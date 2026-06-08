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

    # ── Telemetry mode (Phase 8 — monitoring data source) ─────────────────────
    # synthetic | azure. Default "synthetic" so the app runs with zero Azure
    # access. "azure" routes the TelemetryProvider to real Application Insights /
    # Log Analytics for the deployed demo workloads. The synthetic provider is
    # never removed — it stays the offline/CI default.
    telemetry_mode: str = "synthetic"

    # Log Analytics workspace GUID (customerId) backing the workspace-based
    # Application Insights. Required when TELEMETRY_MODE=azure.
    azure_log_analytics_workspace_id: str = ""
    # Application Insights connection string (shared by the demo workloads).
    applicationinsights_connection_string: str = ""

    # ── Azure AI Foundry provider ─────────────────────────────────────────────
    foundry_endpoint: str = ""
    foundry_api_key: str = ""              # empty = use managed identity
    foundry_api_version: str = "2024-08-01-preview"

    # ── Azure OpenAI ─────────────────────────────────────────────────────────
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""          # empty = use managed identity
    azure_openai_api_version: str = "2024-08-01-preview"
    # Cost control (Phase 9): o4-mini ONLY — no gpt-4o / gpt-4o-mini. Every role
    # defaults to o4-mini so a missing/partial .env can never select a pricier
    # (or non-existent) deployment.
    commander_model_deployment: str = "o4-mini"
    specialist_model_deployment: str = "o4-mini"
    reasoning_model_deployment: str = "o4-mini"

    # ── Reasoning escalation ─────────────────────────────────────────────────
    # When the combined investigation confidence (0–100) is below this
    # threshold, the orchestrator escalates to the REASONING (o4-mini) agent for a
    # refined root cause. Default 70 keeps the high-confidence demo path
    # un-escalated (existing behavior unchanged).
    reasoning_escalation_threshold: float = 70.0

    # ── API security ──────────────────────────────────────────────────────────
    # Optional shared key for the model-invoking test endpoints. Empty = open
    # (local dev unchanged). When set, callers must send `X-API-KEY: <value>`.
    dev_api_key: str = ""

    # ── Autonomous incident detection (background monitor) ────────────────────
    # When enabled (and TELEMETRY_MODE=azure), a background loop scans telemetry
    # and AUTO-CREATES + AUTO-INVESTIGATES incidents when thresholds are breached.
    auto_detection_enabled: bool = True
    detection_interval_seconds: int = 30      # how often the monitor scans
    detection_cooldown_seconds: int = 600     # min gap between auto-runs per incident
    # Detection thresholds (telemetry-driven; never fabricated).
    detect_error_rate_warn_pct: float = 5.0   # > this for the window  → P2
    detect_error_rate_crit_pct: float = 20.0  # > this                  → P1
    detect_latency_p95_ms: float = 2000.0     # p95 > this              → P2
    detect_restart_storm_count: int = 5       # container restarts in window → P1

    # ── Demo scenarios (judging control panel) ────────────────────────────────
    # Gates the /api/demo/* endpoints that execute the infra/scripts/scenarios
    # PowerShell scripts against the deployed workload. OFF unless explicitly set.
    demo_mode_enabled: bool = False
    demo_resource_group: str = "rg-opspilot"
    demo_app_name: str = "album-api"


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance. Cached after first call."""
    return Settings()
