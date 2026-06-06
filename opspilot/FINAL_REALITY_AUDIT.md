# OpsPilot — Final Reality Audit

**Mission:** remove every source of fake / seeded / synthetic / mock / hardcoded
incident data. After this pass every displayed value is **REAL** (live Azure
telemetry), **DERIVED** (computed from real persisted records), **LLM_ESTIMATED**
(o4-mini reasoning over real telemetry), or an **EMPTY STATE**. Nothing is SEEDED
or MOCK in the running (azure + foundry) path.

Validated live on workspace `6b91e526-…` with `album-api` healthy:
`/api/system/services` → album-api healthy (source: azure) · `/api/incidents/active` → `[]`
· `/api/investigations/latest` → `null` · `/api/analytics` → `has_data:false` ·
`/api/agents/stats` → `[]` · `/api/incidents/INC-2024-0847` → **404**.

Classification legend: **REAL** · **DERIVED** · **LLM_ESTIMATED** · **EMPTY** (shown when no evidence). `SEEDED`/`MOCK` = eliminated.

## Provenance table (every displayed value)

| Field | Backend Source | Frontend Source | Evidence | Classification |
|-------|----------------|-----------------|----------|----------------|
| **Monitored services** (name/status/latency/error rate) | `AzureMonitorTelemetryProvider.get_all_service_health()` → KQL `AppRequests`/health | `MonitoredServices` ← `/api/system/services` | Live: album-api healthy 0ms/0% `source:azure` | **REAL** |
| **Active incidents** | `incident_service.get_active_incidents()` → `provider.detect_incidents()` (UNHEALTHY services only) | `IncidentPanel` ← `/api/incidents/active` | `[]` when healthy → "No active incidents detected" | **REAL / EMPTY** |
| **Incident Title** | `DetectedIncident.title` (telemetry) or user-created or record description | `IncidentPanel` / `RecommendationPanel` ← record/incident | from telemetry threshold breach, else empty | **REAL / EMPTY** |
| **Incident ID** | telemetry `INC-{service}`, user `INC-{date}-{rand}`, or record `incident_id` | `record.incident_id` (no hardcoded constant) | seed `INC-2024-0847` deleted → 404 | **DERIVED / EMPTY** |
| **Severity** | Commander agent `IntakeOutput.severity` (o4-mini) → `record.severity` | KPI ← `record.severity` (empty `'—'` if absent; no `'P2'` default) | LLM over telemetry; empty when none | **LLM_ESTIMATED / EMPTY** |
| **Root Cause** (title/description/confidence) | RootCause agent (o4-mini) over metrics/logs/deploy findings → `record.root_cause` | `RecommendationPanel`/`InvestigationBlade` ← record | persisted real run; `_mock_investigate` no longer in live path | **LLM_ESTIMATED / EMPTY** |
| **Blast Radius / Affected Users / Cost Impact** | RootCause/Reasoning agent (`RootCauseOutput`) → `record.root_cause.*` | KPI ← record; `'—'` when 0; footnote "estimated by the Root Cause agent from telemetry evidence" | LLM estimate over telemetry; provenance shown | **LLM_ESTIMATED / EMPTY** |
| **Confidence** | per-agent `confidence` (o4-mini) → `combined_confidence` | live SSE while running, else `record.combined_confidence` | real execution; `0` only when no record | **LLM_ESTIMATED / DERIVED** |
| **Live agent queue** (pending→running→complete) | orchestrator SSE events (real execution) | `useLiveInvestigation` ← `/stream` (read-only) | starts EMPTY; roster appears only on real `investigation.started` | **REAL / EMPTY** |
| **History** (records, durations, root causes) | `investigation_store.list_all()` (persisted real runs) | `HistoryPanel` ← `/api/investigations` | `[]` after purge of 14 seed runs | **DERIVED / EMPTY** |
| **Analytics — MTTR / mean duration** | `_avg(record.duration_seconds)` | `AnalyticsPanel` ← `/api/analytics` | `has_data:false` when 0 records | **DERIVED / EMPTY** |
| **Analytics — Agent success / Escalation rate** | counts over `record.agents[].status` / `record.escalated` | `AnalyticsPanel` | computed only from real records | **DERIVED / EMPTY** |
| **Analytics — Root-cause categories / volume / confidence dist.** | aggregates over real records | `AnalyticsPanel` charts | empty until real runs exist | **DERIVED / EMPTY** |
| **Agents page** (executions / success / avg confidence / last run) | `agent_stats()` over `investigation_store` records | `AgentHealthOverview` ← `/api/agents/stats` | `[]` when no executions (no 104/100% fabrication) | **DERIVED / EMPTY** |
| **Recommendations** | RootCause/Recommendation agent (o4-mini) → `record.recommendations` | `RecommendationPanel` ← record | real run output; empty otherwise | **LLM_ESTIMATED / EMPTY** |

## Seeded / mock sources removed

