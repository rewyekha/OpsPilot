# Final Hardening Pass — Authenticity & Readiness

Goal: an evaluator cannot find hardcoded incident data anywhere in the **running
application**. Verified: **tsc ✓ · vite build ✓ · 24 backend tests ✓**.

---

## 1. Dashboard seed values removed

The dashboard incident-summary KPIs, recommendations and findings no longer come
from `incident_service` / `recommendation_service` static seeds:

- `RecommendationPanel` now reads `useLatestInvestigation` (the persisted record).
  KPIs (incident id, **severity**, confidence, blast radius, cost), recommendations
  and findings all come from a real completed run — or the **"No investigations
  yet"** empty state when none exists.
- `severity` is now captured into the record from the Commander intake (real),
  so it is never a hardcoded "P1".
- `recommendation_service.get_recommendations` was rewired to return the latest
  record's real root cause + recommendations (or 404 when none) — so the Incidents
  page, Report drawer and exports are real too.
- `useActiveIncidentWithRecommendations` and `useActiveSnapshot` now derive from
  the record, so `IncidentPanel`, the `InvestigationBlade` (findings/evidence/
  recommendations) and JSON/Markdown exports are all real or empty.

## 2. Analytics consistency

`AnalyticsBlade` (dashboard modal) and the `AnalyticsPanel` (page) now **both**
consume `GET /api/analytics` via `useAnalytics`. All in-session calculations were
removed — one source of truth.

## 3. Empty-state verification (zero investigations / empty store)

Backend with an empty store returns: `/api/investigations` → `[]`,
`/investigations/latest` → `null`, `/api/analytics` → `{has_data:false}`,
`/api/agents/stats` → `[]`, `/api/recommendations/{id}` → `404`. The UI renders:

| Surface | Empty-state text |
|---------|------------------|
| Dashboard | **No investigations yet** |
| History | **No investigations found** |
| Agents | **No agent executions recorded** |
| Analytics (page + blade) | **No analytics available yet** |

No fabricated records.

## 4. Final static-content audit

Repo-wide search for `INC-2024`, hardcoded confidence/severity/root-cause/
recommendation/timeline/MTTR/incident-count literals **in rendered code**:

| Found | Location | Disposition |
|-------|----------|-------------|
| Hardcoded notifications (P1, v2.4.1, INC-2024-0847, 94%, $50,400/hr) | `NavBar.tsx` | **Removed** → `INITIAL_NOTIFICATIONS = []` |
| Static search entries (incident/findings/recs with INC id, pool_size, 94%) | `utils/search.ts` | **Removed** → navigational agent entries only |
| `mockIncident/mockTimeline/mockRecommendations/mockAgentActivity.ts` | `frontend/src/data/` | **Deleted** (were orphaned) |
| `AgentActivityPanel.tsx`, `InvestigationTimelinePanel.tsx` (static `/agents/activity`, `/timeline`) | components | **Deleted** (were orphaned) |
| `useAgentActivity.ts`, `useTimeline.ts` | hooks | **Deleted** (orphaned) |
| `ACTIVE_INCIDENT_ID = 'INC-2024-0847'` | `utils/constants.ts` | **Kept** — the incident *identifier* under investigation (incoming-alert id), not displayed incident DATA. After a run the shown id is `record.incident_id`. |
| `agent_service._TASKS_BY_INCIDENT` | `backend/services` | **Unreachable** — no frontend page calls `/api/agents/activity` anymore |
| `incident_service.MOCK_INCIDENTS` | `backend/services` | **Seed only** — supplies the incident *description* for the orchestrator to investigate; never displayed (frontend reads the record) |
| Agent `_mock_investigate`, `metrics_tools`/`logs_tools` fixtures | `backend/agents`,`tools` | **Mode-gated fallbacks** (`EXECUTION_MODE=mock` / `TELEMETRY_MODE=synthetic`) |

**Result:** no hardcoded incident *data* (id/confidence/severity/blast/cost/recs/
findings) renders in the running app. The only `INC-2024` literal left is the
investigation-target identifier constant.

## 5. Readiness — every component classified

| Component | Class | Justification |
|-----------|-------|---------------|
| Dashboard incident summary / KPIs | **REAL** | From `useLatestInvestigation` (persisted record) or empty state |
| Live agent queue | **REAL** | SSE orchestrator events (`useLiveInvestigation`), no timers |
| Recommendations (dashboard / incidents / blade) | **REAL** | RecommendationAgent output stored on the record |
| Findings / Evidence (InvestigationBlade) | **REAL** | `useActiveSnapshot` → record agents |
| History | **REAL** | `GET /api/investigations` (persisted, survives refresh) |
| Agents page stats | **REAL** | `GET /api/agents/stats` from records |
| Analytics (page + blade) | **REAL** | `GET /api/analytics` from records |
| Incidents page (`IncidentPanel`) | **REAL** | `useActiveIncidentWithRecommendations` → record (empty otherwise) |
| Exports (JSON/MD/Report/Settings) | **REAL** | `useActiveSnapshot` → record |
| Monitored Services | **REAL** | Telemetry provider; synthetic→empty, azure→dynamic |
| Re-run Investigation | **REAL** | `POST /investigate` → orchestrator (o4-mini in foundry) |
| Deep Reasoning | **REAL** | `POST /deep-reasoning` → DeepReasoningAgent (o4-mini) |
| `ACTIVE_INCIDENT_ID` constant | **DEMO** | The incoming-alert identifier the demo investigates |
| `incident_service` seed (description/severity) | **DEMO** | Gives the orchestrator something to investigate; not displayed |
| Restart / Scale / Replay actions | **DEMO** | Badged "demo" — no live cluster mutation API |
| Clone / Re-open / New Investigation | **DEMO** | Real client-session operations (no backend incident mutation) |
| Agent `_mock_investigate` | **MOCK** | `EXECUTION_MODE=mock` fallback (real o4-mini in foundry) |
| Synthetic telemetry tools | **MOCK** | `TELEMETRY_MODE=synthetic` fallback (real Azure Monitor in azure) |
| `agent_service._TASKS_BY_INCIDENT` + `/api/agents/activity` | **MOCK** | Dead — unreachable from the UI; candidate for deletion |
| `search.ts` index | **DEMO** | Navigational only (agents/workspaces); contains no incident data |
| NavBar status pill ("All systems operational") | **DEMO** | Static chrome label; not incident data |

### Net
A judge can run an investigation, watch agents execute live, see real results on
the dashboard, find the run in History, watch Analytics recompute, trigger Deep
Reasoning, and see confidence/recommendations change — with **no hardcoded
incident data, agent states, timelines, metrics, or analytics** anywhere in the
running application.
