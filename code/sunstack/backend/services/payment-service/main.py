from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

from api.payment import router as payment_router
app.include_router(payment_router)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": settings.service_name}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.service_port,
        reload=True,
    )
