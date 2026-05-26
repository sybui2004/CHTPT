"""
Internal API endpoints for order-service
Used by other services to query order data without direct database access
"""
from datetime import datetime, timezone
from typing import Annotated, Any, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel

from core.db import get_db
from core.config import get_settings
from services.redis_handlers import publish_order_cancelled, publish_order_updated

router = APIRouter(prefix="/internal", tags=["Internal Orders"])


class OrderItemResponse(BaseModel):
    id: Optional[str] = None
    item_id: Optional[str] = None
    product_id: Optional[str] = None
    name: Optional[str] = None
    thumbnailUrl: Optional[str] = None
    quantity: int = 1
    price: int = 0
    attributes: list = []


class ShopOrderResponse(BaseModel):
    shop_id: str
    status: str
    total_price: int
    items: list[OrderItemResponse] = []
    shipping_fee: int = 0


class OrderResponse(BaseModel):
    id: str
    user_id: str
    status: str
    shop_orders: list[ShopOrderResponse] = []
    created_at: Optional[str] = None


def _normalize_status(status: str) -> str:
    """Normalize status values: DB uses 'SHIPPED' but enum expects 'SHIPPING'."""
    if status == "SHIPPED":
        return "SHIPPING"
    return status


def _payment_completed_update(now: datetime) -> dict[str, Any]:
    return {
        "completedPayment": True,
        "completed_payment": True,
        "payment.status": "COMPLETED",
        "payment.completedAt": now,
        "payment.completed_at": now,
    }


def serialize_doc(doc: dict[str, Any]) -> dict[str, Any]:
    if doc is None:
        return {}
    data = doc.copy()
    if "_id" in data:
        data["id"] = str(data.pop("_id"))
    # Normalize top-level status
    if "status" in data:
        data["status"] = _normalize_status(data["status"])
    if "shop_orders" in data:
        for so in data["shop_orders"]:
            if "_id" in so:
                so["id"] = str(so.pop("_id"))
            if "status" in so:
                so["status"] = _normalize_status(so["status"])
    return data


def serialize_shop_order(so: dict[str, Any]) -> dict[str, Any]:
    shop_id = so.get("shop_id") or ""
    if isinstance(shop_id, ObjectId):
        shop_id = str(shop_id)
    items = []
    for item in so.get("items", []):
        items.append({
            "id": item.get("item_id") or item.get("id") or item.get("product_id") or "",
            "item_id": item.get("item_id") or "",
            "product_id": item.get("product_id") or "",
            "name": item.get("name") or "",
            "thumbnailUrl": item.get("thumbnailUrl") or item.get("thumbnail_url") or "",
            "quantity": item.get("quantity", 1),
            "price": item.get("price", 0),
            "attributes": item.get("attributes", []),
        })
    return {
        "id": str(so.get("_id") or so.get("id") or ""),
        "shop_id": shop_id,
        "status": _normalize_status(so.get("status") or ""),
        "total_price": so.get("total_price") or so.get("total") or 0,
        "items": items,
        "shipping_fee": so.get("shipping_fee", 0),
    }


async def verify_internal_key(x_internal_key: Annotated[str | None, Header()] = None) -> bool:
    """Verify internal API key for inter-service communication."""
    settings = get_settings()
    if not x_internal_key or x_internal_key != settings.internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid internal API key"
        )
    return True


@router.get("/orders/count")
async def count_orders_by_status(
    shop_ids: str = Query(..., description="Comma-separated shop IDs"),
    statuses: str = Query(..., description="Comma-separated statuses to count"),
    x_internal_key: Annotated[str | None, Header()] = None,
) -> dict[str, int]:
    """Count orders by shop and status (used by shop dashboard)."""
    await verify_internal_key(x_internal_key)
    
    db = get_db()
    shop_id_list = [s.strip() for s in shop_ids.split(",")]
    shop_id_values: list[Any] = []
    for shop_id in shop_id_list:
        shop_id_values.append(shop_id)
        if ObjectId.is_valid(shop_id):
            shop_id_values.append(ObjectId(shop_id))
    status_list = [s.strip() for s in statuses.split(",")]
    
    pipeline = [
        {"$unwind": "$shop_orders"},
        {
            "$match": {
                "shop_orders.shop_id": {"$in": shop_id_values},
                "shop_orders.status": {"$in": status_list},
            }
        },
        {"$count": "total"},
    ]
    
    result = await db.orders.aggregate(pipeline).to_list(length=1)
    return {"count": result[0]["total"] if result else 0}


