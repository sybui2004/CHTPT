from datetime import datetime, timezone
from typing import Annotated, Any, Optional

from bson import DBRef, ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
import httpx

from core.db import get_db
from core.config import get_settings
from schemas.product import (
    ProductCreate,
    ProductListResponse,
    ProductResponse,
    ProductUpdate,
    SKUSchema,
)

router = APIRouter(prefix="/api/v1/products", tags=["Products"])
legacy_router = APIRouter(prefix="/api/v1/product", tags=["Product"])


def _as_object_id(value: Any) -> ObjectId | None:
    if isinstance(value, DBRef):
        value = value.id
    if isinstance(value, ObjectId):
        return value
    if isinstance(value, str) and ObjectId.is_valid(value):
        return ObjectId(value)
    return None


def _convert_objectids(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, DBRef):
        return str(value.id)
    if isinstance(value, dict):
        return {key: _convert_objectids(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_convert_objectids(item) for item in value]
    return value


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


async def deref(db, collection: str, ref: Any) -> dict[str, Any] | None:
    oid = _as_object_id(ref)
    if oid is None:
        return None
    return await db[collection].find_one({"_id": oid})


async def deref_many(db, collection: str, refs: list[Any] | None) -> list[dict[str, Any]]:
    docs = []
    for ref in refs or []:
        doc = await deref(db, collection, ref)
        if doc:
            docs.append(_convert_objectids(doc))
    return docs


def build_variation_display(sku_list: list[dict[str, Any]]) -> list[dict[str, Any]]:
    variations: dict[str, dict[str, int]] = {}
    for sku in sku_list:
        quantity = int(sku.get("quantity", 0) or 0)
        for attr in sku.get("attributes") or []:
            name = attr.get("name")
            value = attr.get("value")
            if not name or value is None:
                continue
            variations.setdefault(name, {})
            variations[name][value] = variations[name].get(value, 0) + quantity

    return [
        {
            "name": name,
            "variationOptions": [
                {"value": value, "available": quantity > 0}
                for value, quantity in options.items()
            ],
        }
        for name, options in variations.items()
    ]


def same_attributes(sku_attributes: list[dict[str, Any]], selected: list[dict[str, Any]]) -> bool:
    if len(sku_attributes) != len(selected):
        return False
    selected_map = {attr.get("name"): attr.get("value") for attr in selected}
    return all(selected_map.get(attr.get("name")) == attr.get("value") for attr in sku_attributes)


async def _get_shop_info(shop_id: str) -> dict[str, Any] | None:
    """Get shop info by shop ID - uses cache first, then falls back to shop-service HTTP call."""
    # Try cache first
    try:
        from backend.libs.redis import get_service_cache
        cache = get_service_cache()
        shop = cache.get_shop(shop_id)
        if shop:
            return shop
    except Exception:
        pass
    
    # Fallback: call shop-service HTTP API
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{get_settings().shop_service_url}/api/v1/shops/internal/{shop_id}")
            if response.status_code == 200:
                return response.json()
    except Exception:
        pass
    return None


async def _get_user_info(user_id: str) -> dict[str, Any] | None:
    """Get user info from user-service via internal API."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{get_settings().user_service_url}/internal/users/{user_id}",
                headers={"X-Internal-Key": get_settings().internal_api_key}
            )
            if response.status_code == 200:
                return response.json()
    except Exception:
        pass
    return None


async def product_detail_response(product: dict[str, Any]) -> dict[str, Any]:
    """Build product detail response - uses HTTP API calls to other services, not direct DB access."""
    db = get_db()
    shop_ref = product.get("shop") or product.get("shop_id") or product.get("shopId")
    shop_id = str(shop_ref.id) if isinstance(shop_ref, DBRef) else str(shop_ref or "")
    
    # Get shop info via HTTP API (shop-service)
    shop_info = await _get_shop_info(shop_id) if shop_id else None
    
    # Get user info via HTTP API (user-service)
    user_id = ""
    if shop_info:
        user_id = shop_info.get("user_id", "") or shop_info.get("userId", "") or ""
    user_info = await _get_user_info(user_id) if user_id else None
    
    sku_list = await deref_many(db, "product_skus", product.get("skuList"))
    media_list = await deref_many(db, "product_media", product.get("mediaList"))

    # Build shop DTO from HTTP response
    shop_dto = None
    if shop_info:
        shop_dto = {
            "id": shop_info.get("id", shop_id),
            "userId": user_id,
            "name": shop_info.get("name"),
            "username": user_info.get("username") if user_info else shop_info.get("username"),
            "avatarUrl": shop_info.get("avatarUrl"),
            "totalProducts": shop_info.get("productCount", 0),
            "totalReviews": shop_info.get("totalReviews", 0),
            "averageRating": shop_info.get("averageRating", 0),
            "createdAt": shop_info.get("createdAt", ""),
            "followerCount": shop_info.get("followerCount", 0),
        }

    return {
        "id": str(product.get("_id")),
        "name": product.get("name", ""),
        "shopId": shop_id or None,
        "description": product.get("description", ""),
        "thumbnailUrl": product.get("thumbnailUrl", product.get("thumbnail_url", "")),
        "price": product.get("price", 0),
        "quantity": product.get("quantity", 0),
        "averageRating": product.get("averageRating", 0),
        "totalReviews": product.get("totalReviews", 0),
        "soldCount": product.get("sold", 0),
        "shop": shop_dto,
        "variationDisplayIndicators": build_variation_display(sku_list),
        "mediaList": media_list,
        "skuList": sku_list,
    }


async def serialize_product(doc: dict[str, Any], db) -> dict[str, Any]:
    data = serialize_doc(doc)

    if "shop" in data:
        data["shop_id"] = str(data.pop("shop"))
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
                media = await db.product_media.find_one({"_id": m})
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
                sku_list.append({
                    "id": str(sku.get("_id", sku.get("id", ""))),
                    "attributes": sku.get("attributes", []),
                    "price": float(sku.get("price", 0)),
                    "quantity": int(sku.get("quantity", 0)),
                    "skuCode": sku.get("sku_code", ""),
                })
            else:
                sku_list.append(sku)
        data["sku_list"] = sku_list

    # Convert snake_case to camelCase for frontend compatibility
    return {
        "id": data.get("id", ""),
        "name": data.get("name", ""),
        "description": data.get("description", ""),
        "price": data.get("price", 0),
        "thumbnailUrl": data.get("thumbnailUrl", data.get("thumbnail_url", "")),
        "shopId": data.get("shop_id", ""),
        "quantity": data.get("quantity", 0),
        "sold": data.get("sold", 0),
        "averageRating": data.get("average_rating", data.get("averageRating", 0)),
        "totalReviews": data.get("total_reviews", data.get("totalReviews", 0)),
        "isActive": data.get("is_active", True),
        "skuList": data.get("sku_list", []),
        "mediaList": data.get("media_list", []),
        "createdAt": data.get("created_at", data.get("createdAt", "")),
        "updatedAt": data.get("updated_at", data.get("updatedAt", "")),
    }


async def get_current_user_id(
    authorization: Annotated[str | None, Header()] = None,
) -> Optional[str]:
    from jose import JWTError, jwt

    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization[7:]

    from core.config import get_settings
    settings = get_settings()

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return payload.get("sub")
    except JWTError:
        return None


@router.get("")
async def list_products(
    page: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    shop_id: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = "created_at",
    sort_order: int = -1,
) -> dict[str, Any]:
    db = get_db()

    query: dict[str, Any] = {"visible": {"$ne": False}}

    if shop_id:
        query["shop"] = shop_id
    if search:
        query["name"] = {"$regex": search, "$options": "i"}

    total = await db.products.count_documents(query)
    cursor = db.products.find(query).skip(page * limit).limit(limit)

    if sort_by:
        sort_by_mongo = {"created_at": "createdAt", "price": "price", "sold": "sold", "average_rating": "averageRating"}.get(sort_by, "createdAt")
        cursor = cursor.sort(sort_by_mongo, sort_order)

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


@router.get("/{product_id}")
async def get_product(product_id: str) -> dict[str, Any]:
    db = get_db()

    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product ID")

    product = await db.products.find_one({"_id": ObjectId(product_id), "visible": {"$ne": False}})
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    return await serialize_product(product, db)


@legacy_router.get("/{product_id}")
async def get_legacy_product(product_id: str) -> dict[str, Any]:
    db = get_db()
    oid = _as_object_id(product_id)
    if oid is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    product = await db.products.find_one({
        "_id": oid,
        "visible": {"$ne": False},
        "deleted": {"$ne": True},
    })
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    return await product_detail_response(product)


@legacy_router.post("/select_variation")
async def select_legacy_variation(payload: dict[str, Any]) -> dict[str, Any]:
    db = get_db()
    oid = _as_object_id(payload.get("productId"))
    if oid is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    product = await db.products.find_one({"_id": oid, "deleted": {"$ne": True}})
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    sku_list = await deref_many(db, "product_skus", product.get("skuList"))
    selected = payload.get("attributes") or payload.get("selectedAttributes") or []
    matched_sku = next(
        (sku for sku in sku_list if same_attributes(sku.get("attributes") or [], selected)),
        None,
    )

    return {
        "sku": matched_sku,
        "price": matched_sku.get("price", -1) if matched_sku else -1,
        "quantity": matched_sku.get("quantity", product.get("quantity", 0)) if matched_sku else product.get("quantity", 0),
        "variationDisplayIndicators": build_variation_display(sku_list),
    }


@router.post("")
async def create_product(
    payload: ProductCreate,
    user_id: Optional[str] = Depends(get_current_user_id),
) -> dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    db = get_db()

    product_data = payload.model_dump()
    product_data["name"] = payload.name
    product_data["description"] = payload.description or ""
    product_data["price"] = payload.price
    product_data["quantity"] = payload.quantity
    product_data["thumbnail_url"] = payload.thumbnail_url or ""
    product_data["shop"] = payload.shop_id
    product_data["sold"] = 0
    product_data["averageRating"] = 0
    product_data["totalReviews"] = 0
    product_data["is_active"] = True
    product_data["visible"] = True
    product_data["sku_list"] = [sku.model_dump() for sku in payload.attributes] if payload.attributes else []
    product_data["mediaList"] = []
    product_data["createdAt"] = datetime.now(timezone.utc)
    product_data["updatedAt"] = datetime.now(timezone.utc)

    result = await db.products.insert_one(product_data)
    product_data["id"] = str(result.inserted_id)
    product_data["_id"] = result.inserted_id

    return await serialize_product(product_data, db)


@router.put("/{product_id}")
async def update_product(
    product_id: str,
    payload: ProductUpdate,
    user_id: Optional[str] = Depends(get_current_user_id),
) -> dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product ID")

    db = get_db()

    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.now(timezone.utc)
    # Map API field names to MongoDB names
    if "thumbnail_url" in update_data:
        update_data["thumbnailUrl"] = update_data.pop("thumbnail_url")
    if "is_active" in update_data:
        update_data["visible"] = update_data.pop("is_active")

    result = await db.products.find_one_and_update(
        {"_id": ObjectId(product_id)},
        {"$set": update_data},
        return_document=True,
    )

    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    return await serialize_product(result, db)


@router.delete("/{product_id}")
async def delete_product(
    product_id: str,
    user_id: Optional[str] = Depends(get_current_user_id),
) -> dict[str, str]:
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product ID")

    db = get_db()

    result = await db.products.update_one(
        {"_id": ObjectId(product_id)},
        {"$set": {"visible": False, "updatedAt": datetime.now(timezone.utc)}},
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    return {"status": "success"}
