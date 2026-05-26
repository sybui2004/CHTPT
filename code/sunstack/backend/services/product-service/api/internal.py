"""
Internal API endpoints for product-service
Used by other services to query product data without direct database access
"""
from datetime import datetime, timezone
from typing import Annotated, Any, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from starlette import status

from core.db import get_db
from core.config import get_settings

router = APIRouter(prefix="/internal", tags=["Internal Products"])


def serialize_value(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, list):
        return [serialize_value(item) for item in value]
    if isinstance(value, dict):
        return serialize_doc(value)
    return value


def serialize_doc(doc: dict[str, Any] | None) -> dict[str, Any]:
    if doc is None:
        return {}

    data: dict[str, Any] = {}
    for key, value in doc.items():
        if key == "_id":
            data["id"] = str(value)
        else:
            data[key] = serialize_value(value)
    return data


def _object_ids(values: list[str]) -> list[ObjectId]:
    return [ObjectId(value) for value in values if ObjectId.is_valid(value)]


def _shop_query(shop_id_list: list[str]) -> dict[str, Any]:
    shop_object_ids = _object_ids(shop_id_list)
    return {
        "$or": [
            {"shop": {"$in": shop_object_ids}},
            {"shop": {"$in": shop_id_list}},
            {"shop_id": {"$in": shop_id_list}},
            {"shopId": {"$in": shop_id_list}},
        ]
    }


async def _resolve_refs(db, collection: str, refs: list[Any] | None) -> list[dict[str, Any]]:
    if not refs:
        return []

    resolved: list[dict[str, Any]] = []
    ids = [ref for ref in refs if isinstance(ref, ObjectId)]
    ids.extend(ObjectId(ref) for ref in refs if isinstance(ref, str) and ObjectId.is_valid(ref))

    if ids:
        async for doc in db[collection].find({"_id": {"$in": ids}}):
            resolved.append(serialize_doc(doc))

    for ref in refs:
        if isinstance(ref, dict):
            resolved.append(serialize_doc(ref))

    return resolved


async def verify_internal_key(x_internal_key: Annotated[str | None, Header()] = None) -> bool:
    """Verify internal API key for inter-service communication."""
    settings = get_settings()
    if not x_internal_key or x_internal_key != settings.internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid internal API key"
        )
    return True


@router.get("/products/count")
async def count_products_by_shop(
    shop_ids: str = Query(..., description="Comma-separated shop IDs"),
    x_internal_key: Annotated[str | None, Header()] = None,
) -> dict[str, int]:
    """Count products by shop (used by shop dashboard)."""
    await verify_internal_key(x_internal_key)
    
    db = get_db()
    shop_id_list = [s.strip() for s in shop_ids.split(",")]
    
    count = await db.products.count_documents(_shop_query(shop_id_list))
    return {"count": count}


@router.get("/products/count-restricted")
async def count_restricted_products(
    shop_ids: str = Query(..., description="Comma-separated shop IDs"),
    x_internal_key: Annotated[str | None, Header()] = None,
) -> dict[str, int]:
    """Count restricted/inactive products (used by shop dashboard)."""
    await verify_internal_key(x_internal_key)
    
    db = get_db()
    shop_id_list = [s.strip() for s in shop_ids.split(",")]
    
    count = await db.products.count_documents({
        "$and": [
            _shop_query(shop_id_list),
            {
                "$or": [
                    {"restricted": True},
                    {"restrictStatus": {"$nin": ["OPENED", None, ""]}},
                    {"status": {"$in": ["RESTRICTED", "SUSPENDED", "BLOCKED"]}},
                    {"is_active": False},
                    {"visible": False},
                ]
            },
        ]
    })
    return {"count": count}


