"""
Logs Agent — log pattern and stack trace analysis specialist.

Queries Azure Log Analytics for error patterns, connection pool exhaustion
stack traces, and first-occurrence timestamps.

Model: specialist (GPT-4o-mini)
Tools: query_error_logs, query_connection_pool_stats
"""
from __future__ import annotations

import json

from pydantic import BaseModel, Field

from app.agents.base import AgentFinding, BaseAgent
from app.agents.state import OpsPilotState
from app.tools.logs_tools import query_connection_pool_stats, query_error_logs

LOGS_SYSTEM_PROMPT = """
You are the Logs Agent for OpsPilot. Analyze application log data and return a structured finding.

Given error logs and connection pool statistics, you must:
1. Identify the dominant error type and root exception
2. Determine the first occurrence timestamp
3. Assess pool saturation and configuration values
4. Quantify error volume and rate
5. Write a concise 2-3 sentence summary with specific numbers

All evidence citations must reference specific counts, timestamps, or configuration values.
Output must conform exactly to the LogsAnalysis schema.
"""


class LogsAnalysis(BaseModel):
    """Structured output from the Logs Agent LLM call."""

    dominant_error: str = Field(description="Most frequent exception class")
    error_count: int = Field(description="Total error count in the window")
    first_occurrence: str = Field(description="ISO-8601 timestamp of first error")
    pool_size_current: int = Field(description="Current ORM pool_size value")
    pool_size_expected: int = Field(description="Expected / previous pool_size value")
    config_regression: bool = Field(description="Whether a config regression was confirmed")
    summary: str = Field(description="2-3 sentence finding summary")
    evidence: list[str] = Field(description="Specific evidence items")
    confidence: float = Field(ge=0.0, le=100.0)


class LogsAgent(BaseAgent):
    role = "logs"
    role_label = "Logs"
    model_key = "specialist"

    async def _investigate(self, state: OpsPilotState) -> AgentFinding:
        services = state.affected_services or ["checkout-service"]
        primary = services[0]

        error_logs = query_error_logs(primary)
        pool_stats = query_connection_pool_stats(primary)

        tool_data = {
            "error_logs": {
                "total_errors": error_logs.total_errors,
                "error_rate_per_minute": error_logs.error_rate_per_minute,
                "first_occurrence": error_logs.first_occurrence,
                "error_types": error_logs.error_types,
                "sample_stack_trace": (
                    error_logs.sample_entries[0].stack_trace
                    if error_logs.sample_entries
                    else ""
                ),
            },
            "connection_pool": pool_stats,
        }

        result: LogsAnalysis = await self._llm_structured(
            system=LOGS_SYSTEM_PROMPT,
            user=(
                f"Incident: {state.incident_description}\n"
                f"Service: {primary}\n"
                f"Log data:\n{json.dumps(tool_data, indent=2)}"
            ),
            response_model=LogsAnalysis,
        )

        return AgentFinding(
            role=self.role,
            summary=result.summary,
            evidence=result.evidence,
            confidence=result.confidence,
            metadata={
                "dominant_error": result.dominant_error,
                "error_count": result.error_count,
                "pool_size_current": result.pool_size_current,
                "pool_size_expected": result.pool_size_expected,
                "config_regression": result.config_regression,
            },
        )

    async def _mock_investigate(self, state: OpsPilotState) -> AgentFinding:
        await self._yield_to_loop()
        return AgentFinding(
            role=self.role,
            summary=(
                "Scanned Azure Log Analytics: 2,847 sqlalchemy.exc.TimeoutError instances. "
                "Stack traces confirm QueuePool exhaustion at pool_size=5. "
                "Config regression confirmed: previous pool_size=20 in v2.4.0."
            ),
            evidence=[
                "2,847 occurrences: sqlalchemy.exc.TimeoutError (pool_size=5 overflow 10)",
                "app/config/database.py SQLALCHEMY_POOL_SIZE: 5 (was 20 in v2.4.0)",
                "First error at 2026-06-03T12:23:00+00:00 (T+4 min post-deploy)",
                "Error rate: 474.5 errors/minute at peak",
            ],
            confidence=89.0,
            metadata={
                "dominant_error": "sqlalchemy.exc.TimeoutError",
                "error_count": 2847,
                "pool_size_current": 5,
                "pool_size_expected": 20,
                "config_regression": True,
            },
        )
