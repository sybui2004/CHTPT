from datetime import datetime, timezone
from typing import Any, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
import logging

from core.db import get_db, serialize_doc
from core.internal_client import get_internal_client

from schemas.shop import (
    ShopResponse,
    ShopUpdate,
    SaveProductDTO,
    InventoryAlertConfigDTO,
)
from api.helpers import get_current_user_id, find_owned_shop, serialize_shop_doc

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/dashboard/get_task_overview")
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


@router.get("/profile/get")
async def shop_get_profile(user_id: str = Depends(get_current_user_id)) -> dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    from api.helpers import get_or_create_shop
    return await get_or_create_shop(user_id)


@router.post("/profile/update")
async def shop_update_profile(
    payload: ShopUpdate,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    shop = await find_owned_shop(user_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    result = await db.shops.find_one_and_update(
        {"_id": shop["_id"]},
        {"$set": update_data},
        return_document=True,
    )
    return ShopResponse(**serialize_doc(result))


@router.get("/profile/get_address")
async def shop_get_address(user_id: str = Depends(get_current_user_id)) -> dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    db = get_db()
    address = await db.shop_addresses.find_one({"user_id": user_id})
    if not address:
        return {}
    return serialize_doc(address)


@router.post("/profile/update_address")
async def shop_update_address(
    payload: BaseModel,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    db = get_db()
    data = payload.model_dump()
    data["user_id"] = user_id
    await db.shop_addresses.update_one(
        {"user_id": user_id},
        {"$set": data},
        upsert=True,
    )
    return {"status": "success"}


@router.get("/product/list")
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


@router.get("/product/inventory-alert-config")
async def shop_get_inventory_alert_config(user_id: str = Depends(get_current_user_id)) -> dict[str, int]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    db = get_db()
    shop = await find_owned_shop(user_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    config = await db.shop_settings.find_one({"shop_id": str(shop["_id"])})
    return {"lowStockThreshold": int(config.get("lowStockThreshold", 10)) if config else 10}


@router.post("/product/inventory-alert-config")
async def shop_update_inventory_alert_config(
    payload: InventoryAlertConfigDTO,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, int]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    if payload.lowStockThreshold < 1:
        raise HTTPException(status_code=400, detail="lowStockThreshold must be greater than 0")
    db = get_db()
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


@router.get("/product/{product_id}")
async def shop_get_product(product_id: str) -> dict[str, Any]:
    db = get_db()
    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=400, detail="Invalid product ID")
    product = await db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return serialize_doc(product)


@router.post("/product/add")
async def shop_add_product(
    payload: SaveProductDTO,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    db = get_db()
    shop = await find_owned_shop(user_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    product_data = payload.model_dump()
    product_data["shop_id"] = str(shop["_id"])
    product_data["is_active"] = True
    product_data["sold"] = 0
    product_data["average_rating"] = 0
    product_data["total_reviews"] = 0
    product_data["created_at"] = datetime.now(timezone.utc)
    product_data["updated_at"] = datetime.now(timezone.utc)

    result = await db.products.insert_one(product_data)
    return {"id": str(result.inserted_id)}


@router.post("/product/update")
async def shop_update_product(
    payload: SaveProductDTO,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    if not payload.product_id:
        raise HTTPException(status_code=400, detail="productId required")
    db = get_db()
    shop = await find_owned_shop(user_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    update_data = {k: v for k, v in payload.model_dump().items() if v is not None and k != "product_id"}
    update_data["updated_at"] = datetime.now(timezone.utc)

    result = await db.products.find_one_and_update(
        {"_id": ObjectId(payload.product_id), "shop_id": str(shop["_id"])},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"status": "success"}


@router.post("/product/change_visible")
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


@router.post("/product/delete/{product_id}")
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


@router.get("/order/get_list")
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
    shop_ids: list[Any] = [shop_id]
    if ObjectId.is_valid(shop_id):
        shop_ids.append(ObjectId(shop_id))

    status_by_type = {
        "1": [1, "1", "PENDING"], "2": [2, "2", "CONFIRMED", "PREPARING"],
        "3": [3, "3", "SHIPPED"], "4": [4, "4", "SHIPPING"],
        "5": [5, "5", "DELIVERED"], "6": [7, "7", "CANCELLED"],
    }

    match: dict[str, Any] = {"shop_orders.shop_id": {"$in": shop_ids}}
    if status_filter := status_by_type.get(str(type)):
        match["shop_orders.status"] = {"$in": status_filter}

    pipeline: list[dict[str, Any]] = [{"$unwind": "$shop_orders"}, {"$match": match}]

    if keyword:
        regex = {"$regex": keyword, "$options": "i"}
        if filterType == "1":
            pipeline.append({"$match": {"_id": regex}})
        elif filterType == "2":
            pipeline.append({"$match": {"user_id": regex}})
        elif filterType == "3":
            pipeline.append({"$match": {"shop_orders.items.name": regex}})

    sort_field = "created_at"
    sort_direction = -1
    if sortType == "1":
        sort_direction = 1
    elif sortType in {"2", "3"}:
        sort_field = "shop_orders.total_price"
        sort_direction = -1 if sortType == "2" else 1

    total_rows = await db.orders.aggregate([*pipeline, {"$count": "total"}]).to_list(length=1)
    total = total_rows[0]["total"] if total_rows else 0

    pipeline.extend([{"$sort": {sort_field: sort_direction}}, {"$skip": page * limit}, {"$limit": limit}])

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
            "orderId": str(doc.get("_id")),  # Parent order ID for cancel operation
            "shopId": shop_id,  # Shop ID for cancel operation
            "createdAt": doc.get("createdAt") or doc.get("created_at"),
            "buyerName": doc.get("buyerName") or doc.get("user_id") or "Khách hàng",
            "items": items,
            "paymentType": doc.get("paymentType") or doc.get("payment_type") or "cash_on_delivery",
            "completedPayment": bool(doc.get("completedPayment") or doc.get("payment", {}).get("status") == "COMPLETED"),
            "total": shop_order.get("total") or shop_order.get("total_price") or 0,
            "status": status_number,
        })

    return {"content": content, "totalElements": total, "totalPages": (total + limit - 1) // limit if limit else 0, "page": page, "limit": limit}


@router.post("/order/update")
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

    status_to_order_status = {"CONFIRMED": "CONFIRMED", "PREPARING": "PREPARING", "SHIPPED": "SHIPPED", "CANCELLED": "CANCELLED"}
    new_order_status = status_to_order_status.get(currentStatus, currentStatus)

    updated = await get_internal_client().update_shop_order_status(shopOrderId, shop_id, new_order_status)
    if not updated:
        raise HTTPException(status_code=404, detail="Order not found or not owned")

    return {"status": "success"}


@router.post("/order/cancel")
async def shop_cancel_order(
    orderId: str = Query(..., alias="orderId"),
    shopId: str = Query(..., alias="shopId"),
    cancelReason: str = Query(..., alias="cancelReason"),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, str]:
    """Cancel a shop order (called by shop owner)."""
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = get_db()
    shop = await find_owned_shop(user_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    # Verify shop ID matches
    shop_id = str(shop["_id"])
    if shopId != shop_id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this order")

    if not ObjectId.is_valid(orderId):
        raise HTTPException(status_code=400, detail="Invalid order ID")

    cancelled = await get_internal_client().cancel_shop_order(orderId, shop_id, cancelReason)
    if not cancelled:
        raise HTTPException(status_code=404, detail="Failed to cancel order")

    return {"status": "success", "message": "Order cancelled successfully"}


@router.get("/complaints")
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


@router.post("/complaints/{complaint_id}/action")
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
