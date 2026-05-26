from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, Optional

from bson import ObjectId
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, status
import httpx
from pydantic import BaseModel, Field, ConfigDict

from backend.libs import RetryConfig, retry_async
from core.db import get_db
from core.config import get_settings
from schemas.order import (
    OrderCreate,
    OrderListResponse,
    OrderResponse,
    OrderStatus,
)
from services.redis_handlers import (
    publish_order_created,
    publish_order_cancelled,
)

router = APIRouter(prefix="/api/v1/orders", tags=["Orders"])

# Root-level cart router for /api/v1/cart/* paths
cart_router = APIRouter(prefix="/api/v1/cart", tags=["Cart"])

# Root-level checkout router for /api/v1/checkout/* paths
checkout_router = APIRouter(prefix="/api/v1/checkout", tags=["Checkout"])


def serialize_doc(doc: dict[str, Any]) -> dict[str, Any]:
    if doc is None:
        return {}
    data = doc.copy()
    if "_id" in data:
        data["id"] = str(data.pop("_id"))
    if "shop_orders" in data:
        data["shop_orders"] = data["shop_orders"].copy()
        for so in data["shop_orders"]:
            if "_id" in so:
                so["id"] = str(so.pop("_id"))
    # Normalize status field names (DB uses 'SHIPPED' but enum uses 'SHIPPING')
    status = data.get("status", "")
    if status == "SHIPPED":
        data["status"] = "SHIPPING"
    if "shop_orders" in data:
        for so in data["shop_orders"]:
            so_status = so.get("status", "")
            if so_status == "SHIPPED":
                so["status"] = "SHIPPING"
    return data


def _bank_transfer_payment_pending_query(now: datetime | None = None) -> dict[str, Any]:
    query: dict[str, Any] = {
        "$and": [
            {"$or": [{"payment_type": "bank_transfer"}, {"paymentType": "bank_transfer"}]},
            {"$or": [{"completedPayment": {"$ne": True}}, {"completed_payment": {"$ne": True}}]},
            {"payment.status": {"$ne": "COMPLETED"}},
            {"shop_orders.status": {"$nin": ["CANCELLED", "7"]}},
        ]
    }
    if now is not None:
        query["$and"].append({
            "$or": [
                {"payment.expireAt": {"$exists": False}},
                {"payment.expireAt": None},
                {"payment.expireAt": {"$gt": now}},
            ]
        })
    return query


def _bank_transfer_payment_expired_query(now: datetime) -> dict[str, Any]:
    return {
        "$and": [
            {"$or": [{"payment_type": "bank_transfer"}, {"paymentType": "bank_transfer"}]},
            {"$or": [{"completedPayment": {"$ne": True}}, {"completed_payment": {"$ne": True}}]},
            {"payment.status": {"$ne": "COMPLETED"}},
            {"payment.expireAt": {"$lte": now}},
        ]
    }


def _payment_completed_update(now: datetime) -> dict[str, Any]:
    return {
        "completedPayment": True,
        "completed_payment": True,
        "payment.status": "COMPLETED",
        "payment.completedAt": now,
        "payment.completed_at": now,
    }


