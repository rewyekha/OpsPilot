"""
Application configuration.

Loads all settings from environment variables via pydantic-settings.
Secrets are resolved from Azure Key Vault at startup using managed identity.
Never read secrets from hardcoded strings or config files.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_cors_origins: list[str] = ["http://localhost:3000"]
    log_level: str = "INFO"

    # Azure OpenAI
    azure_openai_endpoint: str
    azure_openai_api_key: str = ""          # empty = use managed identity
    azure_openai_api_version: str = "2024-08-01-preview"
    commander_model_deployment: str = "gpt-4o"
    specialist_model_deployment: str = "gpt-4o-mini"
    reasoning_model_deployment: str = "o3"

    # Azure AI Foundry
    azure_ai_foundry_project_name: str
    azure_ai_foundry_resource_group: str

    # Azure Cosmos DB
    cosmos_db_endpoint: str
    cosmos_db_database: str = "opspilot"
    cosmos_db_key: str = ""                 # empty = use managed identity

    # Azure AI Search
    azure_search_endpoint: str
    azure_search_key: str = ""              # empty = use managed identity
    azure_search_index_incidents: str = "past-incidents"
    azure_search_index_runbooks: str = "runbooks"

    # Azure Monitor
    applicationinsights_connection_string: str = ""

    # Feature flags
    use_mock_tools: bool = True
    enable_deep_reasoning: bool = False
    enable_action_execution: bool = False


settings = Settings()  # type: ignore[call-arg]
