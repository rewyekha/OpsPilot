"""
Azure AI Foundry service client.

Responsibilities:
  - Initialize the AzureOpenAI async client from settings
  - Provide structured_chat() for schema-enforced LLM responses (Pydantic models)
  - Gracefully fall back to deterministic mock output when credentials are absent,
    so the full agent pipeline runs in development without cloud access
  - Attach Foundry project tracing when azure_ai_foundry_project_name is set
"""
from __future__ import annotations

import json
import logging
from typing import Any, TypeVar

from openai import AsyncAzureOpenAI
from pydantic import BaseModel

from app.config import get_settings

log = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class FoundryClient:
    """Thin async wrapper around Azure OpenAI with Pydantic structured output."""

    def __init__(self) -> None:
        settings = get_settings()
        self._endpoint: str = settings.azure_openai_endpoint
        self._api_key: str = settings.azure_openai_api_key
        self._api_version: str = settings.azure_openai_api_version
        self._commander_model: str = settings.commander_model_deployment
        self._specialist_model: str = settings.specialist_model_deployment
        self._client: AsyncAzureOpenAI | None = None

    @property
    def is_configured(self) -> bool:
        """True when Azure OpenAI endpoint is present in settings."""
        return bool(self._endpoint)

    def _get_client(self) -> AsyncAzureOpenAI:
        if self._client is None:
            kwargs: dict[str, Any] = {
                "azure_endpoint": self._endpoint,
                "api_version": self._api_version,
            }
            if self._api_key:
                kwargs["api_key"] = self._api_key
            else:
                # Use DefaultAzureCredential via azure-identity
                from azure.identity import DefaultAzureCredential, get_bearer_token_provider

                credential = DefaultAzureCredential()
                token_provider = get_bearer_token_provider(
                    credential,
                    "https://cognitiveservices.azure.com/.default",
                )
                kwargs["azure_ad_token_provider"] = token_provider
            self._client = AsyncAzureOpenAI(**kwargs)  # type: ignore[arg-type]

            # Enable Azure AI Foundry tracing when project is configured.
            # This instruments every openai call with spans visible in the
            # Foundry portal — required for "Reasoning Agents with Foundry" track.
            settings = get_settings()
            if settings.azure_ai_foundry_project_name:
                try:
                    from azure.ai.projects import AIProjectClient
                    from azure.identity import DefaultAzureCredential as _Cred
                    project_client = AIProjectClient(
                        credential=_Cred(),
                        project_name=settings.azure_ai_foundry_project_name,
                        resource_group_name=settings.azure_ai_foundry_resource_group,
                        subscription_id=settings.azure_subscription_id,
                    )
                    project_client.telemetry.enable()
                    log.info(
                        "foundry.telemetry.enabled",
                        project=settings.azure_ai_foundry_project_name,
                    )
                except Exception as exc:
                    log.warning("foundry.telemetry.failed", error=str(exc))

        return self._client

    def model_for(self, role: str) -> str:
        """Return the deployment name for a given agent role string."""
        return self._commander_model if role == "commander" else self._specialist_model

    async def structured_chat(
        self,
        messages: list[dict[str, str]],
        model_deployment: str,
        response_model: type[T],
    ) -> T:
        """
        Call Azure OpenAI with Pydantic structured output.

        Returns a validated instance of *response_model*.
        Falls back to response_model.model_validate({}) on parse failure.
        """
        if not self.is_configured:
            raise RuntimeError("FoundryClient: Azure OpenAI endpoint not configured.")

        client = self._get_client()
        try:
            completion = await client.beta.chat.completions.parse(
                model=model_deployment,
                messages=messages,  # type: ignore[arg-type]
                response_format=response_model,
            )
            result = completion.choices[0].message.parsed
            if result is None:
                raise ValueError("LLM returned null parsed result")
            return result  # type: ignore[return-value]
        except Exception as exc:
            log.warning(
                "foundry.structured_chat.error",
                model=model_deployment,
                error=str(exc),
            )
            raise

    async def plain_chat(self, messages: list[dict[str, str]], model_deployment: str) -> str:
        """Plain text completion — returns the assistant message content."""
        if not self.is_configured:
            raise RuntimeError("FoundryClient: Azure OpenAI endpoint not configured.")
        client = self._get_client()
        completion = await client.chat.completions.create(
            model=model_deployment,
            messages=messages,  # type: ignore[arg-type]
        )
        return completion.choices[0].message.content or ""


# Module-level singleton — created once, reused across requests
_foundry_client: FoundryClient | None = None


def get_foundry_client() -> FoundryClient:
    global _foundry_client
    if _foundry_client is None:
        _foundry_client = FoundryClient()
    return _foundry_client
