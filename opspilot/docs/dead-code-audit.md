# Dead Code Audit

_Report only — nothing was deleted. Classification: **(1) Safe to delete**, **(2) Future roadmap**,
**(3) Currently unused**. Verify imports before removing anything._

> Empty `__init__.py` files are **excluded** — they are required Python package markers, not dead code.

## 1. Safe to delete (superseded; not imported on any path)

| File | Why |
|---|---|
| `frontend/src/pages/{CommandCenter,IncidentDetail,Agents,History,Settings}.tsx` | Routing is done by `AppShell` state-switch; these page components are never rendered/imported. |
| `frontend/src/components/agents/AgentCard.tsx`, `AgentStatusBadge.tsx` | Superseded by the Investigation Queue table + `AgentDetailsDrawer` + shared badges. (empty) |
| `frontend/src/components/incident/IncidentHeader.tsx`, `IncidentList.tsx` | Superseded by `IncidentPanel` + Incident Summary strip. (empty) |
| `frontend/src/components/recommendations/RecommendationCard.tsx` | Superseded by recommendation tiles + `RecommendationDrawer`. (empty) |
| `frontend/src/components/risk/BusinessImpactCard.tsx`, `summary/ExecutiveSummary.tsx`, `timeline/TimelineEvent.tsx` | Superseded by KPI strip / ReportDrawer / timeline rows. (empty) |
| `frontend/src/components/shared/LoadingSpinner.tsx` | Superseded by Fluent `Spinner`. (empty) |
| `frontend/src/store/agentStore.ts`, `uiStore.ts` | Superseded by `SessionContext` / `PreferencesContext` / `FilterContext`. (empty) |
| `backend/app/agents/{deployment,logs,time_machine}/prompts.py` | Empty; those agents define prompts inline. |
| `backend/app/observability/metrics.py` | Empty; no importers. |

## 2. Future roadmap (intentionally empty; planned integrations — keep)

| File | Planned use |
|---|---|
| `backend/app/services/cosmos_db.py` | Incident persistence + LangGraph checkpointer. |
| `backend/app/services/ai_search.py` | Episodic/semantic incident memory. |
| `backend/app/tools/infra_tools.py` | K8s / ARM / Service Health (docstring stub). |
| `backend/app/tools/memory_tools.py` | AI Search retrieval tools (docstring stub). |
| `backend/app/api/middleware/auth.py` | Entra ID / MSAL bearer auth (docstring stub; Phase 5 added a simpler `security.py` API-key gate instead). |

## 3. Currently unused (has content, off the live path — verify before removing)

| File / symbol | Notes |
|---|---|
| `backend/app/services/foundry.py` — `FoundryClient` / `get_foundry_client()` | **Orphaned after the Phase 2 migration** to `AIProvider`. No remaining importers. Strongest cleanup candidate; retained only to avoid churn. Recommend deletion in a dedicated cleanup commit. |
| `frontend/src/data/mock{Incident,Recommendations,AgentActivity,Timeline}.ts` | Demo fixtures; the live panels read API hooks. Confirm no imports, then remove or keep as offline fixtures. |
| `backend/tests/integration/test_*.py`, `tests/unit/test_models.py`, `tests/unit/test_tools.py` | **Empty test stubs** (0 bytes). Either implement or delete so the suite looks intentional. |

## Recommendation

- **Highest value:** remove the orphaned `FoundryClient` (§3) — it's the only item that actively confuses the architecture (two model clients).
- The §1 empty files are harmless but make the repo read as unfinished to a browsing judge; a single "prune scaffolding" commit improves perceived polish.
- Keep §2 — they signal the roadmap and are referenced in docs.
