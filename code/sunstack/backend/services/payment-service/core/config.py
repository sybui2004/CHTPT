from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    service_name: str = "payment-service"
    service_port: int = 8006
    mongo_uri: str = Field(..., alias="MONGO_URI")
    mongo_database: str = Field(..., alias="MONGO_DATABASE")
    auth_service_url: str = Field(..., alias="AUTH_SERVICE_URL")
    jwt_secret: str = Field(..., alias="JWT_SECRET")
    vnpay_url: str = Field(..., alias="VNPAY_URL")
    vnpay_tmn_code: str = Field(..., alias="VNPAY_TMN_CODE")
    vnpay_secret_key: str = Field(..., alias="VNPAY_SECRET_KEY")
    vnpay_return_url: str = Field(..., alias="VNPAY_RETURN_URL")
    cors_origins: str = Field(..., alias="CORS_ORIGINS")
    internal_api_key: str = Field(..., alias="INTERNAL_API_KEY")

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
