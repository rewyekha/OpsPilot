Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/services/foundry.py#1-1), lines 1 to 120

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/services/foundry.py#120-120), lines 120 to 124

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/config.py#1-1), lines 1 to 80

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/agents/base.py#1-1), lines 1 to 100

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/agents/base.py#100-100), lines 100 to 160

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/agents/base.py#155-155), lines 155 to 170

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/agents/orchestrator.py#1-1), lines 1 to 80

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/agents/orchestrator.py#80-80), lines 80 to 130

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/agents/state.py#1-1), lines 1 to 80

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/agents/state.py#80-80), lines 80 to 104

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/agents/graph.py)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/agents/graph.py#18-18), lines 18 to 19

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/agents/time_machine/agent.py#1-1), lines 1 to 120

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/agents/commander/agent.py#1-1), lines 1 to 60

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/agents/commander/prompts.py#1-1), lines 1 to 80

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/agents/metrics/agent.py#1-1), lines 1 to 40

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/tools/metrics_tools.py#1-1), lines 1 to 60

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/services/event_stream.py#1-1), lines 1 to 60

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/services/event_stream.py#60-60), lines 60 to 75

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/main.py)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/api/routes/__init__.py)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/api/routes/incidents.py)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/services/incident_service.py)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/services/agent_service.py#1-1), lines 1 to 60

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/api/routes/agents.py)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/agents/root_cause/agent.py#1-1), lines 1 to 30

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/agents/recommendation/agent.py#1-1), lines 1 to 50

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/api/routes/stream.py#1-1), lines 1 to 80

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/tools)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/tools/infra_tools.py)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/tools/memory_tools.py)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/tools/deployment_tools.py#1-1), lines 1 to 40

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/tools/logs_tools.py#1-1), lines 1 to 40

Ran terminal command: from app.agents.orchestrator import InvestigationOrchestrator
from app.services.foundry import get_foundry_client
from app.config import get_settings

s = get_settings()
fc = get_foundry_client()
print('endpoint configured:', bool(s.azure_openai_endpoint))
print('foundry is_configured:', fc.is_configured)
print('commander model:', s.commander_model_deployment)
print('specialist model:', s.specialist_model_deployment)
print('foundry project:', bool(s.azure_ai_foundry_project_name))
print('cosmos endpoint:', bool(s.cosmos_db_endpoint))
print('search endpoint:', bool(s.azure_search_endpoint))
print('redis_url:', s.redis_url)

Ran terminal command: python -c "
# Check which agent paths are actually executable
from app.agents.metrics.agent import MetricsAgent
from app.agents.logs.agent import LogsAgent
from app.agents.deployment.agent import DeploymentAgent
from app.agents.time_machine.agent import CorrelationAgent
from app.agents.root_cause.agent import RootCauseAgent
from app.agents.recommendation.agent import RecommendationAgent
from app.agents.commander.agent import CommanderAgent
from app.agents.orchestrator import InvestigationOrchestrator

agents = [MetricsAgent, LogsAgent, DeploymentAgent, CorrelationAgent, RootCauseAgent, RecommendationAgent, CommanderAgent]
for a in agents:
    print(f'{a.__name__}: role={a.role!r}, model_key={a.model_key!r}, has_investigate={hasattr(a, "_investigate")}, has_mock={hasattr(a, "_mock_investigate")}')
" 2>&1
Completed with input: python -c "
# Check which agent paths are actually executable
from app.agents.metrics.agent import MetricsAgent
from app.agents.logs.agent import LogsAgent
from app.agents.deployment.agent import DeploymentAgent
from app.agents.time_machine.agent import CorrelationAgent
from app.agents.root_cause.agent import RootCauseAgent
from app.agents.recommendation.agent import RecommendationAgent
from app.agents.commander.agent import CommanderAgent
from app.agents.orchestrator import InvestigationOrchestrator

agents = [MetricsAgent, LogsAgent, DeploymentAgent, CorrelationAgent, RootCauseAgent, RecommendationAgent, CommanderAgent]
for a in agents:
    print(f'{a.__name__}: role={a.role!r}, model_key={a.model_key!r}, has_investigate={hasattr(a, "_investigate")}, has_mock={hasattr(a, "_mock_investigate")}')
