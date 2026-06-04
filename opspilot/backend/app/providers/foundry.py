"""
FoundryProvider — Azure AI Foundry execution.

Talks to the Foundry / Azure OpenAI inference endpoint via the async OpenAI SDK
(the SDK is imported lazily, only when a live call is actually made, so mock
mode never requires it to be installed).

Configuration (from app.config / environment):
  - FOUNDRY_ENDPOINT      (required)
  - FOUNDRY_API_KEY       (optional — falls back to managed identity)
  - FOUNDRY_API_VERSION
  - {commander,specialist,reasoning}_model_deployment  (deployment names, never hardcoded)
"""
from __future__ import annotations

import logging
from typing import Any

from app.config import Settings, get_settings
from app.providers.base import AIProvider
from app.providers.models import ExecutionMode, ModelRole, ProviderConfigurationError

log = logging.getLogger(__name__)


class FoundryProvider(AIProvider):
    name = "foundry"
    mode = ExecutionMode.FOUNDRY

    def __init__(self, settings: Settings | None = None) -> None:
        s = settings or get_settings()
        self._endpoint: str = s.foundry_endpoint
        self._api_key: str = s.foundry_api_key
        self._api_version: str = s.foundry_api_version
        self._deployments: dict[ModelRole, str] = {
            ModelRole.COMMANDER: s.commander_model_deployment,
            ModelRole.SPECIALIST: s.specialist_model_deployment,
            ModelRole.REASONING: s.reasoning_model_deployment,
        }
        self._client: Any | None = None

        # "foundry mode must fail if credentials are missing" — surface it early.
        if not self._endpoint:
            raise ProviderConfigurationError(
                "EXECUTION_MODE=foundry requires FOUNDRY_ENDPOINT to be set."
            )

    def model_for(self, role: ModelRole) -> str:
        return self._deployments.get(role, self._deployments[ModelRole.SPECIALIST])

    def _get_client(self) -> Any:
        """Lazily build the AsyncAzureOpenAI client (SDK imported on first use)."""
        if self._client is not None:
            return self._client

        from openai import AsyncAzureOpenAI  # lazy: not needed in mock mode

        kwargs: dict[str, Any] = {
            "azure_endpoint": self._endpoint,
            "api_version": self._api_version,
        }
        if self._api_key:
            kwargs["api_key"] = self._api_key
        else:
            # Managed identity / DefaultAzureCredential fallback.
            from azure.identity import DefaultAzureCredential, get_bearer_token_provider

            kwargs["azure_ad_token_provider"] = get_bearer_token_provider(
                DefaultAzureCredential(),
                "https://cognitiveservices.azure.com/.default",
            )

        self._client = AsyncAzureOpenAI(**kwargs)
        return self._client

    async def generate(self, role: ModelRole, prompt: str) -> str:
        client = self._get_client()
        deployment = self.model_for(role)

        kwargs: dict[str, Any] = {
            "model": deployment,
            "messages": [{"role": "user", "content": prompt}],
        }
        # o3 / reasoning deployments reject `temperature`; only set it for chat models.
        if role is not ModelRole.REASONING:
            kwargs["temperature"] = 0.2

        completion = await client.chat.completions.create(**kwargs)
        return completion.choices[0].message.content or ""
