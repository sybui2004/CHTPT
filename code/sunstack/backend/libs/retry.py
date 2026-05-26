from __future__ import annotations

import asyncio
import random
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class RetryConfig:
    max_attempts: int = 3
    base_delay_s: float = 0.2
    max_delay_s: float = 2.0
    jitter_s: float = 0.1


def _compute_delay(attempt: int, cfg: RetryConfig) -> float:
    exp = cfg.base_delay_s * (2 ** max(0, attempt - 1))
    delay = min(cfg.max_delay_s, exp)
    if cfg.jitter_s > 0:
        delay += random.random() * cfg.jitter_s
    return delay


async def retry_async(
    fn: Callable[[], Awaitable[Any]],
    *,
    cfg: RetryConfig,
    is_retryable_exc: Callable[[BaseException], bool],
    on_retry: Callable[[int, BaseException, float], None] | None = None,
) -> Any:
    last_exc: BaseException | None = None
    for attempt in range(1, cfg.max_attempts + 1):
        try:
            return await fn()
        except BaseException as e:  # noqa: BLE001
            last_exc = e
            if attempt >= cfg.max_attempts or not is_retryable_exc(e):
                raise
            delay = _compute_delay(attempt, cfg)
            if on_retry:
                on_retry(attempt, e, delay)
            await asyncio.sleep(delay)
    raise last_exc  # pragma: no cover
