Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/agents/logs/agent.py#30-30), lines 30 to 80

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/agents/deployment/agent.py#40-40), lines 40 to 60

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/agents/metrics/prompts.py)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/models/incident.py)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/backend/app/models/findings.py)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/frontend/src)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/frontend/src/pages)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/frontend/src/components)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/frontend/src/components/investigation)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/frontend/src/components/agents)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/frontend/src/components/shared)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/frontend/src/components/investigation/RootCausePanel.tsx)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/frontend/src/components/investigation/InvestigationGraph.tsx)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/frontend/src/components/investigation/EvidenceExplorer.tsx)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/frontend/src/pages/CommandCenter.tsx)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/frontend/src/pages/IncidentDetail.tsx)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/frontend/src/pages/Agents.tsx)

Ran terminal command: cd "d:\05_Backups\this lap's old backup\microsoft\opspilot\frontend" ; Get-ChildItem -Recurse -Filter "*.tsx" | Where-Object { (Get-Content $_.FullName -Raw).Length -gt 200 } | ForEach-Object { $lines = (Get-Content $_.FullName).Count; "$($_.Name): $lines lines" } | Sort-Object

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/frontend/src/App.tsx)

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/frontend/src/components/layout/AppShell.tsx#1-1), lines 1 to 50

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/frontend/src/components/layout/AppShell.tsx#50-50), lines 50 to 125

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/frontend/src/hooks/useIncidentStream.ts#1-1), lines 1 to 60

Ran terminal command: cd "d:\05_Backups\this lap's old backup\microsoft\opspilot\backend" ; python -c "
import pathlib, json

# Count total lines across all Python files
total_lines = 0
total_files = 0
stubs = []
implemented = []

for p in pathlib.Path('app').rglob('*.py'):
    src = p.read_text(encoding='utf-8')
    lines = len(src.splitlines())
    non_empty = [l for l in src.splitlines() if l.strip() and not l.strip().startswith('#')]
    total_lines += lines
    total_files += 1
    if len(non_empty) < 10:
        stubs.append((str(p), lines))
    else:
        implemented.append((str(p), lines))

print(f'Total Python files: {total_files}')
print(f'Total lines: {total_lines}')
print(f'Implemented files: {len(implemented)}')
print(f'Stub files: {len(stubs)}')
print()
print('STUBS:')
for s in stubs:
    print(f'  {s[0]}: {s[1]} lines')
"

Ran terminal command: import pathlib
# Check key service stubs
for p in ['app/services/ai_search.py', 'app/services/cosmos_db.py', 'app/api/middleware/auth.py', 'app/observability/telemetry.py', 'app/observability/metrics.py']:
    src = pathlib.Path(p).read_text(encoding='utf-8')
    print(p, '- lines:', len(src.splitlines()), '- preview:', repr(src[:120]))

Ran terminal command: import pathlib
# Check if there's a requirements.txt or pyproject.toml
for f in ['requirements.txt', 'requirements-dev.txt', 'pyproject.toml']:
    p = pathlib.Path(f)
    if p.exists():
        print(f'=== {f} ===')
        print(p.read_text(encoding='utf-8')[:800])

