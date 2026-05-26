from functools import lru_cache
import os
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    service_name: str = "upload-service"
    service_port: int = 8011
    auth_service_url: str = Field(..., alias="AUTH_SERVICE_URL")
    jwt_secret: str = Field(..., alias="JWT_SECRET")
    cors_origins: str = Field("http://localhost:5173", alias="CORS_ORIGINS")
    internal_api_key: str = Field(..., alias="INTERNAL_API_KEY")
    
    gcs_bucket_name: str = Field("shopbee-uploads", alias="GCS_BUCKET_NAME")
    gcs_project_id: str = Field(..., alias="GCS_PROJECT_ID")
    gcs_credentials_file: str = Field("./gcs-credentials.json", alias="GCS_CREDENTIALS_FILE")

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def get_gcs_credentials(self):
        cred_path = self.gcs_credentials_file
        if os.path.exists(cred_path):
            return cred_path
        return None


@lru_cache
def get_settings() -> Settings:
    return Settings()
