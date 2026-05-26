"""
Internal API client for shop-service to call other services
This follows the Data Ownership pattern - shop-service calls other services' APIs
instead of accessing their databases directly
"""

from typing import Optional
import httpx

from backend.libs import RetryConfig, retry_async
from core.config import get_settings


class InternalAPIClient:
    """Client for calling other services' internal APIs."""
    
    def __init__(self):
        self.settings = get_settings()
        self._order_client: Optional[httpx.AsyncClient] = None
        self._product_client: Optional[httpx.AsyncClient] = None
    
    async def _get_order_client(self) -> httpx.AsyncClient:
        if self._order_client is None:
            self._order_client = httpx.AsyncClient(
                base_url=self.settings.order_service_url,
                timeout=30.0,
                headers={"X-Internal-Key": self.settings.internal_api_key}
            )
        return self._order_client
    
    async def _get_product_client(self) -> httpx.AsyncClient:
        if self._product_client is None:
            self._product_client = httpx.AsyncClient(
                base_url=self.settings.product_service_url,
                timeout=30.0,
                headers={"X-Internal-Key": self.settings.internal_api_key}
            )
        return self._product_client
    
    async def close(self):
        if self._order_client:
            await self._order_client.aclose()
            self._order_client = None
        if self._product_client:
            await self._product_client.aclose()
            self._product_client = None
    
    # ========== Order Service APIs ==========
    
    async def count_orders_by_status(self, shop_ids: list[str], statuses: list[str]) -> int:
        """Count orders by shop and status (for shop dashboard)."""
        client = await self._get_order_client()

        async def _do() -> httpx.Response:
            return await client.get(
                "/internal/orders/count",
                params={
                    "shop_ids": ",".join(shop_ids),
                    "statuses": ",".join(statuses),
                },
            )

        try:
            response = await retry_async(
                _do,
                cfg=RetryConfig(max_attempts=3, base_delay_s=0.2, max_delay_s=1.0, jitter_s=0.1),
                is_retryable_exc=lambda e: isinstance(e, (httpx.ConnectError, httpx.ReadTimeout, httpx.RemoteProtocolError, httpx.PoolTimeout)),
            )
            if response.status_code == 200:
                return response.json().get("count", 0)
        except Exception:
            pass
        return 0
    
    async def list_orders_by_shop(
        self,
        shop_ids: list[str],
        status: Optional[str] = None,
        statuses: Optional[list[str]] = None,
        page: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        filter_type: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: int = -1,
    ) -> dict:
        """List orders for shop management."""
        client = await self._get_order_client()
        params = {
            "shop_ids": ",".join(shop_ids),
            "page": page,
            "limit": limit,
            "sort_by": sort_by,
            "sort_order": sort_order,
        }
        if statuses:
            params["statuses"] = ",".join(statuses)
        elif status:
            params["status"] = status
        if keyword:
            params["keyword"] = keyword
        if filter_type:
            params["filter_type"] = filter_type
        
        try:
            response = await client.get("/internal/orders", params=params)
            if response.status_code == 200:
                return response.json()
        except Exception:
            pass
        return {"content": [], "total": 0, "page": page, "limit": limit}
    
    async def update_shop_order_status(self, order_id: str, shop_id: str, status: str) -> bool:
        """Update shop order status."""
        client = await self._get_order_client()
        try:
            response = await client.put(
                f"/internal/orders/{order_id}/shop-order/{shop_id}/status",
                params={"status": status}
            )
            return response.status_code == 200
        except Exception:
            return False

    async def cancel_shop_order(self, order_id: str, shop_id: str, reason: str) -> bool:
        """Cancel a shop order."""
        client = await self._get_order_client()
        try:
            response = await client.put(
                f"/internal/orders/{order_id}/shop-order/{shop_id}/cancel",
                params={"reason": reason},
            )
            return response.status_code == 200
        except Exception:
            return False
    
    # ========== Product Service APIs ==========
    
    async def count_products_by_shop(self, shop_ids: list[str]) -> int:
        """Count products by shop."""
        client = await self._get_product_client()
        try:
            response = await client.get(
                "/internal/products/count",
                params={"shop_ids": ",".join(shop_ids)}
            )
            if response.status_code == 200:
                return response.json().get("count", 0)
        except Exception:
            pass
        return 0
    
    async def count_restricted_products(self, shop_ids: list[str]) -> int:
        """Count restricted/inactive products."""
        client = await self._get_product_client()
        try:
            response = await client.get(
                "/internal/products/count-restricted",
                params={"shop_ids": ",".join(shop_ids)}
            )
            if response.status_code == 200:
                return response.json().get("count", 0)
        except Exception:
            pass
        return 0
    
    async def list_products_by_shop(
        self,
        shop_ids: list[str],
        status_filter: Optional[str] = None,
        page: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: int = -1
    ) -> dict:
        """List products for shop management."""
        import logging
        logger = logging.getLogger(__name__)
        
        client = await self._get_product_client()
        params = {
            "shop_ids": ",".join(shop_ids),
            "page": page,
            "limit": limit,
            "sort_by": sort_by,
            "sort_order": sort_order,
        }
        if status_filter:
            params["status_filter"] = status_filter
        if keyword:
            params["keyword"] = keyword
        
        logger.info(f"Calling product-service internal API: /internal/products with params: {params}")
        
        try:
            response = await client.get("/internal/products", params=params)
            logger.info(f"Product-service response status: {response.status_code}")
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Product-service error: {response.status_code} - {response.text}")
        except Exception as e:
            logger.error(f"Exception calling product-service: {e}")
        return {"content": [], "total": 0, "page": page, "limit": limit, "total_pages": 0}
    
    async def update_product(self, product_id: str, data: dict) -> bool:
        """Update product."""
        client = await self._get_product_client()
        try:
            response = await client.put(
                f"/internal/products/{product_id}",
                json=data
            )
            return response.status_code == 200
        except Exception:
            return False

    async def get_product(self, product_id: str) -> Optional[dict]:
        """Get one product from product-service."""
        client = await self._get_product_client()
        try:
            response = await client.get(f"/internal/products/{product_id}")
            if response.status_code == 200:
                return response.json()
        except Exception:
            return None
        return None
    
    async def toggle_product_visibility(self, product_id: str, visible: bool) -> bool:
        """Toggle product visibility."""
        client = await self._get_product_client()
        try:
            response = await client.put(
                f"/internal/products/{product_id}/visibility",
                params={"visible": visible}
            )
            return response.status_code == 200
        except Exception:
            return False
    
    async def get_products_batch(self, product_ids: list[str]) -> list[dict]:
        """Get product snapshots by IDs."""
        ids = [pid for pid in dict.fromkeys(product_ids) if pid]
        if not ids:
            return []

        client = await self._get_product_client()
        try:
            response = await client.get(
                "/internal/products/batch",
                params={"product_ids": ",".join(ids)},
            )
            if response.status_code == 200:
                data = response.json()
                return data if isinstance(data, list) else []
        except Exception:
            pass
        return []


# Singleton instance
_client: Optional[InternalAPIClient] = None


def get_internal_client() -> InternalAPIClient:
    global _client
    if _client is None:
        _client = InternalAPIClient()
    return _client


async def close_internal_client():
    global _client
    if _client:
        await _client.close()
        _client = None
