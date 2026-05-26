import logging
import httpx
from typing import Any

logger = logging.getLogger(__name__)


class WebSocketManager:
    """
    Lightweight in-memory STOMP-over-WebSocket relay.
    Clients connect via WebSocket and send STOMP frames.
    Server handles CONNECT, SUBSCRIBE, UNSUBSCRIBE, and SEND frames.
    Messages are routed to subscribers in-memory (no external broker needed).
    """

    def __init__(self):
        # channel -> set of websocket connections
        self._subscriptions: dict[str, set[Any]] = {}
        # connection -> set of subscribed channels
        self._conn_channels: dict[Any, set[str]] = {}
        # connection -> username (extracted from JWT in CONNECT frame)
        self._conn_username: dict[Any, str] = {}

    async def connect(self, websocket: Any) -> None:
        self._conn_channels[websocket] = set()
        logger.info(f"WS client connected: {websocket.client}")

    async def disconnect(self, websocket: Any) -> None:
        self._conn_username.pop(websocket, None)
        channels = self._conn_channels.pop(websocket, set())
        for ch in channels:
            subs = self._subscriptions.get(ch, set())
            subs.discard(websocket)
            if not subs:
                self._subscriptions.pop(ch, None)
        logger.info(f"WS client disconnected: {websocket.client}")

    async def relay(self, websocket: Any, frame_type: str, headers: dict[str, str], body: str) -> None:
        logger.info(f"WS frame received: {frame_type} from {websocket.client}")
        if frame_type in ("CONNECT", "STOMP"):
            # Extract username from JWT token in Authorization header
            auth_header = headers.get("Authorization", "")
            if auth_header.lower().startswith("bearer "):
                token = auth_header[7:]
                try:
                    import json, base64
                    payload_b64 = token.split(".")[1]
                    # Add padding if needed
                    padding = 4 - len(payload_b64) % 4
                    if padding != 4:
                        payload_b64 += "=" * padding
                    payload = json.loads(base64.b64decode(payload_b64))
                    username = payload.get("sub") or payload.get("username")
                    if username:
                        self._conn_username[websocket] = username
                        logger.info(f"WS client identified as username: {username}")
                except Exception:
                    pass

            response = "CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\x00"
            logger.info(f"WS: Sending CONNECTED response")
            await websocket.send_text(response)
            logger.info(f"WS: CONNECTED response sent")
            logger.info(f"WS client authenticated: {websocket.client}")

        elif frame_type == "SUBSCRIBE":
            channel = headers.get("destination", "")
            if channel not in self._subscriptions:
                self._subscriptions[channel] = set()
            self._subscriptions[channel].add(websocket)
            if channel not in self._conn_channels[websocket]:
                self._conn_channels[websocket].add(channel)
            logger.info(f"WS client subscribed to: {channel}")

        elif frame_type == "UNSUBSCRIBE":
            channel = headers.get("destination", "")
            if channel in self._subscriptions:
                self._subscriptions[channel].discard(websocket)
                if not self._subscriptions[channel]:
                    self._subscriptions.pop(channel)
            if channel in self._conn_channels.get(websocket, set()):
                self._conn_channels[websocket].discard(channel)
            logger.info(f"WS client unsubscribed from: {channel}")

        elif frame_type == "SEND":
            channel = headers.get("destination", "")
            await self._broadcast(channel, body, headers)
            logger.debug(f"WS message sent to {channel}: {body[:100]}")

            # Forward message to chat-service for persistence
            if channel == "/app/send_message":
                await self._forward_to_chat_service(body, headers, sender_websocket=websocket)

        elif frame_type == "DISCONNECT":
            await self.disconnect(websocket)
            logger.info(f"WS client disconnected: {websocket.client}")

    async def _broadcast(self, channel: str, body: str, headers: dict[str, str], subscription_id: str | None = None) -> None:
        subscribers = self._subscriptions.get(channel, set())
        if not subscription_id:
            parts = channel.rstrip("/").split("/")
            subscription_id = parts[-1] if parts else "default"
        for sub in list(subscribers):
            try:
                frame_headers = [f"subscription:{subscription_id}"]
                for k, v in headers.items():
                    if k not in ("destination", "content-type", "content-length"):
                        frame_headers.append(f"{k}:{v}")
                frame = f"MESSAGE\n" + "\n".join(frame_headers) + f"\n\n{body}\x00"
                await sub.send_text(frame)
            except Exception:
                pass

    async def _forward_to_chat_service(self, body: str, headers: dict[str, str], sender_websocket: Any | None = None) -> None:
        """Forward message to chat-service for persistence, then push reply directly to sender."""
        import json
        try:
            message_data = json.loads(body)
            if not message_data.get("senderUsername") and sender_websocket is not None:
                message_data["senderUsername"] = self._conn_username.get(sender_websocket)
            auth_header = headers.get("Authorization", "")
            request_headers = {"Content-Type": "application/json"}
            if auth_header:
                request_headers["Authorization"] = auth_header
            saved_message: dict[str, Any] = {}
            delivered = False
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "http://chat-service:8010/internal/send_message",
                    json=message_data,
                    headers=request_headers
                )
                logger.info(f"WS message forwarded to chat-service: {resp.status_code}")
                if resp.is_success:
                    saved_message = resp.json()
                    delivered = not saved_message.get("error")

            # Push reply signal directly back to the sender websocket.
            if sender_websocket is not None:
                reply_payload = {
                    "id": saved_message.get("id"),
                    "tempId": message_data.get("tempId"),
                    "chatroomId": message_data.get("chatroomId"),
                    "type": message_data.get("type", "TEXT"),
                    "content": message_data.get("content", ""),
                    "createdAt": saved_message.get("createdAt"),
                    "status": "sent" if delivered else "failed",
                }
                sender_username = self._conn_username.get(sender_websocket)
                frame_headers = ["subscription:chat.reply", "content-type:application/json"]
                for k, v in headers.items():
                    if k not in ("destination", "content-type", "content-length"):
                        frame_headers.append(f"{k}:{v}")
                frame = "MESSAGE\n" + "\n".join(frame_headers) + f"\n\n{json.dumps(reply_payload)}\x00"
                try:
                    await sender_websocket.send_text(frame)
                    logger.info(f"Reply pushed directly to sender ({sender_username})")
                except Exception as e:
                    logger.error(f"Failed to push reply to sender: {e}")
        except Exception as e:
            logger.error(f"Failed to forward message to chat-service: {e}")

    async def _send_to_user(self, username: str, channel: str, body: str, extra_headers: dict[str, str] | None = None) -> None:
        """Send a STOMP MESSAGE frame directly to a specific user by username."""
        target_channel = f"/user/{username}{channel}"
        subscribers = self._subscriptions.get(target_channel, set())
        for sub in list(subscribers):
            try:
                parts = channel.rstrip("/").split("/")
                subscription_id = parts[-1] if parts else "default"
                frame_headers = [f"subscription:{subscription_id}"]
                if extra_headers:
                    for k, v in extra_headers.items():
                        if k not in ("destination", "content-type", "content-length"):
                            frame_headers.append(f"{k}:{v}")
                frame = f"MESSAGE\n" + "\n".join(frame_headers) + f"\n\n{body}\x00"
                await sub.send_text(frame)
                logger.info(f"Sent reply to {target_channel}")
            except Exception as e:
                logger.error(f"Failed to send reply to {username}: {e}")

    async def send_to_channel(self, channel: str, body: str, headers: dict[str, str] | None = None) -> None:
        """Called by services (e.g. chat-service) to push a message to a channel."""
        # channel format: /user/{username}/chat.reply or /user/{userId}/chat.queue
        await self._broadcast(channel, body, headers or {})


ws_manager = WebSocketManager()
