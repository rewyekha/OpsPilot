# OpsPilot — Release Readiness

_Generated for Phase 5 (stabilization & hardening). Verification only — nothing was auto-merged._

## Branch & commit

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD commit | `b97e24a` — _feat: implement reasoning escalation and langgraph orchestration_ |
| Phase 1–4 | **Committed** on `main` (consolidated from feature branches) |
| Phase 5 | **Uncommitted working-tree changes** (15 modified, 5 new) — pending review/commit |
| Merge conflicts | **None** (no conflict markers anywhere in `app/` or `src/`) |
| Untracked implementation files | `backend/app/api/security.py`, `backend/tests/unit/test_security.py`, `frontend/.env.example`, `frontend/src/components/shared/ErrorBoundary.test.tsx`, `frontend/vitest.config.ts` — all **new Phase 5 files**, not orphans |

## Implemented phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Provider abstraction (`Mock`/`Foundry`/factory), `EXECUTION_MODE`, `/api/test/foundry` | ✅ |
| 2 | Agents migrated to `AIProvider` + `structured_generate`; `ModelRole` routing (gpt-4o / gpt-4o-mini / o3) | ✅ |
| 3 | Reasoning escalation — `DeepReasoningAgent` (o3), combined-confidence threshold | ✅ |
| 4 | **LangGraph** workflow (`graph.py` `StateGraph`), conditional reasoning node | ✅ |
| 5 | Demo escalation mode, API-key auth, `ErrorBoundary`, configurable URLs, exception logging, docs, tests | ✅ |

## Build & test status

| Gate | Command | Result |
|---|---|---|
| Frontend typecheck | `npm run typecheck` (`tsc --noEmit`) | ✅ pass |
| Frontend build | `npm run build` (`tsc && vite build`) | ✅ pass (one pre-existing >500 kB Fluent chunk warning) |
| Frontend tests | `npm run test` (vitest) | ✅ 2 passed (ErrorBoundary) |
| Backend tests | `pytest` | ✅ 24 passed (providers 7, reasoning 6, graph 6, security 5) |

Runs with **zero Azure credentials** (`EXECUTION_MODE=mock` default).

## Known limitations

- **Persistence is in-memory** — incidents (`incident_service.MOCK_INCIDENTS`) and the SSE bus (`event_stream`, in-process `asyncio.Queue`) do not survive restart and are **single-replica only**. `cosmos_db.py` / `ai_search.py` are intentionally empty (out of scope).
- **Live Foundry path is unverified end-to-end** — wired and unit-tested in mock; a real call requires credentials (see `foundry-validation.md`). o3 structured output uses `beta.parse`; may need per-deployment adjustment.
- **Mock data services** back several read endpoints (agent activity, timeline, recommendations).
- **Dead/scaffold files** remain (see `dead-code-audit.md`); none are imported on the live path.
- **Telemetry/tools** (Azure Monitor, Log Analytics, K8s, AI Search memory) are mock/stub.
- Frontend bundle is a single ~750 kB chunk (Fluent UI); acceptable for the demo.
