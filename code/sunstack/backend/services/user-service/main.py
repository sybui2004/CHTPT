from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId
from typing import Annotated, Any

from core.config import get_settings
from core.db import close_db, connect_db

from backend.libs import get_logging_settings, setup_logging
from backend.libs.middleware import request_logging_middleware


settings = get_settings()
logger = setup_logging(get_logging_settings(settings.service_name))


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()

    try:
        from backend.libs.redis import get_redis_client

        redis_client = get_redis_client()
        redis_client.ping()
        logger.info("redis_initialized")
    except Exception as e:
        logger.warning("redis_init_failed err=%s", e)

    logger.info("service_startup")
    yield

    logger.info("service_shutdown")
    try:
        from backend.libs.redis import get_redis_client

        get_redis_client().close()
    except Exception:
        pass

    await close_db()


app = FastAPI(title=settings.service_name, version="1.0.0", lifespan=lifespan)
app.middleware("http")(request_logging_middleware(logger))
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from api.user import router as user_router, user_root_router, address_root_router
from api.internal import router as internal_router
app.include_router(user_router)
app.include_router(user_root_router, prefix="")
app.include_router(address_root_router)
app.include_router(internal_router)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": settings.service_name}


async def _get_shop_info_for_user(user_id: str) -> dict[str, Any]:
    """Fetch shop info from shop-service API (with HTTP fallback)."""
    import httpx
    settings = get_settings()
    logger.info(f"_get_shop_info_for_user called with user_id: {user_id}")
    logger.info(f"shop_service_url: {settings.shop_service_url}")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"{settings.shop_service_url}/api/v1/shops/internal/by-user/{user_id}"
            logger.info(f"Calling shop-service: {url}")
            response = await client.get(
                url,
                headers={"X-Internal-Key": settings.internal_api_key}
            )
            logger.info(f"shop-service response status: {response.status_code}")
            if response.status_code == 200:
                shop = response.json()
                logger.info(f"shop data: {shop}")
                return {
                    "shopName": shop.get("name") or shop.get("shopName") or "",
                    "thumbnailUrl": shop.get("avatarUrl") or shop.get("thumbnailUrl") or shop.get("avatar") or ""
                }
            else:
                logger.warning(f"shop-service returned status {response.status_code}: {response.text}")
    except Exception as e:
        logger.error(f"Error fetching shop info: {e}")
    return {}


@app.get("/internal/users/{user_id}")
async def internal_get_user(
    user_id: str,
    x_internal_key: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    # Temporarily allow requests without key for debugging
    # if not x_internal_key or x_internal_key != settings.internal_api_key:
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid internal key")

    db = get_db()
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = await db.users.find_one({"username": user_id})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    # Serialize all ObjectId fields to strings
    data = {}
    for key, value in user.items():
        if isinstance(value, ObjectId):
            data[key] = str(value)
        elif key != "password":
            data[key] = value
    if "_id" in data:
        data["id"] = data.pop("_id")
    
    # Also fetch shop data if available (via shop-service API)
    try:
        shop_info = await _get_shop_info_for_user(user_id)
        data["shopName"] = shop_info.get("shopName") or data.get("fullName") or data.get("username", "")
        data["thumbnailUrl"] = shop_info.get("thumbnailUrl") or data.get("avatarUrl") or data.get("avatar") or ""
    except Exception:
        # Fallback to user data
        data["shopName"] = data.get("fullName") or data.get("username", "")
        data["thumbnailUrl"] = data.get("avatarUrl") or data.get("avatar") or ""
    
    return data


@app.get("/internal/users/by_username/{username}")
async def internal_get_user_by_username(
    username: str,
    x_internal_key: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    if not x_internal_key or x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid internal key")

    db = get_db()
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    data = {}
    for key, value in user.items():
        if isinstance(value, ObjectId):
            data[key] = str(value)
        elif key != "password":
            data[key] = value
    if "_id" in data:
        data["id"] = data.pop("_id")
    
    # Also fetch shop data if available (via shop-service API)
    try:
        shop_info = await _get_shop_info_for_user(data.get("id", ""))
        data["shopName"] = shop_info.get("shopName") or data.get("fullName") or data.get("username", "")
        data["thumbnailUrl"] = shop_info.get("thumbnailUrl") or data.get("avatarUrl") or data.get("avatar") or ""
    except Exception:
        # Fallback to user data
        data["shopName"] = data.get("fullName") or data.get("username", "")
        data["thumbnailUrl"] = data.get("avatarUrl") or data.get("avatar") or ""
    
    return data


def get_db():
    from core.db import get_db as _get_db
    return _get_db()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.service_port,
        reload=True,
    )
