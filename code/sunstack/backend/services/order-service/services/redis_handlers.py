import logging
from backend.libs.redis import get_redis_client, RedisStreams

logger = logging.getLogger(__name__)


STREAM_ORDER_EVENTS = "order-events"


def publish_order_event(stream: str, data: dict):
    redis_client = get_redis_client()
    RedisStreams(redis_client).publish(stream, data)


async def publish_order_created(order_data: dict):
    logger.info("order_event_publish type=order.created")
    publish_order_event(STREAM_ORDER_EVENTS, {
        "event_type": "order.created",
        "order_id": order_data.get("order_id", ""),
        "user_id": order_data.get("user_id", ""),
        "total_amount": order_data.get("total_amount", 0),
        "shop_orders": order_data.get("shop_orders", []),
        "shipping_address": order_data.get("shipping_address", {}),
        "payment_type": order_data.get("payment_type", "cash_on_delivery"),
    })


async def publish_order_updated(order_id: str, status: str, **kwargs):
    logger.info("order_event_publish type=order.updated")
    publish_order_event(STREAM_ORDER_EVENTS, {
        "event_type": "order.updated",
        "order_id": order_id,
        "status": status,
        **kwargs
    })


async def publish_order_cancelled(order_data: dict):
    logger.info("order_event_publish type=order.cancelled")
    publish_order_event(STREAM_ORDER_EVENTS, {
        "event_type": "order.cancelled",
        "order_id": order_data.get("order_id", ""),
        "user_id": order_data.get("user_id", ""),
        "shop_id": order_data.get("shop_id", ""),
        "reason": order_data.get("reason", ""),
        "old_status": order_data.get("old_status", ""),
        "shop_orders": order_data.get("shop_orders", []),
    })
