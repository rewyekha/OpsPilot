# OpsPilot: World-Class Architecture Design
## Panel: Microsoft Azure AI Foundry Architect · Principal Platform Engineer · SRE Lead · Copilot Engineering Architect · Distributed Systems Architect · Product Judge

---

## 1. Executive Architecture Overview

### Architecture Philosophy

OpsPilot is not a chatbot with an incident lookup feature. It is a **reasoning machine** — a system where multiple AI agents, each with distinct expertise and toolsets, investigate a production incident independently and then synthesize their findings into a unified, evidence-backed response.

The architectural north star is: **every output must be traceable to evidence, every recommendation must carry a confidence score, and every agent action must be observable**.

### Core Architecture Pattern: Parallel Investigative Synthesis

```
User Reports Incident
        ↓
Commander Agent (Triage + Orchestration)
        ↓
[Fan-Out: Parallel Agent Investigation]
        ↓
[Fan-In: Evidence Aggregation]
        ↓
Commander Agent (Multi-Source Reasoning + Synthesis)
        ↓
Structured Incident Report with Confidence Scores
```

This pattern is not novel — it mirrors how elite SRE teams operate. What is novel is that OpsPilot does it **autonomously, in under 5 minutes, with full observability**.

### Why This Architecture Wins the Hackathon

| Judging Criterion | Architectural Decision That Maximizes It |
|---|---|
| **Accuracy** | Each agent uses specialized prompts + domain-specific tools. No generalist hallucination. |
| **Reasoning** | Commander uses o3/GPT-4o with structured multi-source synthesis, not a single-shot prompt. |
| **Reliability** | LangGraph state machine with checkpointing. Agents can retry independently. |
| **Creativity** | Time Machine Agent is genuinely novel — no existing tool does this. |
| **User Experience** | Fluent UI mission control that looks like it ships with Azure. |

### Technology Choices — Justified

- **LangGraph** over AutoGen/CrewAI: LangGraph is a directed graph with explicit state transitions. You can checkpoint, replay, and inspect every step. This is non-negotiable for production reliability and demo transparency.
- **Azure AI Foundry** over direct OpenAI SDK: Foundry gives you model routing, evaluation, tracing, and prompt management in one plane. It is the Microsoft-native answer to LangChain Hub + LangSmith combined.
- **FastAPI + SSE** over WebSockets: Server-Sent Events are simpler, HTTP-native, and sufficient for one-directional agent activity streaming. Less infrastructure, same effect.
- **Azure Container Apps** over AKS: Solo developer in 2-4 weeks. AKS is a full-time job. ACA gives you scale-to-zero, managed certificates, and VNET integration without a Kubernetes certification.
- **Fluent UI** over custom CSS: The judges are Microsoft employees. They will immediately recognize Fluent UI components. This communicates that you understand the Microsoft design language at a professional level.

---

## 2. C4 System Context Diagram

```
╔══════════════════════════════════════════════════════════════════════════╗
║                        SYSTEM CONTEXT: OpsPilot                         ║
╚══════════════════════════════════════════════════════════════════════════╝

  ┌─────────────────┐       HTTP/SSE        ┌────────────────────────────┐
  │                 │ ─────────────────────▶ │                            │
  │   SRE Engineer  │                        │     OpsPilot Platform      │
  │   (Primary User)│ ◀───────────────────── │   (Azure Container Apps)   │
  │                 │   Real-time Dashboard  │                            │
  └─────────────────┘                        └─────────────┬──────────────┘
                                                           │
           ┌───────────────────────────────────────────────┼───────────────────────────────────────┐
           │                                               │                                       │
           ▼                                               ▼                                       ▼
  ┌─────────────────────┐               ┌─────────────────────────┐              ┌─────────────────────────┐
  │  Azure AI Foundry   │               │   Observability Stack   │              │   Enterprise Data Sources│
  │  ─────────────────  │               │  ─────────────────────  │              │  ─────────────────────── │
  │  • Model Catalog    │               │  • Prometheus           │              │  • Azure Monitor         │
  │  • Prompt Registry  │               │  • Grafana              │              │  • Log Analytics (KQL)   │
  │  • Evaluation Hub   │               │  • OpenTelemetry        │              │  • Azure DevOps API      │
  │  • Azure OpenAI     │               │  • App Insights         │              │  • GitHub Actions API    │
  │    (GPT-4o, o3)     │               │                         │              │  • Kubernetes Events API │
  └─────────────────────┘               └─────────────────────────┘              └─────────────────────────┘


  External Systems (Mocked in MVP, Real in V2):
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │  PagerDuty   │  │   Datadog    │  │  ServiceNow  │  │ Slack/Teams  │
  │  (Alerts)    │  │  (Metrics)   │  │  (Tickets)   │  │  (Notify)    │
  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

---

## 3. Container Architecture

```
╔══════════════════════════════════════════════════════════════════════════════════════╗
║                           CONTAINER ARCHITECTURE                                    ║
╚══════════════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: FRONTEND CONTAINER                                                        │
│  opspilot-ui  [Azure Container Apps — Scale: 1-3 replicas]                         │
│  ─────────────────────────────────────────────────────────                         │
│  React 18 + TypeScript + Vite                                                       │
│  Microsoft Fluent UI v9                                                             │
│  React Query (server state) + Zustand (client state)                               │
│  SSE client for real-time agent activity stream                                     │
│  D3.js for Investigation Graph visualization                                        │
│  Port: 3000 → Exposed via Azure Front Door                                         │
└─────────────────────────┬───────────────────────────────────────────────────────────┘
                          │ HTTPS / REST + SSE
