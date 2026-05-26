from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Header, HTTPException, status, Query, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import Annotated, Any, Optional
from bson import ObjectId
from datetime import datetime, timezone
from pydantic import BaseModel

from core.config import get_settings
from core.db import close_db, connect_db

from backend.libs import get_logging_settings, setup_logging
from backend.libs.middleware import request_logging_middleware


settings = get_settings()
logger = setup_logging(get_logging_settings(settings.service_name))


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    logger.info("service_startup")
    yield
    logger.info("service_shutdown")
    await close_db()


app = FastAPI(title="chat-service", version="1.0.0", lifespan=lifespan)
app.middleware("http")(request_logging_middleware(logger))
app.add_middleware(CORSMiddleware, allow_origins=get_settings().allowed_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


class MessageCreate(BaseModel):
    conversation_id: str
    content: str


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    content: str
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


def serialize_doc(doc: dict[str, Any]) -> dict[str, Any]:
    if doc is None:
        return {}
    data = doc.copy()
    if "_id" in data:
        data["id"] = str(data.pop("_id"))
    if "created_at" in data and "createdAt" not in data:
        data["createdAt"] = data["created_at"]
    if "sender_id" in data and "senderUsername" not in data:
        data["senderUsername"] = data["sender_id"]
    return data


async def get_current_user_id(authorization: Annotated[str | None, Header()] = None) -> str:
    from jose import JWTError, jwt
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing access token")
    token = authorization[7:]
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "chat-service"}


