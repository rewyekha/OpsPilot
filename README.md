# OpsPilot — Autonomous Multi-Agent SRE Command Center

> Built for the **Microsoft Agents League Hackathon** · Reasoning Agents Track

OpsPilot compresses production incident triage from hours of tribal, high-pressure
manual work into an evidence-backed, **sub-5-minute investigation** — and escalates
to a frontier reasoning model *only when it needs to*.

When an incident fires, a **Commander** agent dispatches a team of specialized AI
agents that investigate **in parallel**, correlate their evidence into a causal
timeline, determine a **confidence-scored root cause**, and propose ranked,
executable remediations — all streamed live to an Azure-Portal-style command
centre over Server-Sent Events.

The application code lives in [`opspilot/`](opspilot/). Start there:
[`opspilot/README.md`](opspilot/README.md) · [`opspilot/docs/JUDGES_GUIDE.md`](opspilot/docs/JUDGES_GUIDE.md).

---

## The differentiator: confidence-gated reasoning escalation

After root-cause analysis, OpsPilot computes a **combined confidence score**. Only
when it falls below threshold (default 70) does it route the full context to the
**o4-mini** reasoning model, which re-examines the evidence from first principles
and returns a refined root cause plus a complete reasoning trace. Frontier
reasoning stays **off the hot path** unless it's actually needed — governing cost
and latency by design.

| Agent | Role | Model |
|-------|------|-------|
| Commander | Orchestration & synthesis | GPT-4o |
| Metrics / Logs / Deployment | Parallel evidence gathering | GPT-4o-mini |
| Time Machine | Causal event timeline | GPT-4o |
| Root Cause | Confidence-scored hypothesis | GPT-4o |
| Deep Reasoning | First-principles re-analysis (escalation) | o4-mini |
| Recommendation | Ranked, executable remediations | GPT-4o-mini |

Agents are routed by role to configurable Azure AI Foundry deployments and
orchestrated as a compiled **LangGraph** `StateGraph` with conditional escalation
edges.

---

## Run it (for judges)

OpsPilot runs in **zero-credential mock mode by default** — no Azure account
needed to evaluate the full experience. All paths below open the app at
**http://localhost:3000**.

> First, in every path: `cd opspilot && cp .env.example .env`
> The defaults in `.env.example` select mock mode, so this just works.

### Option A — Prebuilt images from GHCR (fastest, no build)

```bash
cd opspilot
cp .env.example .env
docker compose -f docker-compose.ghcr.yml up
```

Pull the images directly if you prefer:

```bash
docker pull ghcr.io/rewyekha/opspilot-backend:latest
docker pull ghcr.io/rewyekha/opspilot-frontend:latest
```

### Option B — Build from source with Docker

```bash
cd opspilot
cp .env.example .env
docker compose -f docker-compose.yml up --build
```

### Option C — Local dev (hot reload)

```bash
# Backend (mock mode — no credentials)
cd opspilot/backend && uvicorn app.main:app --port 8000
# Frontend
cd opspilot/frontend && npm install && npm run dev
```

### Bring your own Azure AI Foundry credentials (live mode)

Edit `opspilot/.env` and set:

```bash
EXECUTION_MODE=foundry
FOUNDRY_ENDPOINT=https://<your-resource>.openai.azure.com/
FOUNDRY_API_KEY=<your-key>            # or leave empty to use managed identity
COMMANDER_MODEL_DEPLOYMENT=gpt-4o
SPECIALIST_MODEL_DEPLOYMENT=gpt-4o-mini
REASONING_MODEL_DEPLOYMENT=o4-mini
```

Then re-run any option above. See [`opspilot/backend/.env.example`](opspilot/backend/.env.example)
for the full list of supported variables (all optional except `FOUNDRY_ENDPOINT`
in live mode).

---

## Container images

| Image | Registry path |
|-------|---------------|
| Backend (FastAPI + LangGraph) | `ghcr.io/rewyekha/opspilot-backend` |
| Frontend (React + nginx) | `ghcr.io/rewyekha/opspilot-frontend` |

Images are built and published automatically on every push to `main` by
[`.github/workflows/docker-ghcr.yml`](.github/workflows/docker-ghcr.yml). Tags:
`latest`, the short commit SHA, and semantic-version tags on `v*` releases.

---

## Repository layout

```
.
├── opspilot/              # the application
│   ├── backend/           # FastAPI + LangGraph agent runtime (Python 3.12)
│   ├── frontend/          # React + TypeScript + Fluent UI v9
│   ├── infra/             # Azure Bicep infrastructure-as-code
│   ├── evaluation/        # Foundry evaluation datasets and runners
│   ├── docs/              # architecture, judges' guide, readiness reports
│   └── docker-compose*.yml
├── docs/                  # planning notes and design history
└── .github/workflows/     # CI/CD (Docker → GHCR)
```

## Tech stack

`React 18` · `TypeScript` · `Fluent UI v9` · `FastAPI` · `Python 3.12` ·
`LangGraph` · `Azure AI Foundry` · `Azure OpenAI` · `Docker` · `GitHub Actions`