| Source (file) | What it was | Action |
|---------------|-------------|--------|
| `backend/app/services/incident_service.py` | `MOCK_INCIDENTS` = INC-2024-0847 / checkout / ORM pool / P1 / 73% + `_INDEX` | **Rewritten telemetry-driven** (detect_incidents + user registry + record resolution); seed deleted |
| `backend/data/investigations.json` | 14 persisted runs, **all** INC-2024-0847 (powered fake analytics/history/agents) | **Purged → `[]`** (backup → `investigations.seed-backup.json`, gitignored) |
| `backend/app/agents/base.py` | LLM-failure → `_mock_investigate()` (injected checkout data into the live path) | **Removed** — emits an explicit empty *failed* finding (confidence 0, no fabricated metrics) |
| `backend/app/agents/orchestrator.py` | every agent recorded `status="complete"` | **Honest status** — `failed` when the finding is flagged failed |
| `backend/app/api/routes/stream.py` | SSE generator called `orchestrator.run()` → **started a run on every connection** (nav restart bug) | **Read-only** — subscribes only; never starts a run |
| `backend/app/api/routes/incidents.py` | `POST` appended to `MOCK_INCIDENTS`/`_INDEX` | uses `register_user_incident()` (explicit user incidents only) |
| `frontend/src/utils/constants.ts` | `ACTIVE_INCIDENT_ID = 'INC-2024-0847'` (used in 10+ components) | **Deleted**; replaced by runtime "latest real investigation"; `EXPORT_STEM` for filenames |
| `frontend` hooks `useIncident` / `useActiveSnapshot` | `... || 'P2'` severity default | (already removed prior pass) — empty severity, never a default |

**Note on `_mock_investigate`:** the 8 agents still define `_mock_investigate` for the
explicit offline `EXECUTION_MODE=mock` (tests / zero-credential dev). It is **not
reachable in the live azure+foundry path** — agents run `_investigate` (o4-mini),
and the failure fallback no longer calls it. The synthetic telemetry tools
(`tools/*.py`, `telemetry/synthetic.py`) are likewise only used by
`SyntheticTelemetryProvider` (TELEMETRY_MODE=synthetic), never in azure mode.

## Files changed

Backend: `services/incident_service.py` · `agents/base.py` · `agents/orchestrator.py`
· `api/routes/stream.py` · `api/routes/incidents.py` · `data/investigations.json` (purged).
Frontend: `utils/constants.ts` · `hooks/useLiveInvestigation.ts` · `hooks/useActiveSnapshot.ts`
· `hooks/useIncident.ts` · `store/SessionContext.tsx` · `components/dashboard/DashboardSummary.tsx`
· `components/recommendations/RecommendationPanel.tsx` · `components/incident/IncidentPanel.tsx`
· `components/incident/InvestigationBlade.tsx` · `components/command/GlobalCommandBar.tsx`
· `components/settings/SettingsPanel.tsx`.

Validation: `frontend tsc --noEmit` → 0 errors; `backend pytest` → 24 passed; live azure e2e (above).

## Before / after architecture

```
BEFORE (seed-driven)                          AFTER (telemetry-driven)
──────────────────────                        ────────────────────────
incident_service.MOCK_INCIDENTS               TelemetryProvider.detect_incidents()
  └ INC-2024-0847 (checkout/ORM/P1)             └ UNHEALTHY services only → []  when healthy
        │                                              │
ACTIVE_INCIDENT_ID='INC-2024-0847' ──┐         (no constant) latest real record ──┐
        │                            │                 │                          │
GET /stream ──starts──> orchestrator.run()      POST /investigate ──starts──> orchestrator.run()
   (every mount = NEW run, nav restart)         GET /stream = READ-ONLY (watch; never starts)
        │                            │                 │                          │
agent.run(): LLM fail → _mock_investigate       agent.run(): LLM fail → empty FAILED finding
   (checkout data into live UI)                    (no fabrication)
        │                            │                 │                          │
investigations.json: 14× INC-2024-0847          investigations.json: []  (only real runs persist)
        │                                              │
Analytics/History/Agents aggregate 14 fakes     Analytics/History/Agents aggregate real runs → EMPTY
        ▼                                              ▼
Dashboard: fake INC-2024-0847, 3 svc,           Dashboard: album-api healthy (REAL),
   12k users, $50.4k/hr, 100% success              "No active incidents", empty history/analytics
```

## Proof: every remaining displayed value is REAL / DERIVED / LLM_ESTIMATED

1. **Incidents** come only from `detect_incidents()` (UNHEALTHY telemetry), explicit
   user creation, or a persisted record — there is no other code path. Healthy
   album-api ⇒ `/api/incidents/active = []`. (REAL/EMPTY)
2. **Severity / root cause / blast radius / users / cost / recommendations** come
   from o4-mini agents (`_investigate`) over real telemetry, persisted to the
   record; the live path can no longer fall back to mock data. Absent ⇒ `'—'`.
   (LLM_ESTIMATED/EMPTY, with on-screen provenance for the impact KPIs)
3. **History / Analytics / Agents** are pure aggregations of
   `investigation_store` (now `[]`) — `has_data:false`, no 104/100% constants.
   (DERIVED/EMPTY)
4. **Monitored services** are live KQL health from Application Insights. (REAL)
5. **No nav restart:** `GET /stream` no longer starts a run; only `POST
   /investigate` does. The live queue starts empty and resets only on a real
   `investigation.started`. Navigating Dashboard→History→Dashboard re-subscribes
   without restarting execution.

**Result:** when `album-api` is healthy, OpsPilot shows the real service as healthy
and **"No active incidents"**, with empty History/Analytics/Agents — and no code
path can manufacture an incident, metric, or investigation without telemetry
evidence.
