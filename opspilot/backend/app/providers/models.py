"""
Shared enums and exceptions for the AI provider layer.

These are intentionally dependency-free (no Azure / openai imports) so they can
be imported anywhere — including at app startup with zero credentials.
"""
from __future__ import annotations

from enum import Enum


class ExecutionMode(str, Enum):
    """How the application resolves which AI provider to use."""

    MOCK = "mock"        # always the deterministic mock provider
    FOUNDRY = "foundry"  # always Azure AI Foundry (fail if credentials missing)
    AUTO = "auto"        # Foundry when configured, otherwise fall back to mock

    @classmethod
    def parse(cls, value: str) -> "ExecutionMode":
        """Parse a raw env string, defaulting to MOCK on anything unrecognised."""
        try:
            return cls(value.strip().lower())
        except (ValueError, AttributeError):
            return cls.MOCK


class ModelRole(str, Enum):
    """Logical model tier. The provider maps each role to a concrete deployment."""

    COMMANDER = "commander"    # high-capability synthesis (e.g. gpt-4o)
    SPECIALIST = "specialist"  # cheap, fast, tool-grounded (e.g. gpt-4o-mini)
    REASONING = "reasoning"    # deep reasoning (e.g. o4-mini)

    @classmethod
    def parse(cls, value: str) -> "ModelRole":
        """Parse a raw role string, defaulting to COMMANDER on anything unrecognised."""
        try:
            return cls(value.strip().lower())
        except (ValueError, AttributeError):
            return cls.COMMANDER


class ProviderConfigurationError(RuntimeError):
    """Raised when a provider is requested but its required configuration is absent.

    Example: EXECUTION_MODE=foundry but FOUNDRY_ENDPOINT is not set.
    """
