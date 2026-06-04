"""Application configuration.

All settings are loaded from environment variables (or a .env file).
Azure credentials default to empty strings so the app starts locally
without requiring cloud access. Production deployments set these via
Azure Key Vault references in the App Service configuration.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── API ──────────────────────────────────────────────────────────────────
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    log_level: str = "INFO"

    # ── Execution mode (provider selection) ──────────────────────────────────
    # mock | foundry | auto. Default "mock" so the app runs with zero credentials.
    execution_mode: str = "mock"

    # ── Azure AI Foundry provider ─────────────────────────────────────────────
    foundry_endpoint: str = ""
    foundry_api_key: str = ""              # empty = use managed identity
    foundry_api_version: str = "2024-08-01-preview"

    # ── Azure OpenAI ─────────────────────────────────────────────────────────
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""          # empty = use managed identity
    azure_openai_api_version: str = "2024-08-01-preview"
    commander_model_deployment: str = "gpt-4o"
    specialist_model_deployment: str = "gpt-4o-mini"
    reasoning_model_deployment: str = "o4-mini"

    # ── Reasoning escalation ─────────────────────────────────────────────────
    # When the combined investigation confidence (0–100) is below this
    # threshold, the orchestrator escalates to the REASONING (o4-mini) agent for a
    # refined root cause. Default 70 keeps the high-confidence demo path
    # un-escalated (existing behavior unchanged).
    reasoning_escalation_threshold: float = 70.0

    # ── Demo mode (Phase 5) ───────────────────────────────────────────────────
    # When true, the combined confidence is intentionally lowered so the o4-mini
    # reasoning escalation always fires — useful for demoing the reasoning path.
    # DISABLED by default; production behavior is unchanged.
    low_confidence_demo: bool = False

    # ── API security (Phase 5) ────────────────────────────────────────────────
    # Optional shared key for the model-invoking test endpoints. Empty = open
    # (local dev unchanged). When set, callers must send `X-API-KEY: <value>`.
    dev_api_key: str = ""

    # ── Azure AI Foundry ─────────────────────────────────────────────────────
    azure_ai_foundry_project_name: str = ""
    azure_ai_foundry_resource_group: str = ""
    azure_subscription_id: str = ""

    # ── Azure Cosmos DB ──────────────────────────────────────────────────────
    cosmos_db_endpoint: str = ""
    cosmos_db_database: str = "opspilot"
    cosmos_db_incidents_container: str = "incidents"

    # ── Azure AI Search ──────────────────────────────────────────────────────
    azure_search_endpoint: str = ""
    azure_search_index_name: str = "incident-history"

    # ── Redis ────────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance. Cached after first call."""
    return Settings()