┌─────────────────────────▼───────────────────────────────────────────────────────────┐
│  LAYER 2: API CONTAINER                                                             │
│  opspilot-api  [Azure Container Apps — Scale: 1-5 replicas]                        │
│  ─────────────────────────────────────────────────────────                         │
│  FastAPI + Python 3.12                                                              │
│  Pydantic v2 (all schemas, structured agent I/O)                                   │
│  OpenTelemetry SDK (auto-instrumented)                                              │
│  Azure Application Insights exporter                                               │
│  SSE endpoint: /api/incidents/{id}/stream                                          │
│  REST endpoints: /api/incidents, /api/agents, /api/findings                        │
│  Auth: Azure AD / Entra ID (MSAL)                                                  │
└─────────────────────────┬───────────────────────────────────────────────────────────┘
                          │ Internal VNET
┌─────────────────────────▼───────────────────────────────────────────────────────────┐
│  LAYER 3: AGENT RUNTIME CONTAINER                                                   │
│  opspilot-agents  [Azure Container Apps — Scale: 1-3 replicas]                     │
│  ─────────────────────────────────────────────────────────                         │
│  LangGraph 0.2+ orchestration engine                                               │
│  Commander Agent (GPT-4o, high reasoning)                                          │
│  Metrics Agent (GPT-4o-mini, structured output)                                    │
│  Logs Agent (GPT-4o-mini, structured output)                                       │
│  Deployment Agent (GPT-4o-mini, structured output)                                 │
│  Time Machine Agent (GPT-4o, synthesis)                                            │
│  LangGraph checkpointer → Azure Cosmos DB (state persistence)                      │
│  Agent memory → Azure AI Search (semantic retrieval)                               │
└─────────────────────────┬───────────────────────────────────────────────────────────┘
                          │ Tool Calls
┌─────────────────────────▼───────────────────────────────────────────────────────────┐
│  LAYER 4: TOOL LAYER                                                                │
│  opspilot-tools  [Internal service — not exposed publicly]                         │
│  ─────────────────────────────────────────────────────────                         │
│  MetricsTool: query_prometheus(), query_azure_monitor(), detect_anomaly()          │
│  LogsTool: query_log_analytics(), search_errors(), extract_stack_traces()          │
│  DeploymentTool: get_recent_deployments(), get_git_diff(), get_change_timeline()   │
│  InfraTool: get_k8s_events(), get_pod_status(), get_resource_utilization()         │
│  MemoryTool: search_past_incidents(), store_finding(), retrieve_runbook()          │
│  All tools return: ToolResult(data, confidence, source, timestamp)                 │
└─────────────────────────┬───────────────────────────────────────────────────────────┘
                          │ Azure SDK / REST
┌─────────────────────────▼───────────────────────────────────────────────────────────┐
│  LAYER 5: LLM LAYER                                                                 │
│  Azure AI Foundry + Azure OpenAI                                                    │
│  ─────────────────────────────────────────────────────────                         │
│  Commander Agent:     GPT-4o (128k context, high reasoning)                        │
│  Specialist Agents:   GPT-4o-mini (cost-optimized, structured output)              │
│  Root Cause Synthesis: o3 (optional — deep reasoning mode)                         │
│  Embeddings:          text-embedding-3-large (Azure AI Search)                     │
│  All calls routed through Azure AI Foundry for tracing + evaluation                │
└─────────────────────────┬───────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────────────────────────┐
│  LAYER 6: DATA LAYER                                                                │
│  ─────────────────────────────────────────────────────────                         │
│  Azure Cosmos DB (NoSQL):    Incident records, agent findings, state checkpoints    │
│  Azure AI Search:            Agent memory, past incident index, runbook index       │
│  Azure Blob Storage:         Raw logs, evidence artifacts, export reports           │
│  Azure Cache for Redis:      Active investigation state (sub-second reads)          │
│  Azure Key Vault:            All secrets, API keys, connection strings              │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Agent Orchestration Architecture