" 2>&1

Ran terminal command: from app.agents.metrics.agent import MetricsAgent
from app.agents.logs.agent import LogsAgent
from app.agents.deployment.agent import DeploymentAgent
from app.agents.time_machine.agent import CorrelationAgent
from app.agents.root_cause.agent import RootCauseAgent
from app.agents.recommendation.agent import RecommendationAgent
from app.agents.commander.agent import CommanderAgent

agents = [MetricsAgent, LogsAgent, DeploymentAgent, CorrelationAgent, RootCauseAgent, RecommendationAgent, CommanderAgent]
for a in agents:
    print(a.__name__, 'role=%s' % a.role, 'model=%s' % a.model_key)

Ran terminal command: import inspect
from app.agents.metrics.agent import MetricsAgent
from app.agents.logs.agent import LogsAgent
from app.agents.deployment.agent import DeploymentAgent
from app.agents.time_machine.agent import CorrelationAgent
from app.agents.root_cause.agent import RootCauseAgent
from app.agents.recommendation.agent import RecommendationAgent

agents = [MetricsAgent, LogsAgent, DeploymentAgent, CorrelationAgent, RootCauseAgent, RecommendationAgent]
for a in agents:
    inv = inspect.getsource(a._investigate)
    mock = inspect.getsource(a._mock_investigate)
    calls_llm = '_llm_structured' in inv
    calls_tools = any(t in inv for t in ['query_', 'get_recent', 'get_config'])
    print(a.__name__, 'calls_llm=%s calls_tools=%s mock_lines=%d' % (calls_llm, calls_tools, len(mock.splitlines())))

Ran terminal command: import inspect
from app.tools import metrics_tools, logs_tools, deployment_tools, infra_tools, memory_tools
for m in [metrics_tools, logs_tools, deployment_tools, infra_tools, memory_tools]:
    fns = [n for n,f in inspect.getmembers(m, inspect.isfunction)]
    src = inspect.getsource(m)
    is_stub = 'pass' in src and len(src.splitlines()) < 25
    print(m.__name__.split('.')[-1], 'functions=%s stub=%s' % (fns, is_stub))

Ran terminal command: from app.agents.graph import *
" 2>&1 ; echo "graph.py is a stub

Ran terminal command: import pathlib
g = pathlib.Path('app/agents/graph.py').read_text()
print('lines:', len(g.splitlines()))
print(g)
Completed with input: import pathlib
g = pathlib.Path('app/agents/graph.py').read_text()
print('lines:', len(g.splitlines()))
print(g)

Ran terminal command: import pathlib
g = pathlib.Path('app/agents/graph.py').read_text(encoding='utf-8')
print('lines:', len(g.splitlines()))
print(repr(g[:500]))

Ran terminal command: # Check the .env file for any real credentials
import pathlib, os
env = pathlib.Path('.env')
print('.env exists:', env.exists())
if env.exists():
    lines = env.read_text(encoding='utf-8').splitlines()
    for l in lines:
        k = l.split('=')[0] if '=' in l else l
        v = l.split('=',1)[1] if '=' in l else ''
        print(k, '= <SET>' if v.strip() and not v.strip().startswith('#') else '= (empty)')

Ran terminal command: # Verify what REST endpoints exist and whether they use mock or real data
import pathlib
routes = list(pathlib.Path('app/api/routes').glob('*.py'))
for r in routes:
    src = r.read_text(encoding='utf-8')
    has_mock = '_service' in src
    has_orchestrator = 'Orchestrator' in src or 'orchestrator' in src
    imports = [l.strip() for l in src.splitlines() if l.startswith('from app')]
    print(r.name, 'uses_mock_service=%s uses_orchestrator=%s' % (has_mock, has_orchestrator))

