"""
AIProvider — the single interface every execution backend implements.

Agents and endpoints depend only on this interface; the concrete provider
(Mock or Foundry) is chosen centrally by the factory. This is the seam that
lets the system switch between mock and Azure AI Foundry execution without any
caller change.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TypeVar

from pydantic import BaseModel

from app.providers.models import ExecutionMode, ModelRole

TModel = TypeVar("TModel", bound=BaseModel)


class AIProvider(ABC):
    """Common contract for all AI execution providers."""

    #: Stable identifier returned in API responses ("mock" | "foundry").
    name: str = "base"
    #: The execution mode this provider represents.
    mode: ExecutionMode = ExecutionMode.MOCK

    @property
    def is_live(self) -> bool:
        """True when this provider performs real model calls (i.e. not mock)."""
        return self.mode is ExecutionMode.FOUNDRY

    @abstractmethod
    def model_for(self, role: ModelRole) -> str:
        """Return the concrete deployment name backing *role*."""
        ...

    @abstractmethod
    async def generate(self, role: ModelRole, prompt: str) -> str:
        """Generate a plain-text completion for *prompt* using *role*'s model."""
        ...

    @abstractmethod
    async def structured_generate(
        self,
        role: ModelRole,
        prompt: str,
        schema: type[TModel],
    ) -> TModel:
        """Generate a response validated against *schema* (a Pydantic model).

        Returns an instance of *schema*. Mock providers return a deterministic
        instance; live providers use the model's structured-output support.
        """
        ...
