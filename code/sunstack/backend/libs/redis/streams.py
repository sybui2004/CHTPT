from __future__ import annotations

import json
import logging
import time
from dataclasses import replace
from dataclasses import dataclass
from typing import Any, Callable, Optional

from .client import RedisClient
from .config import get_redis_config

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class StreamConfig:
    stream: str
    group: str
    consumer: str
    block_ms: int = 5000
    count: int = 20
    maxlen: int = 10000


class RedisStreams:
    def __init__(self, redis_client: RedisClient | None = None):
        if redis_client is None:
            # Stream consumers use blocking reads; a normal short socket timeout
            # turns healthy idle polls into noisy errors.
            self.redis_client = RedisClient(replace(get_redis_config(), socket_timeout=None))
        else:
            self.redis_client = redis_client
        self.client = self.redis_client.client

    def ensure_group(self, stream: str, group: str) -> None:
        try:
            # mkstream=True: create stream if missing
            self.client.xgroup_create(name=stream, groupname=group, id="0-0", mkstream=True)
            logger.info("redis_stream_group_created stream=%s group=%s", stream, group)
        except Exception as e:
            # BUSYGROUP means group already exists
            if "BUSYGROUP" in str(e):
                return
            raise

    def publish(self, stream: str, event: dict[str, Any], *, maxlen: int = 10000) -> str:
        payload = {"event": json.dumps(event, ensure_ascii=False)}
        return self.client.xadd(stream, payload, maxlen=maxlen, approximate=True)

    def consume_forever(
        self,
        cfg: StreamConfig,
        handler: Callable[[dict[str, Any]], None],
        *,
        stop_flag: Callable[[], bool] | None = None,
        retry_max: int = 3,
        retry_sleep_s: float = 0.2,
    ) -> None:
        """Blocking consume loop intended to run in a background thread.

        Uses consumer groups. On handler error, it will retry a few times, then move to a DLQ stream.
        """
        self.ensure_group(cfg.stream, cfg.group)
        dlq_stream = f"{cfg.stream}:dlq"

        while True:
            if stop_flag and stop_flag():
                return

            try:
                resp = self.client.xreadgroup(
                    groupname=cfg.group,
                    consumername=cfg.consumer,
                    streams={cfg.stream: ">"},
                    count=cfg.count,
                    block=cfg.block_ms,
                )
            except Exception as e:
                if "Timeout reading from socket" in str(e):
                    continue
                logger.error("redis_stream_read_failed stream=%s group=%s err=%s", cfg.stream, cfg.group, e)
                time.sleep(0.5)
                continue

            if not resp:
                continue

            for _stream_name, messages in resp:
                for message_id, fields in messages:
                    raw = fields.get("event")
                    try:
                        if raw is None:
                            event = {"raw": fields}
                        else:
                            event = json.loads(raw)
                    except Exception:
                        event = {"raw": raw}

                    attempt = 0
                    while True:
                        try:
                            handler(event)
                            self.client.xack(cfg.stream, cfg.group, message_id)
                            break
                        except Exception as e:
                            attempt += 1
                            logger.error(
                                "redis_stream_handler_failed stream=%s group=%s id=%s attempt=%s err=%s",
                                cfg.stream,
                                cfg.group,
                                message_id,
                                attempt,
                                e,
                            )
                            if attempt >= retry_max:
                                try:
                                    self.publish(dlq_stream, {"failed_event": event, "error": str(e), "stream": cfg.stream, "id": message_id})
                                except Exception as dlq_e:
                                    logger.error("redis_stream_dlq_publish_failed stream=%s err=%s", dlq_stream, dlq_e)
                                # Ack to prevent endless poison message loop
                                self.client.xack(cfg.stream, cfg.group, message_id)
                                break
                            time.sleep(retry_sleep_s)
