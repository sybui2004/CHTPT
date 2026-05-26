from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class OrderStatus(str, Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    SHIPPING = "SHIPPING"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"


class PaymentMethod(str, Enum):
    COD = "COD"
    VNPAY = "VNPAY"


class OrderItem(BaseModel):
    item_id: Optional[str] = None
    product_id: str
    name: Optional[str] = None
    sku_id: Optional[str] = None
    quantity: int
    price: float
    thumbnail_url: Optional[str] = None
    attributes: Optional[list[dict]] = []


class ShopOrder(BaseModel):
    id: Optional[str] = Field(None, alias="id")
    shop_id: str = Field(..., alias="shopId")
    name: Optional[str] = Field(None, alias="name")
    status: OrderStatus = OrderStatus.PENDING
    items: list[OrderItem] = []
    total_price: float = 0
    shipping_fee: float = 0
    discount_amount: float = 0

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str) and v == "SHIPPED":
            return OrderStatus.SHIPPING
        if isinstance(v, str) and v not in ["PENDING", "CONFIRMED", "SHIPPING", "DELIVERED", "CANCELLED", "REFUNDED"]:
            return OrderStatus.PENDING
        return v


class OrderCreate(BaseModel):
    items: list[OrderItem]
    shipping_address: dict
    payment_method: PaymentMethod = PaymentMethod.COD
    note: Optional[str] = None


class OrderResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    items: Optional[list[OrderItem]] = []
    shop_orders: Optional[list[ShopOrder]] = []
    total_amount: float = 0
    shipping_fee: float = 0
    discount_amount: float = 0
    final_amount: float = 0
    status: OrderStatus = OrderStatus.PENDING
    payment_method: Optional[str] = None
    payment_type: Optional[str] = None
    shipping_address: Optional[dict] = None
    shipping_address_id: Optional[str] = None
    note: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("status", mode="before")
    @classmethod
    def normalize_top_status(cls, v):
        if isinstance(v, str) and v == "SHIPPED":
            return OrderStatus.SHIPPING
        if isinstance(v, str) and v not in ["PENDING", "CONFIRMED", "SHIPPING", "DELIVERED", "CANCELLED", "REFUNDED"]:
            return OrderStatus.PENDING
        return v


class OrderListResponse(BaseModel):
    content: list[OrderResponse]
    total: int
    page: int
    limit: int
    total_pages: int
