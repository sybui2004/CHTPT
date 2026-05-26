from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from core.config import get_settings

client: AsyncIOMotorClient | None = None


async def connect_db() -> None:
    global client
    if client is None:
        client = AsyncIOMotorClient(get_settings().mongo_uri)


async def close_db() -> None:
    global client
    if client is not None:
        client.close()
        client = None


def get_db() -> AsyncIOMotorDatabase:
    if client is None:
        raise RuntimeError("MongoDB client is not initialized")
    return client[get_settings().mongo_database]
