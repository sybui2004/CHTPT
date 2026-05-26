from __future__ import annotations

import time
import uuid
from typing import Callable

from fastapi import Request, Response


def _safe_client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    if request.client:
        return request.client.host
    return ""


def request_logging_middleware(logger) -> Callable:
    async def middleware(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        start = time.perf_counter()

        try:
            response: Response = await call_next(request)
            return response
        finally:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            status_code = getattr(locals().get("response"), "status_code", 500)
            logger.info(
                "request id=%s method=%s path=%s status=%s elapsed_ms=%.2f ip=%s",
                request_id,
                request.method,
                request.url.path,
                status_code,
                elapsed_ms,
                _safe_client_ip(request),
            )

    return middleware