### LangGraph State Schema

```python
# The single source of truth for an investigation
class OpsPilotState(TypedDict):
    # Input
    incident_id: str
    incident_description: str
    severity: Literal["P0", "P1", "P2", "P3"]
    affected_services: list[str]
    
    # Agent findings (populated as agents complete)
    metrics_findings: MetricsFindings | None
    logs_findings: LogsFindings | None
    deployment_findings: DeploymentFindings | None
    infra_findings: InfraFindings | None
    
    # Synthesized outputs (populated by Commander)
    timeline: list[TimelineEvent]
    root_cause: RootCauseAssessment | None
    blast_radius: BlastRadiusAssessment | None
    recommendations: list[Recommendation]
    confidence_scores: dict[str, float]
    executive_summary: str | None
    
    # Orchestration metadata
    agent_status: dict[str, AgentStatus]
    messages: Annotated[list[AnyMessage], add_messages]
    iteration_count: int
    created_at: datetime
    completed_at: datetime | None
```

### LangGraph Topology

```
╔══════════════════════════════════════════════════════════════════╗
║                   LANGGRAPH TOPOLOGY                             ║
╚══════════════════════════════════════════════════════════════════╝

                    ┌──────────┐
                    │  START   │
                    └────┬─────┘
                         │
                    ┌────▼─────────────────────┐
                    │  commander_intake         │
                    │  ─────────────────────    │
                    │  • Parse incident input   │
                    │  • Classify severity      │
                    │  • Determine which agents │
                    │    to dispatch            │
                    │  • Set investigation scope│
                    └────┬─────────────────────┘
                         │
          ┌──────────────┼──────────────┬──────────────┐
          │              │              │              │
     ┌────▼────┐   ┌─────▼────┐  ┌────▼────┐  ┌─────▼────────┐
     │ metrics │   │  logs    │  │ deploy  │  │  time_machine │
     │ _agent  │   │ _agent   │  │ _agent  │  │  _agent       │
     │         │   │          │  │         │  │               │
     │ Tools:  │   │ Tools:   │  │ Tools:  │  │ Tools:        │
     │ query_  │   │ query_   │  │ get_    │  │ (reads all    │
     │ metrics │   │ logs     │  │ deploys │  │  other agent  │
     │ detect_ │   │ search_  │  │ git_    │  │  findings +   │
     │ anomaly │   │ errors   │  │ diff    │  │  builds       │
     └────┬────┘   └─────┬────┘  └────┬────┘  │  timeline)   │
          │              │            │        └─────┬────────┘
          │              │            │              │
          └──────────────┴────────────┴──────────────┘
                                    │
                         [conditional: all_agents_complete?]
                                    │ YES
                    ┌───────────────▼──────────────────────┐
                    │  commander_synthesize                  │
                    │  ──────────────────────────────────   │
                    │  • Aggregate all agent findings        │
                    │  • Build evidence correlation matrix   │
                    │  • Determine root cause hypothesis     │
                    │  • Score confidence per hypothesis     │
                    │  • Rank recommendations                │
                    │  • Generate executive summary          │
                    │  Model: GPT-4o (full context window)  │
                    └───────────────┬──────────────────────┘
                                    │
                         [conditional: confidence < 0.7?]
                                    │ YES: route to deep_reasoning
                    ┌───────────────▼──────────────────────┐
                    │  deep_reasoning_node (optional)        │
                    │  ──────────────────────────────────   │
                    │  Model: o3                             │
                    │  Prompt: "Given this evidence,         │
                    │  what is the most likely root cause?" │
                    │  Returns: refined root_cause with     │
                    │  higher confidence                     │
                    └───────────────┬──────────────────────┘
                                    │
                    ┌───────────────▼──────────────────────┐
                    │  output_formatter                      │
                    │  • Structure final IncidentReport     │
                    │  • Emit SSE events to frontend         │
                    │  • Persist to Cosmos DB               │
                    │  • Update agent_status = COMPLETE     │
                    └───────────────┬──────────────────────┘
                                    │
                    ┌───────────────▼──────────────────────┐
                    │             END                        │
                    └───────────────────────────────────────┘
```

### Agent Memory Model

