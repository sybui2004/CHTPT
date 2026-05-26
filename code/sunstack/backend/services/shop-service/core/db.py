from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from core.config import get_settings

client: AsyncIOMotorClient | None = None


def serialize_doc(doc: dict[str, Any]) -> dict[str, Any]:
    """Convert MongoDB document to serializable dict."""
    if doc is None:
        return {}
    data = doc.copy()
    if "_id" in data:
        data["id"] = str(data.pop("_id"))
    if isinstance(data.get("user"), ObjectId):
        data["user"] = str(data["user"])
    return data


def build_owner_query(user_id: str) -> dict[str, Any]:
    """Build MongoDB query to find shops owned by a user (supports multiple ID formats)."""
    owner_values: list[Any] = [user_id]
    if ObjectId.is_valid(user_id):
        owner_values.append(ObjectId(user_id))
    return {
        "$or": [
            {"user": {"$in": owner_values}},
            {"user_id": {"$in": owner_values}},
            {"owner_id": {"$in": owner_values}},
        ]
    }


async def connect_db() -> None:
    global client
    if client is None:
        client = AsyncIOMotorClient(get_settings().mongo_uri)


async def close_db() -> None:
    global client
    if client is not None:
        client.close()
        client = None


def get_db() -> AsyncIOMotorDatabase:
    if client is None:
        raise RuntimeError("MongoDB client is not initialized")
    return client[get_settings().mongo_database]
