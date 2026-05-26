from datetime import datetime, timezone
from typing import Annotated, Any, Optional
from bson import ObjectId
from fastapi import Header
import logging

from core.db import get_db, serialize_doc, build_owner_query
from core.config import get_settings

logger = logging.getLogger(__name__)


def serialize_shop_doc(doc: dict[str, Any]) -> dict[str, Any]:
    data = serialize_doc(doc)
    owner_id = data.get("user_id") or data.get("user")
    if isinstance(owner_id, ObjectId):
        owner_id = str(owner_id)

    return {
        **data,
        "user_id": str(owner_id or ""),
        "avatar_url": data.get("avatar_url") or data.get("avatarUrl"),
        "cover_image_url": data.get("cover_image_url") or data.get("coverImageUrl"),
        "product_count": data.get("product_count", data.get("productCount", 0)),
        "follower_count": data.get("follower_count", data.get("followerCount", 0)),
        "average_rating": data.get("average_rating", data.get("averageRating", 0)),
        "total_rating": data.get("total_rating", data.get("totalReviews", data.get("totalRating", 0))),
        "created_at": data.get("created_at") or data.get("createdAt"),
        "updated_at": data.get("updated_at") or data.get("updatedAt"),
    }


async def get_current_user_id(
    authorization: Annotated[str | None, Header()] = None,
) -> Optional[str]:
    from jose import JWTError, jwt

    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization[7:]

    settings = get_settings()

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return payload.get("sub")
    except JWTError:
        return None


async def get_or_create_shop(user_id: str) -> dict[str, Any]:
    from fastapi import HTTPException, status
    shop = await find_owned_shop(user_id)
    if not shop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop not found")
    return serialize_doc(shop)


async def find_owned_shop(user_id: str) -> Optional[dict[str, Any]]:
    db = get_db()
    return await db.shops.find_one(build_owner_query(user_id))