```
AGENT MEMORY ARCHITECTURE:
─────────────────────────────────────────────────────────────────

  SHORT-TERM MEMORY (in-graph state):
  → The OpsPilotState object flowing through LangGraph nodes
  → All agents read the full state; each agent writes only its own findings
  → Enables Commander to reason across all findings in a single context

  EPISODIC MEMORY (Azure AI Search):
  → When an incident is resolved, findings are indexed with embeddings
  → Future agents can retrieve: "find similar past incidents"
  → Tool: search_past_incidents(symptoms, timeframe, service)
  → Returns: list[PastIncident] with similarity scores
  → WHY: enables learning across incidents without fine-tuning

  SEMANTIC MEMORY (Runbook Index):
  → Engineering runbooks indexed by service + symptom type
  → Deployment Agent retrieves relevant runbooks during investigation
  → Tool: retrieve_runbook(service, symptom)
  → WHY: agents produce actionable recommendations, not generic advice

  PROCEDURAL MEMORY (System Prompts):
  → Stored in Azure AI Foundry Prompt Registry
  → Version-controlled, evaluatable, auditable
  → WHY: prompt engineering is infrastructure; treat it as such
```

### Reasoning Flow Detail

```
COMMANDER SYNTHESIS PROMPT ARCHITECTURE:
────────────────────────────────────────

The Commander does NOT get a single "summarize this" prompt.
It receives a structured multi-section prompt:

  SECTION 1: INCIDENT CONTEXT
  → Raw user description + classified severity

  SECTION 2: METRICS EVIDENCE
  → MetricsFindings (anomalies, affected metrics, time of deviation)

  SECTION 3: LOG EVIDENCE
  → LogsFindings (error patterns, stack traces, frequency)

  SECTION 4: DEPLOYMENT EVIDENCE
  → DeploymentFindings (recent changes correlated with incident start)

  SECTION 5: TIMELINE
  → Chronological event sequence built by Time Machine Agent

  SECTION 6: SIMILAR PAST INCIDENTS
  → Retrieved from Azure AI Search episodic memory

  SECTION 7: REASONING INSTRUCTIONS
  → "Using the evidence above, reason step-by-step to determine:
     1. The most likely root cause (with confidence score)
     2. Alternative hypotheses (with confidence scores)
     3. Blast radius assessment
     4. Recommended remediation steps in priority order
     5. A 3-sentence executive summary suitable for leadership"

This structured prompting is why OpsPilot produces traceable,
multi-hypothesis reasoning rather than generic answers.
```

---

## 5. Azure Architecture

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                         AZURE ARCHITECTURE                                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│  AZURE AI FOUNDRY                                                            │
│  ─────────────────────────────────────────────────────────                  │
│  PURPOSE: The AI control plane. Everything AI-related is managed here.      │
│                                                                              │
│  Components used:                                                            │
│  • Azure OpenAI deployment (GPT-4o, GPT-4o-mini, o3, text-embedding-3-large)│
│  • Foundry Tracing → every LLM call traced with input/output/latency/tokens │
│  • Prompt Registry → agent system prompts versioned and stored here         │
│  • Evaluation Hub → automated eval runs against golden incident datasets    │
│  • Model Catalog → used to demonstrate model selection reasoning            │
│                                                                              │
│  WHY IT IMPROVES SCORING:                                                    │
│  Judges see a system that treats AI as infrastructure, not a magic API call. │
│  Foundry tracing makes every reasoning step visible and auditable.          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  AZURE CONTAINER APPS (ACA)                                                  │
│  ─────────────────────────────────────────────────────────                  │
│  PURPOSE: Managed container hosting with zero Kubernetes management overhead │
│                                                                              │
│  Containers deployed:                                                        │
│  • opspilot-ui       (React frontend, scale 1-3)                             │
│  • opspilot-api      (FastAPI, scale 1-5, CPU triggers)                      │
│  • opspilot-agents   (LangGraph runtime, scale 1-3, queue triggers)          │
│                                                                              │
│  ACA features leveraged:                                                     │
│  • DAPR sidecar for service-to-service calls (optional, impressive to show) │
│  • Managed identity → no stored credentials anywhere                        │
│  • VNET integration → agents never exposed to internet                      │
│  • Scale-to-zero for cost efficiency during demo/idle periods               │
│                                                                              │
│  WHY NOT AKS: Solo developer, 2-4 week timeline. ACA removes 80% of the    │
│  operational burden while still running production-grade containers.         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  AZURE MONITOR + APPLICATION INSIGHTS                                        │
│  ─────────────────────────────────────────────────────────                  │
│  PURPOSE: Full-stack observability. OpsPilot monitors your cloud; someone   │
│  must monitor OpsPilot.                                                      │
│                                                                              │
│  What is tracked:                                                            │
│  • Agent execution time per investigation                                   │
│  • LLM token consumption per agent per run                                  │
│  • Tool call success/failure rates                                          │
│  • End-to-end incident resolution time                                      │
│  • Confidence score distribution across incidents                           │
│                                                                              │
│  Custom Dashboard: "OpsPilot Operations" → shows the system's own health   │
│  This is a meta-narrative the judges will appreciate.                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  AZURE AI SEARCH                                                             │
│  ─────────────────────────────────────────────────────────                  │
│  PURPOSE: Agent episodic and semantic memory                                 │
│                                                                              │
│  Indexes:                                                                    │
│  • past_incidents    (vector + keyword hybrid search)                        │
│  • runbooks          (semantic search over engineering runbooks)             │
│  • known_patterns    (common failure signatures with resolutions)           │
│                                                                              │
│  WHY: Makes recommendations specific and actionable. An agent that says     │
│  "Based on 3 similar past incidents (linked), the most likely fix is..."   │
│  is dramatically more impressive than a generic suggestion.                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  AZURE COSMOS DB (NoSQL API)                                                 │
│  ─────────────────────────────────────────────────────────                  │
│  PURPOSE: Incident state persistence + LangGraph checkpointing               │
│                                                                              │
│  Collections:                                                                │
│  • incidents         (full investigation records)                           │
│  • agent_findings    (individual agent outputs per incident)                │
│  • checkpoints       (LangGraph state snapshots for replay)                 │
│                                                                              │
│  WHY COSMOS: Schema flexibility for evolving agent output structures.        │
│  LangGraph checkpointing enables full investigation replay — critical for   │
│  the demo's "Evidence Explorer" panel.                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  AZURE KEY VAULT                                                             │
│  ─────────────────────────────────────────────────────────                  │
│  PURPOSE: Zero-trust secret management                                       │
│  All containers use Managed Identity → Key Vault reference bindings         │
│  No .env files with actual secrets ever committed or deployed               │
│  Demonstrates enterprise security practices to judges                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  AZURE FRONT DOOR + STATIC WEB APPS (optional frontend hosting)             │
│  PURPOSE: Global CDN + TLS termination for the React frontend               │
│  Alternative: serve frontend from ACA container                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Microsoft Foundry IQ Integration Strategy

