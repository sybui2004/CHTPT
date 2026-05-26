from datetime import datetime, timezone
from typing import Annotated, Any, Optional
from bson import ObjectId
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, status
from pymongo import ReturnDocument
import httpx
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
    SaveProductDTO,
    InventoryAlertConfigDTO,
)
from api.helpers import serialize_shop_doc, get_current_user_id, find_owned_shop

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/shops", tags=["Shops"])
shop_root_router = APIRouter(prefix="/api/v1/shop", tags=["Shop (Root)"])


def _normalize_location(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        name = value.get("name")
        location = {"name": name} if name else {}
        if value.get("id") is not None:
            location["id"] = value.get("id")
        return location
    if value:
        return {"name": str(value)}
    return {}


def normalize_shop_address(payload: dict[str, Any]) -> dict[str, Any]:
    sender_name = payload.get("senderName") or payload.get("sender_name")
    phone_number = payload.get("phoneNumber") or payload.get("phone_number") or payload.get("phone")
    detail = payload.get("detail") or payload.get("address")
    province = _normalize_location(payload.get("province") or payload.get("province_name"))
    district = _normalize_location(payload.get("district") or payload.get("district_name"))
    ward = _normalize_location(payload.get("ward") or payload.get("ward_name"))

    if not sender_name or not phone_number or not detail or not province or not district or not ward:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Missing required shop address fields",
        )

    return {
        "senderName": sender_name,
        "phoneNumber": phone_number,
        "detail": detail,
        "province": province,
        "district": district,
        "ward": ward,
        "sender_name": sender_name,
        "phone_number": phone_number,
        "phone": phone_number,
        "address": detail,
        "province_name": province["name"],
        "district_name": district["name"],
        "ward_name": ward["name"],
    }


