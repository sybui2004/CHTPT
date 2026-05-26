from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Service
    service_name: str = "auth-service"
    service_port: int = 8001

    # MongoDB
    mongo_uri: str = Field(
        ...,
        alias="MONGO_URI",
    )
    mongo_database: str = Field(..., alias="MONGO_DATABASE")

    # JWT
    jwt_secret: str = Field(
        ...,
        alias="JWT_SECRET",
    )
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    refresh_token_expire_days: int = 30

    # CORS
    cors_origins: str = Field(
        ...,
        alias="CORS_ORIGINS",
    )

    # Internal API
    internal_api_key: str = Field(..., alias="INTERNAL_API_KEY")

    # Email (SMTP)
    smtp_host: str | None = Field(None, alias="SMTP_HOST")
    smtp_port: int = Field(587, alias="SMTP_PORT")
    smtp_user: str | None = Field(None, alias="SMTP_USER")
    smtp_password: str | None = Field(None, alias="SMTP_PASSWORD")
    smtp_from: str | None = Field(None, alias="SMTP_FROM")
    smtp_tls: bool = Field(True, alias="SMTP_TLS")

    # Public URL used in emails
    public_base_url: str = Field("http://localhost:5173", alias="PUBLIC_BASE_URL")

    # Compatibility (older envs)
    mail_username: str | None = Field(None, alias="MAIL_USERNAME")
    mail_password: str | None = Field(None, alias="MAIL_PASSWORD")

    # Google OAuth2
    google_client_id: str = Field(..., alias="GOOGLE_CLIENT_ID")
    google_client_secret: str = Field(..., alias="GOOGLE_CLIENT_SECRET")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