### What Foundry IQ Is — Precisely

Foundry IQ is not a product. It is the conceptual framework Microsoft uses to describe AI systems built with **grounded reasoning** (not hallucination), **enterprise-grade traceability**, and **responsible AI practices** embedded into the architecture — not bolted on afterward.

To maximize alignment, OpsPilot must demonstrate all three pillars.

### Integration Options — Ranked by Impact

**Option A: Foundry Traces as the Reasoning Transparency Layer (HIGHEST IMPACT)**

Every LLM call in OpsPilot emits a Foundry trace. In the UI, the "Agent Activity Stream" panel links each agent finding to its trace ID. A judge can click any agent output and see:
- The exact prompt sent
- The model's chain-of-thought
- The tools called and their results
- The token count and latency
- The confidence score justification

This makes reasoning transparent, which is the core of Foundry IQ. It also makes the demo dramatically more compelling because the system explains itself.

**Option B: Foundry Evaluation Hub for Incident Quality Scoring (STRONG)**

Build a golden dataset of 10 fictional incidents with known root causes. Run OpsPilot against them via Foundry Evaluation. Show a dashboard with:
- Accuracy rate: 9/10 correct root causes
- Average confidence calibration
- Average time-to-finding: 4.2 minutes

This demonstrates that you are treating AI output quality as an engineering metric, not a subjective judgment.

**Option C: Foundry Prompt Registry for Prompt-as-Infrastructure (IMPORTANT)**

All 5 agent system prompts are registered, versioned, and deployed through the Foundry Prompt Registry. In the codebase, agents load their prompts by name + version, never from hardcoded strings. This demonstrates:
- Prompt engineering as a discipline
- Separation of model code from prompt content
- The ability to A/B test prompts across agent versions

**Option D: Responsible AI Content Safety Layer**

Before any agent output is surfaced to the user, route it through Azure AI Content Safety. Not because SRE dashboards risk harmful content, but because it demonstrates that you have internalized Microsoft's Responsible AI principles. This earns points with Copilot Engineering judges specifically.

### Recommended Implementation (MVP + Demo)

Implement A + C in the MVP. Implement B before the demo (takes ~2 hours to build 10 golden incidents). Reference D in your architecture slides even if not coded.

---

## 7. Frontend Information Architecture

### Design Language

The visual target is: **Microsoft Security Copilot's investigation workspace** crossed with **Azure Monitor's dashboard density** crossed with **GitHub Copilot Workspace's step-by-step transparency**.

Not ChatGPT. Not a Streamlit app. Not a generic Next.js dashboard.

Colors: Azure dark navy (`#0a1628`) base, Azure blue (`#0078d4`) accent, semantic red/yellow/green for severity. Fluent UI component library throughout.

