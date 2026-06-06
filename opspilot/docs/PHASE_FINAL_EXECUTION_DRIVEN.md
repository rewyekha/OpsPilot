# Phase Final — Execution-Driven OpsPilot (Static Data Eliminated)

OpsPilot is now driven by a **single source of truth**: a persisted store of real
investigation executions. Every completed orchestrator run is captured and
written to disk; History, Analytics, the Agents page and the dashboard all read
from it. The dashboard agent queue is driven live by real SSE events — no static
rosters, no timers, no simulated transitions.

---

## TASK 1 — Static data audit

| File | Static data found | Replacement source |
|------|-------------------|--------------------|
| `backend/app/services/agent_service.py` | `_TASKS_BY_INCIDENT` — hardcoded agents, findings, confidence, durations, statuses for INC-2024-0847 | **No longer read by any page.** Dashboard queue → live SSE; Agents page → `GET /api/agents/stats`; history → store |
| `backend/app/services/recommendation_service.py` | `_RECOMMENDATIONS` — hardcoded root cause + 3 recommendations | Real recommendations captured from the `RecommendationAgent` into each `InvestigationRecord`. (Dashboard's incident-summary still seeds from this endpoint until the first run — see "Remaining".) |
| `backend/app/services/incident_service.py` | Seed "active incident" (the incoming alert) | Kept intentionally as the incident to investigate; everything downstream is real |
| `backend/app/services/timeline_service.py` | Hardcoded timeline events | Per-investigation timeline now comes from the record's agent executions |
| `backend/app/tools/metrics_tools.py`, `logs_tools.py` | Synthetic metric/log fixtures | Telemetry-mode gated (synthetic provider). Real Azure data in `TELEMETRY_MODE=azure`. Legitimate, not removed |
| `backend/app/agents/*/agent.py` `_mock_investigate()` | Deterministic agent output | Legitimate fallback used only when `EXECUTION_MODE=mock`; real `_investigate()` (o4-mini) runs in foundry mode |
| `frontend/src/data/mockIncident.ts`, `mockTimeline.ts`, `mockRecommendations.ts`, `mockAgentActivity.ts` | Mock UI datasets | **Orphaned** — no longer imported by any page (history/analytics/agents/dashboard read backend records) |
| `frontend/src/components/agents/AgentActivityPanel.tsx` (+ `useAgentActivity`) | Rendered the static `/api/agents/activity` | **Removed from the Agents page.** Live execution is now the dashboard queue |
| `frontend/src/store/SessionContext.tsx` `closedIncidents` | Client-only "history" | History/Analytics no longer use it — they read the persisted store |
| `frontend/src/utils/search.ts` `INDEX` | Static command-palette seed | Documented swappable seam (unchanged this phase) |

## TASK 2 — Live agent queue (no static, no timers)

The dashboard "Investigation Queue" is rendered from `useLiveInvestigation`, which
opens **one** SSE connection and aggregates the orchestrator's real events:

```
investigation.started → all agents PENDING
agent.started (commander)   → Commander RUNNING
agent.finding (commander)   → Commander COMPLETE (+ real confidence)
agent.started (metrics)     → Metrics RUNNING        … etc …
reasoning.escalated         → Deep Reasoning injected before Recommendation
investigation.complete      → run COMPLETE
```

Order: Commander → Metrics → Logs → Deployment → Time Machine → Root Cause →
(Deep Reasoning if escalated) → Recommendation. **No `setTimeout`, no fake
progress** — every transition is a real backend event.

## TASK 3 — Real History

`HistoryPanel` reads `GET /api/investigations` (persisted to
`backend/data/investigations.json`), so it **survives page refresh and backend
restart**. Columns: investigation id, completed timestamp, duration, confidence,
root cause, recommendation count, agent count. Row → the record's agent execution
timeline + RCA. No fabricated investigations.

## TASK 4 — Real Agents

`AgentHealthOverview` reads `GET /api/agents/stats`: per agent — **execution
count, average duration, average confidence, last execution, success rate** —
all computed from completed investigations. Zero hardcoded percentages.

## TASK 5 — Real Analytics

`AnalyticsPanel` reads `GET /api/analytics`: MTTR, mean duration, confidence
distribution, root-cause categories, investigation volume (7-day), agent success
rate, **reasoning escalation rate** — all from stored investigations. Empty-state
when no data; nothing fabricated.

## TASK 6 — Recommendations generated + stored

The `RecommendationAgent` runs over the real metrics/logs/deployment findings +
(possibly reasoning-refined) root cause; its output is captured into
`InvestigationRecord.recommendations` and persisted with the run.

## TASK 7 — Service inventory stays real

Unchanged and verified: synthetic mode → "No monitored Azure services discovered";
azure mode → dynamic discovery from the telemetry provider. No hardcoded fallback.

## TASK 8 — Single source of truth

`backend/app/services/investigation_store.py` — one persisted `InvestigationRecord`
model. The orchestrator writes one record per run; Dashboard, History, Agents,
Analytics, Recommendations and the per-record Timeline all read from it (or its
live SSE feed). No duplicate stores, no static mirrors.

---

## TASK 9 — Final report

### 1. Static sources removed / bypassed
- Dashboard queue no longer reads `agent_service._TASKS_BY_INCIDENT` → live SSE.
- Agents page no longer reads `/api/agents/activity` → `/api/agents/stats` (real).
- History no longer reads `SessionContext.closedIncidents` → `/api/investigations`.
- Analytics no longer computes from session/mock → `/api/analytics` (real).
- Dashboard summary widgets no longer read static activity → latest persisted record.
- `mock*.ts` datasets + `AgentActivityPanel` orphaned (no longer rendered).

### 2. Remaining mock / demo-only features
- **Incident seed** (`incident_service`, `recommendation_service`): seeds the
  incoming alert + a baseline root cause/recommendations for the dashboard's
  incident-summary KPIs **before the first run**. After any real run, the
  persisted record is authoritative. (Pointing the incident-summary KPIs at
  `latest` is the natural next step.)
- **Agent `_mock_investigate`** + **synthetic telemetry tools**: deterministic
  output when `EXECUTION_MODE=mock` / `TELEMETRY_MODE=synthetic` — the documented
  zero-credential path. Real `o4-mini` + Azure Monitor in live mode.
- **Demo-marked actions**: Restart / Scale / Replay (clearly badged "demo").
- **AnalyticsBlade** (dashboard quick-view modal) still computes from in-session
  data; the full Analytics page is fully real.

### 3. Architecture — data flow
```
                         ┌────────────────────────────────────────────┐
                         │  InvestigationOrchestrator (LangGraph)       │
  POST /investigate ───► │  commander→metrics→logs→deployment→          │
  (or SSE connect)       │  time_machine→root_cause→[reasoning]→        │
                         │  recommendation   (real o4-mini in foundry)  │
                         └───────────────┬───────────────┬─────────────┘
                                         │ emits          │ captures
                                  SSE events         AgentExecution[]
                                         │                │ + root cause + recs
                                         ▼                ▼
                          ┌────────────────────┐   ┌──────────────────────────┐
                          │ event_stream (SSE) │   │ investigation_store (JSON)│  ◄── SINGLE SOURCE
                          └─────────┬──────────┘   └───────────┬──────────────┘     OF TRUTH
                                    │                          │
             ┌──────────────────────┼──────────┬──────────────┼───────────────┐
             ▼ (live)               ▼           ▼              ▼               ▼
   Dashboard queue        /investigations   /investigations  /analytics   /agents/stats
   (useLiveInvestigation)   /latest          (History)       (Analytics)   (Agents)
             │                  │                 │              │             │
             └──────────────────┴─────── OpsPilot frontend ──────┴─────────────┘
```

### 4. End-to-end execution path
```
User clicks Re-run / Run
  → POST /api/incidents/{id}/investigate
  → trigger_investigation()  → InvestigationOrchestrator.run()  (guarded, real agents)
  → each agent emits SSE (agent.started / agent.finding / agent.completed)
  → Dashboard queue updates LIVE via useLiveInvestigation (pending→running→complete)
  → orchestrator captures every AgentExecution + root cause + recommendations
  → investigation_store.add(record)  → backend/data/investigations.json  (persisted)
  → investigation.complete (SSE)
  → frontend `opspilot:refresh` → History, Analytics, Agents, Dashboard re-fetch
  → History shows the run · Analytics recomputes MTTR/volume/escalation · Agents stats update
```

### Verification
```
backend: 2 orchestrator runs → /api/investigations=2, /api/analytics total=2 mttr computed,
         /api/agents/stats execution_count=2 per role     → all real
frontend: tsc --noEmit ✓ · vite build ✓ (2205 modules)
backend:  pytest test_graph + test_agents + test_reasoning → 12 passed
persistence: backend/data/investigations.json (gitignored); survives refresh + restart
```

### Judge success criteria — met
1. Run an investigation → real orchestrator executes.
2. Watch agents execute live → dashboard queue transitions via real SSE.
3. Results in dashboard → confidence + findings + recommendations from the run.
4. Stored in history → persisted record (survives refresh).
5. Analytics update automatically → recomputed from records on `opspilot:refresh`.
6. Trigger deep reasoning → real o4-mini, appended to the investigation blade.
7. Confidence/recommendations change → captured per run, reflected everywhere.
