from datetime import datetime, timezone
from typing import Any, Optional
import json

from bson import ObjectId
from fastapi import APIRouter, Query
import httpx

from core.db import get_db
from core.config import get_settings

router = APIRouter(prefix="/api/v1/homepage", tags=["Homepage"])


def _convert_objectids(value: Any) -> Any:
    """Recursively convert all ObjectId instances to strings."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, dict):
        return {k: _convert_objectids(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_convert_objectids(item) for item in value]
    return value


def serialize_doc(doc: dict[str, Any]) -> dict[str, Any]:
    if doc is None:
        return {}
    data = doc.copy()
    if "_id" in data:
        data["id"] = str(data.pop("_id"))
    return _convert_objectids(data)


async def serialize_product(doc: dict[str, Any], db) -> dict[str, Any]:
    data = serialize_doc(doc)

    if "shop" in data:
        shop_val = data.pop("shop")
        data["shop_id"] = str(shop_val) if isinstance(shop_val, ObjectId) else str(shop_val)
    if "visible" in data:
        data["is_active"] = data.pop("visible")
    if "averageRating" in data:
        data["average_rating"] = data.pop("averageRating")
    if "totalReviews" in data:
        data["total_reviews"] = data.pop("totalReviews")
    if "mediaList" in data:
        media_ids = data.pop("mediaList")
        media_list = []
        for m in media_ids:
            try:
                oid = ObjectId(m) if isinstance(m, str) else m
                media = await db.product_media.find_one({"_id": oid})
                if media:
                    media_list.append({"id": str(media["_id"]), "url": media.get("url", "")})
            except Exception:
                media_list.append({"id": str(m), "url": ""})
        data["media_list"] = media_list
    if "createdAt" in data:
        data["created_at"] = data.pop("createdAt")
    if "updatedAt" in data:
        data["updated_at"] = data.pop("updatedAt")
    if "restrictStatus" in data:
        data.pop("restrictStatus")
    if "restricted" in data:
        data.pop("restricted")
    if "deleted" in data:
        data.pop("deleted")
    if "demoSeed" in data:
        data.pop("demoSeed")
    if "sku_list" in data and isinstance(data["sku_list"], list):
        sku_list = []
        for sku in data["sku_list"]:
            if isinstance(sku, dict):
                sku_id = sku.get("_id", sku.get("id", ""))
                sku_list.append({
                    "id": str(sku_id) if isinstance(sku_id, ObjectId) else str(sku_id),
                    "attributes": sku.get("attributes", []),
                    "price": float(sku.get("price", 0)),
                    "quantity": int(sku.get("quantity", 0)),
                    "skuCode": sku.get("sku_code", ""),
                })
            else:
                sku_list.append(sku)
        data["sku_list"] = sku_list

    data = _convert_objectids(data)

    # Convert snake_case to camelCase for frontend compatibility
    return {
        "id": str(data.get("id", "")),
        "name": data.get("name", ""),
        "description": data.get("description", ""),
        "price": float(data.get("price", 0)),
        "thumbnailUrl": data.get("thumbnailUrl", data.get("thumbnail_url", "")),
        "categoryId": None,
        "shopId": str(data.get("shop_id", "")),
        "quantity": int(data.get("quantity", 0)),
        "sold": int(data.get("sold", 0)),
        "averageRating": float(data.get("average_rating", data.get("averageRating", 0))),
        "totalReviews": int(data.get("total_reviews", data.get("totalReviews", 0))),
        "isActive": bool(data.get("is_active", True)),
        "skuList": data.get("sku_list", []),
        "mediaList": data.get("media_list", []),
        "createdAt": str(data.get("created_at", data.get("createdAt", ""))),
        "updatedAt": str(data.get("updated_at", data.get("updatedAt", ""))),
    }


DEFAULT_SECTIONS = [
    {"sectionKey": "recommendation", "type": "recommendation", "title": "Gợi ý hôm nay", "active": True},
]


@router.get("/get-items")
async def get_items(
    page: int = Query(0, ge=0),
    limit: int = Query(60, ge=1, le=100),
) -> dict[str, Any]:
    db = get_db()

    query: dict[str, Any] = {"visible": {"$ne": False}}
    total = await db.products.count_documents(query)
    cursor = db.products.find(query).sort("createdAt", -1).skip(page * limit).limit(limit)

    products = []
    async for doc in cursor:
        products.append(await serialize_product(doc, db))

    total_pages = (total + limit - 1) // limit if limit else 0

    return {
        "content": products,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
    }


@router.get("/get_sections")
async def get_sections() -> list[dict[str, Any]]:
    return DEFAULT_SECTIONS


@router.get("/search")
async def search(
    sortBy: str = Query("relevance"),
    order: str = Query("desc"),
    page: int = Query(0, ge=0),
    limit: int = Query(12, ge=1, le=100),
) -> dict[str, Any]:
    db = get_db()

    query: dict[str, Any] = {"visible": {"$ne": False}}

    sort_mapping = {
        "sales": "sold",
        "newest": "createdAt",
        "relevance": "createdAt",
        "price": "price",
        "rating": "averageRating",
    }
    sort_field = sort_mapping.get(sortBy, "createdAt")
    sort_order = -1 if order == "desc" else 1

    total = await db.products.count_documents(query)
    cursor = db.products.find(query).sort(sort_field, sort_order).skip(page * limit).limit(limit)

    products = []
    async for doc in cursor:
        products.append(await serialize_product(doc, db))

    total_pages = (total + limit - 1) // limit if limit else 0

    return {
        "content": products,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
    }


@router.get("/get_locations_filter")
async def get_locations_filter() -> list[dict[str, Any]]:
    """Get all provinces for location filter - calls shop-service API with caching."""
    # Try cache first
    cache_key = "cache:locations:provinces"
    try:
        from backend.libs.redis import get_redis_client
        redis_client = get_redis_client()
        cached = redis_client.get(cache_key)
        if cached:
            import json
            return json.loads(cached)
    except Exception:
        pass
    
    # Fallback: call shop-service HTTP API
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{get_settings().shop_service_url}/api/v1/shops/internal/locations/provinces"
            )
            if response.status_code == 200:
                data = response.json()
                # Cache the result
                try:
                    from backend.libs.redis import get_redis_client
                    redis_client = get_redis_client()
                    redis_client.set(cache_key, json.dumps(data), ex=3600)  # 1 hour TTL
                except Exception:
                    pass
                return data
    except Exception:
        pass
    
    return []
