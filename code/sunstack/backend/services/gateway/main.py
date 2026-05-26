from contextlib import asynccontextmanager
import asyncio
import json
import websockets
from fastapi import FastAPI, Request, Response, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx

from core.config import get_settings
from ws_manager import ws_manager

from backend.libs import get_logging_settings, setup_logging, RetryConfig, retry_async
from backend.libs.middleware import request_logging_middleware


settings = get_settings()
logger = setup_logging(get_logging_settings(settings.service_name))


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("service_startup")
    yield
    logger.info("service_shutdown")


app = FastAPI(title="API Gateway", version="1.0.0", lifespan=lifespan)
app.middleware("http")(request_logging_middleware(logger))
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SERVICE_ROUTES = {
    "/api/v1/auth": settings.auth_service_url,
    "/oauth2": settings.auth_service_url,
    "/login/oauth2": settings.auth_service_url,
    "/api/v1/users": settings.user_service_url,
    "/api/v1/user": settings.user_service_url,
    "/api/v1/product": settings.product_service_url,
    "/api/v1/products": settings.product_service_url,
    "/api/v1/orders": settings.order_service_url,
    "/api/v1/order": settings.order_service_url,
    "/api/v1/shop": settings.shop_service_url,
    "/api/v1/shops": settings.shop_service_url,
    "/api/v1/payment": settings.payment_service_url,
    "/api/v1/conversations": settings.chat_service_url,
    "/api/v1/messages": settings.chat_service_url,
    "/api/v1/upload": settings.upload_service_url,
    "/api/v1/homepage": settings.product_service_url,
    "/api/v1/chat": settings.chat_service_url,
    "/api/v1/cart": settings.order_service_url,
    "/api/v1/checkout": settings.order_service_url,
    "/api/v1/shopinfo": settings.product_service_url,
    "/api/v1/common": settings.product_service_url,
    "/api/v1/address": settings.user_service_url,
}

# Path translations: frontend path → service path (for routes that need renaming)
ROUTE_TRANSLATIONS = {
    "/oauth2": "/api/v1/auth/oauth2",
    "/login/oauth2": "/api/v1/auth/login/oauth2",
    "/api/v1/chat": "/api/v1",
    "/api/v1/order": "/api/v1/orders",
}


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "gateway"}


class PushMessageRequest(BaseModel):
    channel: str
    body: dict