Ran terminal command: # Estimate line-counts / completeness of each key subsystem
import pathlib
files = {
    'foundry.py': 'app/services/foundry.py',
    'event_stream.py': 'app/services/event_stream.py',
    'base.py': 'app/agents/base.py',
    'graph.py': 'app/agents/graph.py',
    'orchestrator.py': 'app/agents/orchestrator.py',
    'metrics/agent.py': 'app/agents/metrics/agent.py',
    'logs/agent.py': 'app/agents/logs/agent.py',
    'deployment/agent.py': 'app/agents/deployment/agent.py',
    'time_machine/agent.py': 'app/agents/time_machine/agent.py',
    'root_cause/agent.py': 'app/agents/root_cause/agent.py',
    'recommendation/agent.py': 'app/agents/recommendation/agent.py',
    'commander/agent.py': 'app/agents/commander/agent.py',
    'infra_tools.py': 'app/tools/infra_tools.py',
    'memory_tools.py': 'app/tools/memory_tools.py',
}
for name, path in files.items():
    p = pathlib.Path(path)
    if p.exists():
        src = p.read_text(encoding='utf-8')
        non_comment = [l for l in src.splitlines() if l.strip() and not l.strip().startswith('#')]
        print('%s: %d total lines, %d code lines' % (name, len(src.splitlines()), len(non_comment)))
    else:
        print('%s: MISSING' % name)

Now I have a complete picture. Here is the full architectural audit:

---

## OpsPilot Architectural Audit — June 3, 2026

---

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React/Fluent2)                           │
│  IncidentPanel  AgentActivityPanel  InvestigationTimeline  RecommendPanel   │
│       │               │  ▲                  │  ▲                 │  ▲       │
│       │        REST  (mock)         SSE ◄───┤  │          REST (mock)      │
└───────┼───────────────┼─────────────────────┼──┼─────────────────┼─────────┘
        │               │                     │  │                 │
        ▼               ▼                     │  │                 ▼
