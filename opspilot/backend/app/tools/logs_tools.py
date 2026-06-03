"""
Logs tools — mock implementations for development.

Set USE_MOCK_TOOLS=False in settings and implement real KQL / Log Analytics SDK
calls for production environments.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone


@dataclass
class LogEntry:
    timestamp: str
    service: str
    severity: str
    message: str
    stack_trace: str = ""
    count: int = 1


@dataclass
class LogQueryResult:
    service: str
    total_errors: int
    error_types: list[dict]
    sample_entries: list[LogEntry] = field(default_factory=list)
    first_occurrence: str = ""
    error_rate_per_minute: float = 0.0


_BASE = datetime(2026, 6, 3, 12, 23, 0, tzinfo=timezone.utc)


def _ts(offset_sec: int = 0) -> str:
    return (_BASE + timedelta(seconds=offset_sec)).isoformat()


def query_error_logs(service: str, window_minutes: int = 30) -> LogQueryResult:
    """Return error log summary for *service* over the last *window_minutes*."""
    if service == "checkout-service":
        return LogQueryResult(
            service=service,
            total_errors=2847,
            error_types=[
                {
                    "type": "sqlalchemy.exc.TimeoutError",
                    "count": 2847,
                    "message": "QueuePool limit of size 5 overflow 10 reached, connection timed out",
                },
            ],
            sample_entries=[
                LogEntry(
                    timestamp=_ts(0),
                    service=service,
                    severity="ERROR",
                    message="QueuePool limit of size 5 overflow 10 reached, connection timed out",
                    stack_trace=(
                        "sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 10 reached,\n"
                        "  File \"app/db/session.py\", line 42, in get_session\n"
                        "  File \"sqlalchemy/pool/base.py\", line 310, in _checkout"
                    ),
                    count=2847,
                ),
            ],
            first_occurrence=_ts(0),
            error_rate_per_minute=474.5,
        )
    return LogQueryResult(service=service, total_errors=0, error_types=[])


def query_connection_pool_stats(service: str) -> dict:
    """Return ORM connection pool statistics."""
    if service == "checkout-service":
        return {
            "pool_size": 5,
            "max_overflow": 10,
            "pool_timeout": 30,
            "connections_in_use": 5,
            "connections_available": 0,
            "connections_overflow": 10,
            "connections_timed_out": 2847,
            "config_source": "app/config/database.py",
            "deployed_version": "v2.4.1",
            "previous_pool_size": 20,
        }
    return {}
