"""
Internal API endpoints for user-service
Used by other services to query user data without direct database access
"""
from typing import Annotated, Any, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query

from core.db import get_db
from core.config import get_settings

router = APIRouter(prefix="/internal", tags=["Internal Users"])


def serialize_doc(doc: dict[str, Any]) -> dict[str, Any]:
    if doc is None:
        return {}
    data = doc.copy()
    if "_id" in data:
        data["id"] = str(data.pop("_id"))
    if "password" in data:
        del data["password"]
    return data


async def verify_internal_key(x_internal_key: Annotated[str | None, Header()] = None) -> bool:
    """Verify internal API key for inter-service communication."""
    settings = get_settings()
    if not x_internal_key or x_internal_key != settings.internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid internal API key"
        )
    return True


@router.get("/users/{user_id}")
async def get_user_by_id(
    user_id: str,
    x_internal_key: Annotated[str | None, Header()] = None,
) -> Optional[dict[str, Any]]:
    """Get user by ID (used by other services)."""
    await verify_internal_key(x_internal_key)
    
    db = get_db()
    try:
        if ObjectId.is_valid(user_id):
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        else:
            user = await db.users.find_one({"username": user_id})
    except Exception:
        user = None
    
    if not user:
        return None
    
    return serialize_doc(user)


@router.get("/users/by_username/{username}")
async def get_user_by_username(
    username: str,
    x_internal_key: Annotated[str | None, Header()] = None,
) -> Optional[dict[str, Any]]:
    """Get user by username (used by other services)."""
    await verify_internal_key(x_internal_key)
    
    db = get_db()
    user = await db.users.find_one({"username": username})
    
    if not user:
        return None
    
    return serialize_doc(user)


@router.get("/users/batch")
async def get_users_batch(
    user_ids: str = Query(..., description="Comma-separated user IDs"),
    x_internal_key: Annotated[str | None, Header()] = None,
) -> list[dict[str, Any]]:
    """Get multiple users by IDs (used by other services)."""
    await verify_internal_key(x_internal_key)
    
    db = get_db()
    ids = []
    for uid in user_ids.split(","):
        uid = uid.strip()
        if ObjectId.is_valid(uid):
            ids.append(ObjectId(uid))
    
    users = []
    async for doc in db.users.find({"_id": {"$in": ids}}):
        users.append(serialize_doc(doc))
    
    return users


@router.get("/users/{user_id}/following")
async def get_user_following(
    user_id: str,
    x_internal_key: Annotated[str | None, Header()] = None,
) -> list[dict[str, Any]]:
    """Get list of shops user is following (used by other services)."""
    await verify_internal_key(x_internal_key)
    
    db = get_db()
    follows = []
    async for doc in db.follows.find({"user_id": user_id}):
        follows.append({
            "user_id": doc.get("user_id"),
            "shop_id": doc.get("shop_id"),
            "created_at": str(doc.get("created_at", "")),
        })
    
    return follows


@router.get("/users/{user_id}/addresses")
async def get_user_addresses(
    user_id: str,
    x_internal_key: Annotated[str | None, Header()] = None,
) -> list[dict[str, Any]]:
    """Get user addresses (used by other services)."""
    await verify_internal_key(x_internal_key)
    
    db = get_db()
    addresses = []
    async for doc in db.user_addresses.find({"user_id": user_id}):
        addresses.append(serialize_doc(doc))
    
    return addresses