async def _get_product_thumbnail_from_service(product_id: str) -> str:
    """Get product thumbnail from product-service via API."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{get_settings().product_service_url}/api/v1/product/{product_id}")
            if response.status_code == 200:
                product = response.json()
                return product.get("thumbnailUrl") or product.get("thumbnail_url", "")
    except Exception:
        pass
    return ""


async def _get_product_from_service(product_id: str) -> dict[str, Any] | None:
    """Get product info from product-service via API."""
    if not product_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{get_settings().product_service_url}/api/v1/product/{product_id}")
            if response.status_code == 200:
                return response.json()
    except Exception:
        return None
    return None


def _extract_shop_id(product: dict[str, Any] | None) -> str:
    if not product:
        return ""
    shop = product.get("shop")
    if isinstance(shop, dict):
        return str(shop.get("id") or shop.get("_id") or "")
    return str(product.get("shopId") or product.get("shop_id") or shop or "")


async def _resolve_item_shop_id(item: dict[str, Any]) -> str:
    shop_id = str(item.get("shop_id") or item.get("shopId") or "")
    if shop_id and shop_id != "default":
        return shop_id

    product_id = item.get("product_id") or item.get("productId")
    product = await _get_product_from_service(product_id)
    resolved_shop_id = _extract_shop_id(product)
    return resolved_shop_id or "default"


async def _get_selected_variation(product_id: str, attributes: list[dict] | None) -> dict[str, Any] | None:
    if not product_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{get_settings().product_service_url}/api/v1/product/select_variation",
                json={"productId": product_id, "attributes": attributes or []},
            )
        if response.status_code == 200:
            return response.json()
    except Exception:
        return None
    return None


async def _get_shop_from_service(shop_id: str) -> dict[str, Any] | None:
    """Get shop info from cache (via Redis pub/sub from shop-service)."""
    if not shop_id or shop_id == "default":
        return {"name": "Shop", "id": shop_id, "username": ""}
    
    try:
        from backend.libs.redis import get_service_cache
        cache = get_service_cache()
        shop = cache.get_shop(shop_id)
        if shop:
            return shop
    except Exception:
        pass
    
    # Fallback: try to get from shop-service directly
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            settings = get_settings()
            response = await client.get(
                f"{settings.shop_service_url}/api/v1/shops/internal/{shop_id}",
                headers={"X-Internal-Key": settings.internal_api_key},
            )
            if response.status_code == 200:
                return response.json()
    except Exception:
        pass
    
    return None


async def _get_user_address_from_service(user_id: str) -> dict[str, Any] | None:
    """Get user's default address from user-service via API."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            settings = get_settings()
            response = await client.get(
                f"{settings.user_service_url}/internal/users/{user_id}/addresses",
                headers={"X-Internal-Key": settings.internal_api_key},
            )
            if response.status_code == 200:
                addresses = response.json()
                if not isinstance(addresses, list) or not addresses:
                    return None
                return next((addr for addr in addresses if addr.get("is_default") or addr.get("primary")), addresses[0])
    except Exception:
        pass
    return None


