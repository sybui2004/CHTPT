from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class ShopStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"


class ShopCreate(BaseModel):
    name: str
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    address: Optional[str] = None


class ShopUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    address: Optional[str] = None


class ShopResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    address: Optional[str] = None
    status: ShopStatus = ShopStatus.ACTIVE
    product_count: int = 0
    follower_count: int = 0
    average_rating: float = 0
    total_rating: int = 0
    is_following: bool = False
    following: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ShopListResponse(BaseModel):
    content: list[ShopResponse]
    total: int
    page: int
    limit: int


class SaveProductDTO(BaseModel):
    product_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    price: float
    attributes: Optional[list[dict]] = []


class InventoryAlertConfigDTO(BaseModel):
    lowStockThreshold: int
