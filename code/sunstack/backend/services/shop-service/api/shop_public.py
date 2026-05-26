from datetime import datetime, timezone
from typing import Annotated, Any, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query
import logging

from core.db import get_db, serialize_doc, build_owner_query
from core.config import get_settings
from backend.libs.redis import get_service_cache

from schemas.shop import (
    ShopCreate,
    ShopListResponse,
    ShopResponse,
    ShopStatus,
    ShopUpdate,
)
from api.helpers import serialize_shop_doc

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=ShopListResponse)
async def list_shops(
    page: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
) -> dict[str, Any]:
    db = get_db()
    query: dict[str, Any] = {"status": ShopStatus.ACTIVE.value}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}

    total = await db.shops.count_documents(query)
    cursor = db.shops.find(query).skip(page * limit).limit(limit).sort("created_at", -1)

    shops = []
    async for doc in cursor:
        shops.append(ShopResponse(**serialize_shop_doc(doc)))

    return {
        "content": [s.model_dump() for s in shops],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/{shop_id}", response_model=ShopResponse)
async def get_shop(
    shop_id: str,
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    db = get_db()
    if not ObjectId.is_valid(shop_id):
        raise HTTPException(status_code=400, detail="Invalid shop ID")
    shop = await db.shops.find_one({"_id": ObjectId(shop_id)})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    is_following = False
    owner_id = str(shop.get("user_id") or shop.get("user") or "")
    if authorization and authorization.lower().startswith("bearer "):
        from jose import JWTError, jwt
        settings = get_settings()
        try:
            payload = jwt.decode(authorization[7:], settings.jwt_secret, algorithms=["HS256"])
            current_user_id = payload.get("sub")
            if current_user_id and current_user_id != owner_id:
                try:
                    import httpx
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        response = await client.get(
                            f"{settings.user_service_url}/internal/users/{current_user_id}/following",
                            headers={"X-Internal-Key": settings.internal_api_key},
                        )
                        if response.status_code == 200:
                            following = response.json()
                            is_following = any(
                                (f.get("shop_id") == shop_id or f.get("shopId") == shop_id)
                                for f in following
                            )
                except Exception:
                    pass
        except JWTError:
            pass

    data = serialize_shop_doc(shop)
    data["is_following"] = is_following
    data["following"] = is_following
    return data


@router.get("/internal/{shop_id}")
async def get_shop_internal(shop_id: str) -> dict[str, Any]:
    db = get_db()
    if not ObjectId.is_valid(shop_id):
        raise HTTPException(status_code=400, detail="Invalid shop ID")
    shop = await db.shops.find_one({"_id": ObjectId(shop_id)})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    return {
        "id": str(shop.get("_id")),
        "name": shop.get("name"),
        "username": shop.get("username"),
        "avatarUrl": shop.get("avatarUrl"),
        "user_id": str(shop.get("user_id") or shop.get("user") or ""),
    }


@router.get("/internal/by-user/{user_id}")
async def get_shop_by_user_internal(user_id: str) -> dict[str, Any] | None:
    logger.info(f"get_shop_by_user_internal called with user_id: {user_id}")
    db = get_db()

    shop = await db.shops.find_one(build_owner_query(user_id))
    logger.info(f"Shop query result: {shop}")

    if not shop:
        logger.warning(f"No shop found for user_id: {user_id}")
        return None
    return {
        "id": str(shop.get("_id")),
        "name": shop.get("name"),
        "username": shop.get("username"),
        "avatarUrl": shop.get("avatarUrl"),
        "user_id": str(shop.get("user_id") or shop.get("user") or ""),
        "createdAt": shop.get("createdAt", ""),
    }


@router.get("/internal/locations/provinces")
async def get_provinces_internal() -> list[dict[str, Any]]:
    db = get_db()
    provinces = []
    async for doc in db.provinces.find({}).sort("name", 1):
        data = doc.copy()
        if "_id" in data:
            data["id"] = str(data.pop("_id"))
        provinces.append(data)
    return provinces


@router.get("/internal/locations/districts")
async def get_districts_internal(provinceId: int = Query(...)) -> list[dict[str, Any]]:
    db = get_db()
    districts = []
    async for doc in db.districts.find({"provinceId": provinceId}).sort("name", 1):
        data = doc.copy()
        if "_id" in data:
            data["id"] = str(data.pop("_id"))
        districts.append(data)
    return districts


@router.get("/internal/locations/wards")
async def get_wards_internal(districtId: int = Query(...)) -> list[dict[str, Any]]:
    db = get_db()
    wards = []
    async for doc in db.wards.find({"districtId": districtId}).sort("name", 1):
        data = doc.copy()
        if "_id" in data:
            data["id"] = str(data.pop("_id"))
        wards.append(data)
    return wards


@router.get("/user/{user_id}", response_model=list[ShopResponse])
async def get_shops_by_user(user_id: str) -> list[dict[str, Any]]:
    db = get_db()
    shops = []
    async for doc in db.shops.find(build_owner_query(user_id)):
        shops.append(ShopResponse(**serialize_shop_doc(doc)))
    return [s.model_dump() for s in shops]


@router.post("", response_model=ShopResponse)
async def create_shop(
    payload: ShopCreate,
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    from api.helpers import get_current_user_id
    
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    db = get_db()
    from api.helpers import find_owned_shop
    existing = await find_owned_shop(user_id)
    if existing:
        raise HTTPException(status_code=400, detail="User already has a shop")

    shop_data = payload.model_dump()
    shop_data["user_id"] = user_id
    if ObjectId.is_valid(user_id):
        shop_data["user"] = ObjectId(user_id)
    shop_data["status"] = ShopStatus.ACTIVE.value
    shop_data["product_count"] = 0
    shop_data["follower_count"] = 0
    shop_data["average_rating"] = 0
    shop_data["total_rating"] = 0
    shop_data["created_at"] = datetime.now(timezone.utc)
    shop_data["updated_at"] = datetime.now(timezone.utc)

    result = await db.shops.insert_one(shop_data)
    shop_id = str(result.inserted_id)
    shop_data["id"] = shop_id

    try:
        cache = get_service_cache()
        cache.publish_shop_update(shop_id, "create", serialize_doc(shop_data))
    except Exception:
        pass

    return ShopResponse(**serialize_doc(shop_data))


@router.put("/{shop_id}", response_model=ShopResponse)
async def update_shop(
    shop_id: str,
    payload: ShopUpdate,
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    from api.helpers import get_current_user_id
    
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    if not ObjectId.is_valid(shop_id):
        raise HTTPException(status_code=400, detail="Invalid shop ID")

    db = get_db()
    shop = await db.shops.find_one({"_id": ObjectId(shop_id), "user_id": user_id})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found or not owned")

    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)

    result = await db.shops.find_one_and_update(
        {"_id": ObjectId(shop_id)},
        {"$set": update_data},
        return_document=True,
    )

    try:
        cache = get_service_cache()
        cache.publish_shop_update(shop_id, "update", serialize_doc(result))
    except Exception:
        pass

    return ShopResponse(**serialize_doc(result))


@router.get("/{shop_id}/followers")
async def get_shop_followers(
    shop_id: str,
    page: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    db = get_db()
    cursor = db.follows.find({"shop_id": shop_id}).skip(page * limit).limit(limit)
    followers = []
    async for doc in cursor:
        followers.append({"user_id": doc.get("user_id"), "created_at": doc.get("created_at")})
    total = await db.follows.count_documents({"shop_id": shop_id})
    return {"content": followers, "total": total, "page": page, "limit": limit}


@router.get("/{shop_id}/vouchers")
async def get_shop_vouchers(shop_id: str) -> list[dict[str, Any]]:
    db = get_db()
    now = datetime.now(timezone.utc)
    vouchers = []
    cursor = db.vouchers.find({
        "shop_id": shop_id,
        "start_date": {"$lte": now},
        "end_date": {"$gte": now},
    }).limit(10)
    async for doc in cursor:
        vouchers.append(serialize_doc(doc))
    return vouchers
