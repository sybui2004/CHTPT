from __future__ import annotations

import json
import logging
import threading
from typing import Any, Optional

from .client import get_redis_client
from .streams import RedisStreams, StreamConfig

logger = logging.getLogger(__name__)


class ServiceCache:
    """Cross-service cache synchronized via Redis Streams.

    Replaces Redis Pub/Sub to avoid message loss when consumers restart.
    """

    # Streams
    STREAM_SHOP_UPDATES = "service:shop:updates"
    STREAM_PRODUCT_UPDATES = "service:product:updates"
    STREAM_ORDER_UPDATES = "service:order:updates"

    # Consumer group
    GROUP = "service-cache"

    # Cache key prefixes
    PREFIX_SHOP = "cache:shop:"
    PREFIX_SHOP_BY_USER = "cache:shop:by_user:"
    PREFIX_PRODUCT = "cache:product:"
    PREFIX_ORDER = "cache:order:"

    def __init__(self):
        self._redis = get_redis_client()
        self._streams = RedisStreams(self._redis)
        self._local_cache: dict[str, dict] = {}
        self._listener_thread: Optional[threading.Thread] = None
        self._stop_flag = False

    def _get_key(self, prefix: str, entity_id: str) -> str:
        return f"{prefix}{entity_id}"

    # ========== Shop Cache ==========

    def cache_shop(self, shop_id: str, shop_data: dict):
        key = self._get_key(self.PREFIX_SHOP, shop_id)
        self._local_cache[key] = shop_data
        self._redis.set(key, json.dumps(shop_data), ex=3600)

        user_id = shop_data.get("user_id")
        if user_id:
            user_key = self._get_key(self.PREFIX_SHOP_BY_USER, user_id)
            user_mapping = {"shop_id": shop_id}
            self._local_cache[user_key] = user_mapping
            self._redis.set(user_key, json.dumps(user_mapping), ex=3600)

    def get_shop(self, shop_id: str) -> Optional[dict]:
        key = self._get_key(self.PREFIX_SHOP, shop_id)
        if key in self._local_cache:
            return self._local_cache[key]

        data = self._redis.get(key)
        if data:
            shop_data = json.loads(data)
            self._local_cache[key] = shop_data
            return shop_data
        return None

    def get_shop_id_by_user(self, user_id: str) -> Optional[str]:
        user_key = self._get_key(self.PREFIX_SHOP_BY_USER, user_id)
        if user_key in self._local_cache:
            return self._local_cache[user_key].get("shop_id")

        data = self._redis.get(user_key)
        if data:
            mapping = json.loads(data)
            self._local_cache[user_key] = mapping
            return mapping.get("shop_id")
        return None

    def invalidate_shop(self, shop_id: str, shop_data: dict | None = None):
        key = self._get_key(self.PREFIX_SHOP, shop_id)
        self._local_cache.pop(key, None)
        self._redis.delete(key)

        if shop_data:
            user_id = shop_data.get("user_id")
            if user_id:
                user_key = self._get_key(self.PREFIX_SHOP_BY_USER, user_id)
                self._local_cache.pop(user_key, None)
                self._redis.delete(user_key)

    # ========== Product Cache ==========

    def cache_product(self, product_id: str, product_data: dict):
        key = self._get_key(self.PREFIX_PRODUCT, product_id)
        self._local_cache[key] = product_data
        self._redis.set(key, json.dumps(product_data), ex=3600)

    def get_product(self, product_id: str) -> Optional[dict]:
        key = self._get_key(self.PREFIX_PRODUCT, product_id)
        if key in self._local_cache:
            return self._local_cache[key]

        data = self._redis.get(key)
        if data:
            product_data = json.loads(data)
            self._local_cache[key] = product_data
            return product_data
        return None

    def invalidate_product(self, product_id: str):
        key = self._get_key(self.PREFIX_PRODUCT, product_id)
        self._local_cache.pop(key, None)
        self._redis.delete(key)

    # ========== Event Handlers ==========

    def _handle_shop_update(self, data: dict):
        action = data.get("action")
        shop_id = data.get("shop_id")
        shop_data = data.get("data")

        if not shop_id:
            return

        if action in ("create", "update"):
            if shop_data:
                self.cache_shop(shop_id, shop_data)
            else:
                self.invalidate_shop(shop_id)
        elif action == "delete":
            self.invalidate_shop(shop_id, shop_data)

    def _handle_product_update(self, data: dict):
        action = data.get("action")
        product_id = data.get("product_id")
        product_data = data.get("data")

        if not product_id:
            return

        if action in ("create", "update"):
            if product_data:
                self.cache_product(product_id, product_data)
            else:
                self.invalidate_product(product_id)
        elif action == "delete":
            self.invalidate_product(product_id)

    # ========== Publishers ==========

    def publish_shop_update(self, shop_id: str, action: str, shop_data: dict | None = None):
        message = {"action": action, "shop_id": shop_id, "data": shop_data}
        self._streams.publish(self.STREAM_SHOP_UPDATES, message)

    def publish_product_update(self, product_id: str, action: str, product_data: dict | None = None):
        message = {"action": action, "product_id": product_id, "data": product_data}
        self._streams.publish(self.STREAM_PRODUCT_UPDATES, message)

    # ========== Consumer ==========

    def start_subscribing(self, consumer_name: str = ""):
        if self._listener_thread and self._listener_thread.is_alive():
            return

        consumer = consumer_name or f"consumer-{threading.get_ident()}"
        self._stop_flag = False

        def stop_flag() -> bool:
            return self._stop_flag

        def shop_handler(evt: dict[str, Any]):
            self._handle_shop_update(evt)

        def product_handler(evt: dict[str, Any]):
            self._handle_product_update(evt)

        def run():
            logger.info("service_cache_stream_listener_started consumer=%s", consumer)
            RedisStreams().consume_forever(
                StreamConfig(stream=self.STREAM_SHOP_UPDATES, group=self.GROUP, consumer=consumer),
                handler=shop_handler,
                stop_flag=stop_flag,
            )

        def run_product():
            logger.info("service_cache_stream_listener_started consumer=%s", consumer)
            RedisStreams().consume_forever(
                StreamConfig(stream=self.STREAM_PRODUCT_UPDATES, group=self.GROUP, consumer=consumer),
                handler=product_handler,
                stop_flag=stop_flag,
            )

        self._listener_thread = threading.Thread(target=run, daemon=True)
        self._listener_thread.start()
        threading.Thread(target=run_product, daemon=True).start()

    def close(self):
        self._stop_flag = True
        self._local_cache.clear()


_cache: Optional[ServiceCache] = None


def get_service_cache() -> ServiceCache:
    global _cache
    if _cache is None:
        _cache = ServiceCache()
    return _cache
