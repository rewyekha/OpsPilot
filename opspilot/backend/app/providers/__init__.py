"""AI provider abstraction layer.

Public surface:
  - AIProvider             : the interface every backend implements
  - MockProvider           : deterministic, credential-free execution
  - FoundryProvider        : Azure AI Foundry execution
  - ExecutionMode / ModelRole : configuration enums
  - get_provider()         : centralized provider selection (use this — never
                             construct a provider directly)
"""
from app.providers.base import AIProvider
from app.providers.factory import (
    get_provider,
    provider_is_live,
    reset_provider_cache,
    resolve_execution_mode,
)
from app.providers.foundry import FoundryProvider
from app.providers.mock import MockProvider
from app.providers.models import ExecutionMode, ModelRole, ProviderConfigurationError

__all__ = [
    "AIProvider",
    "MockProvider",
    "FoundryProvider",
    "ExecutionMode",
    "ModelRole",
    "ProviderConfigurationError",
    "get_provider",
    "provider_is_live",
    "resolve_execution_mode",
    "reset_provider_cache",
]
