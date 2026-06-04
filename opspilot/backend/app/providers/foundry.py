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
from app.providers.base import AIProvider, TModel
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

    @staticmethod
    def _is_reasoning(role: ModelRole) -> bool:
        return role is ModelRole.REASONING

    def _base_params(self, role: ModelRole, prompt: str) -> dict[str, Any]:
        """Role-aware request params.

        Reasoning models (o3) reject `temperature` and use `max_completion_tokens`
        rather than `max_tokens`; we therefore pass NEITHER an explicit temperature
        nor `max_tokens` for the reasoning role, letting the service defaults apply.
        Chat models (gpt-4o / gpt-4o-mini) get a low temperature for determinism.
        """
        params: dict[str, Any] = {
            "model": self.model_for(role),
            "messages": [{"role": "user", "content": prompt}],
        }
        if not self._is_reasoning(role):
            params["temperature"] = 0.2
        return params

    async def generate(self, role: ModelRole, prompt: str) -> str:
        client = self._get_client()
        try:
            completion = await client.chat.completions.create(**self._base_params(role, prompt))
            return completion.choices[0].message.content or ""
        except Exception as exc:
            # Log role + deployment + error only — never endpoint/key material.
            log.warning(
                "foundry.generate.error role=%s deployment=%s error=%s",
                role.value, self.model_for(role), type(exc).__name__,
            )
            raise

    async def structured_generate(
        self,
        role: ModelRole,
        prompt: str,
        schema: type[TModel],
    ) -> TModel:
        """Schema-driven generation via Azure OpenAI structured output (parse).

        Uses beta.chat.completions.parse with the Pydantic schema as
        response_format. No `temperature` is sent (parse does not accept it and
        o3 would reject it), keeping the call valid across gpt-4o / gpt-4o-mini / o3.
        """
        client = self._get_client()
        deployment = self.model_for(role)
        try:
            completion = await client.beta.chat.completions.parse(
                model=deployment,
                messages=[{"role": "user", "content": prompt}],
                response_format=schema,
            )
            parsed = completion.choices[0].message.parsed
            if parsed is None:
                raise ValueError(f"Foundry returned no parsed result for {schema.__name__}")
            return parsed
        except Exception as exc:
            log.warning(
                "foundry.structured_generate.error role=%s deployment=%s schema=%s error=%s",
                role.value, deployment, schema.__name__, type(exc).__name__,
            )
            raise