### Screen 1: Command Center (Primary View)

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║  ⬡ OpsPilot   [Incidents ▾]  [Agents ▾]  [History]  [Settings]         [MK] ⚙  ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║  ┌─── ACTIVE INCIDENT ──────────────────────────────────────────────────────┐   ║
║  │  🔴 P1 · INC-2024-0847   Checkout Service Degradation                   │   ║
║  │  Started: 14:23 UTC · Duration: 00:04:32 · Blast Radius: HIGH            │   ║
║  │  Affected: checkout-svc · payment-svc · order-svc (3 services)           │   ║
║  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Investigation: 73% complete        │   ║
║  └────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                  ║
║  ┌── AGENT ACTIVITY STREAM ──────┐  ┌── TIMELINE ─────────────────────────┐   ║
║  │ ✅ Commander    Dispatching   │  │  14:18 — Deployment: checkout v2.4.1  │   ║
║  │ ✅ MetricsAgent  Complete     │  │  14:21 — Latency spike: p99 → 8.2s   │   ║
║  │ ✅ LogsAgent     Complete     │  │  14:22 — Error rate crosses 5%        │   ║
║  │ 🔄 DeployAgent   Running...   │  │  14:23 — PagerDuty alert triggered   │   ║
║  │ ⏳ TimeMachine   Waiting      │  │  14:27 — DB connection pool exhausted │   ║
║  │                               │  │  ◀ Root cause window identified       │   ║
║  │ [View Full Trace]             │  │                                        │   ║
║  └───────────────────────────────┘  └────────────────────────────────────┘   ║
║                                                                                  ║
║  ┌── ROOT CAUSE ASSESSMENT ──────────────────────────────────────────────────┐  ║
║  │  Hypothesis 1 ████████████████████████ 87% — DB connection pool leak     │  ║
║  │               introduced in checkout v2.4.1 (ORM config regression)      │  ║
║  │                                                                            │  ║
║  │  Hypothesis 2 ████████████ 41%           — Upstream payment-svc timeout  │  ║
║  │  Hypothesis 3 ████ 18%                   — Traffic spike (Black Friday)  │  ║
║  └────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                  ║
║  ┌── RECOMMENDATIONS ────────────────────────────────────────────────────────┐  ║
║  │  1. [IMMEDIATE] Roll back checkout-svc to v2.3.9          [Execute] [✓]  │  ║
║  │  2. [IMMEDIATE] Increase DB connection pool limit          [Execute] [✓]  │  ║
║  │  3. [SHORT-TERM] Add connection pool monitoring alert      [Create] [✓]  │  ║
║  │  4. [LONG-TERM]  Add ORM config validation to CI pipeline  [Ticket] [✓]  │  ║
║  └────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

### Screen 2: Investigation Graph (Secondary Panel)

A D3.js force-directed graph. Each node is an agent or evidence artifact. Edges represent causal relationships discovered during investigation. Clicking a node opens the Evidence Explorer for that specific finding.

```
  [Commander]
      │
      ├──── [Deployment v2.4.1] ───── [Git diff: ORM config change]
      │              │
      │         [DB Connection Pool] ──── [Prometheus: conn exhaustion]
      │              │
      ├──── [Error Spike: 14:21] ──── [Log: PoolExhausted exception]
      │
      └──── [Blast Radius: 3 services]
```

### Screen 3: Evidence Explorer (Drill-Down Panel)

When a user clicks any finding, a right-side panel slides in (Fluent UI Panel component) showing:
- Raw evidence from the tool call
- The agent's reasoning about this evidence
- Confidence score with justification
- Link to the Foundry trace for this specific LLM call
- Link to the source data (log query, metric chart, deployment diff)

### Screen 4: Executive Summary View

A clean, printable view. One page. Three sections:
1. **What happened** (2 sentences)
2. **Why it happened** (3 sentences + confidence score)
3. **What we recommend** (numbered list with time estimates)

Designed to be pasted directly into a Slack channel or Teams message.

### Navigation Model

```
Left Nav (collapsed by default, expands on hover):
  ⬡ Home
  🔴 Active Incidents (badge: 1)
  📊 Metrics
  📋 Logs
  🚀 Deployments
  🕐 History
  🧠 Agents
  ⚙  Settings
```

### Real-Time UX Pattern

The Agent Activity Stream uses SSE. As each agent completes:
1. The stream card animates from "Running..." to "Complete"
2. The confidence score counter increments in real-time
3. New timeline entries slide in from the bottom
4. The root cause probability bars animate to new values

This real-time progression is the most impressive UX moment in the demo. It must feel like watching a brilliant SRE team work in real time.

---

## 8. Demo Flow

### 5-Minute Demo Script