Read [](file:///d%3A/05_Backups/this%20lap%27s%20old%20backup/microsoft/opspilot/frontend/src/components/recommendations/RecommendationPanel.tsx#1-1), lines 1 to 60

Now I have everything needed for a deep, honest review. 

---

# OpsPilot — Senior Staff Engineer / Hackathon Judge Review

---

## SECTION 1 — CURRENT MATURITY ASSESSMENT

### Architecture: **7.5 / 10**

**Strengths:**
- The layered design is genuinely solid. FastAPI → route → service → agent → tool is a clean separation of concerns that a real platform team would approve.
- `FoundryClient` abstraction over `AsyncAzureOpenAI` is the correct pattern — one place to swap auth, model, and tracing.
- `EventStreamService` as an in-process `asyncio.Queue` bridge is elegant for SSE. It avoids Redis for the prototype without architectural debt.
- `BaseAgent` with mandatory `_investigate()` / `_mock_investigate()` duality means every agent is demo-safe and prod-ready simultaneously.
- `OpsPilotState` as a Pydantic model with `Annotated[list, add_messages]` shows langgraph awareness even before the graph is built.

**Weaknesses:**
- graph.py is an 18-line docstring. The LangGraph graph described in it (fan-out, conditional routing, CosmosDB checkpointer) does not exist. The orchestrator is a plain `asyncio.gather` wrapper — correct, but not LangGraph.
- `app/config.py` has a duplicate `Settings` class body after `@lru_cache` (orphaned fields from a prior version). This will cause a silent configuration shadow.
- The `asyncio.Queue` SSE bridge is process-local — one Uvicorn process, one worker. This collapses under multiple Gunicorn workers and is invisible on Azure Container Apps scaling. Not a problem for a hackathon, but worth acknowledging.
- infra_tools.py and memory_tools.py are docstring-only. The InfraAgent path is entirely absent. Memory tools mean episodic "pattern matching to past incidents" — one of the strongest differentiators — is not implemented.

---

### Frontend: **6.5 / 10**

**Strengths:**
- RecommendationPanel.tsx (957 lines), `AgentActivityPanel.tsx` (738 lines), `InvestigationTimelinePanel.tsx` (713 lines), `IncidentPanel.tsx` (635 lines) are all substantial, real implementations.
- Fluent UI v9 with a custom dark theme is the right choice for a Microsoft hackathon — it looks native to the Azure Portal.
- `useIncidentStream` is clean native EventSource. SSE wired to all 3 panels.
- `StreamStatusBadge` (CONNECTED/RECONNECTING/DISCONNECTED) adds real operational feel.

**Weaknesses:**
- CommandCenter.tsx — the **main demo page** — is a 26-line comment stub with `export {}`. This is critical.
- RootCausePanel.tsx is 14 lines, all stub.
- InvestigationGraph.tsx (D3 force graph) — stub. This is your most visually distinctive planned feature and it doesn't exist.
- EvidenceExplorer.tsx — stub. Without this, every agent finding is opaque.
- `IncidentDetail.tsx`, `Agents.tsx` pages — empty files.
- Navigation routing is `if/else` string matching in AppShell.tsx instead of a router. `history` maps to `InvestigationTimelinePanel`, `home` maps to `RecommendationPanel` — this is confusing and will hurt demo coherence.

---

### Backend: **7 / 10**

**Strengths:**
- 42 implemented Python files, 3,378 total lines. This is a real codebase, not a scaffold.
- All 7 agents: complete dual-path implementation, correct Pydantic output schemas, proper prompts.
- `BaseAgent.run()` now emits structured logs (`agent.started` / `agent.completed` / `duration_ms` / `mode`).
- `POST /api/agents/test` provides direct agent invocation — excellent for demos.
- `GET /api/system/health` exposes Foundry configuration state clearly.
- pyproject.toml declares the real SDK dependencies: `azure-ai-projects`, `azure-cosmos`, `azure-search-documents`, `langchain-openai`.

**Weaknesses:**
- 5 REST endpoints still serve hardcoded mock data that is **decoupled from actual agent runs**. When the SSE stream runs MetricsAgent at 91% confidence, `GET /api/agents/activity` still returns the hardcoded 91% from agent_service.py. There is no persistence binding.
- `cosmos_db.py` and `ai_search.py` are empty files. The backend cannot persist anything.
- `CreateIncidentRequest` model exists but there is no `POST /api/incidents` endpoint — you cannot trigger a new investigation from the UI.
- The uvicorn startup has been failing (Exit Code 1 in terminal context). This needs to be resolved before any demo.

---

### Agent Design: **8 / 10**

**Strengths:**
- Fan-out parallelism (Metrics + Logs + Deployment via `asyncio.gather`) is architecturally correct and produces the right SSE sequence.
- Every agent has a well-designed Pydantic output schema (`MetricsAnalysis`, `LogsAnalysis`, `DeploymentAnalysis`, `CorrelationOutput`, `RootCauseOutput`, `RecommendationOutput`) — the LLM is forced to produce structured, validated data.
- Model tier separation is correct: specialist agents use `gpt-4o-mini`, commander-tier agents use `gpt-4o`. This is cost-optimal and reflects real capability requirements.
- System prompts are focused, include explicit output schema references, and avoid generic framing.
- Graceful fallback (`_mock_investigate()` on exception) means a failed LLM call never crashes the investigation.

**Weaknesses:**
- `CommanderAgent` is not called by the orchestrator — intake classification is skipped entirely. `state.affected_services` is always the hardcoded value passed to `orchestrator.run()`.
- State does not accumulate between agents. After `CorrelationAgent` runs, its timeline output is captured in `AgentFinding.metadata` but never written back to `OpsPilotState.timeline` (which stays `[]`). `RootCauseAgent` therefore sees no correlation context beyond `state.metrics_findings`, `state.logs_findings`, `state.deployment_findings`.
- No retry logic for LLM calls. A transient Azure OpenAI 429 or 503 causes immediate fallback to mock — silent degradation with no log distinguishing "endpoint not configured" from "LLM call failed".

---

### SRE Realism: **8.5 / 10**

This is your strongest category. The incident scenario (ORM connection pool regression post-deploy, 73% error rate, p99 latency 1847ms, 3-service cascade) is **exactly the kind of incident that keeps SREs up at 2am**. The mock data reflects genuine operational understanding:

- Anomaly onset 4 minutes after deploy matches realistic pool exhaustion ramp.
- `sqlalchemy.exc.TimeoutError` with specific stack trace depth is authentic.
- Config diff showing `SQLALCHEMY_POOL_SIZE: 20 → 5` is realistic (dependency version bumped the default).
- blast_radius=3, affected_users=12,000, $50,400/hr business impact are plausible P1 numbers.
- `langgraph_run_id` field on `IncidentRecord` signals understanding of how LangGraph checkpoints link to incidents.

**Gap:** The tools (`metrics_tools.py`, `logs_tools.py`, `deployment_tools.py`) are hardcoded for `checkout-service` only. Any other service name returns an empty result. This will be exposed immediately in a live Q&A.

---

### Foundry Readiness: **4 / 10**

**What works:** `FoundryClient` is production-quality code. It will make real LLM calls the moment `AZURE_OPENAI_ENDPOINT` is populated.

**What doesn't exist:**
- Zero Foundry project tracing — no spans appear in the Foundry portal.
- `azure-ai-projects` is declared in `pyproject.toml` but never imported anywhere in the codebase.
- No prompt registry integration — prompts are Python string literals.
- No Foundry evaluations configured.
- No connection to Azure AI Foundry Agent Service (distinct from raw OpenAI).

For a hackathon track explicitly called "Reasoning Agents with Microsoft Foundry", the absence of any `azure-ai-projects` usage is the single biggest gap.

---

### Hackathon Competitiveness: **6.5 / 10**

Current state: **Demo-capable but not demo-ready.** The most visually distinctive features (InvestigationGraph, EvidenceExplorer, RootCausePanel, CommandCenter) are stubs. A live demo right now would show 4 panels of solid UI driven by mock data — impressive depth, but the judge would ask "where's the LLM?" and the honest answer is "it's not connected yet."

With Azure credentials + 3 days of focused work this becomes an 8.5/10 project.

---

## SECTION 2 — GAP ANALYSIS

### A) Demo-Ready (can show something in a browser)

**Critical:**
1. Fix uvicorn startup failure (Exit Code 1 in terminals — likely `config.py` duplicate Settings body)
2. Implement `CommandCenter.tsx` — it is the only page shown in the demo and it's a stub
3. Wire `POST /api/incidents` so a user can trigger an investigation from the UI
4. Fix `AppShell.tsx` navigation — `history` should route to timeline, `home` should be the CommandCenter

**Important:**
5. Implement `RootCausePanel.tsx` — this is the emotional payoff of the whole investigation
6. Remove the orphaned Settings body from `config.py` (lines 60–80 after `@lru_cache`)

### B) Hackathon-Ready (can compete, not just demo)

**Critical:**
7. Populate `.env` with real Azure OpenAI credentials — without this, `mode=mock` in every log
8. Import and use `azure-ai-projects` somewhere (even one trace) — the track name is "Foundry"
9. Add `CommanderAgent` to orchestrator and use its output to populate `state.affected_services`
10. Write `CorrelationAgent` output back to `state.timeline` so `RootCauseAgent` sees it

**Important:**
11. Implement `InvestigationGraph.tsx` — D3 force graph is your single most visually unique feature
12. Implement `EvidenceExplorer.tsx` — "trust through transparency" is the core enterprise value prop
13. Add Foundry span tracing to `FoundryClient.structured_chat()` (5 lines of code)
14. Replace hardcoded tool data with parameterized fixtures (support 2–3 different incident scenarios)
15. `POST /api/agents/test` should accept `affected_services` param

### C) Strong Contender for Top Rankings

**Nice-to-have:**
16. Real Azure Monitor query (even one KQL call against a real workspace)
17. Implement `memory_tools.py` with Azure AI Search — past incident retrieval is a compelling capability
18. `GET /api/system/health` linked in UI so judges can see Foundry connection status live
19. Executive summary auto-generated by Commander, copyable to clipboard
20. Cosmos DB persistence so reloading the page doesn't lose investigation state
21. Confidence threshold routing (confidence < 70 → escalate to o3 reasoning model)
22. `POST /api/incidents/{id}/resolve` endpoint with resolution capture

---

## SECTION 3 — FOUNDRY INTEGRATION PLAN

### Ideal Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Azure AI Foundry Project                         │
│                                                                     │
│  ┌─────────────────┐   ┌────────────────────┐   ┌───────────────┐  │
│  │  Prompt Registry │   │  Tracing / Evals   │   │  Model Deploy │  │
│  │  commander/      │   │  (Azure AI Traces) │   │  gpt-4o       │  │
│  │  synthesis/      │   │  per-agent spans   │   │  gpt-4o-mini  │  │
│  │  root_cause/     │   │  confidence gauge  │   │  o3           │  │
│  └─────────────────┘   └────────────────────┘   └───────────────┘  │
│           │                       ▲                                 │
└───────────┼───────────────────────┼─────────────────────────────────┘
            │                       │
            ▼                       │
┌─────────────────────────────────────────────────────────────────────┐
│                         FoundryClient                               │
│                                                                     │
│  structured_chat()                                                  │
│    ├─ AIProjectClient.telemetry.enable()  ← adds span context      │
│    ├─ beta.chat.completions.parse()       ← structured output      │
│    └─ on exception → mock fallback + WARNING log                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Implementation (minimal viable Foundry usage)

```python
# foundry.py — add to _get_client():
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

if settings.azure_ai_foundry_project_name:
    project_client = AIProjectClient(
        credential=DefaultAzureCredential(),
        project_name=settings.azure_ai_foundry_project_name,
        resource_group_name=settings.azure_ai_foundry_resource_group,
        subscription_id=settings.azure_subscription_id,
    )
    project_client.telemetry.enable()   # ← one line = spans in Foundry portal
```

That single call instruments every `openai` call with trace spans visible in Foundry. This is the minimum required to legitimately claim "Foundry integration."

### Agent Model Assignments

| Agent | Model | Justification |
|---|---|---|
| MetricsAgent | `gpt-4o-mini` | JSON → structured anomaly detection, low reasoning depth needed |
| LogsAgent | `gpt-4o-mini` | Pattern matching in log output, token-efficient |
| DeploymentAgent | `gpt-4o-mini` | Config diff analysis, deterministic reasoning |
| CorrelationAgent | `gpt-4o` | Cross-source synthesis needs full context window |
| RootCauseAgent | `gpt-4o` | Causal chain reasoning, high stakes |
| RecommendationAgent | `gpt-4o` | Risk-stratified action generation |
| CommanderAgent (intake) | `gpt-4o-mini` | Simple classification |
| Deep reasoning path | `o3` | Triggered when any agent confidence < 70% |

### Azure Services (student subscription budget)

| Service | Tier | Monthly Cost Estimate | Purpose |
|---|---|---|---|
| Azure OpenAI | S0 + PTU-free tier | ~$15–40 at hackathon usage | Core LLM calls |
| Azure AI Foundry | Free project tier | $0 | Tracing, prompt registry |
| Azure Container Apps | Consumption plan | $0–5 | API hosting |
| Azure Static Web Apps | Free tier | $0 | Frontend hosting |
| Azure Cosmos DB | Free tier (1000 RU/s) | $0 | State persistence |
| Azure AI Search | Free tier (3 indexes) | $0 | Episodic memory |

**Total: $15–45/month during development**

### Security Approach (student context)

1. API key in `.env` locally; Azure Key Vault reference on Container Apps (one setting, no code change)
2. `DefaultAzureCredential` in production path — already coded
3. No authentication on API for hackathon (the `auth.py` middleware stub stays disabled)
4. CORS restricted to `localhost:3000` + your deployed frontend URL

---

## SECTION 4 — LANGGRAPH DESIGN

### Complete Graph Specification

```
State: OpsPilotState (Pydantic BaseModel)
  - incident_id: str
  - incident_description: str
  - severity: Severity
  - affected_services: list[str]        ← set by commander_intake node
  - metrics_findings: dict | None       ← set by metrics_node
  - logs_findings: dict | None          ← set by logs_node
  - deployment_findings: dict | None    ← set by deployment_node
  - correlation_timeline: list | None   ← set by correlation_node  [MISSING TODAY]
  - root_cause: RootCauseAssessment | None
  - recommendations: list[Recommendation]
  - agent_confidence: dict[str, float]  ← track per-agent score
  - messages: Annotated[list, add_messages]
  - iteration_count: int
  - low_confidence_agents: list[str]    ← triggers deep reasoning

Graph Nodes:
  1. commander_intake_node
  2. metrics_node
  3. logs_node
  4. deployment_node
  5. correlation_node
  6. root_cause_node
  7. deep_reasoning_node    ← conditional
  8. recommendation_node
  9. output_formatter_node

Graph Definition:

START
  └─► commander_intake_node
        ├─► metrics_node    ─────────────┐
        ├─► logs_node       ─────────────┤  (fan-out via Send API)
        └─► deployment_node ─────────────┘
                                         │
                    [fan-in barrier: all three complete]
                                         ▼
                               correlation_node
                                         ▼
                               root_cause_node
                                         ▼
                            [should_escalate() conditional]
                            ├─► deep_reasoning_node ──────────┐
                            │    (runs if any confidence<0.7)  │
                            │                                  │
                            └─────────────────────────────────►│
                                                               ▼
                                                   recommendation_node
                                                               ▼
                                                   output_formatter_node
                                                               ▼
                                                              END
```

### Implementation Sketch

```python
# app/agents/graph.py  (currently empty — this is what it should contain)

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.aiosqlite import AsyncSqliteSaver  # or Cosmos

from app.agents.state import OpsPilotState

def should_escalate(state: OpsPilotState) -> str:
    """Route to deep_reasoning if any agent confidence below threshold."""
    low = [a for a, c in state.agent_confidence.items() if c < 70.0]
    return "deep_reasoning" if low else "recommendation"

async def commander_intake_node(state: OpsPilotState) -> dict:
    agent = CommanderAgent(get_foundry_client(), get_event_stream())
    finding = await agent.run(state)
    return {
        "affected_services": finding.metadata["affected_services"],
        "severity": finding.metadata["severity"],
        "agent_confidence": {"commander": finding.confidence},
    }

async def metrics_node(state: OpsPilotState) -> dict:
    finding = await MetricsAgent(get_foundry_client(), get_event_stream()).run(state)
    return {
        "metrics_findings": finding.metadata,
        "agent_confidence": {**state.agent_confidence, "metrics": finding.confidence},
    }

# ... logs_node, deployment_node follow same pattern

async def correlation_node(state: OpsPilotState) -> dict:
    finding = await CorrelationAgent(...).run(state)
    return {
        "timeline": finding.metadata["timeline"],      # ← fixes the gap today
        "agent_confidence": {**state.agent_confidence, "correlation": finding.confidence},
    }

async def root_cause_node(state: OpsPilotState) -> dict:
    finding = await RootCauseAgent(...).run(state)
    return {
        "root_cause": RootCauseAssessment(...),
        "agent_confidence": {**state.agent_confidence, "root_cause": finding.confidence},
    }

async def deep_reasoning_node(state: OpsPilotState) -> dict:
    # Re-run low-confidence agents with o3 model
    ...

def build_graph():
    builder = StateGraph(OpsPilotState)
    builder.add_node("commander_intake", commander_intake_node)
    builder.add_node("metrics", metrics_node)
    builder.add_node("logs", logs_node)
    builder.add_node("deployment", deployment_node)
    builder.add_node("correlation", correlation_node)
    builder.add_node("root_cause", root_cause_node)
    builder.add_node("deep_reasoning", deep_reasoning_node)
    builder.add_node("recommendation", recommendation_node)
    builder.add_node("output_formatter", output_formatter_node)

    builder.add_edge(START, "commander_intake")
    # Fan-out via Send API (parallel)
    builder.add_conditional_edges("commander_intake",
        lambda s: ["metrics", "logs", "deployment"])
    builder.add_edge("metrics", "correlation")
    builder.add_edge("logs", "correlation")
    builder.add_edge("deployment", "correlation")
    builder.add_edge("correlation", "root_cause")
    builder.add_conditional_edges("root_cause", should_escalate,
        {"deep_reasoning": "deep_reasoning", "recommendation": "recommendation"})
    builder.add_edge("deep_reasoning", "recommendation")
    builder.add_edge("recommendation", "output_formatter")
    builder.add_edge("output_formatter", END)

    checkpointer = AsyncSqliteSaver.from_conn_string("investigations.db")
    return builder.compile(checkpointer=checkpointer)
```

### Failure Handling

- Each node wraps its agent call in try/except. Exception → emit `agent.error` SSE event, write `AgentStatus.FAILED` to state, continue graph execution.
- Graph-level interrupt via `builder.add_breakpoint("root_cause")` enables human-in-the-loop escalation for P0 incidents.
- `iteration_count` field on state prevents infinite loops in any future retry edges (max 3).

---

## SECTION 5 — HACKATHON WINNING FEATURES

Ranked by **Impact × (1/Effort)**:

| # | Feature | Impact | Effort (hrs) | Why It Wins |
|---|---|---|---|---|
| 1 | **Live Foundry traces visible in portal** | Very High | 2 | One `AIProjectClient.telemetry.enable()` call. Judges literally log into Foundry and see your agents running. This is the clearest signal of real Foundry usage. |
| 2 | **CommandCenter.tsx with real-time agent progress** | Very High | 6 | The main demo page. Shows all agents animating to completion with confidence bars. This is what's in every screenshot. Without it, you're demoing a sidebar. |
| 3 | **RootCausePanel.tsx with confidence animation** | High | 4 | Emotional payoff moment of the investigation. Confidence bar animates from 0→94%. "ORM Connection Pool Regression" appears with supporting evidence. This is your money shot. |
| 4 | **POST /api/incidents — trigger live investigation** | High | 3 | Judges love typing an incident description and watching agents respond. Transforms it from "replay" to "live system." |
| 5 | **D3 Investigation Graph (InvestigationGraph.tsx)** | High | 8 | A force-directed graph of causal links between findings is visually unlike anything else on stage. A single screenshot wins slide decks. |
| 6 | **EvidenceExplorer.tsx (click any finding → raw data)** | High | 5 | "Trust through transparency" is the core enterprise SRE value prop. Clicking a 73% confidence number and seeing the exact metric datapoints is what separates a toy from a tool. |
| 7 | **Executive summary copy-to-clipboard** | Medium | 2 | An auto-generated 3-sentence summary of the investigation, ready to paste into Slack/Teams. Engineers and judges relate to this instantly — "I need to write this at 3am." |
| 8 | **Multi-scenario demo support (2 incident types)** | Medium | 4 | A database-pool incident and a memory-leak incident. Shows the system generalizes, not hardcoded. Critical for Q&A: "What if it's a different kind of incident?" |
| 9 | **Confidence threshold → o3 escalation** | Medium | 4 | Show in logs: "Correlation agent confidence 62% — escalating to o3 reasoning model." The conditional routing to a stronger model for low-confidence situations is exactly what judges of "Reasoning Agents" track want to see. |
| 10 | **System Health card in UI** | Low | 2 | Show `GET /api/system/health` response in the UI: "Foundry Connected ✓ — gpt-4o-mini / gpt-4o / o3." Transparent operational state builds trust instantly. |

---

## SECTION 6 — EXECUTION ROADMAP

### Phase 1 — Stabilize and Connect (8 hours)
*Goal: App starts, Foundry connected, all 6 agents run live*

| Task | Hours | Dependency |
|---|---|---|
| Fix config.py duplicate Settings body (delete lines 62–80) | 0.5 | None |
| Fix uvicorn startup error (check terminal, likely import error from config) | 0.5 | Task above |
| Create `.env` with real `AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_API_KEY` | 0.5 | Azure OpenAI resource |
| Add `AIProjectClient.telemetry.enable()` to `FoundryClient._get_client()` | 1 | Azure AI Foundry project |
| Run `POST /api/agents/test` and confirm `mode: "live"` in response | 0.5 | Tasks above |
| Add `CommanderAgent` call at start of `InvestigationOrchestrator.run()` | 1 | None |
| Write `CorrelationAgent` output back to `state.timeline` in orchestrator | 1 | None |
| Add `POST /api/incidents` endpoint triggering `InvestigationOrchestrator` | 2 | None |
| Add retry (tenacity, 3 attempts with exponential backoff) to `FoundryClient.structured_chat()` | 1 | None |

**Expected outcome:** `python -m uvicorn app.main:app --reload` starts cleanly. `GET /api/system/health` returns `foundryConfigured: true`. All 6 agents run against Azure OpenAI. Traces appear in Foundry portal.

---

### Phase 2 — Build the Demo Page (10 hours)
*Goal: One compelling, navigable page a judge can watch*

| Task | Hours | Dependency |
|---|---|---|
| Implement CommandCenter.tsx — 2-column layout with incident header + tabbed content | 4 | None |
| Implement RootCausePanel.tsx — animated confidence bar, primary hypothesis, evidence list | 3 | Phase 1 `/api/incidents` endpoint |
| Wire AppShell.tsx so `home` → `CommandCenter`, not `RecommendationPanel` | 0.5 | CommandCenter.tsx |
| Add `GET /api/system/health` indicator widget to NavBar | 1 | Phase 1 |
| Executive summary copy-to-clipboard in CommandCenter bottom bar | 1.5 | RootCauseAgent output |

**Expected outcome:** Open `localhost:3000`, see CommandCenter. Submit an incident description. Watch 6 agents animate to completion. RootCause panel populates with animated confidence. Copy executive summary to clipboard.

---

### Phase 3 — LangGraph Orchestration (8 hours)
*Goal: Replace `asyncio.gather` orchestrator with real LangGraph graph*

| Task | Hours | Dependency |
|---|---|---|
| Implement graph.py — `StateGraph` with all 7 nodes | 4 | Phase 1 agents |
| Add `should_escalate()` conditional edge to o3 deep reasoning | 1.5 | graph.py |
| Replace `InvestigationOrchestrator.run()` with `graph.invoke()` | 1 | graph.py |
| Add SQLite checkpointer (local) — Cosmos DB checkpointer optional | 1 | graph.py |
| Test full graph run end-to-end with real LLM | 0.5 | Phase 1 credentials |

**Expected outcome:** `GET /api/incidents/INC-2024-0847/stream` runs via LangGraph. Checkpoints visible. Low-confidence path invokes o3 model. `langgraph_run_id` on `IncidentRecord` links to real checkpoint.

---

### Phase 4 — Demo Polish (6 hours)
*Goal: Visually impressive, handles Q&A*

| Task | Hours | Dependency |
|---|---|---|
| Implement InvestigationGraph.tsx — D3 force graph of causal links | 4 | EvidenceExplorer |
| Implement EvidenceExplorer.tsx — right drawer, shows raw tool data + Foundry trace link | 2 | Phase 2 |
| Add second incident scenario to tools (memory-leak pattern) | 1.5 | mock tools |
| Add `BlastRadiusPanel.tsx` showing affected services + estimated user impact | 1 | RootCauseAgent output |
| Record 90-second demo video as backup | 1 | All above |

**Expected outcome:** Full visual flow from incident submission → agent activity → investigation graph → root cause panel → evidence explorer → recommendations. Judges can click any finding and see the supporting data.

---

### Phase 5 — Submission Preparation (3 hours)
*Goal: Submission artifacts complete*

| Task | Hours |
|---|---|
| Write project description emphasizing Foundry tracing, multi-agent design, fan-out pattern | 1 |
| Create architecture diagram screenshot | 0.5 |
| Record demo video with voiceover | 1 |
| Deploy to Azure Container Apps + Static Web Apps (optional but impressive) | 1.5 |
| Submit via hackathon portal | 0.5 |

---

## SECTION 7 — IF CLAUDE DISAPPEARS TOMORROW

### Complete Implementation Guide for a New Engineer

---

#### Repository Structure (what exists, what to build)

```
opspilot/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── base.py          ✅ DONE — do not modify
│   │   │   ├── state.py         ✅ DONE — do not modify
│   │   │   ├── orchestrator.py  ✅ DONE — 1 bug to fix (see below)
│   │   │   ├── graph.py         ❌ EMPTY — implement Phase 3
│   │   │   ├── metrics/agent.py ✅ DONE
│   │   │   ├── logs/agent.py    ✅ DONE
│   │   │   ├── deployment/agent.py ✅ DONE
│   │   │   ├── time_machine/agent.py ✅ DONE
│   │   │   ├── root_cause/agent.py   ✅ DONE
│   │   │   ├── recommendation/agent.py ✅ DONE
│   │   │   └── commander/agent.py    ✅ DONE (not yet wired)
│   │   ├── api/routes/
│   │   │   ├── incidents.py     ⚠️  ADD POST /api/incidents
│   │   │   ├── agents.py        ⚠️  reads mock, not live results
│   │   │   ├── stream.py        ✅ DONE
│   │   │   ├── system.py        ✅ DONE
│   │   │   └── __init__.py      ✅ DONE
│   │   ├── services/
│   │   │   ├── foundry.py       ✅ DONE — needs telemetry.enable()
│   │   │   ├── event_stream.py  ✅ DONE
│   │   │   ├── incident_service.py ⚠️ hardcoded mock
│   │   │   ├── cosmos_db.py     ❌ EMPTY
│   │   │   └── ai_search.py     ❌ EMPTY
│   │   ├── tools/
│   │   │   ├── metrics_tools.py ✅ mock data (works for demo)
│   │   │   ├── logs_tools.py    ✅ mock data
│   │   │   ├── deployment_tools.py ✅ mock data
│   │   │   ├── infra_tools.py   ❌ EMPTY
│   │   │   └── memory_tools.py  ❌ EMPTY
│   │   └── config.py            ⚠️ FIX DUPLICATE (delete lines 62–80)
│   └── .env.example             ✅ DONE — copy to .env and fill in
└── frontend/
    └── src/
        ├── pages/
        │   ├── CommandCenter.tsx  ❌ STUB — highest priority
        │   ├── IncidentDetail.tsx ❌ EMPTY
        │   └── Agents.tsx         ❌ EMPTY
        └── components/
            ├── investigation/
            │   ├── RootCausePanel.tsx    ❌ STUB — second priority
            │   ├── InvestigationGraph.tsx ❌ STUB — Phase 4
            │   └── EvidenceExplorer.tsx   ❌ STUB — Phase 4
            └── layout/
                └── AppShell.tsx   ⚠️ navigation routing wrong
```

---

#### API Contracts (complete)

```
# Existing (all working in mock mode):
GET  /health                         → { status, service, version }
GET  /api/incidents/active           → IncidentRecord[]
GET  /api/incidents/{id}             → IncidentRecord
GET  /api/agents/activity?incident_id= → AgentActivityResponse
GET  /api/timeline/{id}             → TimelineResponse
GET  /api/recommendations/{id}      → RecommendationResponse
GET  /api/incidents/{id}/stream     → SSE stream of agent events
GET  /api/system/health             → FoundryHealthResponse
POST /api/agents/test               → AgentTestResponse

# MISSING — must implement:
POST /api/incidents                 → IncidentRecord
  body: { description: str, affected_services: str[], reported_severity: "P0"|"P1"|"P2"|"P3" }
  action: calls InvestigationOrchestrator.run() as background task
  returns: newly created IncidentRecord with generated id
```

---

#### Agent Contract (invariant — all agents must satisfy)

```python
class SomeAgent(BaseAgent):
    role: str = "role_name"          # used in SSE event agent_name field
    role_label: str = "Human Label"  # shown in UI
    model_key: str = "specialist"    # "specialist" or "commander"

    async def _investigate(self, state: OpsPilotState) -> AgentFinding:
        # 1. Gather tool data (if applicable)
        # 2. Call self._llm_structured(system=PROMPT, user=context, response_model=OutputModel)
        # 3. Return AgentFinding(role, summary, evidence, confidence, metadata)
        # NOTE: Do NOT catch exceptions here — BaseAgent.run() handles fallback
        ...

    async def _mock_investigate(self, state: OpsPilotState) -> AgentFinding:
        # Must return deterministic data (no randomness)
        # Must call await self._yield_to_loop() at start
        # confidence values: metrics=91, logs=89, deployment=96, correlation=92,
        #                    root_cause=94, recommendation=93, commander=94
        ...
```

---

#### Bug Fixes Required Before Any New Work

**Bug 1 — config.py duplicate Settings body (causes silent misconfiguration):**
Delete everything from line 62 (`# Azure Cosmos DB`) to end of file. The valid `Settings` class and `get_settings()` function end at line 58.

**Bug 2 — `CorrelationAgent` result not written to `state.timeline`:**
In orchestrator.py, after `await self.correlation.run(state)`, add:
```python
correlation_finding = await self.correlation.run(state)
# Write timeline back to state so RootCauseAgent can read it
state_dict = state.model_dump()
state_dict["timeline"] = correlation_finding.metadata.get("timeline", [])
# OpsPilotState is immutable Pydantic — need to reconstruct or use model_copy
state = state.model_copy(update={"metrics_findings": state.metrics_findings,
                                  "logs_findings": state.logs_findings,
                                  "deployment_findings": state.deployment_findings})
```
(Simpler: make `OpsPilotState` fields mutable by setting `model_config = ConfigDict(frozen=False)` in state.py)

**Bug 3 — `CommanderAgent` not called:**
Add to `InvestigationOrchestrator.__init__()`:
```python
self.commander = CommanderAgent(foundry, stream)
```
Add to `InvestigationOrchestrator.run()` before Phase 1:
```python
commander_finding = await self.commander.run(state)
if not affected_services:
    affected_services = commander_finding.metadata.get("affected_services", [])
state = state.model_copy(update={"affected_services": affected_services})
```

---

#### `POST /api/incidents` — Complete Implementation

```python
# In app/api/routes/incidents.py — add this endpoint:
import uuid
from datetime import datetime, timezone
from fastapi import BackgroundTasks

@router.post(
    "/",
    response_model=IncidentRecord,
    status_code=201,
    summary="Create incident and trigger investigation",
)
async def create_incident(
    body: CreateIncidentRequest,
    background_tasks: BackgroundTasks,
) -> IncidentRecord:
    incident = IncidentRecord(
        id=f"INC-{datetime.now(timezone.utc).strftime('%Y-%m%d')}-{uuid.uuid4().hex[:4].upper()}",
        description=body.description,
        status=IncidentStatus.INVESTIGATING,
        severity=body.reported_severity,
        affected_services=body.affected_services,
        reporter=body.reporter,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    # Add to in-memory index so GET /api/incidents/{id} works immediately
    from app.services.incident_service import _INDEX
    _INDEX[incident.id] = incident

    # Start investigation as a background task (non-blocking)
    from app.agents.orchestrator import InvestigationOrchestrator
    orchestrator = InvestigationOrchestrator()
    background_tasks.add_task(
        orchestrator.run,
        incident.id,
        incident.description,
        incident.affected_services,
    )
    return incident
```

---

#### Foundry Telemetry — 8 Lines That Make It Real

```python
# In app/services/foundry.py — add to _get_client() after creating AsyncAzureOpenAI:

settings = get_settings()
if settings.azure_ai_foundry_project_name:
    try:
        from azure.ai.projects import AIProjectClient
        from azure.identity import DefaultAzureCredential
        project_client = AIProjectClient(
            credential=DefaultAzureCredential(),
            project_name=settings.azure_ai_foundry_project_name,
            resource_group_name=settings.azure_ai_foundry_resource_group,
            subscription_id=settings.azure_subscription_id,
        )
        project_client.telemetry.enable()
        log.info("foundry.telemetry.enabled", project=settings.azure_ai_foundry_project_name)
    except Exception as exc:
        log.warning("foundry.telemetry.failed", error=str(exc))
```

---

#### CommandCenter.tsx — Minimal Viable Implementation

The page must show: incident header bar + left sidebar (agent activity stream) + right content (tabs: Investigation / Evidence / Recommendations).

```tsx
// Minimum viable CommandCenter.tsx:
// 1. Call useActiveIncident() to get INC-2024-0847
// 2. Call useIncidentStream(incidentId) for SSE
// 3. Left: render AgentActivityPanel passing liveData from SSE
// 4. Right tab 1: render RootCausePanel + InvestigationTimelinePanel
// 5. Right tab 2: render RecommendationPanel
// 6. Bottom: executive summary text + copy button

// Key: Do not build new components. 
// Wire together the 4 existing implemented panels:
//   IncidentPanel, AgentActivityPanel, InvestigationTimelinePanel, RecommendationPanel
// They already consume their own hooks and handle their own data.
// CommandCenter just provides the layout grid and the SSE hook.
```

---

#### What to Prioritize if You Have Only 4 Hours

**Hour 1:** Fix config.py + start uvicorn + create `.env` with real credentials + confirm `mode:live` in `/api/agents/test`

**Hour 2:** Add `AIProjectClient.telemetry.enable()` + implement `POST /api/incidents` + fix orchestrator to call `CommanderAgent`

**Hour 3:** Implement CommandCenter.tsx (wire existing 4 panels into a 2-column layout with incident header)

**Hour 4:** Implement RootCausePanel.tsx (animated confidence bar, title, 4 evidence bullets)

After these 4 hours: the system is demo-ready, Foundry-integrated, and fully live.