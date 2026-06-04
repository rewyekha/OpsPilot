"""
MockProvider — deterministic, credential-free execution.

Returns canned but role-aware text so the full pipeline (and the smoke-test
endpoint) works with zero Azure configuration. It still reports the *configured*
deployment names via model_for(), so role routing (incl. the o3 reasoning role)
is observable even in mock mode.
"""
from __future__ import annotations

from app.config import Settings, get_settings
from app.providers.base import AIProvider
from app.providers.models import ExecutionMode, ModelRole


class MockProvider(AIProvider):
    name = "mock"
    mode = ExecutionMode.MOCK

    def __init__(self, settings: Settings | None = None) -> None:
        s = settings or get_settings()
        self._deployments: dict[ModelRole, str] = {
            ModelRole.COMMANDER: s.commander_model_deployment,
            ModelRole.SPECIALIST: s.specialist_model_deployment,
            ModelRole.REASONING: s.reasoning_model_deployment,
        }

    def model_for(self, role: ModelRole) -> str:
        return self._deployments.get(role, self._deployments[ModelRole.SPECIALIST])

    async def generate(self, role: ModelRole, prompt: str) -> str:
        model = self.model_for(role)
        preview = prompt.strip().replace("\n", " ")
        if len(preview) > 240:
            preview = preview[:240] + "…"
        return (
            f"[MOCK · {role.value} · {model}] "
            f"Deterministic analysis for: \"{preview}\". "
            "This is a simulated response generated without Azure credentials; "
            "set EXECUTION_MODE=foundry with FOUNDRY_ENDPOINT to use a live model."
        )
