"""
Metrics Agent — time-series anomaly analysis specialist.

Queries error rate, latency p99, throughput, and DB connection metrics
for the affected services and identifies the anomaly onset timestamp.

Model: specialist (GPT-4o-mini)
Tools: query_error_rate, query_latency_p99, query_throughput, query_db_connections
"""
from __future__ import annotations

import json

from pydantic import BaseModel, Field

from app.agents.base import AgentFinding, BaseAgent
from app.agents.state import OpsPilotState
from app.agents.metrics.prompts import METRICS_SYSTEM_PROMPT
from app.tools.metrics_tools import (
    query_db_connections,
    query_error_rate,
    query_latency_p99,
    query_throughput,
)


class MetricsAnalysis(BaseModel):
    """Structured output from the Metrics Agent LLM call."""

    error_rate_pct: float = Field(description="Peak error rate percentage detected")
    latency_p99_ms: float = Field(description="Peak p99 latency in milliseconds")
    anomaly_start_timestamp: str = Field(description="ISO-8601 timestamp of first anomaly")
    affected_services: list[str] = Field(description="Services with anomalous metrics")
    root_metric: str = Field(description="The primary metric that deviated first")
    summary: str = Field(description="2-3 sentence summary of metric findings")
    evidence: list[str] = Field(description="Specific data points supporting the finding")
    confidence: float = Field(ge=0.0, le=100.0, description="Confidence score 0–100")


class MetricsAgent(BaseAgent):
    role = "metrics"
    role_label = "Metrics"
    model_key = "specialist"

    async def _investigate(self, state: OpsPilotState) -> AgentFinding:
        services = state.affected_services or ["checkout-service"]
        primary = services[0]

        # Gather metric data
        error_rate = query_error_rate(primary)
        latency = query_latency_p99(primary)
        throughput = query_throughput(primary)
        db_conns = query_db_connections(primary)

        tool_data = {
            "error_rate": {
                "series": error_rate.datapoints,
                "peak": error_rate.peak_value,
                "baseline": error_rate.baseline_value,
                "anomaly_detected": error_rate.anomaly_detected,
                "anomaly_start": error_rate.anomaly_start,
            },
            "latency_p99_ms": {
                "series": latency.datapoints,
                "peak": latency.peak_value,
                "baseline": latency.baseline_value,
            },
            "throughput_rps": {
                "series": throughput.datapoints,
                "peak": throughput.peak_value,
            },
            "db_connections": {
                "series": db_conns.datapoints,
                "peak": db_conns.peak_value,
                "anomaly": db_conns.anomaly_detected,
                "anomaly_start": db_conns.anomaly_start,
            },
        }

        result: MetricsAnalysis = await self._llm_structured(
            system=METRICS_SYSTEM_PROMPT,
            user=(
                f"Incident: {state.incident_description}\n"
                f"Services: {', '.join(services)}\n"
                f"Metric data:\n{json.dumps(tool_data, indent=2)}"
            ),
            response_model=MetricsAnalysis,
        )

        return AgentFinding(
            role=self.role,
            summary=result.summary,
            evidence=result.evidence,
            confidence=result.confidence,
            metadata={
                "error_rate_pct": result.error_rate_pct,
                "latency_p99_ms": result.latency_p99_ms,
                "anomaly_start": result.anomaly_start_timestamp,
                "root_metric": result.root_metric,
            },
        )

    async def _mock_investigate(self, state: OpsPilotState) -> AgentFinding:
        await self._yield_to_loop()
        return AgentFinding(
            role=self.role,
            summary=(
                "Detected 73% error rate spike and 1,847ms p99 latency degradation "
                "across checkout-service beginning at 14:23 UTC. DB connection pool "
                "capped at 5 connections correlates with onset of errors."
            ),
            evidence=[
                "checkout-service p99 latency: 23ms → 1,847ms at 14:23 UTC",
                "Error rate: 0.8% → 73.4% (threshold breach at T+3 min)",
                "DB active connections: plateaued at 5 (pool ceiling) from 14:20 UTC",
                "payment-gateway timeout rate: 0% → 41% (downstream cascade)",
            ],
            confidence=91.0,
            metadata={
                "error_rate_pct": 73.4,
                "latency_p99_ms": 1847,
                "anomaly_start": "2026-06-03T12:22:00+00:00",
                "root_metric": "db_connections_active",
            },
        )
