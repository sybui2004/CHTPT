import uuid
from datetime import datetime, timedelta
from typing import Optional

from google.cloud import storage

from core.config import get_settings


class GCSService:
    def __init__(self):
        settings = get_settings()
        self.bucket_name = settings.gcs_bucket_name
        
        credentials = settings.get_gcs_credentials()
        if credentials:
            self.client = storage.Client.from_service_account_json(credentials)
        else:
            self.client = storage.Client()
        
        self.bucket = self.client.bucket(self.bucket_name)

    def _generate_object_name(self, original_filename: str, folder: str = "shopbee") -> str:
        ext = original_filename.split(".")[-1] if "." in original_filename else ""
        unique_id = uuid.uuid4().hex
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        if ext:
            return f"{folder}/{timestamp}_{unique_id}.{ext}"
        return f"{folder}/{timestamp}_{unique_id}"

    def upload_file(
        self,
        file_content: bytes,
        content_type: str,
        original_filename: str,
        folder: str = "shopbee"
    ) -> dict:
        object_name = self._generate_object_name(original_filename, folder)
        
        blob = self.bucket.blob(object_name)
        blob.upload_from_string(
            file_content,
            content_type=content_type
        )

        return {
            "object_name": object_name,
            "url": blob.public_url,
            "bucket": self.bucket_name,
            "content_type": content_type,
            "size": len(file_content)
        }

    def upload_image(self, file_content: bytes, original_filename: str) -> dict:
        return self.upload_file(file_content, "image/*", original_filename, "shopbee/images")

    def upload_video(self, file_content: bytes, original_filename: str) -> dict:
        return self.upload_file(file_content, "video/*", original_filename, "shopbee/videos")

    def delete_file(self, object_name: str) -> bool:
        try:
            blob = self.bucket.blob(object_name)
            blob.delete()
            return True
        except Exception:
            return False

    def get_signed_url(self, object_name: str, expiration_minutes: int = 15) -> str:
        blob = self.bucket.blob(object_name)
        return blob.generate_signed_url(
            expiration=datetime.utcnow() + timedelta(minutes=expiration_minutes),
            method="GET"
        )

    def file_exists(self, object_name: str) -> bool:
        blob = self.bucket.blob(object_name)
        return blob.exists()


_gcs_service: Optional[GCSService] = None


def get_gcs_service() -> GCSService:
    global _gcs_service
    if _gcs_service is None:
        _gcs_service = GCSService()
    return _gcs_service
