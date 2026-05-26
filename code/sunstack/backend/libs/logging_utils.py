from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path


@dataclass(frozen=True)
class LoggingSettings:
    service_name: str
    log_dir: str = "logs"
    level: str = "INFO"
    backup_days: int = 7


class _UtcDailyRotatingFileHandler(TimedRotatingFileHandler):
    """Rotate at midnight UTC and keep a fixed number of days.

    Python's TimedRotatingFileHandler uses local time by default; we force UTC to
    make rotation deterministic across containers.
    """

    def __init__(
        self,
        filename: str,
        backupCount: int,
        encoding: str = "utf-8",
    ):
        super().__init__(
            filename=filename,
            when="midnight",
            interval=1,
            backupCount=backupCount,
            encoding=encoding,
            delay=True,
            utc=True,
        )


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _prune_old_logs(log_dir: Path, service_name: str, keep_days: int) -> None:
    if keep_days <= 0:
        return

    cutoff = datetime.now(timezone.utc) - timedelta(days=keep_days)
    prefix = f"{service_name}.log."

    try:
        for p in log_dir.glob(f"{service_name}.log.*"):
            # TimedRotatingFileHandler suffix default: YYYY-MM-DD
            # We parse best-effort; if cannot parse, skip.
            suffix = p.name.replace(prefix, "")
            try:
                dt = datetime.strptime(suffix, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                continue
            if dt < cutoff:
                try:
                    p.unlink(missing_ok=True)
                except OSError:
                    pass
    except OSError:
        pass


def setup_logging(settings: LoggingSettings) -> logging.Logger:
    """Configure root logger with console + daily rotating file logs.

    Returns a named logger for the service.
    """

    log_level_name = (settings.level or "INFO").upper()
    level = getattr(logging, log_level_name, logging.INFO)

    log_dir = Path(settings.log_dir)
    _ensure_dir(log_dir)

    # File handler: logs/<service>.log, rotate daily, keep last N days.
    logfile = log_dir / f"{settings.service_name}.log"
    file_handler = _UtcDailyRotatingFileHandler(
        filename=str(logfile),
        backupCount=int(settings.backup_days),
        encoding="utf-8",
    )

    formatter = logging.Formatter(
        fmt="%(asctime)sZ %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    file_handler.setFormatter(formatter)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(level)

    # Avoid duplicate handlers when reload=True
    existing_types = {type(h) for h in root.handlers}
    if type(console_handler) not in existing_types:
        root.addHandler(console_handler)
    # Always add file handler (it has service-specific filename). If reloaded,
    # avoid stacking by checking handler baseFilename.
    for h in list(root.handlers):
        if isinstance(h, TimedRotatingFileHandler) and getattr(h, "baseFilename", None) == file_handler.baseFilename:
            break
    else:
        root.addHandler(file_handler)

    # Tame noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

    _prune_old_logs(log_dir, settings.service_name, int(settings.backup_days))

    return logging.getLogger(settings.service_name)


def get_logging_settings(service_name: str) -> LoggingSettings:
    return LoggingSettings(
        service_name=service_name,
        log_dir=os.getenv("LOG_DIR", "logs"),
        level=os.getenv("LOG_LEVEL", "INFO"),
        backup_days=int(os.getenv("LOG_BACKUP_DAYS", "7")),
    )
