# OpsPilot — Judges' Guide

_A 5-minute tour. OpsPilot is an AI-powered, multi-agent SRE command center for the Microsoft Agents League._

## 1. What OpsPilot does
When a production incident fires, OpsPilot dispatches a team of specialized AI agents that investigate in parallel, correlate evidence into a timeline, determine a confidence-scored root cause, and propose ranked, executable remediations — all streamed live to an Azure-Portal-style command center.

## 2. Problem statement
Incident response is slow and tribal: an on-call engineer manually pivots across metrics, logs, deployments, and history under pressure. OpsPilot compresses that triage into an autonomous, evidence-backed, sub-5-minute investigation — and **escalates to a frontier reasoning model only when confidence is low**, keeping cost and latency down.

## 3. Architecture overview
- **Frontend:** React + TypeScript + **Fluent UI v9** — incident lifecycle, drawers, reporting, history; live updates over **SSE**.
- **Backend:** **FastAPI**. A **provider abstraction** (`AIProvider`) selects execution centrally via `EXECUTION_MODE` (`mock` | `foundry` | `auto`).
- **Agents:** Commander, Metrics, Logs, Deployment, Time Machine, Root Cause, Deep Reasoning, Recommendation.
- **Orchestration:** a compiled **LangGraph** workflow.
- Runs with **zero credentials** (mock mode) — flip one env var for live Azure AI Foundry.

## 4. Agent workflow
`Commander` triages → `Metrics`, `Logs`, `Deployment` gather evidence → `Time Machine` correlates a causal timeline → `Root Cause` synthesizes a hypothesis → **confidence decision** → (escalate if low) → `Recommendation` produces ranked fixes.

## 5. Foundry integration
Each agent is routed by **`ModelRole`** to a configurable deployment — **GPT-4o** (commander/synthesis), **GPT-4o-mini** (specialists), **o4-mini** (reasoning). `FoundryProvider` handles o4-mini's parameter rules (no `temperature`, no `max_tokens`) and structured (schema-validated) output. See `foundry-validation.md`.

## 6. LangGraph workflow
A `StateGraph` over `OpsPilotState`:
```
START → metrics → logs → deployment → time_machine → root_cause
      → confidence_decision ──(< threshold)──→ deep_reasoning ─┐
                            └──(≥ threshold)───────────────────┴→ recommendation → END
```
Conditional edges implement the escalation branch; agents are pure nodes.

## 7. Reasoning escalation (the differentiator)
After root cause, OpsPilot computes a **combined confidence**. If it's below the threshold (default 70), it routes the full context to the **o4-mini** `DeepReasoningAgent`, which re-examines the evidence from first principles and returns a refined root cause + reasoning trace — then feeds it into recommendations. o4-mini stays **off the hot path** unless needed.

## 8. Demo steps
```bash
# Backend (mock mode — no credentials)
cd opspilot/backend && uvicorn app.main:app --port 8000
# Frontend
cd opspilot/frontend && npm install && npm run dev    # http://localhost:3000
```
1. **Dashboard** — incident summary, Investigation Queue (click a row → agent drawer), recommendation tiles (click → execution drawer).
2. **Execute** a remediation → confirm → watch lifecycle move Mitigating → Monitoring; **Mark Resolved** → **Close**.
3. **Generate Report** (command bar) → sectioned report → Download/Copy; **Export** JSON.
4. **History** → closed incident → reopen details.
5. **Provider smoke test:** `POST /api/test/foundry {"message":"...","role":"reasoning"}` → shows provider + model (`o4-mini`) + response.
6. **See the o4-mini reasoning agent live:** set `LOW_CONFIDENCE_DEMO=true`, create an incident → escalation fires and the timeline shows the reasoning step.

## 9. Known limitations
In-memory persistence (single-replica; no Cosmos/Redis/Search wired), several read endpoints are mock-backed, and the live Foundry path is wired + unit-tested but requires credentials to exercise end-to-end. Full list in `release-readiness.md`.

## 10. Future roadmap
Cosmos persistence + LangGraph checkpointing (resume/replay), AI Search episodic memory, real telemetry tools (Azure Monitor / Log Analytics / K8s), Entra ID auth, and multi-incident routing.

---
**Validation:** `pytest` 24 ✓ · `tsc --noEmit` ✓ · `vite build` ✓ · `vitest` 2 ✓.
**More docs:** `release-readiness.md` · `foundry-validation.md` · `dead-code-audit.md`.
