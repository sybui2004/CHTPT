import redis
from typing import Optional
from .config import get_redis_config, RedisConfig


class RedisClient:
    _instance: Optional["RedisClient"] = None
    _client: Optional[redis.Redis] = None

    def __init__(self, config: RedisConfig = None):
        self.config = config or get_redis_config()
        self._client = redis.Redis(
            host=self.config.host,
            port=self.config.port,
            db=self.config.db,
            password=self.config.password,
            decode_responses=self.config.decode_responses,
            socket_timeout=self.config.socket_timeout,
            socket_connect_timeout=self.config.socket_connect_timeout,
            max_connections=self.config.max_connections,
        )

    @property
    def client(self) -> redis.Redis:
        return self._client

    def ping(self) -> bool:
        return self._client.ping()

    def set(self, key: str, value: str, ex: int = None) -> bool:
        return self._client.set(key, value, ex=ex)

    def get(self, key: str) -> Optional[str]:
        return self._client.get(key)

    def delete(self, *keys: str) -> int:
        return self._client.delete(*keys)

    def publish(self, channel: str, message: str) -> int:
        return self._client.publish(channel, message)

    def publish_json(self, channel: str, data: dict) -> int:
        import json
        return self._client.publish(channel, json.dumps(data))

    def close(self):
        self._client.close()


def get_redis_client() -> RedisClient:
    if RedisClient._instance is None:
        RedisClient._instance = RedisClient()
    return RedisClient._instance
