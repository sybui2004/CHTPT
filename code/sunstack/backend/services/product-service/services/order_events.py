from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone
from typing import Any

from bson import DBRef, ObjectId
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

from backend.libs.redis import RedisStreams, StreamConfig
from core.config import get_settings

logger = logging.getLogger(__name__)

STREAM_ORDER_EVENTS = "order-events"
GROUP = "product-inventory"
CONFIRMED_STATUSES = {"CONFIRMED", "2"}

_listener_thread: threading.Thread | None = None
_stop_flag = False


def _as_object_id(value: Any) -> ObjectId | None:
    if isinstance(value, DBRef):
        value = value.id
    if isinstance(value, ObjectId):
        return value
    if isinstance(value, str) and ObjectId.is_valid(value):
        return ObjectId(value)
    return None


def _same_attributes(left: list[dict[str, Any]], right: list[dict[str, Any]]) -> bool:
    if len(left) != len(right):
        return False
    right_map = {attr.get("name"): attr.get("value") for attr in right}
    return all(right_map.get(attr.get("name")) == attr.get("value") for attr in left)


def _get_product_db():
    settings = get_settings()
    client = MongoClient(settings.mongo_uri)
    return client, client[settings.mongo_database]


def _load_order(client: MongoClient, event: dict[str, Any]) -> dict[str, Any] | None:
    if event.get("shop_orders"):
        return {
            "order_id": event.get("order_id"),
            "status": event.get("status"),
            "shop_orders": event.get("shop_orders") or [],
        }

    order_id = event.get("order_id")
    oid = _as_object_id(order_id)
    if oid is None:
        return None

    order_db = client.get_database("order_db")
    order = order_db.orders.find_one({"_id": oid})
    if not order:
        return None
    order["order_id"] = str(order["_id"])
    return order


def _find_matching_sku(db, product: dict[str, Any], attributes: list[dict[str, Any]]) -> dict[str, Any] | None:
    sku_refs = product.get("skuList") or product.get("sku_list") or []
    for ref in sku_refs:
        sku_id = _as_object_id(ref)
        if sku_id is None:
            continue
        sku = db.product_skus.find_one({"_id": sku_id})
        if sku and _same_attributes(sku.get("attributes") or [], attributes):
            return sku
    return None


def _decrement_item_stock(db, item: dict[str, Any]) -> None:
    product_id = item.get("product_id") or item.get("productId")
    product_oid = _as_object_id(product_id)
    if product_oid is None:
        logger.warning("inventory_decrement_skipped reason=invalid_product_id product_id=%s", product_id)
        return

    quantity = int(item.get("quantity", 0) or 0)
    if quantity <= 0:
        return

    product = db.products.find_one({"_id": product_oid})
    if not product:
        logger.warning("inventory_decrement_skipped reason=product_not_found product_id=%s", product_id)
        return

    attributes = item.get("attributes") or []
    sku = _find_matching_sku(db, product, attributes) if attributes else None
    now = datetime.now(timezone.utc)

    if sku:
        sku_result = db.product_skus.update_one(
            {"_id": sku["_id"], "quantity": {"$gte": quantity}},
            {"$inc": {"quantity": -quantity}, "$set": {"updatedAt": now}},
        )
        if sku_result.modified_count == 0:
            logger.warning("inventory_sku_decrement_failed product_id=%s sku_id=%s quantity=%s", product_id, sku["_id"], quantity)
            return

    product_result = db.products.update_one(
        {"_id": product_oid, "quantity": {"$gte": quantity}},
        {"$inc": {"quantity": -quantity, "sold": quantity}, "$set": {"updatedAt": now}},
    )
    if product_result.modified_count == 0:
        logger.warning("inventory_product_decrement_failed product_id=%s quantity=%s", product_id, quantity)


def _handle_confirmed_order(event: dict[str, Any]) -> None:
    client, db = _get_product_db()
    try:
        order = _load_order(client, event)
        if not order:
            logger.warning("inventory_event_skipped reason=order_not_found order_id=%s", event.get("order_id"))
            return

        order_id = str(order.get("order_id") or order.get("_id") or event.get("order_id") or "")
        status = str(event.get("status") or order.get("status") or "")
        shop_id_filter = str(event.get("shop_id") or "")
        if status not in CONFIRMED_STATUSES:
            return

        shop_orders = order.get("shop_orders") or []
        for shop_order in shop_orders:
            shop_id = str(shop_order.get("shop_id") or shop_order.get("shopId") or "")
            if shop_id_filter and shop_id != shop_id_filter:
                continue
            shop_status = status if event.get("status") in CONFIRMED_STATUSES else str(shop_order.get("status") or status)
            if shop_status not in CONFIRMED_STATUSES:
                continue

            event_id = f"order-confirmed:{order_id}:{shop_id or 'all'}"
            now = datetime.now(timezone.utc)
            try:
                db.inventory_events.insert_one({
                    "_id": event_id,
                    "order_id": order_id,
                    "shop_id": shop_id,
                    "event_type": event.get("event_type"),
                    "created_at": now,
                    "status": "processing",
                })
            except DuplicateKeyError:
                marker = db.inventory_events.find_one({"_id": event_id})
                if marker and marker.get("processed_at"):
                    logger.info("inventory_event_already_processed order_id=%s shop_id=%s", order_id, shop_id)
                    continue
                db.inventory_events.update_one(
                    {"_id": event_id},
                    {"$set": {"status": "processing", "updated_at": now}},
                )

            for item in shop_order.get("items") or []:
                _decrement_item_stock(db, item)

            db.inventory_events.update_one(
                {"_id": event_id},
                {"$set": {"status": "processed", "processed_at": datetime.now(timezone.utc)}},
            )
            logger.info("inventory_decremented order_id=%s shop_id=%s", order_id, shop_id)
    finally:
        client.close()


def _handle_order_event(event: dict[str, Any]) -> None:
    if event.get("event_type") != "order.updated":
        return
    _handle_confirmed_order(event)


def start_order_event_listener(consumer_name: str) -> None:
    global _listener_thread, _stop_flag
    if _listener_thread and _listener_thread.is_alive():
        return

    _stop_flag = False
    streams = RedisStreams()
    consumer = consumer_name or "product-service"

    def stop_flag() -> bool:
        return _stop_flag

    def run() -> None:
        logger.info("order_event_listener_started consumer=%s", consumer)
        streams.consume_forever(
            StreamConfig(stream=STREAM_ORDER_EVENTS, group=GROUP, consumer=consumer),
            handler=_handle_order_event,
            stop_flag=stop_flag,
        )

    _listener_thread = threading.Thread(target=run, daemon=True)
    _listener_thread.start()


def stop_order_event_listener() -> None:
    global _stop_flag
    _stop_flag = True