def _to_number(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _build_product_update_data(payload: dict[str, Any], shop_id: str) -> dict[str, Any]:
    protected_fields = {
        "productId",
        "product_id",
        "id",
        "_id",
        "shop",
        "shop_id",
        "shopId",
        "sold",
        "soldCount",
        "revenue",
        "averageRating",
        "average_rating",
        "totalReviews",
        "total_reviews",
        "createdAt",
        "created_at",
        "updatedAt",
        "updated_at",
    }
    update_data = {
        key: value
        for key, value in payload.items()
        if value is not None and key not in protected_fields
    }

    sku_list = update_data.get("skuList")
    if isinstance(sku_list, list) and sku_list:
        prices = [
            price
            for price in (_to_number(sku.get("price")) for sku in sku_list if isinstance(sku, dict))
            if price is not None
        ]
        quantities = [
            quantity
            for quantity in (_to_number(sku.get("quantity")) for sku in sku_list if isinstance(sku, dict))
            if quantity is not None
        ]
        if prices:
            update_data["price"] = min(prices)
        if quantities:
            update_data["quantity"] = int(sum(quantities))

    update_data["shop_id"] = shop_id
    update_data["shopId"] = shop_id
    return update_data


# ========== PUBLIC ROUTES ==========

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
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    db = get_db()
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


# ========== SHOP OWNER ROUTES ==========

from pydantic import BaseModel
from core.internal_client import get_internal_client


@shop_root_router.get("/dashboard/get_task_overview")
async def shop_get_task_overview(user_id: str = Depends(get_current_user_id)) -> dict[str, int]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    shop = await find_owned_shop(user_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    shop_id = str(shop["_id"])
    internal_client = get_internal_client()
    restricted_products = await internal_client.count_restricted_products([shop_id])

    return {
        "pendingOrders": 0,
        "preparingOrders": 0,
        "restrictedProducts": restricted_products,
    }


@shop_root_router.get("/profile/get")
async def shop_get_profile(user_id: str = Depends(get_current_user_id)) -> dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    from api.helpers import get_or_create_shop
    return await get_or_create_shop(user_id)


@shop_root_router.post("/profile/update")
async def shop_update_profile(
    payload: dict[str, Any] = Body(...),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = get_db()
    shop = await find_owned_shop(user_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    protected_fields = {"id", "_id", "user", "user_id", "createdAt", "created_at", "updatedAt", "updated_at"}
    update_data = {k: v for k, v in payload.items() if v is not None and k not in protected_fields}
    update_data["updated_at"] = datetime.now(timezone.utc)

    result = await db.shops.find_one_and_update(
        {"_id": shop["_id"]},
        {"$set": update_data},
        return_document=True,
    )
    return serialize_shop_doc(result)


@shop_root_router.get("/profile/get_address")
async def shop_get_address(user_id: str = Depends(get_current_user_id)) -> dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    db = get_db()
    address = await db.shop_addresses.find_one({"user_id": user_id})
    if not address:
        return {}
    return serialize_doc(address)


@shop_root_router.post("/profile/update_address")
async def shop_update_address(
    payload: dict[str, Any] = Body(...),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    db = get_db()
    data = normalize_shop_address(payload)
    data["user_id"] = user_id
    now = datetime.now(timezone.utc)
    data["updated_at"] = now
    result = await db.shop_addresses.find_one_and_update(
        {"user_id": user_id},
        {"$set": data, "$setOnInsert": {"created_at": now}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return serialize_doc(result)


@shop_root_router.get("/product/list")
async def shop_product_list(
    type: str = Query("0"),
    sortType: str = Query("0"),
    keyword: Optional[str] = None,
    page: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    shop = await find_owned_shop(user_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    shop_id = str(shop["_id"])
    internal_client = get_internal_client()

    status_filter_map = {"0": "active", "1": "restricted", "2": "pending", "3": "inactive", "4": "out_of_stock"}
    sort_map = {
        "0": ("sold", -1), "1": ("sold", 1), "2": ("quantity", -1), "3": ("quantity", 1),
        "4": ("price", -1), "5": ("price", 1), "6": ("created_at", -1), "7": ("created_at", 1),
        "8": ("sold", -1), "9": ("sold", 1),
    }

    result = await internal_client.list_products_by_shop(
        shop_ids=[shop_id],
        status_filter=status_filter_map.get(type),
        page=page, limit=limit, keyword=keyword,
        sort_by=sort_map.get(sortType, ("created_at", -1))[0],
        sort_order=sort_map.get(sortType, ("created_at", -1))[1],
    )

    products = result.get("content", [])
    for product in products:
        if "revenue" not in product:
            product["revenue"] = 0

    return {
        "content": products,
        "totalElements": result.get("total", 0),
        "totalPages": result.get("total_pages", 0),
        "page": result.get("page", page),
        "limit": result.get("limit", limit),
    }


@shop_root_router.get("/product/inventory-alert-config")
async def shop_get_inventory_alert_config(user_id: str = Depends(get_current_user_id)) -> dict[str, int]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    shop = await find_owned_shop(user_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    config = await db.shop_settings.find_one({"shop_id": str(shop["_id"])})
    return {"lowStockThreshold": int(config.get("lowStockThreshold", 10)) if config else 10}


@shop_root_router.post("/product/inventory-alert-config")
async def shop_update_inventory_alert_config(
    payload: InventoryAlertConfigDTO,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, int]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    if payload.lowStockThreshold < 1:
        raise HTTPException(status_code=400, detail="lowStockThreshold must be greater than 0")
    shop = await find_owned_shop(user_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    threshold = int(payload.lowStockThreshold)
    await db.shop_settings.update_one(
        {"shop_id": str(shop["_id"])},
        {"$set": {"lowStockThreshold": threshold, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"lowStockThreshold": threshold}


@shop_root_router.get("/product/{product_id}")
async def shop_get_product(
    product_id: str,
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=400, detail="Invalid product ID")
    
    # Get current user for authorization check
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get user's shop to verify ownership
    shop = await find_owned_shop(user_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    shop_id = str(shop["_id"])
    
    # Call product-service internal API to get product
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{get_settings().product_service_url}/internal/products/{product_id}",
                headers={"X-Internal-Key": get_settings().internal_api_key}
            )
            
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Product not found")
            
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to get product")
            
            product = response.json()
            
            # Verify product belongs to this shop
            if product.get("shop_id") != shop_id and product.get("shopId") != shop_id:
                raise HTTPException(status_code=403, detail="Not authorized to edit this product")
            
            return product
    except httpx.HTTPError as e:
        logger.error(f"Error calling product-service: {e}")
        raise HTTPException(status_code=500, detail="Failed to get product")


@shop_root_router.post("/product/add")
async def shop_add_product(
    payload: dict[str, Any] = Body(...),
    authorization: Annotated[str | None, Header()] = None,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Create product for current shop.

    Data ownership: product data must be stored in `product_db` by `product-service`.
    So shop-service forwards create request to product-service public API.
    """
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    shop = await find_owned_shop(user_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    shop_id = str(shop["_id"])

    # Frontend sends: thumbnailUrl, mediaList, skuList, visible, weight...
    # product-service expects: thumbnail_url, shop_id, attributes (variant attributes list)
    sku_list = payload.get("skuList") if isinstance(payload.get("skuList"), list) else []
    product_payload = {
        "shop_id": shop_id,
        "name": payload.get("name", ""),
        "description": payload.get("description") or "",
        "price": payload.get("price") or 0,
        "quantity": payload.get("quantity") or 0,
        "thumbnail_url": payload.get("thumbnailUrl") or payload.get("thumbnail_url") or "",
        "attributes": sku_list,
    }

    # Forward to product-service (via internal network, but public endpoint).
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{get_settings().product_service_url}/api/v1/products",
                json=product_payload,
                headers={"Authorization": authorization} if authorization else None,
            )

        if response.status_code in (401, 403):
            raise HTTPException(status_code=401, detail="Authentication required")
        if response.status_code >= 400:
            raise HTTPException(status_code=400, detail=response.text)

        return response.json()
    except httpx.HTTPError as e:
        logger.error(f"Error calling product-service create product: {e}")
        raise HTTPException(status_code=500, detail="Failed to create product")


@shop_root_router.post("/product/update")
async def shop_update_product(
    payload: dict[str, Any] = Body(...),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Support both productId (camelCase from frontend) and product_id (snake_case)
    product_id = payload.get("productId") or payload.get("product_id")

    if not product_id:
        raise HTTPException(status_code=400, detail="productId required")

    shop = await find_owned_shop(user_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    shop_id = str(shop["_id"])
    internal_client = get_internal_client()
    product = await internal_client.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if str(product.get("shop_id") or product.get("shopId") or product.get("shop") or "") != shop_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this product")

    update_data = _build_product_update_data(payload, shop_id)
    if not await internal_client.update_product(product_id, update_data):
        raise HTTPException(status_code=404, detail="Product not found")
    return {"status": "success"}


@shop_root_router.post("/product/change_visible")
async def shop_toggle_visible(
    productId: str = Query(...),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    db = get_db()
    shop = await find_owned_shop(user_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    product = await db.products.find_one({"_id": ObjectId(productId), "shop_id": str(shop["_id"])})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.products.update_one(
        {"_id": ObjectId(productId)},
        {"$set": {"is_active": not product.get("is_active", True), "updated_at": datetime.now(timezone.utc)}},
    )
    return {"status": "success"}


@shop_root_router.post("/product/delete/{product_id}")
async def shop_delete_product(
    product_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    db = get_db()
    shop = await find_owned_shop(user_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    result = await db.products.update_one(
        {"_id": ObjectId(product_id), "shop_id": str(shop["_id"])},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"status": "success"}


@shop_root_router.get("/order/get_list")
async def shop_order_list(
    type: str = Query("0"),
    filterType: Optional[str] = None,
    sortType: str = Query("0"),
    keyword: Optional[str] = None,
    page: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    db = get_db()
    shop = await find_owned_shop(user_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    shop_id = str(shop["_id"])
    status_by_type = {
        "1": ["PENDING", "1"],
        "2": ["CONFIRMED", "PREPARING", "2"],
        "3": ["SHIPPED", "3"],
        "4": ["SHIPPING", "4"],
        "5": ["DELIVERED", "5"],
        "6": ["CANCELLED", "7"],
    }

    sort_field = "created_at"
    sort_order = -1
    if sortType == "1":
        sort_order = 1
    elif sortType in {"2", "3"}:
        sort_field = "total_price"
        sort_order = -1 if sortType == "2" else 1

    internal_client = get_internal_client()
    result = await internal_client.list_orders_by_shop(
        shop_ids=[shop_id],
        statuses=status_by_type.get(str(type)),
        page=page,
        limit=limit,
        keyword=keyword,
        filter_type=filterType,
        sort_by=sort_field,
        sort_order=sort_order,
    )

    orders = result.get("content", [])
    product_ids = [
        item.get("product_id") or item.get("productId")
        for order in orders
        for shop_order in order.get("shop_orders", [])
        for item in shop_order.get("items", [])
        if item.get("product_id") or item.get("productId")
    ]
    products = await internal_client.get_products_batch(product_ids)
    product_by_id = {str(product.get("id") or product.get("_id")): product for product in products}

    content = []
    for doc in orders:
        shop_order = (doc.get("shop_orders") or [{}])[0]
        status_number = {"PENDING": 1, "CONFIRMED": 2, "PREPARING": 2, "SHIPPED": 3, "SHIPPING": 4, "DELIVERED": 5, "REVIEWED": 6, "CANCELLED": 7}.get(str(shop_order.get("status", 1)), 1)

        items = []
        for item in shop_order.get("items", []):
            item_product = item.get("product") if isinstance(item.get("product"), dict) else {}
            product_id = str(item.get("product_id") or item.get("productId") or item_product.get("id") or item.get("id") or "")
            product = product_by_id.get(product_id, {})
            items.append({
                "id": str(item.get("id") or item.get("item_id") or product_id),
                "quantity": item.get("quantity", 1),
                "price": item.get("price", 0),
                "attributes": item.get("attributes", []),
                "product": {
                    "id": product_id,
                    "name": item.get("name") or item_product.get("name") or product.get("name") or "Sản phẩm",
                    "thumbnailUrl": item.get("thumbnailUrl") or item.get("thumbnail_url") or item_product.get("thumbnailUrl") or product.get("thumbnailUrl") or product.get("thumbnail_url") or "",
                },
            })

        content.append({
            "id": str(shop_order.get("id") or doc.get("id")),
            "orderId": str(doc.get("id")),
            "shopId": str(shop_order.get("shop_id") or shop_id),
            "createdAt": doc.get("createdAt") or doc.get("created_at"),
            "buyerName": doc.get("buyerName") or doc.get("user_id") or "Khách hàng",
            "items": items,
            "paymentType": doc.get("paymentType") or doc.get("payment_type") or "cash_on_delivery",
            "completedPayment": bool(doc.get("completedPayment") or doc.get("completed_payment") or doc.get("payment", {}).get("status") == "COMPLETED"),
            "total": shop_order.get("total") or shop_order.get("total_price") or 0,
            "status": status_number,
        })

    total = int(result.get("total", 0) or 0)
    return {"content": content, "totalElements": total, "totalPages": (total + limit - 1) // limit if limit else 0, "page": page, "limit": limit}

    content = []
    async for doc in db.orders.aggregate(pipeline):
        shop_order = doc.get("shop_orders", {})
        status_number = {"PENDING": 1, "CONFIRMED": 2, "PREPARING": 2, "SHIPPED": 3, "SHIPPING": 4, "DELIVERED": 5, "REVIEWED": 6, "CANCELLED": 7}.get(str(shop_order.get("status", 1)), 1)

        items = [{
            "id": str(item.get("id") or item.get("item_id") or item.get("product_id") or ""),
            "quantity": item.get("quantity", 1),
            "price": item.get("price", 0),
            "attributes": item.get("attributes", []),
            "product": {
                "id": item.get("product_id") or item.get("id") or "",
                "name": item.get("name") or item.get("product", {}).get("name") or "Sản phẩm",
                "thumbnailUrl": item.get("thumbnailUrl") or item.get("thumbnail_url") or item.get("product", {}).get("thumbnailUrl") or "",
            },
        } for item in shop_order.get("items", [])]

        content.append({
            "id": str(shop_order.get("id") or shop_order.get("_id") or doc.get("_id")),
            "orderId": str(doc.get("_id")),
            "shopId": str(shop_order.get("shop_id") or shop_id),
            "createdAt": doc.get("createdAt") or doc.get("created_at"),
            "buyerName": doc.get("buyerName") or doc.get("user_id") or "Khách hàng",
            "items": items,
            "paymentType": doc.get("paymentType") or doc.get("payment_type") or "cash_on_delivery",
            "completedPayment": bool(doc.get("completedPayment") or doc.get("payment", {}).get("status") == "COMPLETED"),
            "total": shop_order.get("total") or shop_order.get("total_price") or 0,
            "status": status_number,
        })

    return {"content": content, "totalElements": total, "totalPages": (total + limit - 1) // limit if limit else 0, "page": page, "limit": limit}


@shop_root_router.post("/order/update")
async def shop_update_order(
    shopOrderId: str = Query(..., alias="shopOrderId"),
    currentStatus: str = Query(..., alias="currentStatus"),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, str]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    shop = await find_owned_shop(user_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    shop_id = str(shop["_id"])

    status_to_order_status = {
        "1": "CONFIRMED",
        "2": "SHIPPED",
        "CONFIRMED": "CONFIRMED",
        "PREPARING": "PREPARING",
        "SHIPPED": "SHIPPED",
        "CANCELLED": "CANCELLED",
    }
    new_order_status = status_to_order_status.get(currentStatus, currentStatus)

    updated = await get_internal_client().update_shop_order_status(shopOrderId, shop_id, new_order_status)
    if not updated:
        raise HTTPException(status_code=404, detail="Order not found or not owned")

    return {"status": "success"}


@shop_root_router.get("/complaints")
async def shop_complaints(
    page: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    db = get_db()
    shop = await find_owned_shop(user_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    query: dict[str, Any] = {"shop_id": str(shop["_id"])}
    total = await db.complaints.count_documents(query)
    cursor = db.complaints.find(query).sort("created_at", -1).skip(page * limit).limit(limit)
    complaints = []
    async for doc in cursor:
        complaints.append(serialize_doc(doc))
    return {"content": complaints, "total": total, "page": page, "limit": limit}


@shop_root_router.post("/complaints/{complaint_id}/action")
async def shop_handle_complaint(
    complaint_id: str,
    payload: BaseModel,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, str]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    db = get_db()
    data = payload.model_dump()
    await db.complaints.update_one(
        {"_id": ObjectId(complaint_id)},
        {"$set": {"status": data.get("status"), "response": data.get("response"), "updated_at": datetime.now(timezone.utc)}},
    )
    return {"status": "success"}
