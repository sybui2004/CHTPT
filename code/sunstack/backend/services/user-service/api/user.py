from datetime import datetime, timezone
from typing import Annotated, Any, Optional

from bson import ObjectId
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, status
from pymongo import ReturnDocument

from core.db import get_db
from core.config import get_settings
from schemas.user import (
    AddressCreate,
    AddressResponse,
    AddressUpdate,
    FollowResponse,
)

router = APIRouter(prefix="/api/v1/users", tags=["Users"])

user_root_router = APIRouter(prefix="/api/v1", tags=["Users (Root)"])
address_root_router = APIRouter(prefix="/api/v1/address", tags=["Address"])


def serialize_value(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [serialize_value(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize_value(item) for key, item in value.items()}
    return value


def serialize_doc(doc: dict[str, Any]) -> dict[str, Any]:
    if doc is None:
        return {}
    data = doc.copy()
    if "_id" in data:
        data["id"] = str(data.pop("_id"))
    return {key: serialize_value(value) for key, value in data.items()}


def serialize_address(doc: dict[str, Any]) -> dict[str, Any]:
    data = serialize_doc(doc)
    data["receiverName"] = data.get("receiverName") or data.get("receiver_name") or data.get("full_name") or ""
    data["phoneNumber"] = data.get("phoneNumber") or data.get("phone_number") or data.get("phone") or ""
    data["detail"] = data.get("detail") or data.get("address") or ""
    data["province"] = data.get("province") or data.get("province_name") or ""
    data["district"] = data.get("district") or data.get("district_name") or ""
    data["ward"] = data.get("ward") or data.get("ward_name") or ""
    data["primary"] = bool(data.get("primary", data.get("is_default", False)))
    return data


def normalize_legacy_address(payload: dict[str, Any]) -> dict[str, Any]:
    receiver_name = payload.get("receiverName") or payload.get("receiver_name") or payload.get("full_name")
    phone_number = payload.get("phoneNumber") or payload.get("phone_number") or payload.get("phone")
    detail = payload.get("detail") or payload.get("address")
    province = payload.get("province") or payload.get("province_name")
    district = payload.get("district") or payload.get("district_name")
    ward = payload.get("ward") or payload.get("ward_name")
    primary = bool(payload.get("primary", payload.get("is_default", False)))

    if not receiver_name or not phone_number or not detail or not province or not district or not ward:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing required address fields")

    return {
        "receiverName": receiver_name,
        "phoneNumber": phone_number,
        "detail": detail,
        "province": province,
        "district": district,
        "ward": ward,
        "primary": primary,
        "full_name": receiver_name,
        "phone": phone_number,
        "address": detail,
        "province_name": province,
        "district_name": district,
        "ward_name": ward,
        "is_default": primary,
    }


def serialize_user(user: dict[str, Any]) -> dict[str, Any]:
    if user is None:
        return {}
    data = serialize_doc(user)
    data.pop("password", None)

    full_name = data.get("fullName") or data.get("full_name") or ""
    phone_number = data.get("phoneNumber") or data.get("phone_number") or data.get("phone") or ""
    avatar_url = data.get("avatarUrl") or data.get("avatar_url") or data.get("avatar") or ""
    dob = data.get("dob") or data.get("date_of_birth")

    data["fullName"] = full_name
    data["full_name"] = full_name
    data["phoneNumber"] = phone_number
    data["phone"] = phone_number
    data["avatarUrl"] = avatar_url
    data["avatar_url"] = avatar_url
    data["dob"] = dob
    data["date_of_birth"] = dob
    return data


def get_first_present(payload: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in payload:
            return payload[key]
    return None


def parse_profile_date(value: Any) -> Any:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        normalized = value.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            return value
    return value


def normalize_profile_update(payload: dict[str, Any]) -> dict[str, Any]:
    update_data: dict[str, Any] = {}

    if any(key in payload for key in ("fullName", "full_name")):
        full_name = get_first_present(payload, "fullName", "full_name") or ""
        update_data["fullName"] = full_name
        update_data["full_name"] = full_name

    if any(key in payload for key in ("phoneNumber", "phone_number", "phone")):
        phone_number = get_first_present(payload, "phoneNumber", "phone_number", "phone") or ""
        update_data["phoneNumber"] = phone_number
        update_data["phone"] = phone_number

    if any(key in payload for key in ("avatarUrl", "avatar_url", "avatar")):
        avatar_url = get_first_present(payload, "avatarUrl", "avatar_url", "avatar") or ""
        update_data["avatarUrl"] = avatar_url
        update_data["avatar_url"] = avatar_url

    if "gender" in payload:
        update_data["gender"] = payload.get("gender") or ""

    if any(key in payload for key in ("dob", "date_of_birth")):
        dob = get_first_present(payload, "dob", "date_of_birth")
        parsed_dob = parse_profile_date(dob)
        update_data["dob"] = parsed_dob
        update_data["date_of_birth"] = parsed_dob

    update_data["updated_at"] = datetime.now(timezone.utc)
    return update_data


async def get_current_user_id(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    from jose import JWTError, jwt

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing access token",
        )
    token = authorization[7:]

    from core.config import get_settings
    settings = get_settings()

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
        return user_id
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


# ========== /api/v1/users/* endpoints ==========

@router.get("/me")
async def get_profile(user_id: str = Depends(get_current_user_id)) -> dict[str, Any]:
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return serialize_user(user)


@router.put("/me")
async def update_profile(
    payload: dict[str, Any] = Body(...),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    db = get_db()
    update_data = normalize_profile_update(payload)
    user = await db.users.find_one_and_update(
        {"_id": ObjectId(user_id)},
        {"$set": update_data},
        return_document=ReturnDocument.AFTER,
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return serialize_user(user)


@router.get("/addresses")
async def list_addresses(user_id: str = Depends(get_current_user_id)) -> list[dict[str, Any]]:
    db = get_db()
    addresses = []
    async for addr in db.user_addresses.find({"user_id": user_id}):
        addresses.append(serialize_doc(addr))
    return addresses


@router.post("/addresses")
async def create_address(
    payload: AddressCreate,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    db = get_db()
    if payload.is_default:
        await db.user_addresses.update_many({"user_id": user_id}, {"$set": {"is_default": False}})
    address_data = payload.model_dump()
    address_data["user_id"] = user_id
    address_data["created_at"] = datetime.now(timezone.utc)
    address_data["updated_at"] = datetime.now(timezone.utc)
    result = await db.user_addresses.insert_one(address_data)
    address_data["id"] = str(result.inserted_id)
    return address_data


@router.put("/addresses/{address_id}")
async def update_address(
    address_id: str,
    payload: AddressUpdate,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    db = get_db()
    if payload.is_default:
        await db.user_addresses.update_many({"user_id": user_id}, {"$set": {"is_default": False}})
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    result = await db.user_addresses.find_one_and_update(
        {"_id": ObjectId(address_id), "user_id": user_id},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")
    return serialize_doc(result)


@router.delete("/addresses/{address_id}")
async def delete_address(
    address_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, str]:
    db = get_db()
    result = await db.user_addresses.delete_one({"_id": ObjectId(address_id), "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")
    return {"status": "success"}


@router.put("/addresses/{address_id}/default")
async def set_default_address(
    address_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, str]:
    db = get_db()
    await db.user_addresses.update_many({"user_id": user_id}, {"$set": {"is_default": False}})
    result = await db.user_addresses.find_one_and_update(
        {"_id": ObjectId(address_id), "user_id": user_id},
        {"$set": {"is_default": True}},
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")
    return {"status": "success"}


@router.post("/follow")
async def follow_shop(
    shopId: Annotated[str | None, Query(alias="shopId")] = None,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, str]:
    db = get_db()
    if not shopId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="shopId is required")
    await db.follows.update_one(
        {"user_id": user_id, "shop_id": shopId},
        {"$setOnInsert": {"user_id": user_id, "shop_id": shopId, "created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"status": "success", "message": "Followed shop successfully"}


@router.delete("/unfollow")
async def unfollow_shop(
    shopId: Annotated[str | None, Query(alias="shopId")] = None,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, str]:
    db = get_db()
    if not shopId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="shopId is required")
    await db.follows.delete_one({"user_id": user_id, "shop_id": shopId})
    return {"status": "success", "message": "Unfollowed shop successfully"}


@router.post("/unfollow")
async def unfollow_shop_post(
    shopId: Annotated[str | None, Query(alias="shopId")] = None,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, str]:
    db = get_db()
    if not shopId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="shopId is required")
    await db.follows.delete_one({"user_id": user_id, "shop_id": shopId})
    return {"status": "success", "message": "Unfollowed shop successfully"}


@router.get("/following")
async def list_following(
    user_id: str = Depends(get_current_user_id),
    page: int = 0,
    limit: int = 20,
) -> list[dict[str, Any]]:
    db = get_db()
    shops = []
    cursor = db.follows.find({"user_id": user_id}).skip(page * limit).limit(limit)
    async for follow in cursor:
        follow.pop("_id", None)
        shops.append(follow)
    return shops


# ========== Root-level /api/v1/user/* endpoints ==========

@user_root_router.get("/user/profile")
async def root_get_profile(user_id: str = Depends(get_current_user_id)) -> dict[str, Any]:
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return serialize_user(user)


@user_root_router.post("/user/profile/update")
async def root_update_profile(
    payload: dict[str, Any] = Body(...),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    db = get_db()
    update_data = normalize_profile_update(payload)
    user = await db.users.find_one_and_update(
        {"_id": ObjectId(user_id)},
        {"$set": update_data},
        return_document=ReturnDocument.AFTER,
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return serialize_user(user)


@user_root_router.get("/user/address/get-list")
async def root_get_address_list(user_id: str = Depends(get_current_user_id)) -> list[dict[str, Any]]:
    db = get_db()
    addresses = []
    async for addr in db.user_addresses.find({"user_id": user_id}):
        addresses.append(serialize_address(addr))
    return addresses


@user_root_router.post("/user/address/set-primary")
async def root_set_primary_address(
    addressId: str = Query(...),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, str]:
    db = get_db()
    await db.user_addresses.update_many({"user_id": user_id}, {"$set": {"is_default": False, "primary": False}})
    result = await db.user_addresses.find_one_and_update(
        {"_id": ObjectId(addressId), "user_id": user_id},
        {"$set": {"is_default": True, "primary": True}},
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")
    return {"status": "success"}


@user_root_router.post("/user/address/delete")
async def root_delete_address(
    addressId: str = Query(...),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, str]:
    db = get_db()
    result = await db.user_addresses.delete_one({"_id": ObjectId(addressId), "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")
    return {"status": "success"}


@user_root_router.post("/user/address/add")
async def root_add_address(
    payload: dict[str, Any] = Body(...),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    db = get_db()
    address_data = normalize_legacy_address(payload)
    if address_data["is_default"]:
        await db.user_addresses.update_many({"user_id": user_id}, {"$set": {"is_default": False, "primary": False}})
    address_data["user_id"] = user_id
    address_data["created_at"] = datetime.now(timezone.utc)
    address_data["updated_at"] = datetime.now(timezone.utc)
    result = await db.user_addresses.insert_one(address_data)
    address_data["id"] = str(result.inserted_id)
    return serialize_address(address_data)


@user_root_router.post("/user/address/update")
async def root_update_address(
    payload: dict[str, Any] = Body(...),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    db = get_db()
    address_id = payload.get("addressId") or payload.get("id")
    if not address_id or not ObjectId.is_valid(address_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid address ID")
    address_data = normalize_legacy_address(payload)
    address_data["updated_at"] = datetime.now(timezone.utc)
    if address_data["is_default"]:
        await db.user_addresses.update_many({"user_id": user_id}, {"$set": {"is_default": False, "primary": False}})
    result = await db.user_addresses.find_one_and_update(
        {"_id": ObjectId(address_id), "user_id": user_id},
        {"$set": address_data},
        return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")
    return serialize_address(result)


@address_root_router.get("/provinces")
async def get_provinces() -> list[dict[str, Any]]:
    db = get_db()
    provinces = []
    async for doc in db.provinces.find({}).sort("name", 1):
        provinces.append(serialize_doc(doc))
    return provinces


@address_root_router.get("/districts")
async def get_districts(provinceId: int = Query(...)) -> list[dict[str, Any]]:
    db = get_db()
    districts = []
    async for doc in db.districts.find({"provinceId": provinceId}).sort("name", 1):
        districts.append(serialize_doc(doc))
    return districts


@address_root_router.get("/wards")
async def get_wards(districtId: int = Query(...)) -> list[dict[str, Any]]:
    db = get_db()
    wards = []
    async for doc in db.wards.find({"districtId": districtId}).sort("name", 1):
        wards.append(serialize_doc(doc))
    return wards


# ========== Follow/Unfollow endpoints at /api/v1/user/* ==========

@user_root_router.post("/user/follow")
async def root_follow_shop(
    shopId: Annotated[str | None, Query(alias="shopId")] = None,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, str]:
    if not shopId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="shopId is required")
    db = get_db()
    await db.follows.update_one(
        {"user_id": user_id, "shop_id": shopId},
        {"$setOnInsert": {"user_id": user_id, "shop_id": shopId, "created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"status": "success", "message": "Followed shop successfully"}


@user_root_router.post("/user/unfollow")
async def root_unfollow_shop(
    shopId: Annotated[str | None, Query(alias="shopId")] = None,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, str]:
    if not shopId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="shopId is required")
    db = get_db()
    await db.follows.delete_one({"user_id": user_id, "shop_id": shopId})
    return {"status": "success", "message": "Unfollowed shop successfully"}


@user_root_router.delete("/user/unfollow")
async def root_unfollow_shop_delete(
    shopId: Annotated[str | None, Query(alias="shopId")] = None,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, str]:
    if not shopId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="shopId is required")
    db = get_db()
    await db.follows.delete_one({"user_id": user_id, "shop_id": shopId})
    return {"status": "success", "message": "Unfollowed shop successfully"}


# ========== Internal API endpoints for other services ==========

@router.get("/internal/{user_id}")
async def get_user_internal(user_id: str) -> dict[str, Any]:
    """Internal API to get user info by user ID (used by other services)."""
    db = get_db()
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return {
        "id": str(user.get("_id")),
        "username": user.get("username"),
        "email": user.get("email"),
        "fullName": user.get("full_name") or user.get("fullName"),
        "avatarUrl": user.get("avatar_url") or user.get("avatarUrl"),
    }


@router.get("/internal/{user_id}/address")
async def get_user_address_internal(user_id: str) -> dict[str, Any] | None:
    """Internal API to get user's default address (used by other services)."""
    db = get_db()
    address = await db.user_addresses.find_one({"user_id": user_id, "is_default": True})
    if not address:
        address = await db.user_addresses.find_one({"user_id": user_id})
    if not address:
        return None
    return {
        "id": str(address.get("_id")),
        "receiverName": address.get("receiver_name") or address.get("receiverName"),
        "phoneNumber": address.get("phone_number") or address.get("phoneNumber"),
        "detail": address.get("detail"),
        "ward": address.get("ward"),
        "district": address.get("district"),
        "province": address.get("province"),
    }


@router.get("/internal/username/{username}")
async def get_user_by_username_internal(username: str) -> dict[str, Any] | None:
    """Internal API to get user by username (used by other services)."""
    db = get_db()
    user = await db.users.find_one({"username": username})
    if not user:
        return None
    return {
        "id": str(user.get("_id")),
        "username": user.get("username"),
        "email": user.get("email"),
        "fullName": user.get("full_name") or user.get("fullName"),
        "avatarUrl": user.get("avatar_url") or user.get("avatarUrl"),
    }
