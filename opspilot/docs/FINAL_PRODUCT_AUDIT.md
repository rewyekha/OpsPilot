# OpsPilot — Final Product Audit (UX + Product Completion)

Scope: frontend / UX / usability only. No AI orchestration, Foundry, or Azure
changes. No deployments. Verified: **`tsc` ✓ · `vite build` ✓ (2202 modules) · `vitest` ✓**.

---

## A. Completed improvements

### Phase A — Search bar (critical bug fixed)
- **Root cause:** `GlobalSearch` wrapped `<SearchBox>` in a Fluent `<PopoverTrigger>`. Opening the popover on the first keystroke pulled focus off the input (Fluent popover focus management runs even with `trapFocus={false}`), so only one character could be typed.
- **Fix:** removed the Popover entirely; the input is now permanently mounted with results rendered in a custom anchored dropdown that never steals focus → continuous typing, focus preserved.
- Added **Ctrl/⌘+K** global focus shortcut, a **clear (X)** button (native SearchBox dismiss), arrow-key navigation, Enter-to-open, Esc/outside-click to dismiss, and ARIA combobox/listbox roles.
- Search covers incidents (incl. **incident id**), agents, recommendations, timeline events, and findings.
- Files: `components/command/GlobalSearch.tsx`, `utils/search.ts`.

### Phase B — Settings page (was blank)
- New `components/settings/SettingsPanel.tsx` with five sections, **every control real**:
  - **General** — Theme (current), Timezone (Local/UTC, live), Auto-refresh interval (Off/15s/30s/60s/2m).
  - **Investigation** — Agent timeout, Confidence threshold, Auto-escalation (read-only server config, clearly labelled).
  - **AI** — Model deployment, Execution mode, Telemetry mode, Cost optimization — **read live** from `/api/system/health` + `/api/system/services`.
  - **System** — Backend status, API version (`/health`), App version.
  - **Export** — PDF (print dialog), JSON, Markdown — all functional downloads.
- Preferences now **persist to localStorage** and auto-refresh is wired into the shell.
- Files: `components/settings/SettingsPanel.tsx`, `hooks/useSystemInfo.ts`, `api/system.ts`, `store/PreferencesContext.tsx`.

### Phase C — Analytics page (new)
- New nav item + `components/analytics/AnalyticsPanel.tsx` with 5 views from **real** data: Incident Volume (per-day), Agent Performance (confidence), Investigation Duration (per agent), Recommendation Distribution (rollback/hotfix/scale), Severity Distribution (P1/P2/P3) + KPI stat row.
- Dependency-free SVG/CSS chart kit (`components/analytics/charts.tsx`) — no chart library added. Per-card empty states; full-page empty state when no investigation data exists.

### Phase D — History improvements
- Statistics header (total incidents, avg duration, root causes identified, total impact), **time-range filters** (Today/7d/30d/All), **search**, **Re-open incident** action (`reopenIncident` added to SessionContext), **Export Report** (JSON), and production empty states.

### Phase E — Agents improvements
- New `AgentHealthOverview` (health cards: active agents, completion rate, avg confidence, avg exec time) + **Agent Comparison** table; rows open the existing `AgentDetailsDrawer` (findings, evidence, tools, timeline). Composed above the live activity feed via `AgentsPanel`.

### Phase F — Dashboard improvements
- Monitored Services empty state replaced with the telemetry-aware message ("Telemetry Mode: …" + guidance).
- New `DashboardSummary` with 4 widgets: Investigation Summary, Agent Activity, Investigation Duration, Recent Findings — all from real data.

### Phase G — Incident actions menu
- New `IncidentActionsMenu` on the dashboard header with 7 functional actions: Re-run Investigation (decoupled `opspilot:refresh` event), Export JSON, Export Markdown, Generate Executive Summary (clipboard), Create Follow-up Investigation, Duplicate Investigation, Archive Incident.

### Phase H — Empty states
- Single reusable `components/shared/EmptyState.tsx` (icon + title + body + actions) applied to History, Agents, Analytics, Monitored Services. Removed "not part of the current sprint" placeholder language.

### Phase I — UX polish
- Consistent makeStyles/tokens spacing across new surfaces; loading spinners on Settings/Analytics/Agents; row hover + keyboard activation (tabIndex + Enter/Space) on tables; ARIA labels/roles on search, tablists, listbox; Ctrl+K keyboard entry; localStorage-persisted preferences.