@router.get("/products")
async def list_products_by_shop(
    shop_ids: str = Query(..., description="Comma-separated shop IDs"),
    status_filter: Optional[str] = Query(None, description="Filter type: all, active, restricted, inactive, out_of_stock"),
    page: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("created_at"),
    sort_order: int = Query(-1),
    x_internal_key: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    """List products for shop management (used by shop-service)."""
    await verify_internal_key(x_internal_key)
    
    db = get_db()
    shop_id_list = [s.strip() for s in shop_ids.split(",")]
    
    query_parts: list[dict[str, Any]] = [_shop_query(shop_id_list)]
    
    if status_filter == "active":
        query_parts.extend([
            {"is_active": {"$ne": False}},
            {"visible": {"$ne": False}},
            {"restricted": {"$ne": True}},
            {"restrictStatus": {"$in": ["OPENED", None, ""]}},
            {"status": {"$nin": ["RESTRICTED", "SUSPENDED", "BLOCKED"]}},
        ])
    elif status_filter == "restricted":
        query_parts.append({
            "$or": [
                {"restricted": True},
                {"restrictStatus": {"$nin": ["OPENED", None, ""]}},
                {"status": {"$in": ["RESTRICTED", "SUSPENDED", "BLOCKED"]}},
            ]
        })
    elif status_filter == "inactive":
        query_parts.append({
            "$or": [
                {"is_active": False},
                {"visible": False},
            ]
        })
    elif status_filter == "out_of_stock":
        query_parts.append({"quantity": {"$lte": 0}})
    
    if keyword:
        query_parts.append({"name": {"$regex": keyword, "$options": "i"}})

    query: dict[str, Any] = {"$and": query_parts}
    
    total = await db.products.count_documents(query)
    
    sort_field_map = {
        "created_at": "createdAt",
        "price": "price",
        "sold": "sold",
        "quantity": "quantity",
    }
    sort_field = sort_field_map.get(sort_by, "createdAt")
    
    cursor = db.products.find(query).sort(sort_field, sort_order).skip(page * limit).limit(limit)
    
    products = []
    async for doc in cursor:
        data = serialize_doc(doc)
        sku_list = await _resolve_refs(db, "product_skus", doc.get("skuList") or doc.get("sku_list"))
        media_list = await _resolve_refs(db, "product_media", doc.get("mediaList") or doc.get("media_list"))
        products.append({
            **data,
            "thumbnailUrl": data.get("thumbnailUrl") or data.get("thumbnail_url") or "",
            "visible": data.get("visible", data.get("is_active", True)),
            "restricted": data.get("restricted", False) or data.get("status") in ["RESTRICTED", "SUSPENDED", "BLOCKED"],
            "quantity": data.get("quantity", 0),
            "skuList": sku_list,
            "mediaList": media_list,
        })
    
    total_pages = (total + limit - 1) // limit if limit else 0
    
    return {
        "content": products,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
    }


@router.get("/products/{product_id}")
async def get_product_by_id(
    product_id: str,
    x_internal_key: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    """Get product by ID (used by other services)."""
    await verify_internal_key(x_internal_key)
    
    db = get_db()
    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=404, detail="Invalid product ID")
    
    product = await db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    data = serialize_doc(product)
    sku_list = await _resolve_refs(db, "product_skus", product.get("skuList") or product.get("sku_list"))
    media_list = await _resolve_refs(db, "product_media", product.get("mediaList") or product.get("media_list"))

    # Add shop_id field for compatibility (product may have 'shop' or 'shop_id' field)
    shop_id = data.get("shop_id") or data.get("shop") or ""
    if isinstance(shop_id, dict) and "$oid" in shop_id:
        shop_id = shop_id["$oid"]

    return {
        **data,
        "shop_id": str(shop_id),
        "shopId": str(shop_id),
        "thumbnailUrl": data.get("thumbnailUrl") or data.get("thumbnail_url") or "",
        "visible": data.get("visible", data.get("is_active", True)),
        "quantity": data.get("quantity", 0),
        "skuList": sku_list,
        "mediaList": media_list,
    }


@router.get("/products/batch")
async def get_products_batch(
    product_ids: str = Query(..., description="Comma-separated product IDs"),
    x_internal_key: Annotated[str | None, Header()] = None,
) -> list[dict[str, Any]]:
    """Get multiple products by IDs (used by other services)."""
    await verify_internal_key(x_internal_key)
    
    db = get_db()
    ids = [ObjectId(pid.strip()) for pid in product_ids.split(",") if ObjectId.is_valid(pid.strip())]
    
    products = []
    async for doc in db.products.find({"_id": {"$in": ids}}):
        products.append(serialize_doc(doc))
    
    return products


@router.put("/products/{product_id}")
async def update_product_internal(
    product_id: str,
    payload: dict,
    x_internal_key: Annotated[str | None, Header()] = None,
) -> dict[str, str]:
    """Update product (used by shop-service for product management)."""
    await verify_internal_key(x_internal_key)
    
    db = get_db()
    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product ID")
    
    update_data = {k: v for k, v in payload.items() if v is not None}
    update_data["updatedAt"] = datetime.now(timezone.utc)
    
    result = await db.products.find_one_and_update(
        {"_id": ObjectId(product_id)},
        {"$set": update_data},
        return_document=True,
    )
    
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    return {"status": "success"}


@router.put("/products/{product_id}/visibility")
async def toggle_product_visibility(
    product_id: str,
    visible: bool = Query(...),
    x_internal_key: Annotated[str | None, Header()] = None,
) -> dict[str, str]:
    """Toggle product visibility (used by shop-service)."""
    await verify_internal_key(x_internal_key)
    
    db = get_db()
    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product ID")
    
    result = await db.products.update_one(
        {"_id": ObjectId(product_id)},
        {"$set": {"is_active": visible, "visible": visible, "updatedAt": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    return {"status": "success"}
