from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core.config import get_settings
from services.gcs_service import get_gcs_service

from backend.libs import get_logging_settings, setup_logging
from backend.libs.middleware import request_logging_middleware


settings = get_settings()
logger = setup_logging(get_logging_settings(settings.service_name))


@asynccontextmanager
async def lifespan(app: FastAPI):
    _ = get_gcs_service()
    logger.info("service_startup")
    yield
    logger.info("service_shutdown")


app = FastAPI(title="upload-service", version="2.0.0", lifespan=lifespan)
app.middleware("http")(request_logging_middleware(logger))
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


class UploadResponse(BaseModel):
    url: str
    object_name: str
    bucket: str


class DeleteResponse(BaseModel):
    status: str


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "upload-service", "storage": "gcs"}


@app.post("/api/v1/upload/image", response_model=UploadResponse)
async def upload_image(file: UploadFile = File(...)) -> dict:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )
    
    try:
        gcs = get_gcs_service()
        content = await file.read()
        result = gcs.upload_image(content, file.filename or "image")
        
        return {
            "url": result["url"],
            "object_name": result["object_name"],
            "bucket": result["bucket"]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )


@app.post("/api/v1/upload/video", response_model=UploadResponse)
async def upload_video(file: UploadFile = File(...)) -> dict:
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a video"
        )
    
    try:
        gcs = get_gcs_service()
        content = await file.read()
        result = gcs.upload_video(content, file.filename or "video")
        
        return {
            "url": result["url"],
            "object_name": result["object_name"],
            "bucket": result["bucket"]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )


@app.post("/api/v1/upload/file", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)) -> dict:
    try:
        gcs = get_gcs_service()
        content = await file.read()
        content_type = file.content_type or "application/octet-stream"
        result = gcs.upload_file(content, content_type, file.filename or "file", "shopbee/files")
        
        return {
            "url": result["url"],
            "object_name": result["object_name"],
            "bucket": result["bucket"]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )


@app.delete("/api/v1/upload/{bucket}/{object_name:path}", response_model=DeleteResponse)
async def delete_file(bucket: str, object_name: str) -> dict:
    try:
        gcs = get_gcs_service()
        full_object_name = f"{bucket}/{object_name}" if bucket != gcs.bucket_name else object_name
        
        if gcs.delete_file(full_object_name):
            return {"status": "success"}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found or could not be deleted"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Delete failed: {str(e)}"
        )


@app.get("/api/v1/upload/signed-url/{object_name:path}")
async def get_signed_url(object_name: str, expiration_minutes: int = 15) -> dict:
    try:
        gcs = get_gcs_service()
        url = gcs.get_signed_url(object_name, expiration_minutes)
        return {"signed_url": url}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate signed URL: {str(e)}"
        )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8011, reload=True)