### Phase J — Audit & cleanup
- **Removed 11 dead files** (zero real imports): `pages/{CommandCenter,Settings,History,Agents,IncidentDetail}.tsx`, `store/{agentStore,incidentStore,uiStore}.ts`, `hooks/useAgentStream.ts`, `components/agents/AgentActivityStream.tsx`, `components/shared/LoadingSpinner.tsx`. No dangling references remain.
- De-duplicated snapshot/export logic into `hooks/useActiveSnapshot.ts`.
- Verified: typecheck, production build, tests all green.

---

## B. Unresolved / intentionally out-of-scope items

- **Investigation settings are read-only.** Agent timeout / confidence threshold / auto-escalation are backend env config with no write API; shown as live read-only values rather than fake editable controls. A `PATCH /api/system/config` would make them editable.
- **Confidence "trend"** (Phase E ask) shows the current confidence, not a historical series — the backend exposes a single confidence per agent run, not a time series. Honest single-value rendering instead of a fabricated trend.
- **Analytics breadth is bounded by data.** The demo centers on one active incident, so Incident Volume / Severity Distribution reflect the incidents actually present (active + session-closed). Charts grow as more investigations run; no synthetic padding added.
- **PDF export** uses the browser print dialog (no PDF lib added to keep the bundle lean).
- **Search index is the static seam** (`utils/search.ts`) the project already documented; swapping `search()` for `/api/search?q=` is a one-function change, no call-site edits.

## C. Technical debt

- **Bundle size:** single chunk ~824 kB (gzip ~230 kB), mostly Fluent UI. Pre-existing; consider `manualChunks`/route-level dynamic import if first-load time matters.
- **No ESLint script** in `package.json` (only `typecheck`/`build`/`test`). Adding `eslint` + a `lint` script would catch unused vars/hooks-deps automatically.
- **Single-incident model:** much of the app is keyed to `ACTIVE_INCIDENT_ID`. A multi-incident backend would let History/Analytics show real fleets without client-side session records.
- **`RecommendationPanel.live.test.tsx`** isn't picked up by the default vitest run (naming); only `ErrorBoundary.test.tsx` executes. Worth aligning test globs and adding coverage for the new panels.
- Decoupled `opspilot:refresh` / `opspilot:navigate` window events are pragmatic; a small app router/context would be cleaner long-term.

## D. Judge demo checklist

1. **Search** — focus with **Ctrl+K**, type `checkout` / `INC-2024-0847` / `metrics` → continuous typing, grouped results, ↑↓ + Enter to jump. (Proves the headline bug is fixed.)
2. **Dashboard** — Overview widgets + Monitored Services. With `TELEMETRY_MODE=synthetic` it shows the "No Azure workloads connected" guidance; the single INVESTIGATING status lives in the KPI.
3. **Incident actions** — header **Actions** menu → Export JSON / Markdown, Generate Executive Summary (clipboard), Duplicate / Follow-up / Archive, Re-run.
4. **Analytics** — 5 live charts + KPI row (agent confidence, durations, recommendation split).
5. **History** — time-range filters + search + stats header; open an incident → **Re-open**; **Export Report**.
6. **Agents** — health overview + comparison table → row opens the agent details drawer.
7. **Settings** — flip Timezone + Auto-refresh (persist across reload); AI/System show live backend config; Export buttons work.
8. **Empty states** — every page degrades gracefully with production-ready messaging.

## E. Recommended future roadmap

1. **Backend config API** — make Investigation settings editable (timeout, threshold, escalation) + persist per-tenant.
2. **Multi-incident backend** — real incident list endpoint → History/Analytics over a true fleet; per-agent confidence history for real trends.
3. **Live search endpoint** — replace the static index with `/api/search`.
4. **Bundle splitting + ESLint/CI** — `manualChunks`, a `lint` script, and broaden the vitest globs + add panel tests.
5. **Real PDF export** (e.g. `@react-pdf` or server render) and scheduled exec-summary email.
6. **Theme options** — light theme + density toggle once a second theme is designed.
7. **Re-enable Azure telemetry** (Phase 9 path) so Monitored Services + Analytics show live discovered workloads.

---

### Verification log
```
tsc --noEmit                     → exit 0
vite build (2202 modules)        → exit 0  (dist/assets/index-*.js ~824 kB / gzip 230 kB)
vitest run                       → 2 passed
dead files removed               → 11 (no dangling references)
```
