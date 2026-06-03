"""
BaseAgent — abstract base class for all OpsPilot investigation agents.

Every specialist agent (Metrics, Logs, Deployment, Correlation, RootCause,
Recommendation) inherits from BaseAgent and implements _investigate().

Execution contract
------------------
1. BaseAgent.run() emits  agent.started  SSE event
2. Calls _investigate() — either via real LLM (FoundryClient) or mock fallback
3. Emits  agent.finding  SSE event with confidence + summary
4. Emits  agent.completed  SSE event
5. Returns AgentFinding to the Orchestrator for fan-in

Graceful degradation
--------------------
When AZURE_OPENAI_ENDPOINT is not configured, each agent calls its
_mock_investigate() method, returning deterministic demo data identical to
the existing mock services. The SSE event sequence is identical in both paths.
"""
from __future__ import annotations

import asyncio
import logging
import time
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

import structlog

from app.agents.state import OpsPilotState
from app.services.event_stream import EventStreamService
from app.services.foundry import FoundryClient

log = structlog.get_logger(__name__)
_stdlib_log = logging.getLogger(__name__)


class AgentFinding:
    """Lightweight finding returned by every agent to the orchestrator."""

    __slots__ = ("role", "summary", "evidence", "confidence", "metadata")

    def __init__(
        self,
        role: str,
        summary: str,
        evidence: list[str],
        confidence: float,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.role = role
        self.summary = summary
        self.evidence = evidence
        self.confidence = confidence  # 0.0 – 100.0
        self.metadata = metadata or {}


class BaseAgent(ABC):
    """Abstract base for all investigation agents."""

    # Subclasses must override
    role: str = ""
    role_label: str = ""
    model_key: str = "specialist"   # "specialist" | "commander"

    def __init__(self, foundry: FoundryClient, stream: EventStreamService) -> None:
        self._foundry = foundry
        self._stream = stream

    # ── Public entry point ────────────────────────────────────────────────────

    async def run(self, state: OpsPilotState) -> AgentFinding:
        """
        Execute this agent against *state*, emitting SSE events throughout.
        Automatically falls back to _mock_investigate() when Azure OpenAI
        credentials are absent.
        """
        incident_id = state.incident_id
        started_at = datetime.now(timezone.utc).isoformat()
        t0 = time.monotonic()
        mode = "live" if self._foundry.is_configured else "mock"

        log.info(
            "agent.started",
            agent=self.role,
            incident_id=incident_id,
            mode=mode,
        )

        await self._emit(incident_id, {
            "event_type": "agent.started",
            "agent_name": self.role,
            "incident_id": incident_id,
            "timestamp": started_at,
            "payload": {"message": f"{self.role_label} agent started", "mode": mode},
        })

        try:
            if self._foundry.is_configured:
                finding = await self._investigate(state)
            else:
                finding = await self._mock_investigate(state)
        except Exception as exc:
            log.exception(
                "agent.error",
                agent=self.role,
                incident_id=incident_id,
                error=str(exc),
            )
            # Degrade gracefully to mock
            finding = await self._mock_investigate(state)
            finding.confidence = max(finding.confidence - 10.0, 0.0)
            log.warning(
                "agent.fallback_to_mock",
                agent=self.role,
                reason=str(exc),
            )

        completed_at = datetime.now(timezone.utc).isoformat()
        duration_ms = round((time.monotonic() - t0) * 1000, 1)

        log.info(
            "agent.completed",
            agent=self.role,
            incident_id=incident_id,
            mode=mode,
            confidence=finding.confidence,
            duration_ms=duration_ms,
        )

        await self._emit(incident_id, {
            "event_type": "agent.finding",
            "agent_name": self.role,
            "incident_id": incident_id,
            "timestamp": completed_at,
            "payload": {
                "confidence": finding.confidence,
                "summary": finding.summary,
                "evidence": finding.evidence,
                "duration_ms": duration_ms,
                "mode": mode,
            },
        })

        await self._emit(incident_id, {
            "event_type": "agent.completed",
            "agent_name": self.role,
            "incident_id": incident_id,
            "timestamp": completed_at,
            "payload": {"duration_ms": duration_ms},
        })

        return finding

    # ── Subclass API ──────────────────────────────────────────────────────────

    @abstractmethod
    async def _investigate(self, state: OpsPilotState) -> AgentFinding:
        """Real LLM-based investigation. Called when Azure OpenAI is configured."""
        ...

    @abstractmethod
    async def _mock_investigate(self, state: OpsPilotState) -> AgentFinding:
        """Deterministic mock investigation for development without Azure credentials."""
        ...

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _emit(self, incident_id: str, event: dict) -> None:
        """Emit one SSE event; never raises."""
        try:
            await self._stream.emit(incident_id, event)
        except Exception:
            pass

    def _model(self) -> str:
        return self._foundry.model_for(self.model_key)

    async def _llm_structured(
        self,
        system: str,
        user: str,
        response_model: type,
    ) -> Any:
        """Convenience wrapper: structured LLM call returning a Pydantic model."""
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
        return await self._foundry.structured_chat(
            messages=messages,
            model_deployment=self._model(),
            response_model=response_model,
        )

    @staticmethod
    async def _yield_to_loop() -> None:
        """Yield to the event loop briefly so SSE events flush."""
        await asyncio.sleep(0.05)
