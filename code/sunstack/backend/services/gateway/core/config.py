from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    service_name: str = "gateway"
    service_port: int = 8000

    auth_service_url: str = Field("http://auth-service:8001", alias="AUTH_SERVICE_URL")
    user_service_url: str = Field("http://user-service:8002", alias="USER_SERVICE_URL")
    product_service_url: str = Field("http://product-service:8003", alias="PRODUCT_SERVICE_URL")
    order_service_url: str = Field("http://order-service:8004", alias="ORDER_SERVICE_URL")
    shop_service_url: str = Field("http://shop-service:8005", alias="SHOP_SERVICE_URL")
    payment_service_url: str = Field("http://payment-service:8006", alias="PAYMENT_SERVICE_URL")
    chat_service_url: str = Field("http://chat-service:8010", alias="CHAT_SERVICE_URL")
    upload_service_url: str = Field("http://upload-service:8011", alias="UPLOAD_SERVICE_URL")

    cors_origins: str = Field("http://localhost:5173", alias="CORS_ORIGINS")

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
