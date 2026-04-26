from __future__ import annotations

import json
import logging
from collections.abc import Mapping
from time import perf_counter
from typing import Any


def configure_logging() -> None:
    root_logger = logging.getLogger()
    if root_logger.handlers:
        return

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


def get_logger(name: str) -> logging.Logger:
    configure_logging()
    return logging.getLogger(name)


def compact_fields(fields: Mapping[str, Any]) -> dict[str, Any]:
    return {
        key: value
        for key, value in fields.items()
        if value is not None
    }


def log_event(
    logger: logging.Logger,
    level: int,
    event: str,
    **fields: Any,
) -> None:
    logger.log(
        level,
        "[app] %s %s",
        event,
        json.dumps(compact_fields(fields), ensure_ascii=True, sort_keys=True),
    )


def start_timer() -> float:
    return perf_counter()


def elapsed_ms(started_at: float) -> int:
    return int((perf_counter() - started_at) * 1000)


def summarize_user_id(user_id: str | None) -> str | None:
    if not user_id:
        return None

    normalized = user_id.strip()
    if len(normalized) <= 8:
        return normalized

    return normalized[:8]
