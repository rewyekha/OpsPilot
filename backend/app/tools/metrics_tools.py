"""
Metrics tools — mock implementations for development.

All functions return deterministic data for the checkout-service incident.
Set USE_MOCK_TOOLS=False in settings and implement the real SDK calls below
when Azure Monitor / Prometheus connectivity is available.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any


@dataclass
class MetricSeries:
    service: str
    metric: str
    unit: str
    datapoints: list[dict[str, Any]] = field(default_factory=list)
    peak_value: float = 0.0
    baseline_value: float = 0.0
    anomaly_detected: bool = False
    anomaly_start: str = ""


_BASE = datetime(2026, 6, 3, 12, 19, 0, tzinfo=timezone.utc)


def _ts(offset_min: int) -> str:
    return (_BASE + timedelta(minutes=offset_min)).isoformat()


def query_error_rate(service: str) -> MetricSeries:
    """Return error rate time series for *service*."""
    if service == "checkout-service":
        return MetricSeries(
            service=service,
            metric="error_rate_pct",
            unit="percent",
            datapoints=[
                {"timestamp": _ts(0), "value": 0.8},
                {"timestamp": _ts(1), "value": 0.9},
                {"timestamp": _ts(2), "value": 1.1},
                {"timestamp": _ts(3), "value": 12.4},
                {"timestamp": _ts(4), "value": 73.4},
                {"timestamp": _ts(5), "value": 74.1},
                {"timestamp": _ts(6), "value": 72.8},
            ],
            peak_value=74.1,
            baseline_value=0.9,
            anomaly_detected=True,
            anomaly_start=_ts(3),
        )
    return MetricSeries(service=service, metric="error_rate_pct", unit="percent")


def query_latency_p99(service: str) -> MetricSeries:
    """Return p99 latency time series for *service* (milliseconds)."""
    if service == "checkout-service":
        return MetricSeries(
            service=service,
            metric="latency_p99_ms",
            unit="milliseconds",
            datapoints=[
                {"timestamp": _ts(0), "value": 23},
                {"timestamp": _ts(1), "value": 26},
                {"timestamp": _ts(2), "value": 89},
                {"timestamp": _ts(3), "value": 847},
                {"timestamp": _ts(4), "value": 1847},
                {"timestamp": _ts(5), "value": 1923},
                {"timestamp": _ts(6), "value": 1812},
            ],
            peak_value=1923,
            baseline_value=25,
            anomaly_detected=True,
            anomaly_start=_ts(2),
        )
    return MetricSeries(service=service, metric="latency_p99_ms", unit="milliseconds")


def query_throughput(service: str) -> MetricSeries:
    """Return requests-per-second time series for *service*."""
    if service == "checkout-service":
        return MetricSeries(
            service=service,
            metric="rps",
            unit="requests/sec",
            datapoints=[
                {"timestamp": _ts(i), "value": max(0, 340 - i * 30)}
                for i in range(7)
            ],
            peak_value=340,
            baseline_value=320,
            anomaly_detected=False,
        )
    return MetricSeries(service=service, metric="rps", unit="requests/sec")


def query_db_connections(service: str) -> MetricSeries:
    """Return active DB connections for *service*."""
    if service == "checkout-service":
        return MetricSeries(
            service=service,
            metric="db_connections_active",
            unit="count",
            datapoints=[
                {"timestamp": _ts(0), "value": 8},
                {"timestamp": _ts(1), "value": 5},
                {"timestamp": _ts(2), "value": 5},
                {"timestamp": _ts(3), "value": 5},
                {"timestamp": _ts(4), "value": 5},
                {"timestamp": _ts(5), "value": 5},
            ],
            peak_value=8,
            baseline_value=8,
            anomaly_detected=True,
            anomaly_start=_ts(1),
        )
    return MetricSeries(service=service, metric="db_connections_active", unit="count")