@app.post("/internal/push_message")
async def push_message(payload: PushMessageRequest):
    """Internal endpoint for services to push messages to WebSocket clients."""
    try:
        body_json = json.dumps(payload.body)
        await ws_manager.send_to_channel(payload.channel, body_json)
        logger.info("ws_push channel=%s size=%s", payload.channel, len(body_json))
        return {"status": "ok"}
    except Exception as e:
        logger.error("ws_push_failed err=%s", e)
        return JSONResponse(status_code=500, content={"detail": str(e)})


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy(path: str, request: Request):
    matched_service = None
    matched_route = None

    full_path = f"/{path}"

    for route, service_url in SERVICE_ROUTES.items():
        if full_path.startswith(route):
            if matched_service is None or len(route) > len(matched_route):
                matched_service = service_url
                matched_route = route

    if not matched_service:
        return JSONResponse(
            status_code=404,
            content={"detail": f"No service found for path: /{path}"}
        )

    # Services that have endpoints with full /api/v1/... paths directly on the app object.
    # Gateway should pass the FULL path (including /api/v1) to these services.
    NO_STRIP_PREFIX_SERVICES = {
        "/oauth2",
        "/login/oauth2",
        "/api/v1/auth",
        "/api/v1/homepage",
        "/api/v1/conversations",
        "/api/v1/messages",
        "/api/v1/upload",
        "/api/v1/users",
        "/api/v1/product",
        "/api/v1/products",
        "/api/v1/orders",
        "/api/v1/order",
        "/api/v1/shop",
        "/api/v1/shops",
        "/api/v1/payment",
        "/api/v1/cart",
        "/api/v1/checkout",
        "/api/v1/chat",
        "/api/v1/user",
        "/api/v1/shopinfo",
        "/api/v1/common",
        "/api/v1/address",
    }

    translated_path = full_path
    for old_route, new_route in ROUTE_TRANSLATIONS.items():
        if full_path == old_route or full_path.startswith(f"{old_route}/"):
            translated_path = full_path.replace(old_route, new_route, 1)
            break

    target_url = f"{matched_service}{translated_path}"

    logger.info("proxy method=%s path=%s target=%s", request.method, full_path, target_url)

    try:
        body = await request.body()
        headers = dict(request.headers)
        headers.pop("host", None)

        async def _do_request() -> httpx.Response:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client:
                return await client.request(
                    method=request.method,
                    url=target_url,
                    headers=headers,
                    content=body if body else None,
                    params=request.query_params,
                )

        def _is_retryable_exc(e: BaseException) -> bool:
            return isinstance(
                e,
                (
                    httpx.ConnectError,
                    httpx.ReadTimeout,
                    httpx.RemoteProtocolError,
                    httpx.PoolTimeout,
                ),
            )

        def _on_retry(attempt: int, err: BaseException, delay_s: float) -> None:
            logger.warning(
                "proxy_retry attempt=%s delay_s=%.2f target=%s err=%s",
                attempt,
                delay_s,
                target_url,
                err,
            )

        response = await retry_async(
            _do_request,
            cfg=RetryConfig(max_attempts=2, base_delay_s=0.15, max_delay_s=0.5, jitter_s=0.05),
            is_retryable_exc=_is_retryable_exc,
            on_retry=_on_retry,
        )

        logger.info("proxy_response target=%s status=%s", target_url, response.status_code)
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=dict(response.headers),
        )
    except httpx.ConnectError as e:
        logger.error("proxy_connect_error target=%s err=%s", target_url, e)
        return JSONResponse(
            status_code=503,
            content={"detail": f"Cannot connect to service: {str(e)}", "target_url": target_url}
        )
    except httpx.RequestError as e:
        logger.error("proxy_request_error target=%s err=%s", target_url, e)
        return JSONResponse(
            status_code=503,
            content={"detail": f"Service request failed: {str(e)}", "target_url": target_url}
        )
    except Exception as e:
        logger.error("proxy_internal_error target=%s err=%s", target_url, e)
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}", "target_url": target_url}
        )


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    logger.info("ws_accept client=%s", websocket.client)

    subprotocol = websocket.headers.get("sec-websocket-protocol", "")
    logger.info("ws_subprotocol_requested value=%s", subprotocol)

    protocols = [p.strip() for p in subprotocol.split(",")] if subprotocol else []
    selected_protocol = None
    for p in protocols:
        if "stomp" in p.lower():
            selected_protocol = p
            break

    if selected_protocol:
        await websocket.accept(subprotocol=selected_protocol)
        logger.info("ws_accepted subprotocol=%s", selected_protocol)
    else:
        await websocket.accept()
        logger.info("ws_accepted")

    await ws_manager.connect(websocket)

    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
            except asyncio.TimeoutError:
                logger.info("ws_idle")
                continue
            except websockets.exceptions.ConnectionClosedOK:
                logger.info("ws_closed_ok")
                break
            except websockets.exceptions.ConnectionClosedError as e:
                logger.info("ws_closed_error err=%s", e)
                break
            except Exception as e:
                logger.error("ws_receive_error err=%s", e)
                break

            lines = raw.rstrip("\x00\n").split("\n")
            if not lines:
                continue

            frame_type = lines[0].strip()
            headers: dict[str, str] = {}

            body_start = 1
            for i in range(1, len(lines)):
                if lines[i] == "":
                    body_start = i + 1
                    break
                if ":" in lines[i]:
                    key, val = lines[i].split(":", 1)
                    headers[key.strip()] = val.strip()

            body = "\n".join(lines[body_start:]) if body_start < len(lines) else ""

            destination = headers.get("destination", "")
            logger.info("ws_frame type=%s destination=%s body_size=%s", frame_type, destination, len(body))

            await ws_manager.relay(websocket, frame_type, headers, body)

    except WebSocketDisconnect:
        logger.info("ws_disconnect")
        await ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error("ws_error err=%s", e)
        await ws_manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=settings.service_port, reload=True)