```
MINUTE 0:00–0:30 — THE HOOK

Presenter says:
"It's Black Friday. 2:23 PM. Your checkout service is failing.
Every minute costs $50,000. Your on-call engineer is in a meeting.
This is the moment OpsPilot was built for."

Types into the incident input:
  "Checkout service is failing. High error rate since 2:20 PM."

Presses Enter.

─────────────────────────────────────────────────────────────────

MINUTE 0:30–1:30 — AGENTS SPIN UP

Show the Agent Activity Stream. Watch in real-time:
  → Commander: "Analyzing incident. Dispatching 4 specialist agents."
  → MetricsAgent: "Querying Prometheus for checkout-svc over last 30 minutes..."
  → LogsAgent: "Searching Log Analytics for errors in checkout-svc..."
  → DeploymentAgent: "Retrieving deployments in last 6 hours..."
  → TimeMachineAgent: "Waiting for agent findings..."

Narrate: "Four specialized agents. Each is an expert. Each has its own tools.
They're not asking the same question — they're investigating from different angles."

─────────────────────────────────────────────────────────────────

MINUTE 1:30–2:30 — THE TIMELINE BUILDS

Narrate: "Watch the Timeline panel."

Timeline entries appear in sequence:
  14:18 — Deployment: checkout-svc v2.4.1 pushed to production
  14:21 — p99 latency climbs: 400ms → 8.2 seconds
  14:22 — Error rate crosses 5% threshold
  14:23 — PagerDuty fires. Your phone buzzes.
  14:27 — Database connection pool exhaustion detected

"OpsPilot built this timeline automatically — from three different data sources.
No human cross-referenced these events. The Time Machine Agent did."

─────────────────────────────────────────────────────────────────

MINUTE 2:30–3:30 — ROOT CAUSE + BLAST RADIUS

Root cause bar fills to 87%:
  "DB connection pool leak introduced in checkout v2.4.1
   via ORM configuration regression"

Click the evidence link. Show the Git diff. Show the stack trace.
Show the Foundry trace — the exact reasoning chain.

"This is not a guess. This is evidence-backed reasoning.
Every claim is traceable to a source."

Show blast radius: 3 services, estimated 12,000 affected sessions,
estimated business impact: $210,000 if unresolved for another hour.

─────────────────────────────────────────────────────────────────

MINUTE 3:30–4:30 — RECOMMENDATIONS + EXECUTIVE SUMMARY

Recommendations appear:
  1. Roll back to v2.3.9 — immediate
  2. Increase connection pool limit — immediate
  3. Add pool monitoring alert — this week
  4. Add ORM config validation to CI — next sprint

"One-click rollback. Right from the OpsPilot UI."
(Demo the Execute button — show it calling a mock Azure DevOps API)

Generate Executive Summary. 3 sentences appear.
"Ready to paste into your incident Slack channel."

─────────────────────────────────────────────────────────────────

MINUTE 4:30–5:00 — THE CLOSE

"Total time from 'checkout is failing' to root cause with evidence:
  4 minutes and 12 seconds.

Average human MTTR for a similar incident: 47 minutes.

OpsPilot didn't replace the SRE. It gave them 43 minutes back —
on the worst possible day, when they needed it most."

Show the OpsPilot monitoring dashboard — OpsPilot monitoring itself.
"Even the AI is observable."
```

---

## 9. MVP Scope

### The Core Decision Principle

Build only what is **visible in the demo**. Mock everything else with production-quality fake data. The judges cannot tell the difference between a real Prometheus query and a realistic mock — but they can immediately tell the difference between a complete UI and an incomplete one.

### What Must Be Real

| Component | Reason |
|---|---|
| Azure AI Foundry + Azure OpenAI integration | Core of the hackathon theme. Must be real. |
| LangGraph orchestration (Commander + 2 agents minimum) | Real multi-agent reasoning. Not faked. |
| FastAPI backend with SSE streaming | Real-time UX depends on it. |
| React/Fluent UI frontend with all primary panels | Judges see this for 5 minutes. Must be polished. |
| Foundry tracing on all LLM calls | Demonstrably real. Clickable in demo. |
| Azure Key Vault managed identity | Demonstrates enterprise security. |

### What Should Be Mocked (With Quality)

| Component | Mock Strategy |
|---|---|
| Prometheus metrics data | Pre-built JSON fixture with realistic time series data showing the incident pattern |
| Log Analytics queries | Pre-scripted log excerpts with real-looking stack traces and error patterns |
| Azure DevOps deployment API | Static fixture: 3 deployments, the middle one is the culprit |
| Kubernetes events API | Static fixture: pod restarts, OOM events correlated with incident |
| Business impact calculation | Hardcoded formula: `error_rate × estimated_sessions × avg_order_value` |
| Past incident retrieval | 3 pre-seeded incidents in Azure AI Search |

### Build Sequence (4-Week Plan)