async def enrich_receiver(receiver_id: str) -> dict[str, str]:
    """Resolve chat participant info.

    Conversations store user IDs. If that user owns a shop, show the shop name/avatar,
    but keep the owner's username for /shop/{username} links.
    """
    import httpx

    settings = get_settings()
    fallback = {
        "id": receiver_id,
        "username": receiver_id,
        "displayName": receiver_id,
        "shopName": "",
        "shopUsername": "",
        "hasShop": False,
        "thumbnailUrl": "",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            user_resp = await client.get(
                f"http://user-service:8002/api/v1/users/internal/{receiver_id}",
                headers={"X-Internal-Key": settings.internal_api_key},
            )
            if user_resp.status_code != 200:
                return fallback

            user_data = user_resp.json()
            username = user_data.get("username") or receiver_id
            user_display_name = (
                user_data.get("fullName")
                or user_data.get("full_name")
                or user_data.get("email")
                or username
                or receiver_id
            )
            receiver = {
                "id": user_data.get("id") or receiver_id,
                "username": username,
                "displayName": user_display_name,
                "shopName": "",
                "shopUsername": "",
                "hasShop": False,
                "thumbnailUrl": user_data.get("thumbnailUrl") or user_data.get("avatarUrl") or user_data.get("avatar") or "",
            }
            user_shop_name = user_data.get("shopName") or ""
            if user_shop_name and user_shop_name != user_display_name:
                receiver["shopName"] = user_shop_name
                receiver["displayName"] = user_shop_name
                receiver["shopUsername"] = username
                receiver["hasShop"] = True

            shop_resp = await client.get(
                f"http://shop-service:8005/api/v1/shops/internal/by-user/{receiver['id']}",
            )
            if shop_resp.status_code == 200:
                shop_data = shop_resp.json()
                if shop_data:
                    shop_name = shop_data.get("name") or shop_data.get("shopName") or ""
                    receiver["shopName"] = shop_name
                    receiver["displayName"] = shop_name or receiver["displayName"]
                    receiver["shopUsername"] = shop_data.get("username") or username
                    receiver["hasShop"] = True
                    receiver["thumbnailUrl"] = shop_data.get("avatarUrl") or receiver["thumbnailUrl"]

            return receiver
    except Exception:
        return fallback


# ========== Root-level endpoints (for /api/v1/chat/* gateway routing) ==========

@app.get("/api/v1/get_unread_rooms")
async def get_unread_rooms(user_id: str = Depends(get_current_user_id)) -> dict[str, Any]:
    from core.db import get_db
    db = get_db()
    conversations = []
    async for doc in db.conversations.find({"participants": user_id, "unread_count": {"$gt": 0}}).sort("updated_at", -1).limit(10):
        conversations.append(serialize_doc(doc))
    return {"content": conversations}


@app.get("/api/v1/get_chatroom")
async def get_chatroom(userId: str = Query(...), authorization: str = Depends(get_current_user_id)) -> dict[str, Any]:
    from core.db import get_db
    db = get_db()
    conv = await db.conversations.find_one({
        "participants": {"$all": [authorization, userId]}
    })

    # Create conversation if not exists
    if not conv:
        conv_data = {
            "participants": [authorization, userId],
            "unread_count": 0,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        result = await db.conversations.insert_one(conv_data)
        conv_data["id"] = str(result.inserted_id)
        conv = conv_data

    serialized = serialize_doc(conv)

    serialized["receiver"] = await enrich_receiver(userId)

    return serialized


@app.get("/api/v1/get_chatroom_list")
async def get_chatroom_list(
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    authorization: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    from core.db import get_db
    db = get_db()
    total = await db.conversations.count_documents({"participants": authorization})
    conversations = []
    cursor = db.conversations.find({"participants": authorization}).sort("updated_at", -1).skip(offset).limit(limit)

    async for doc in cursor:
        conv = serialize_doc(doc)
        # Determine the other participant (receiver)
        participants = conv.get("participants", [])
        receiver_id = None
        for p in participants:
            if p != authorization:
                receiver_id = p
                break

        if receiver_id:
            conv["receiver"] = await enrich_receiver(receiver_id)
        else:
            # No receiver found, create placeholder
            conv["receiver"] = {
                "id": "",
                "username": "",
                "shopName": "Unknown",
                "thumbnailUrl": "",
            }
        conversations.append(conv)
    
    return {
        "content": conversations,
        "total": total,
        "nextOffset": offset + len(conversations),
        "limit": limit,
    }


@app.get("/api/v1/get_messages")
async def get_messages(
    chatroomId: str = Query(...),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> dict[str, Any]:
    from core.db import get_db
    db = get_db()
    messages = []
    cursor = db.messages.find({"conversation_id": chatroomId}).skip(offset).limit(limit).sort("created_at", -1)
    async for doc in cursor:
        messages.append(serialize_doc(doc))
    return {
        "content": messages,
        "nextOffset": offset + len(messages),
    }


@app.post("/api/v1/create_chatroom")
async def create_chatroom(userId: str = Query(...), authorization: str = Depends(get_current_user_id)) -> dict[str, Any]:
    from core.db import get_db
    db = get_db()
    existing = await db.conversations.find_one({
        "participants": {"$all": [authorization, userId]}
    })
    if existing:
        return serialize_doc(existing)
    conv_data = {
        "participants": [authorization, userId],
        "unread_count": 0,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await db.conversations.insert_one(conv_data)
    conv_data["id"] = str(result.inserted_id)
    return serialize_doc(conv_data)


# ========== Prefixed endpoints (for /api/v1/conversations/* and /api/v1/messages/*) ==========

@app.get("/api/v1/conversations")
async def list_conversations(user_id: str = Depends(get_current_user_id)) -> list[dict[str, Any]]:
    from core.db import get_db
    db = get_db()
    conversations = []
    async for doc in db.conversations.find({"participants": user_id}).sort("updated_at", -1):
        conversations.append(serialize_doc(doc))
    return conversations


@app.get("/api/v1/conversations/{conversation_id}/messages")
async def get_conversation_messages(conversation_id: str, page: int = 0, limit: int = 50) -> list[dict[str, Any]]:
    from core.db import get_db
    db = get_db()
    messages = []
    cursor = db.messages.find({"conversation_id": conversation_id}).skip(page * limit).limit(limit).sort("created_at", -1)
    async for doc in cursor:
        messages.append(serialize_doc(doc))
    return messages


@app.post("/api/v1/messages", response_model=MessageResponse)
async def send_message(payload: MessageCreate, user_id: str = Depends(get_current_user_id)) -> dict[str, Any]:
    from core.db import get_db
    db = get_db()
    message_data = payload.model_dump()
    message_data["sender_id"] = user_id
    message_data["created_at"] = datetime.now(timezone.utc)
    result = await db.messages.insert_one(message_data)
    message_data["id"] = str(result.inserted_id)
    created_at = message_data["created_at"].isoformat()
    await db.conversations.update_one({"_id": ObjectId(payload.conversation_id)}, {"$set": {"updated_at": datetime.now(timezone.utc)}})
    return MessageResponse(**serialize_doc(message_data))


# ========== Internal endpoints (for gateway-to-service communication) ==========

class InternalMessageCreate(BaseModel):
    chatroomId: str
    content: str
    type: str = "TEXT"
    senderUsername: Optional[str] = None
    tempId: Optional[str] = None


@app.post("/internal/send_message")
async def internal_send_message(payload: InternalMessageCreate) -> dict[str, Any]:
    """Internal endpoint for gateway to forward messages for persistence."""
    from core.db import get_db
    import httpx

    db = get_db()
    settings = get_settings()

    # sender_username: original plain-string username (matches frontend STOMP subscription)
    # sender_id: resolved UUID for DB storage and participant matching
    sender_username = payload.senderUsername
    sender_id = payload.senderUsername
    if sender_username:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                user_resp = await client.get(
                    f"http://user-service:8002/internal/users/by_username/{sender_username}",
                    headers={"X-Internal-Key": settings.internal_api_key}
                )
                if user_resp.status_code == 200:
                    user_data = user_resp.json()
                    sender_id = user_data.get("id")
        except Exception:
            pass

    # If we couldn't resolve sender_id, return early
    if not sender_id:
        return {"error": "Could not resolve sender"}

    message_data = {
        "conversation_id": payload.chatroomId,
        "content": payload.content,
        "type": payload.type,
        "sender_id": sender_id,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.messages.insert_one(message_data)
    message_data["id"] = str(result.inserted_id)
    created_at = message_data["created_at"].isoformat()
    await db.conversations.update_one(
        {"_id": ObjectId(payload.chatroomId)},
        {"$set": {"updated_at": datetime.now(timezone.utc)}}
    )

    # Notify other participant via chat.queue (use resolved UUID for participant address)
    conv = await db.conversations.find_one({"_id": ObjectId(payload.chatroomId)})
    if conv:
        participants = conv.get("participants", [])
        for participant in participants:
            if participant != sender_id:
                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        await client.post(
                            f"http://gateway:8000/internal/push_message",
                            json={
                                "channel": f"/user/{participant}/chat.queue",
                                "body": {
                                    "id": message_data["id"],
                                    "chatroomId": payload.chatroomId,
                                    "content": payload.content,
                                    "type": payload.type,
                                    "senderUsername": sender_id,
                                    "createdAt": created_at,
                                }
                            }
                        )
                except Exception:
                    pass

    return {"id": message_data["id"], "status": "saved", "createdAt": created_at}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8010, reload=True)