async def _get_user_address_by_id_from_service(user_id: str, address_id: str) -> dict[str, Any] | None:
    """Get one user address from user-service, which owns auth_db.user_addresses."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            settings = get_settings()
            response = await client.get(
                f"{settings.user_service_url}/internal/users/{user_id}/addresses",
                headers={"X-Internal-Key": settings.internal_api_key},
            )
            if response.status_code != 200:
                return None

            addresses = response.json()
            if not isinstance(addresses, list):
                return None
            return next((addr for addr in addresses if addr.get("id") == address_id), None)
    except Exception:
        return None


async def get_current_user_id(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    from jose import JWTError, jwt

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing access token",
        )
    token = authorization[7:]

    from core.config import get_settings
    settings = get_settings()

    try:
        # Debug: log token header to see what algorithm was used
        import base64
        token_parts = token.split('.')
        if token_parts:
            try:
                header_b64 = token_parts[0].replace('-', '+').replace('_', '/')
                header_json = base64.b64decode(header_b64).decode('utf-8')
                print(f"[DEBUG] Token header: {header_json}")
                print(f"[DEBUG] Expected secret length: {len(settings.jwt_secret)}")
            except Exception as e:
                print(f"[DEBUG] Failed to decode token header: {e}")
        
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
        return user_id
    except JWTError as e:
        print(f"[DEBUG] JWT decode error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


# ========== Order Endpoints ==========

class PlaceOrderItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    product_id: str = Field(..., alias="productId")
    quantity: int
    price: int
    attributes: Optional[list[dict]] = []
    thumbnail_url: Optional[str] = Field(default=None, alias="thumbnailUrl")
    name: Optional[str] = None
    item_id: Optional[str] = Field(default=None, alias="itemId")


class PlaceOrderShopOrder(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    shop_id: str = Field(..., alias="shopId")
    shipping_fee: int = Field(default=0, alias="shippingFee")
    total_price: int = Field(..., alias="totalPrice")
    voucher_code: Optional[str] = Field(default=None, alias="voucherCode")
    items: list[PlaceOrderItem] = []


class PlaceOrderRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    address_id: str = Field(..., alias="addressId")
    payment_type: str = Field(default="cash_on_delivery", alias="paymentType")
    shop_orders: list[PlaceOrderShopOrder] = Field(default=[], alias="shopOrders")


async def _get_order_list_impl(
    type: str = "all",
    offset: int = 0,
    limit: int = 20,
    user_id: str = None,
) -> dict[str, Any]:
    db = get_db()
    query: dict[str, Any] = {"user_id": user_id}
    
    # Map buyer tabs to business states.
    # Frontend tabs: 0=all, 1=bank-transfer payment pending,
    # 2=pending shop confirmation, 3=waiting shipment, 4=received/completed,
    # 5=cancelled.
    type_to_status = {
        # Tab indices (string numbers from frontend)
        "2": "PENDING",
        "3": "WAITING_SHIPMENT",
        "4": "DELIVERED",
        "5": "CANCELLED",
        # Keyword strings (from backend calls)
        "pending": "PENDING",
        "shipping": "WAITING_SHIPMENT",
        "delivered": "DELIVERED",
        "cancelled": "CANCELLED",
        "confirmed": "WAITING_SHIPMENT",
        "completed": "DELIVERED",
    }
    filter_status = type_to_status.get(type)
    
    if str(type) == "1":
        query.update(_bank_transfer_payment_pending_query(datetime.now(timezone.utc)))
    elif filter_status:
        if filter_status == "WAITING_SHIPMENT":
            query["shop_orders.status"] = {"$in": ["CONFIRMED", "PREPARING", "SHIPPED", "SHIPPING", "2", "3", "4"]}
        elif filter_status == "DELIVERED":
            query["shop_orders.status"] = {"$in": ["DELIVERED", "COMPLETED", "REVIEWED", "5", "6"]}
        elif filter_status == "CANCELLED":
            query["$or"] = [
                {"status": {"$in": ["CANCELLED", "7"]}},
                {"shop_orders.status": {"$in": ["CANCELLED", "7"]}},
                _bank_transfer_payment_expired_query(datetime.now(timezone.utc)),
            ]
        elif filter_status == "PENDING":
            # Tab "2" - Chờ xác nhận: CHỈ đơn COD (payment_type = cash_on_delivery)
            # vì đơn bank_transfer chưa thanh toán thuộc tab "1" Chờ thanh toán
            query["$and"] = [
                {"$or": [
                    {"payment_type": {"$ne": "bank_transfer", "$exists": True}},
                    {"paymentType": {"$ne": "bank_transfer", "$exists": True}},
                    {"payment_type": {"$exists": False}},
                    {"paymentType": {"$exists": False}},
                ]},
                {"shop_orders.status": {"$in": ["PENDING", "1"]}},
            ]
        else:
            query["shop_orders.status"] = {"$in": [filter_status, "1"]}

    total = await db.orders.count_documents(query)
    cursor = db.orders.find(query).sort("created_at", -1).skip(offset * limit).limit(limit)

    orders = []
    async for doc in cursor:
        orders.append(serialize_doc(doc))

    return {
        "content": orders,
        "total": total,
        "offset": offset,
        "limit": limit,
        "nextOffset": offset + len(orders),
    }


async def _get_order_detail_impl(
    shopOrderId: str,
    user_id: str = None,
) -> dict[str, Any]:
    db = get_db()
    # If shopOrderId is a valid order _id, find by order _id directly
    if ObjectId.is_valid(shopOrderId):
        order = await db.orders.find_one({"_id": ObjectId(shopOrderId), "user_id": user_id})
    else:
        # Fallback: find by shop_id (legacy behavior)
        order = await db.orders.find_one({"user_id": user_id, "shop_orders.shop_id": shopOrderId})
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    data = serialize_doc(order)
    # Return first shop_order (for single-shop orders)
    shop_order = data.get("shop_orders", [None])[0] if data.get("shop_orders") else None
    return {
        "id": data.get("id"),
        "status": data.get("status"),
        "shop_order": shop_order,
        "shipping_address": data.get("shipping_address"),
        "payment_method": data.get("payment_method"),
        "note": data.get("note"),
        "created_at": data.get("created_at"),
        "updated_at": data.get("updated_at"),
    }


async def _place_order_impl(
    payload: PlaceOrderRequest,
    user_id: str = None,
) -> dict[str, Any]:
    db = get_db()
    if not ObjectId.is_valid(payload.address_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid address ID")
    address = await _get_user_address_by_id_from_service(user_id, payload.address_id)
    if not address:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User hasn't have an address yet!")
    shipping_address = {
        "receiver_name": address.get("receiver_name") or address.get("receiverName") or address.get("full_name"),
        "phone_number": address.get("phone_number") or address.get("phoneNumber") or address.get("phone"),
        "detail": address.get("detail"),
        "ward": address.get("ward"),
        "district": address.get("district"),
        "province": address.get("province"),
    }

    cart = await db.carts.find_one({"user_id": user_id}) or {}
    selected_cart_items = [
        _normalize_cart_item(item)
        for item in cart.get("items", [])
        if item.get("selected", True)
    ]
    selected_by_shop: dict[str, list[dict[str, Any]]] = {}
    selected_item_ids: list[str] = []
    for item in selected_cart_items:
        shop_id = await _resolve_item_shop_id(item)
        item["shop_id"] = shop_id
        selected_by_shop.setdefault(shop_id, []).append(item)
        item_id = item.get("item_id") or item.get("itemId")
        if item_id:
            selected_item_ids.append(item_id)

    normalized_shop_orders: list[dict[str, Any]] = []
    for shop_order in payload.shop_orders:
        if shop_order.shop_id == "default" and len(selected_by_shop) == 1:
            shop_order.shop_id = next(iter(selected_by_shop))
        order_items = [item.model_dump(by_alias=False) for item in shop_order.items]
        if not order_items:
            order_items = [
                {
                    "product_id": item.get("product_id") or item.get("productId"),
                    "quantity": int(item.get("quantity", 0) or 0),
                    "price": int(item.get("price", 0) or 0),
                    "attributes": item.get("attributes", []),
                    "thumbnail_url": item.get("thumbnailUrl") or item.get("thumbnail_url"),
                    "name": item.get("name"),
                    "item_id": item.get("item_id") or item.get("itemId"),
                }
                for item in selected_by_shop.get(str(shop_order.shop_id), [])
            ]
        if not order_items:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không có sản phẩm nào để đặt hàng")

        for item in order_items:
            product_id = item.get("product_id")
            quantity = int(item.get("quantity", 0) or 0)
            if quantity <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid item quantity")
            variation = await _get_selected_variation(product_id, item.get("attributes") or [])
            product = await _get_product_from_service(product_id) or {}
            if not variation and not product:
                product_name = item.get("name") or "Sản phẩm"
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{product_name} không còn tồn tại hoặc đã thay đổi mã sản phẩm. Vui lòng xóa khỏi giỏ hàng rồi thêm lại.",
                )
            variation = variation or {}
            available_stock = int(variation.get("quantity", product.get("quantity", 0)) or 0)
            if quantity > available_stock:
                product_name = item.get("name") or product.get("name") or "Sản phẩm"
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{product_name} chỉ còn {available_stock} sản phẩm trong kho.",
                )

        # Get shop info for shop name
        shop_info = await _get_shop_from_service(shop_order.shop_id)
        shop_name = shop_info.get("name", "Shop") if shop_info else "Shop"
        
        normalized_shop_orders.append({
            "shop_id": shop_order.shop_id,
            "name": shop_name,  # Add shop name
            "status": OrderStatus.PENDING.value,  # Set initial status for shop order
            "shipping_fee": shop_order.shipping_fee,
            "total_price": shop_order.total_price,
            "voucher_code": shop_order.voucher_code,
            "items": order_items,
        })

    total_amount = sum(so.total_price for so in payload.shop_orders)
    shipping_fee = sum(so.shipping_fee for so in payload.shop_orders)
    now = datetime.now(timezone.utc)
    payment_status = "PENDING" if payload.payment_type == "bank_transfer" else "COD"
    order_data = {
        "user_id": user_id,
        "payment_type": payload.payment_type,
        "paymentType": payload.payment_type,
        "completedPayment": False,
        "completed_payment": False,
        "payment": {
            "type": payload.payment_type,
            "status": payment_status,
            "amount": total_amount + shipping_fee,
            "expireAt": now + timedelta(minutes=15) if payload.payment_type == "bank_transfer" else None,
        },
        "shop_orders": normalized_shop_orders,
        "shipping_address": shipping_address,
        "status": OrderStatus.PENDING.value,
        "total_amount": total_amount,
        "shipping_fee": shipping_fee,
        "discount_amount": 0,
        "final_amount": total_amount + shipping_fee,
        "note": None,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.orders.insert_one(order_data)
    order_id = str(result.inserted_id)
    if selected_item_ids:
        await db.carts.update_one(
            {"user_id": user_id},
            {
                "$pull": {"items": {"item_id": {"$in": selected_item_ids}}},
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
        )
    
    # Publish Redis event for order creation
    order_data["order_id"] = order_id
    try:
        await publish_order_created(order_data)
    except Exception as e:
        # Log error but don't fail the order creation
        import logging
        logging.getLogger(__name__).warning(f"Failed to publish Redis event: {e}")
    
    return {"orderId": order_id, "paymentUrl": None}


@router.get("", response_model=OrderListResponse)
async def list_orders(
    page: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[OrderStatus] = None,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    db = get_db()
    query: dict[str, Any] = {"user_id": user_id}
    if status_filter:
        query["status"] = status_filter.value
    total = await db.orders.count_documents(query)
    cursor = db.orders.find(query).skip(page * limit).limit(limit).sort("created_at", -1)
    orders = []
    async for doc in cursor:
        orders.append(OrderResponse(**serialize_doc(doc)))
    total_pages = (total + limit - 1) // limit if limit else 0
    return {"content": [o.model_dump() for o in orders], "total": total, "page": page, "limit": limit, "total_pages": total_pages}


@router.get("/get_order_list")
async def get_order_list(
    type: str = Query("all"),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    return await _get_order_list_impl(type, offset, limit, user_id)


@router.get("/detail")
async def get_order_detail(
    shopOrderId: str = Query(...),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    return await _get_order_detail_impl(shopOrderId, user_id)


@router.post("/place_order")
async def place_order(
    payload: PlaceOrderRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    return await _place_order_impl(payload, user_id)


@router.post("/mark_as_received")
async def mark_order_as_received(
    orderId: str = Query(..., alias="shopOrderId"),  # alias kept for backward compat
    user_id: str = Depends(get_current_user_id),
) -> dict[str, str]:
    db = get_db()
    # Validate ObjectId before querying
    if not orderId or not ObjectId.is_valid(orderId):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid orderId")
    # orderId is the top-level order's _id
    order = await db.orders.find_one({"_id": ObjectId(orderId), "user_id": user_id})
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    # Update first shop_order status to DELIVERED
    now = datetime.now(timezone.utc)
    result = await db.orders.update_one(
        {"_id": ObjectId(orderId)},
        {"$set": {
            "shop_orders.0.status": OrderStatus.DELIVERED.value,
            "status": OrderStatus.DELIVERED.value,
            "updated_at": now,
            **_payment_completed_update(now),
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found or cannot be marked as received")
    return {"status": "success"}


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, user_id: str = Depends(get_current_user_id)) -> dict[str, Any]:
    db = get_db()
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid order ID")
    order = await db.orders.find_one({"_id": ObjectId(order_id), "user_id": user_id})
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return OrderResponse(**serialize_doc(order))


@router.post("", response_model=OrderResponse)
async def create_order(payload: PlaceOrderRequest, user_id: str = Depends(get_current_user_id)) -> dict[str, Any]:
    result = await _place_order_impl(payload, user_id)
    return {"id": result["orderId"], "status": "PENDING"}


@router.put("/{order_id}/cancel")
async def cancel_order(
    order_id: str,
    whoCancel: int = Query(1, description="1=buyer, 2=shop owner"),
    reason: Optional[str] = None,
    shopId: Optional[str] = Query(None, description="Shop ID for shop owner cancel"),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, str]:
    db = get_db()
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid order ID")
    
    # For shop owner cancel (whoCancel=2)
    if whoCancel == 2:
        if not shopId:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="shopId is required for shop owner cancel")
        shop_id_values: list[Any] = [shopId]
        if ObjectId.is_valid(shopId):
            shop_id_values.append(ObjectId(shopId))
        
        # Find order and verify shop ownership
        order = await db.orders.find_one({"_id": ObjectId(order_id), "shop_orders.shop_id": {"$in": shop_id_values}})
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        
        # Find the specific shop order
        shop_order = None
        for so in order.get("shop_orders", []):
            so_shop_id = str(so.get("shop_id", ""))
            if so_shop_id == shopId:
                shop_order = so
                break
        
        if not shop_order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop order not found")
        
        # Check if shop order can be cancelled (only PENDING status)
        if shop_order.get("status") not in ["PENDING", "1"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot cancel order in current status")
        
        # Update shop order status to CANCELLED
        result = await db.orders.update_one(
            {"_id": ObjectId(order_id), "shop_orders.shop_id": {"$in": shop_id_values}},
            {"$set": {
                "shop_orders.$.status": "CANCELLED",
                "shop_orders.$.cancel_reason": reason,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Failed to cancel order")
        
        # Publish Redis event
        try:
            await publish_order_cancelled({
                "order_id": order_id,
                "user_id": order.get("user_id", ""),
                "shop_id": shopId,
                "reason": reason or "",
                "who_cancel": 2,
            })
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to publish cancellation Redis event: {e}")
        
        return {"status": "success", "message": "Order cancelled successfully"}
    
    # For buyer cancel (whoCancel=1) - original behavior
    order = await db.orders.find_one({"_id": ObjectId(order_id), "user_id": user_id})
    if not order:
        print(f"[DEBUG] Cancel order failed: order_id={order_id}, user_id={user_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    print(f"[DEBUG] Cancel order: order_id={order_id}, user_id={user_id}, order_status={order.get('status')}, shop_orders_status={[so.get('status') for so in order.get('shop_orders', [])]}")
    if order["status"] not in [OrderStatus.PENDING.value]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot cancel order in current status")
    
    old_status = order["status"]
    
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "status": OrderStatus.CANCELLED.value,
            "shop_orders.$[].status": OrderStatus.CANCELLED.value,
            "cancel_reason": reason,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    
    order_data = {
        "order_id": order_id,
        "user_id": user_id,
        "shop_id": order.get("shop_orders", [{}])[0].get("shop_id", "") if order.get("shop_orders") else "",
        "reason": reason or "",
        "old_status": old_status,
        "shop_orders": order.get("shop_orders", []),
    }
    try:
        await publish_order_cancelled(order_data)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Failed to publish cancellation Redis event: {e}")
    
    return {"status": "success", "message": "Order cancelled successfully"}


# ========== Apply Voucher Endpoint ==========

class ApplyVoucherRequest(BaseModel):
    code: str
    shop_id: str
    order_total: int


@router.post("/apply-voucher")
async def apply_voucher(
    payload: ApplyVoucherRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    db = get_db()
    voucher = await db.vouchers.find_one({"code": payload.code})
    if not voucher:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher not found")

    now = datetime.now(timezone.utc)
    if voucher.get("start_date") and voucher["start_date"] > now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Voucher not started")
    if voucher.get("end_date") and voucher["end_date"] < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Voucher expired")

    discount_percent = voucher.get("discount_percent", 0)
    discount_amount = int(payload.order_total * discount_percent / 100)
    max_discount = voucher.get("max_discount_amount", 999999999)
    discount_amount = min(discount_amount, max_discount)

    return {
        "voucher": {
            "code": voucher.get("code", ""),
            "discount_percent": discount_percent,
        },
        "orderTotal": payload.order_total,
        "discountAmount": discount_amount,
        "finalTotal": payload.order_total - discount_amount,
    }


# ========== Cart Endpoints ==========

class AddToCartItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    product_id: str = Field(..., alias="productId")
    quantity: int = 1
    attributes: Optional[list[dict]] = []


@cart_router.post("/add-to-cart")
async def add_to_cart(
    payload: AddToCartItem,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    db = get_db()
    cart = await db.carts.find_one({"user_id": user_id})
    if not cart:
        cart = {
            "user_id": user_id,
            "items": [],
            "updated_at": datetime.now(timezone.utc),
        }
        await db.carts.insert_one(cart)
        cart["_id"] = str(cart["_id"])

    product = await _get_product_from_service(payload.product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    variation = await _get_selected_variation(payload.product_id, payload.attributes) or {}
    available_stock = int(variation.get("quantity", product.get("stock", product.get("quantity", 0))) or 0)
    unit_price = variation.get("price", product.get("price", 0))
    if unit_price is None or unit_price < 0:
        unit_price = product.get("price", 0)

    # Build item key from attributes
    attr_key = "|".join(sorted(f"{a.get('name', '')}:{a.get('value', '')}" for a in (payload.attributes or [])))

    # Check if item already exists in cart
    existing_item = None
    for item in cart.get("items", []):
        item_attrs = item.get("attributes", [])
        item_key = "|".join(sorted(f"{a.get('name', '')}:{a.get('value', '')}" for a in item_attrs))
        if item.get("product_id") == payload.product_id and item_key == attr_key:
            existing_item = item
            break

    if existing_item:
        current_quantity = int(existing_item.get("quantity", 0) or 0)
        next_quantity = current_quantity + payload.quantity
        if next_quantity > available_stock:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Chỉ còn {available_stock} sản phẩm trong kho. Giỏ hàng hiện có {current_quantity} sản phẩm.",
            )
        await db.carts.update_one(
            {"user_id": user_id, "items.product_id": payload.product_id, "items.attributes": payload.attributes or []},
            {"$inc": {"items.$.quantity": payload.quantity}},
        )
    else:
        if payload.quantity > available_stock:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Chỉ còn {available_stock} sản phẩm trong kho.",
            )
        thumbnail_url = product.get("thumbnailUrl") or product.get("thumbnail_url", "")
        if not thumbnail_url and product.get("mediaList"):
            media_list = product.get("mediaList", [])
            if media_list and isinstance(media_list[0], dict):
                thumbnail_url = media_list[0].get("url", "")

        shop_id = _extract_shop_id(product) or "default"
        new_item = {
            "item_id": str(ObjectId()),
            "product_id": payload.product_id,
            "name": product.get("name", ""),
            "thumbnailUrl": thumbnail_url,
            "price": unit_price,
            "quantity": payload.quantity,
            "attributes": payload.attributes or [],
            "selected": True,
            "stock": available_stock,
            "shop_id": shop_id,
        }
        await db.carts.update_one(
            {"user_id": user_id},
            {"$push": {"items": new_item}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        )

    return {"status": "success"}


@cart_router.get("/get")
async def get_cart(user_id: str = Depends(get_current_user_id)) -> dict[str, Any]:
    return await get_cart_impl(user_id)


@cart_router.get("/get-mini")
async def get_mini_cart(
    authorization: Annotated[str | None, Header()] = None,
):
    """Get mini cart - returns empty cart if not authenticated."""
    # Try to validate token but don't fail if it's invalid/missing
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:]
        try:
            from jose import jwt
            from core.config import get_settings
            settings = get_settings()
            payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
            user_id = payload.get("sub")
            if user_id:
                db = get_db()
                cart = await db.carts.find_one({"user_id": user_id})
                if not cart:
                    return {"items": []}
                items = [_normalize_cart_item(item) for item in cart.get("items", [])]
                return {"items": items}
        except Exception:
            # Token invalid/expired, return empty cart instead of error
            pass
    
    # No valid token - return empty cart (not 401)
    return {"items": []}


class CartItemUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    itemId: str = Field(..., alias="item_id")
    selected: Optional[bool] = None
    quantity: Optional[int] = None


@cart_router.post("/update")
async def update_cart(
    payload: list[CartItemUpdate] = Body(...),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    db = get_db()
    for item in payload:
        update: dict[str, Any] = {}
        if item.quantity is not None:
            update["items.$.quantity"] = item.quantity
        if item.selected is not None:
            update["items.$.selected"] = item.selected
        if update:
            await db.carts.update_one(
                {"user_id": user_id, "items.item_id": item.itemId},
                {"$set": {**update, "updated_at": datetime.now(timezone.utc)}},
            )
    return {"warnMsg": None, "cart": await get_cart_impl(user_id)}


@cart_router.post("/item/remove")
async def remove_cart_item(
    itemId: str = Query(...),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    db = get_db()
    await db.carts.update_one(
        {"user_id": user_id},
        {"$pull": {"items": {"item_id": itemId}}, "$set": {"updated_at": datetime.now(timezone.utc)}},
    )
    return await get_cart_impl(user_id)


@cart_router.post("/items/remove")
async def remove_cart_items(
    payload: list[str] = Body(...),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    db = get_db()
    await db.carts.update_one(
        {"user_id": user_id},
        {"$pull": {"items": {"item_id": {"$in": payload}}}, "$set": {"updated_at": datetime.now(timezone.utc)}},
    )
    return await get_cart_impl(user_id)


def _normalize_cart_item(item: dict) -> dict:
    """Normalize cart item field names for frontend compatibility."""
    result = dict(item)
    if "thumbnail_url" in result and "thumbnailUrl" not in result:
        result["thumbnailUrl"] = result.pop("thumbnail_url")
    if "item_id" in result and "itemId" not in result:
        result["itemId"] = result["item_id"]
    if "product_id" in result and "productId" not in result:
        result["productId"] = result["product_id"]
    product_id = result.get("product_id") or result.get("productId")
    if product_id and "product_id" not in result:
        result["product_id"] = product_id
    return result


async def get_cart_impl(user_id: str) -> dict[str, Any]:
    db = get_db()
    cart = await db.carts.find_one({"user_id": user_id})
    if not cart:
        return {"shopCarts": []}
    shop_map: dict[str, list] = {}
    for item in cart.get("items", []):
        shop_id = await _resolve_item_shop_id(item)
        item["shop_id"] = shop_id
        if shop_id not in shop_map:
            shop_map[shop_id] = []
        shop_map[shop_id].append(_normalize_cart_item(item))
    shop_carts = []
    for shop_id, items in shop_map.items():
        shop = await _get_shop_from_service(shop_id)
        if not shop:
            shop = {"name": "Shop", "id": shop_id, "username": ""}
        shop_carts.append({
            "shop": {
                "id": shop.get("id", shop_id),
                "name": shop.get("name", "Shop"),
                "username": shop.get("username", ""),
            },
            "items": items,
        })
    return {"shopCarts": shop_carts}


# ========== Checkout Endpoints ==========

class CheckoutBody(BaseModel):
    addressId: Optional[str] = None


@checkout_router.get("/get")
async def get_checkout(
    authorization: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    db = get_db()
    cart = await db.carts.find_one({"user_id": authorization})
    if not cart or not cart.get("items"):
        return {"shopCheckouts": []}

    shop_map: dict[str, list] = {}
    for item in cart.get("items", []):
        if not item.get("selected", True):
            continue
        shop_id = await _resolve_item_shop_id(item)
        item["shop_id"] = shop_id
        if shop_id not in shop_map:
            shop_map[shop_id] = []
        shop_map[shop_id].append(_normalize_cart_item(item))

    checkouts = []
    for shop_id, items in shop_map.items():
        shop = await _get_shop_from_service(shop_id)
        if not shop:
            shop = {"Name": "Shop", "id": shop_id}
        total_price = sum(item.get("price", 0) * item.get("quantity", 1) for item in items)
        checkouts.append({
            "shop": {
                "id": shop.get("id", shop_id),
                "name": shop.get("name", "Shop"),
            },
            "items": items,
            "shipmentFee": 25000,
            "expectedDeliveryDate": datetime.now(timezone.utc).isoformat(),
        })

    return {"shopCheckouts": checkouts}


@checkout_router.post("/get")
async def post_checkout(
    payload: CheckoutBody | None = None,
    authorization: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    return await get_checkout(authorization)
