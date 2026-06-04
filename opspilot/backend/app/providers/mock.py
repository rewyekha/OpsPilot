"""
MockProvider — deterministic, credential-free execution.

Returns canned but role-aware text so the full pipeline (and the smoke-test
endpoint) works with zero Azure configuration. It still reports the *configured*
deployment names via model_for(), so role routing (incl. the o3 reasoning role)
is observable even in mock mode.
"""
from __future__ import annotations

import typing
from typing import get_args, get_origin

from pydantic import BaseModel

from app.config import Settings, get_settings
from app.providers.base import AIProvider, TModel
from app.providers.models import ExecutionMode, ModelRole


# bool must precede int (bool is a subclass of int).
_SCALAR_DEFAULTS: tuple[tuple[type, typing.Any], ...] = (
    (bool, False),
    (int, 0),
    (float, 0.0),
    (str, ""),
)


def _scalar_default(annotation: type) -> typing.Any:
    if issubclass(annotation, BaseModel):
        return _build_instance(annotation)
    for typ, default in _SCALAR_DEFAULTS:
        if issubclass(annotation, typ):
            return default
    return None


def _deterministic_value(annotation: typing.Any) -> typing.Any:
    """Return a deterministic, schema-valid placeholder for a type annotation."""
    origin = get_origin(annotation)
    if origin in (list, set, tuple, frozenset):
        return []
    if origin is dict:
        return {}
    if origin is typing.Union:  # Optional[X] / Union → first non-None arg
        args = [a for a in get_args(annotation) if a is not type(None)]
        return _deterministic_value(args[0]) if args else None
    if isinstance(annotation, type):
        return _scalar_default(annotation)
    return None


def _build_instance(schema: type[BaseModel]) -> BaseModel:
    """Construct a deterministic, valid instance of *schema* (Pydantic v2)."""
    values: dict[str, typing.Any] = {}
    for name, field in schema.model_fields.items():
        if not field.is_required():
            continue  # let the model default apply
        values[name] = _deterministic_value(field.annotation)
    return schema(**values)


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

    async def structured_generate(
        self,
        role: ModelRole,
        prompt: str,
        schema: type[TModel],
    ) -> TModel:
        """Return a deterministic, schema-valid instance.

        Note: agents do not hit this path during a mock investigation — they use
        their own canned _mock_investigate() output. This exists so the provider
        contract is complete and directly callable (e.g. smoke tests).
        """
        return typing.cast(TModel, _build_instance(schema))
