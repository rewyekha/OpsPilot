# OpsPilot

**Multi-Agent Autonomous SRE Command Center for Enterprise Cloud Operations**

Built for Microsoft Agents League Hackathon · Reasoning Agents Track

---

## Repository Structure

```
opspilot/
├── backend/          # FastAPI + LangGraph agent runtime
├── frontend/         # React + TypeScript + Fluent UI
├── infra/            # Azure Bicep infrastructure-as-code
├── evaluation/       # Foundry evaluation datasets and runners
├── .github/          # CI/CD workflows
└── docker-compose.yml
```

## Quick Start

```bash
# 1. Copy environment config
cp .env.example .env
# Fill in Azure credentials

# 2. Start development stack
docker compose -f docker-compose.dev.yml up

# Frontend: http://localhost:3000
# API:      http://localhost:8000
# API docs: http://localhost:8000/docs
```

## Development

See [docs/architecture/overview.md](docs/architecture/overview.md) for the full architecture decision record.

| Service    | Tech Stack                          | Port |
|------------|-------------------------------------|------|
| Frontend   | React 18, TypeScript, Fluent UI v9  | 3000 |
| API        | FastAPI, Python 3.12, Pydantic v2   | 8000 |
| Agents     | LangGraph 0.2+, Azure OpenAI        | —    |
| Cache      | Redis 7                             | 6379 |

## Architecture

- **Commander Agent** — GPT-4o — orchestrates investigation, synthesizes findings
- **Metrics Agent** — GPT-4o-mini — queries Prometheus / Azure Monitor
- **Logs Agent** — GPT-4o-mini — queries Log Analytics, extracts error patterns
- **Deployment Agent** — GPT-4o-mini — correlates deployments with incident window
- **Time Machine Agent** — GPT-4o — builds causal event timeline

## Azure Services

| Service                  | Purpose                                        |
|--------------------------|------------------------------------------------|
| Azure AI Foundry         | Model catalog, prompt registry, tracing, eval  |
| Azure OpenAI             | LLM inference for all agents                   |
| Azure Container Apps     | Container hosting (frontend, api, agents)      |
| Azure Cosmos DB          | Incident records, agent findings, checkpoints  |
| Azure AI Search          | Agent episodic memory, runbook index           |
| Azure Monitor + App Insights | Full-stack observability                  |
| Azure Key Vault          | Secret management via managed identity         |
