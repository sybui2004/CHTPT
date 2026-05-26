from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class AttributeSchema(BaseModel):
    name: str
    value: str


class SKUSchema(BaseModel):
    id: Optional[str] = None
    attributes: list[AttributeSchema] = []
    price: float = 0
    quantity: int = 0
    sku_code: Optional[str] = None


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    price: float = 0
    thumbnail_url: Optional[str] = None


class ProductCreate(ProductBase):
    shop_id: str
    quantity: int = 0
    attributes: list[AttributeSchema] = []


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    quantity: Optional[int] = None
    thumbnail_url: Optional[str] = None


class ProductResponse(ProductBase):
    id: str
    shop_id: str
    quantity: int = 0
    sold: int = 0
    average_rating: float = 0
    total_reviews: int = 0
    is_active: bool = True
    sku_list: list[SKUSchema] = []
    media_list: list[dict] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    content: list[ProductResponse]
    total: int
    page: int
    limit: int
    total_pages: int