@router.get("/orders")
async def list_orders_by_shop(
    shop_ids: str = Query(..., description="Comma-separated shop IDs"),
    status: Optional[str] = Query(None, description="Filter by status"),
    statuses: Optional[str] = Query(None, description="Comma-separated statuses to filter"),
    page: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    filter_type: Optional[str] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: int = Query(-1),
    x_internal_key: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    """List orders for shop management (used by shop-service)."""
    await verify_internal_key(x_internal_key)
    
    db = get_db()
    shop_id_list = [s.strip() for s in shop_ids.split(",")]
    shop_id_values: list[Any] = []
    for shop_id in shop_id_list:
        shop_id_values.append(shop_id)
        if ObjectId.is_valid(shop_id):
            shop_id_values.append(ObjectId(shop_id))
    
    match: dict[str, Any] = {"shop_orders.shop_id": {"$in": shop_id_values}}
    
    if statuses:
        status_list: list[Any] = []
        for value in [s.strip() for s in statuses.split(",") if s.strip()]:
            status_list.append(value)
            if value.isdigit():
                status_list.append(int(value))
        if status_list:
            match["shop_orders.status"] = {"$in": status_list}
    elif status:
        match["shop_orders.status"] = status
    
    pipeline = [
        {"$unwind": "$shop_orders"},
        {"$match": match},
    ]
    
    if keyword:
        regex = {"$regex": keyword, "$options": "i"}
        if filter_type == "1":
            if ObjectId.is_valid(keyword):
                pipeline.append({"$match": {"_id": ObjectId(keyword)}})
            else:
                pipeline.append({"$match": {"_id_text": regex}})
        elif filter_type == "2":
            pipeline.append({"$match": {"user_id": regex}})
        elif filter_type == "3":
            pipeline.append({"$match": {"shop_orders.items.name": regex}})
        else:
            pipeline.append({
                "$match": {
                    "$or": [
                        {"user_id": regex},
                        {"shop_orders.items.name": regex},
                    ]
                }
            })
    
    # Count total
    count_pipeline = [*pipeline, {"$count": "total"}]
    count_result = await db.orders.aggregate(count_pipeline).to_list(length=1)
    total = count_result[0]["total"] if count_result else 0
    
    # Get paginated results
    sort_field_map = {
        "created_at": "created_at",
        "total_price": "shop_orders.total_price",
    }
    sort_field = sort_field_map.get(sort_by, "created_at")
    direction = 1 if sort_order == 1 else -1

    pipeline.extend([
        {"$sort": {sort_field: direction}},
        {"$skip": page * limit},
        {"$limit": limit},
    ])
    
    orders = []
    async for doc in db.orders.aggregate(pipeline):
        order = {
            "id": str(doc.get("_id")),
            "user_id": doc.get("user_id", ""),
            "status": _normalize_status(doc.get("shop_orders", {}).get("status", "")),
            "shop_orders": [serialize_shop_order(doc.get("shop_orders", {}))],
            "created_at": str(doc.get("created_at", "")),
            "payment_type": doc.get("payment_type", "cash_on_delivery"),
            "completed_payment": bool(doc.get("completedPayment") or doc.get("completed_payment") or doc.get("payment", {}).get("status") == "COMPLETED"),
        }
        orders.append(order)
    
    return {
        "content": orders,
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/orders/{order_id}")
async def get_order_by_id(
    order_id: str,
    x_internal_key: Annotated[str | None, Header()] = None,
) -> Optional[dict[str, Any]]:
    """Get order by ID (used by other services)."""
    await verify_internal_key(x_internal_key)
    
    db = get_db()
    if not ObjectId.is_valid(order_id):
        return None
    
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        return None
    
    return serialize_doc(order)


@router.put("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    status: str = Query(...),
    x_internal_key: Annotated[str | None, Header()] = None,
) -> dict[str, str]:
    """Update order status (used by shop-service for order management)."""
    await verify_internal_key(x_internal_key)
    
    db = get_db()
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid order ID")
    
    normalized_status = _normalize_status(status)
    now = datetime.now(timezone.utc)
    update_data = {"status": normalized_status, "updated_at": now}
    if normalized_status == "DELIVERED":
        update_data.update(_payment_completed_update(now))

    result = await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if normalized_status == "CONFIRMED":
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
        try:
            await publish_order_updated(
                order_id,
                normalized_status,
                user_id=order.get("user_id", "") if order else "",
                shop_orders=order.get("shop_orders", []) if order else [],
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("order_update_event_publish_failed order_id=%s err=%s", order_id, e)
    
    return {"status": "success"}


@router.put("/orders/{order_id}/shop-order/{shop_id}/status")
async def update_shop_order_status(
    order_id: str,
    shop_id: str,
    status: str = Query(...),
    x_internal_key: Annotated[str | None, Header()] = None,
) -> dict[str, str]:
    """Update shop order status (used by shop-service for order management)."""
    await verify_internal_key(x_internal_key)
    
    db = get_db()
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid order ID")
    
    normalized_status = _normalize_status(status)
    now = datetime.now(timezone.utc)
    update_data = {
        "shop_orders.$.status": normalized_status,
        "status": normalized_status,
        "updated_at": now,
    }
    if normalized_status == "DELIVERED":
        update_data.update(_payment_completed_update(now))

    result = await db.orders.update_one(
        {"_id": ObjectId(order_id), "shop_orders.shop_id": shop_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order or shop order not found")

    if normalized_status == "CONFIRMED":
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
        try:
            await publish_order_updated(
                order_id,
                normalized_status,
                user_id=order.get("user_id", "") if order else "",
                shop_id=shop_id,
                shop_orders=order.get("shop_orders", []) if order else [],
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("shop_order_update_event_publish_failed order_id=%s shop_id=%s err=%s", order_id, shop_id, e)
    
    return {"status": "success"}


@router.put("/orders/{order_id}/shop-order/{shop_id}/cancel")
async def cancel_shop_order(
    order_id: str,
    shop_id: str,
    reason: str = Query(...),
    x_internal_key: Annotated[str | None, Header()] = None,
) -> dict[str, str]:
    """Cancel a specific shop order (used by shop owner)."""
    await verify_internal_key(x_internal_key)
    
    db = get_db()
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid order ID")
    
    order = await db.orders.find_one({"_id": ObjectId(order_id), "shop_orders.shop_id": shop_id})
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order or shop order not found")
    
    # Find the specific shop order
    shop_order = None
    for so in order.get("shop_orders", []):
        so_shop_id = str(so.get("shop_id", ""))
        if so_shop_id == shop_id or so_shop_id == shop_id.replace('"', ''):
            shop_order = so
            break
    
    if not shop_order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop order not found")
    
    # Check if shop order can be cancelled
    if shop_order.get("status") not in ["PENDING", "1"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot cancel shop order in current status")
    
    # Update shop order status to CANCELLED
    result = await db.orders.update_one(
        {"_id": ObjectId(order_id), "shop_orders.shop_id": shop_id},
        {"$set": {
            "shop_orders.$.status": "CANCELLED",
            "shop_orders.$.cancel_reason": reason,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Failed to update shop order")

    try:
        updated_order = await db.orders.find_one({"_id": ObjectId(order_id)})
        await publish_order_cancelled({
            "order_id": order_id,
            "user_id": order.get("user_id", ""),
            "shop_id": shop_id,
            "reason": reason,
            "old_status": shop_order.get("status", ""),
            "shop_orders": updated_order.get("shop_orders", []) if updated_order else [],
        })
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("shop_order_cancel_event_publish_failed order_id=%s shop_id=%s err=%s", order_id, shop_id, e)
    
    return {"status": "success", "message": "Shop order cancelled successfully"}