```
WEEK 1: Core Infrastructure
  ✓ Azure resource provisioning (ACA, Cosmos DB, AI Foundry, Key Vault)
  ✓ FastAPI skeleton with SSE endpoint
  ✓ LangGraph state schema definition
  ✓ Commander Agent + single specialist agent working end-to-end
  ✓ React app skeleton with Fluent UI + dark theme

WEEK 2: Agent Layer + Tools
  ✓ All 4 agents implemented
  ✓ All mock tool fixtures built (high-quality, realistic data)
  ✓ LangGraph graph fully wired
  ✓ Foundry tracing integrated
  ✓ SSE event emission from all agent nodes

WEEK 3: Frontend Polish
  ✓ Agent Activity Stream (real-time)
  ✓ Timeline View (animated)
  ✓ Root Cause Assessment with confidence bars
  ✓ Recommendations panel
  ✓ Evidence Explorer (drill-down panel)
  ✓ Executive Summary view

WEEK 4: Demo Prep + Polish
  ✓ 3 end-to-end demo scenarios scripted and tested
  ✓ Foundry Evaluation golden dataset built
  ✓ Architecture diagrams (for slides)
  ✓ README with architecture documentation
  ✓ One-click demo reset script
  ✓ Contingency: offline mode with cached responses
```

### The Contingency Rule

Always have a pre-recorded fallback for the Azure OpenAI calls. A 10-second API timeout during a live demo is catastrophic. Cache the LLM responses for your 3 demo scenarios using LangGraph checkpointing. If Azure is slow, replay from checkpoint.

---

## 10. Future Vision

### OpsPilot in 3 Years — If Microsoft Productizes It

**Year 1 (Post-Hackathon V1):** OpsPilot becomes a production-grade internal tool at Microsoft. The agent library expands to 12 agents. Integration with Azure Monitor, Microsoft Sentinel, and GitHub Advanced Security is native. OpsPilot is embedded into the Azure Portal as a side panel — when an alert fires in Azure Monitor, OpsPilot automatically opens an investigation.

**Year 2 (Platform Expansion):** Microsoft ships OpsPilot as a premium tier of Azure Monitor. The commander architecture becomes a pattern — a "Reasoning Agent Mesh" — that Microsoft publishes as a reference architecture for enterprise AI. Other products (Sentinel, Defender, DevOps) adopt the same commander-specialist pattern for their own AI features. OpsPilot learns from every resolved incident across its customer base (privacy-preserving, federated) and its recommendations improve continuously.

**Year 3 (Autonomous Operations):** OpsPilot evolves from a recommendation engine to an action engine. With explicit enterprise governance controls, it can:
- Automatically scale resources in response to predicted incidents
- Automatically open pull requests for known fixes (config regressions)
- Automatically update runbooks based on new incident patterns
- Predict incidents 15 minutes before they occur using time-series forecasting agents
- Brief SRE teams at the start of each shift: "Here are the 3 systems most likely to fail today and why"

The product's tagline shifts from "Autonomous SRE Command Center" to **"The Intelligence Layer for Cloud Operations"** — the system that knows your infrastructure better than any single engineer, is available at 3 AM without being paged, and gets smarter every time something goes wrong.

**The Microsoft Narrative:**

OpsPilot demonstrates that the next generation of enterprise software is not software that humans use — it is software that thinks with humans. The value is not in the UI. The value is in the accumulated operational intelligence, the reasoning provenance, and the trust that comes from a system that can always show its work.

This is the product Microsoft builds when it takes GitHub Copilot's code intelligence, Azure Monitor's observability, and Microsoft Sentinel's threat reasoning — and unifies them under a single reasoning agent mesh for cloud operations.

---

## Architecture Decision Summary

| Decision | Choice | Justification |
|---|---|---|
| Agent framework | LangGraph | Explicit state, checkpointing, graph topology is visually demonstrable |
| Agent parallelism | Fan-out/fan-in pattern | Realistic SRE team behavior; faster than sequential; clear in UI |
| Commander model | GPT-4o | Full context window needed for multi-agent synthesis |
| Specialist model | GPT-4o-mini | Cost-optimized; structured output is sufficient |
| Deep reasoning model | o3 (fallback) | Demonstrates model selection intelligence |
| Container platform | Azure Container Apps | Managed, scalable, VNET-ready, solo-developer appropriate |
| State persistence | Cosmos DB | Schema flexibility for evolving agent outputs |
| Agent memory | Azure AI Search | Semantic retrieval elevates recommendations from generic to specific |
| Secret management | Key Vault + Managed Identity | Non-negotiable security baseline |
| Observability | OpenTelemetry + Foundry Tracing | Dual-layer: infrastructure metrics + AI reasoning traces |
| Real-time UX | SSE (not WebSockets) | Simpler, HTTP-native, sufficient for one-directional streaming |
| UI library | Fluent UI v9 | Microsoft-native; communicates design fluency to judges |
| Frontend state | React Query + Zustand | Server state vs client state separation is correct architecture |