┌─────────────────────────────────────────────┼──┼──────────────────────────┐
│                    FastAPI (port 8000)       │  │                          │
│                                             │  │                          │
│  GET /incidents/*  ──► incident_service  ◄──┘  │                          │
│  GET /agents/activity ─► agent_service  [MOCK] │                          │
│  GET /timeline      ──► timeline_service [MOCK]│                          │
│  GET /recommendations ► recommendation_service [MOCK]                     │
│                                                │                          │
│  GET /incidents/{id}/stream ──────────────────►│  ← ONLY real pipeline   │
│    _live_event_generator                       │                          │
│         │                                      │                          │
│         ▼                                      │                          │
│  InvestigationOrchestrator                     │                          │
│    ├─ asyncio.gather() ──────────────────────► │ EventStreamService       │
│    │    MetricsAgent  ─► metrics_tools[MOCK]   │  asyncio.Queue per       │
│    │    LogsAgent     ─► logs_tools  [MOCK]    │  incident_id             │
│    │    DeploymentAgent ► deployment_tools[MOCK]│                         │
│    ├─ CorrelationAgent ─────────────────────── │                          │
│    ├─ RootCauseAgent ──────────────────────────│                          │
│    └─ RecommendationAgent ─────────────────────│                          │
│              │                                 │                          │
│              ▼                                 │                          │
│         FoundryClient                          │                          │
│           is_configured = FALSE ◄──────────────┼── no AZURE_OPENAI_ENDPOINT
│           ∴ all agents use _mock_investigate() │                          │
└─────────────────────────────────────────────────────────────────────────────┘

Azure Services: ALL UNCONFIGURED
  Azure OpenAI  ✗    Cosmos DB  ✗    Azure AI Search  ✗
  Foundry Project  ✗    Redis  ✗ (local only)

LangGraph: INSTALLED but graph.py = docstring stub only (0 nodes, 0 edges)
```

---

### 1. Is Azure AI Foundry Actually Wired and Executable?

**No — FoundryClient is production-quality code, but zero credentials are configured.**

| Check | Status |
|---|---|
| `app/services/foundry.py` implementation | Production-ready: `AsyncAzureOpenAI`, `beta.chat.completions.parse`, managed identity fallback, error handling |
| `AZURE_OPENAI_ENDPOINT` | **Empty string** — no `.env` file, no environment variables |
| `FoundryClient.is_configured` | Returns `False` at runtime |
| Agent execution path | All 7 agents call `_mock_investigate()`, never `_investigate()` |
| Azure AI Foundry project tracing | `azure_ai_foundry_project_name = ""` — not wired |
| `DefaultAzureCredential` path | Code exists, never reached |

foundry.py is **not a stub** — it is real, correct code. The blocker is purely operational: no credentials are present.

---

### 2. Is LangGraph Actually Executing?

**No. LangGraph is installed but completely unused.**

- `app/agents/graph.py` is **18 lines of docstring only** — zero Python code. No `StateGraph`, no `.add_node()`, no `.compile()`.
- The orchestrator is a plain Python class using `asyncio.gather()` and sequential `await` calls.
- `OpsPilotState` imports `add_messages` from `langgraph.graph.message` (so langgraph is referenced in state, but only for the type annotation of `messages`).
- No checkpointer, no graph replay, no conditional routing.

**What actually runs the agents:** `InvestigationOrchestrator.run()` → `asyncio.gather()` → sequential fan-in. This is a custom pipeline, not LangGraph.

---

### 3. Are Specialist Agents Truly Being Used?

All 7 agents are **fully implemented** and **wired into the orchestrator**. Here is their exact execution status:

| Agent | Role | Model | `_investigate()` | `_mock_investigate()` | Calls Tools | Currently Executing |
|---|---|---|---|---|---|---|
| `MetricsAgent` | specialist | gpt-4o-mini | ✅ LLM call | ✅ deterministic | Yes (4 mock functions) | **Mock only** |
| `LogsAgent` | specialist | gpt-4o-mini | ✅ LLM call | ✅ deterministic | Yes (2 mock functions) | **Mock only** |
| `DeploymentAgent` | specialist | gpt-4o-mini | ✅ LLM call | ✅ deterministic | Yes (2 mock functions) | **Mock only** |
| `CorrelationAgent` | commander | gpt-4o | ✅ LLM call | ✅ deterministic | No (pure reasoning) | **Mock only** |
| `RootCauseAgent` | commander | gpt-4o | ✅ LLM call | ✅ deterministic | No (pure reasoning) | **Mock only** |
| `RecommendationAgent` | commander | gpt-4o | ✅ LLM call | ✅ deterministic | No (pure reasoning) | **Mock only** |
| `CommanderAgent` | commander | gpt-4o | ✅ LLM call | ✅ deterministic | No | **Not called by orchestrator** |

Note: `CommanderAgent` is implemented but not instantiated in the orchestrator — it was designed as a pre-flight intake step but was never added to `InvestigationOrchestrator.__init__()`.

---

### 4. Which APIs Use the New Orchestration Flow?

**One endpoint only:**

| Endpoint | Uses Orchestrator | Data Source |
|---|---|---|
| `GET /api/incidents/{id}/stream` | **Yes** — `InvestigationOrchestrator` + `EventStreamService` | Live agent pipeline |
| `GET /api/incidents/active` | No | incident_service.py hardcoded mock |
| `GET /api/incidents/{id}` | No | incident_service.py hardcoded mock |
| `GET /api/agents/activity` | No | agent_service.py hardcoded mock |
| `GET /api/timeline` | No | `timeline_service.py` hardcoded mock |
| `GET /api/recommendations` | No | `recommendation_service.py` hardcoded mock |

The SSE stream route is the **only** endpoint where agents execute. All REST panel-data endpoints return static fixtures.

---

### 5. What Remains Mocked?

| Component | Mock Status | Notes |
|---|---|---|
| metrics_tools.py | **Hardcoded fixtures** | Returns checkout-service incident data; no Azure Monitor / Prometheus SDK |
| logs_tools.py | **Hardcoded fixtures** | Returns 2,847 TimeoutError data; no KQL / Log Analytics SDK |
| deployment_tools.py | **Hardcoded fixtures** | Returns v2.4.1 diff; no Azure DevOps / GitHub API |
| infra_tools.py | **Empty stub** | Docstring only; no Kubernetes API, no ARM, no Service Health |
| memory_tools.py | **Empty stub** | Docstring only; no Azure AI Search, no vector embeddings |
| incident_service.py | **Hardcoded mock** | Single incident INC-2024-0847 |
| agent_service.py | **Hardcoded mock** | Static agent task list — not updated by real agent runs |
| `timeline_service.py` | **Hardcoded mock** | Pre-written 8-event timeline |
| `recommendation_service.py` | **Hardcoded mock** | 3 pre-written actions |
| LangGraph graph | **Docstring stub** | No actual graph compiled |
| Azure credentials | **Not configured** | No `.env`, no managed identity |

---

### 6. What Is Missing Before This Qualifies as a Microsoft Foundry Multi-Agent Solution?

**Operational blockers (nothing works in cloud today):**

1. **Azure credentials** — `AZURE_OPENAI_ENDPOINT` + API key or managed identity. This single `.env` entry switches all 6 agents from mock to real LLM.
2. **Real tool implementations** — metrics_tools.py, logs_tools.py, deployment_tools.py need real SDK calls (Azure Monitor REST, KQL, Azure DevOps API). Currently hardcoded for one incident.

**Architectural gaps (design exists, code is missing):**

3. **LangGraph graph (graph.py)** — 18-line docstring stub. Need `StateGraph` with nodes, fan-out edges, conditional routing (deep reasoning if confidence < 0.7), and a checkpointer.
4. **infra_tools.py** — No implementation. Kubernetes pod events, ARM resource health, Azure Service Health all absent.
5. **memory_tools.py** — No implementation. Azure AI Search episodic memory (past incidents) and runbook retrieval absent. This is what turns generic recommendations into evidence-backed ones.
6. **Cosmos DB persistence** — No checkpointing; investigations are ephemeral. State is lost on restart.
7. **`CommanderAgent` not called by orchestrator** — Implemented but never invoked.

**Platform integration gaps:**

8. **Foundry project tracing** — `azure_ai_foundry_project_name` is empty; no trace/span data in Foundry portal.
9. **REST APIs still serve mock data** — `/agents/activity`, `/timeline`, `/recommendations` do not reflect actual agent run results. Live SSE output and panel REST data are decoupled.
10. **No deep reasoning path** — `o3` model configured (`reasoning_model_deployment`) but no code routes low-confidence findings to it.
11. **No action execution** — `enable_action_execution = False`; no `kubectl rollout undo` or equivalent.
12. **No authentication/authorization** on any API endpoint.

---

### Completion Estimate

| Layer | Complete |
|---|---|
| API layer (FastAPI routing, SSE, CORS) | 95% |
| Agent framework (BaseAgent, SSE bridge, fallback) | 90% |
| Specialist agents (code + prompts + mock data) | 85% |
| Orchestrator (asyncio pipeline) | 80% |
| Azure OpenAI SDK integration (FoundryClient) | 90% (code) / 0% (runtime) |
| Tool implementations | 40% (3/5 modules have code; all 3 return hardcoded data) |
| LangGraph graph | 5% (installed, state schema exists, graph.py empty) |
| Azure persistence (Cosmos DB) | 0% |
| Azure AI Search / Memory | 0% |
| Foundry tracing | 0% |
| **Overall** | **~45%** |

---

### Recommended Next Phase

**Phase 1 — Make it real in 1 day** (pure configuration):
- Create `.env` with `AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_API_KEY`
- All 6 agents immediately switch to live GPT-4o/GPT-4o-mini calls

**Phase 2 — Wire real data tools** (1–2 days):
- Implement metrics_tools.py using `azure-monitor-query` SDK
- Implement logs_tools.py using `azure-loganalytics` KQL client
- Implement deployment_tools.py using Azure DevOps REST client

**Phase 3 — Build the LangGraph graph** (2–3 days):
- Fill in graph.py with `StateGraph`, conditional routing, checkpointer
- Connect to Cosmos DB for state persistence
- Add the deep reasoning conditional edge (o3 model path)

**Phase 4 — Memory and learning** (2–3 days):
- Implement memory_tools.py with Azure AI Search vector index
- Implement infra_tools.py with Kubernetes + ARM clients
- Store investigation results back to the index after resolution

**Phase 5 — Close the loop** (1–2 days):
- Route orchestrator output back to REST endpoints (replace mock services for agents/timeline/recommendations with live post-investigation results)
- Add Foundry project tracing
- Add API authentication