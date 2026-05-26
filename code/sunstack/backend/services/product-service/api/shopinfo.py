from datetime import datetime, timezone
from typing import Annotated, Any, Optional

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException, Query, status
import httpx

from core.db import get_db
from core.config import get_settings

router = APIRouter(prefix="/api/v1/shopinfo", tags=["Shop Info"])


def serialize_doc(doc: dict[str, Any]) -> dict[str, Any]:
    if doc is None:
        return {}
    data: dict[str, Any] = {}
    for key, value in doc.items():
        if key == "_id":
            data["id"] = str(value)
        elif isinstance(value, ObjectId):
            data[key] = str(value)
        else:
            data[key] = value
    return data


async def _get_user_by_username(username: str) -> dict[str, Any] | None:
    """Get user info from user-service by username."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{get_settings().user_service_url}/api/v1/users/internal/username/{username}"
            )
            if response.status_code == 200:
                return response.json()
    except Exception:
        pass
    return None


async def _get_shop_by_user_id(user_id: str) -> dict[str, Any] | None:
    """Get shop info by user ID - uses cache first, then falls back to shop-service HTTP call."""
    # Try cache first
    try:
        from backend.libs.redis import get_service_cache
        cache = get_service_cache()
        shop_id = cache.get_shop_id_by_user(user_id)
        if shop_id:
            shop = cache.get_shop(shop_id)
            if shop:
                return shop
    except Exception:
        pass
    
    # Fallback: call shop-service HTTP API
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{get_settings().shop_service_url}/api/v1/shops/internal/by-user/{user_id}"
            )
            if response.status_code == 200:
                return response.json()
    except Exception:
        pass
    return None


async def _check_follow_status(user_id: str, shop_id: str) -> bool:
    """Check if user follows a shop via user-service."""
    print(f"[DEBUG] _check_follow_status called - user_id: {user_id}, shop_id: {shop_id}")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{get_settings().user_service_url}/internal/users/{user_id}/following",
                headers={"X-Internal-Key": get_settings().internal_api_key}
            )
            print(f"[DEBUG] _check_follow_status - response status: {response.status_code}")
            if response.status_code == 200:
                following = response.json()
                print(f"[DEBUG] _check_follow_status - following list: {following}")
                result = any(f.get("shop_id") == shop_id for f in following)
                print(f"[DEBUG] _check_follow_status - result: {result}")
                return result
            print(f"[DEBUG] _check_follow_status - non-200 response")
    except Exception as e:
        print(f"[DEBUG] _check_follow_status - exception: {e}")
        pass
    return False


@router.get("/get_info")
async def get_shop_info(
    username: str = Query(...),
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    db = get_db()
    settings = get_settings()

    # Find user by username via user-service
    user = None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.user_service_url}/api/v1/users/internal/username/{username}"
            )
            if response.status_code == 200:
                user = response.json()
    except Exception:
        pass

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop not found")

    user_id = user.get("id")

    # Find shop by user via shop-service
    shop = await _get_shop_by_user_id(user_id)
    if not shop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop not found")

    shop_id = shop.get("id")

    # Count products for this shop
    product_count = await db.products.count_documents({
        "shop": ObjectId(shop_id),
        "visible": {"$ne": False},
        "deleted": {"$ne": True},
    })

    # Check if current user has followed this shop
    is_following = False
    current_user_id = None
    if authorization and authorization.lower().startswith("bearer "):
        from jose import JWTError, jwt
        try:
            payload = jwt.decode(authorization[7:], settings.jwt_secret, algorithms=["HS256"])
            current_user_id = payload.get("sub")
            print(f"[DEBUG] JWT decoded - user_id: {current_user_id}, shop_id: {shop_id}")
            if current_user_id:
                is_following = await _check_follow_status(current_user_id, shop_id)
                print(f"[DEBUG] is_following result: {is_following}")
        except JWTError as e:
            print(f"[DEBUG] JWT decode error: {e}")
            pass
    else:
        print(f"[DEBUG] No authorization header present")

    return {
        "id": shop_id,
        "userId": user_id,
        "name": shop.get("name", ""),
        "avatarUrl": shop.get("avatarUrl", ""),
        "following": is_following,
        "followerCount": shop.get("followerCount", shop.get("follower_count", 0)),
        "productCount": product_count or shop.get("productCount", shop.get("product_count", 0)),
        "averageRating": shop.get("averageRating", shop.get("average_rating", 0)),
        "totalReviews": shop.get("totalReviews", shop.get("total_reviews", 0)),
        "createdAt": shop.get("createdAt", ""),
    }


@router.get("/get_product_list")
async def get_shop_product_list(
    shopId: str = Query(...),
    sortBy: str = Query("popular"),
    order: str = Query("desc"),
    page: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> dict[str, Any]:
    db = get_db()

    query: dict[str, Any] = {
        "shop": ObjectId(shopId),
        "visible": {"$ne": False},
        "deleted": {"$ne": True},
    }

    sort_field = "sold"
    if sortBy == "price":
        sort_field = "price"
    elif sortBy == "rating":
        sort_field = "averageRating"
    elif sortBy == "newest":
        sort_field = "createdAt"
    sort_direction = -1 if order == "desc" else 1

    total = await db.products.count_documents(query)
    cursor = db.products.find(query).sort(sort_field, sort_direction).skip(page * limit).limit(limit)

    products = []
    async for doc in cursor:
        data = serialize_doc(doc)
        products.append({
            "id": data.get("id", ""),
            "name": data.get("name", ""),
            "thumbnailUrl": data.get("thumbnailUrl") or data.get("thumbnail_url", ""),
            "price": data.get("price", 0),
            "sold": data.get("sold", 0),
            "averageRating": data.get("averageRating", 0),
            "totalReviews": data.get("totalReviews", 0),
            "quantity": data.get("quantity", 0),
        })

    total_pages = (total + limit - 1) // limit if limit else 0
    return {
        "content": products,
        "totalPages": total_pages,
        "numberOfElements": total,
        "page": page,
        "limit": limit,
    }
