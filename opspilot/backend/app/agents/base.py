"""
BaseAgent — abstract base class for all OpsPilot investigation agents.

Every specialist agent (Metrics, Logs, Deployment, Correlation, RootCause,
Recommendation) inherits from BaseAgent and implements _investigate().

Execution contract
------------------
1. BaseAgent.run() emits  agent.started  SSE event
2. Calls _investigate() (live) or _mock_investigate(), chosen by the injected
   AIProvider (provider.is_live) — see app.providers
3. Emits  agent.finding  SSE event with confidence + summary
4. Emits  agent.completed  SSE event
5. Returns AgentFinding to the Orchestrator for fan-in

Provider architecture
---------------------
Agents depend only on the AIProvider interface; the concrete provider (Mock or
Foundry) is chosen centrally by app.providers.get_provider() based on
EXECUTION_MODE. When the provider is not live (EXECUTION_MODE=mock), each agent
calls _mock_investigate() and returns deterministic demo data — identical SSE
sequence and output in both paths. Live structured calls flow through
provider.structured_generate(role, prompt, schema).
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
from app.providers.base import AIProvider
from app.providers.models import ModelRole
from app.services.event_stream import EventStreamService

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
    model_role: ModelRole = ModelRole.SPECIALIST  # COMMANDER | SPECIALIST | REASONING

    def __init__(self, provider: AIProvider, stream: EventStreamService) -> None:
        self._provider = provider
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
        mode = "live" if self._provider.is_live else "mock"

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
            if self._provider.is_live:
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
            # NO mock fallback — never fabricate telemetry. Emit an explicit, empty
            # failed finding so the UI shows "investigation incomplete" instead of
            # invented incident data. The orchestrator records this as status=failed.
            finding = AgentFinding(
                role=self.role,
                summary=f"{self.role_label} agent could not complete (live error).",
                evidence=[],
                confidence=0.0,
                metadata={"failed": True, "error": str(exc)},
            )
            log.warning(
                "agent.failed_no_fallback",
                agent=self.role,
                reason=str(exc),
            )

        completed_at = datetime.now(timezone.utc).isoformat()
        duration_ms = round((time.monotonic() - t0) * 1000, 1)

        # Stamp execution timing onto the finding so the orchestrator can persist a
        # real per-agent execution record (duration / start / end / mode).
        finding.metadata["_duration_ms"] = duration_ms
        finding.metadata["_started_at"] = started_at
        finding.metadata["_completed_at"] = completed_at
        finding.metadata["_mode"] = mode

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

    async def _llm_structured(
        self,
        system: str,
        user: str,
        response_model: type,
    ) -> Any:
        """Structured LLM call routed through the active AIProvider.

        The agent's `model_role` selects the deployment; the system + user
        messages are combined into one prompt to match the provider's
        structured_generate(role, prompt, schema) contract.
        """
        prompt = f"{system}\n\n{user}"
        return await self._provider.structured_generate(
            role=self.model_role,
            prompt=prompt,
            schema=response_model,
        )

    @staticmethod
    async def _yield_to_loop() -> None:
        """Yield to the event loop briefly so SSE events flush."""
        await asyncio.sleep(0.05)
