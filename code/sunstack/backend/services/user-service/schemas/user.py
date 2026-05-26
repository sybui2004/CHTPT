from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AddressBase(BaseModel):
    full_name: str
    phone: str
    province_id: Optional[str] = None
    province_name: Optional[str] = None
    district_id: Optional[str] = None
    district_name: Optional[str] = None
    ward_id: Optional[str] = None
    ward_name: Optional[str] = None
    address: str
    is_default: bool = False


class AddressCreate(AddressBase):
    pass


class AddressUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    province_id: Optional[str] = None
    province_name: Optional[str] = None
    district_id: Optional[str] = None
    district_name: Optional[str] = None
    ward_id: Optional[str] = None
    ward_name: Optional[str] = None
    address: Optional[str] = None
    is_default: Optional[bool] = None


class AddressResponse(AddressBase):
    id: str
    user_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[datetime] = None


class FollowShopRequest(BaseModel):
    shop_id: str


class FollowResponse(BaseModel):
    status: str
    message: str
