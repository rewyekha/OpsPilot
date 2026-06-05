# Phase 8 — Implementation Plan: Live Telemetry Investigations

This plan details how the `AzureMonitorTelemetryProvider` turns real Azure
telemetry into OpsPilot investigations. The provider skeleton, KQL, and wiring
already exist (`backend/app/telemetry/azure_monitor.py`); this document is the
spec for completing and hardening the four pillars:

1. Application Insights queries (golden-signal metrics)
2. Log Analytics queries (logs / exceptions)
3. Incident generation (telemetry → incident)
4. Root cause analysis (incident → findings → RCA)

All KQL targets the **workspace-based Application Insights** schema projected into
the shared Log Analytics workspace (`opspilot-logs`). Service identity comes from
`AppRoleName` (set per workload via the `OPSPILOT_SERVICE_NAME` / cloud-role
name env var injected by the deploy scripts).

---

## 1. Application Insights queries (metrics)

Maps to `TelemetryProvider.query_error_rate / query_latency_p99 / query_throughput`.
Source table: **`AppRequests`** (one row per HTTP request, `Success`, `DurationMs`).

### Error rate (% failing requests, 1-min bins)
```kql
AppRequests
| where AppRoleName == "{service}" and TimeGenerated > ago(30m)
| summarize total = count(), failures = countif(Success == false)
    by bin(TimeGenerated, 1m)
| extend value = iff(total == 0, 0.0, todouble(failures) / total * 100.0)
| order by TimeGenerated asc
| project timestamp = TimeGenerated, value
```

### p99 latency (ms, 1-min bins)
```kql
AppRequests
| where AppRoleName == "{service}" and TimeGenerated > ago(30m)
| summarize value = percentile(DurationMs, 99) by bin(TimeGenerated, 1m)
| order by TimeGenerated asc
| project timestamp = TimeGenerated, value
```

### Throughput (requests/sec, 1-min bins)
```kql
AppRequests
| where AppRoleName == "{service}" and TimeGenerated > ago(30m)
| summarize value = todouble(count()) / 60.0 by bin(TimeGenerated, 1m)
| order by TimeGenerated asc
| project timestamp = TimeGenerated, value
```

### Dependency failures (for cascade detection — voting-app → redis)
```kql
AppDependencies
| where AppRoleName == "{service}" and TimeGenerated > ago(30m)
| summarize total = count(), failures = countif(Success == false)
    by Target, DependencyType, bin(TimeGenerated, 1m)
| where failures > 0
| order by TimeGenerated asc
```

**To do**
- [ ] Add `query_dependencies(service)` to the provider + a Dependency agent hook.
- [ ] Anomaly onset: replace the simple `peak > 3×baseline` heuristic with
      `series_decompose_anomalies()` over the binned series.
- [ ] Cache results per `(service, metric)` for the request's lifetime to cut
      workspace query volume / cost.

---

## 2. Log Analytics queries (logs / exceptions)

Maps to `TelemetryProvider.query_error_logs`.
Sources: **`AppExceptions`** (App Insights) and **`ContainerAppConsoleLogs_CL`**
(raw stdout/stderr from the Container Apps).

### Grouped exceptions (type, count, first seen, sample)
```kql
AppExceptions
| where AppRoleName == "{service}" and TimeGenerated > ago(30m)
| summarize count = count(), first = min(TimeGenerated),
            sample = any(OuterMessage), stack = any(Details)
    by type = ExceptionType
| order by count desc
```

### Raw container error logs (for stack traces App Insights misses)
```kql
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == "{service}" and TimeGenerated > ago(30m)
| where Log_s has_any ("ERROR", "Exception", "Traceback", "FATAL")
| project TimeGenerated, Log_s
| order by TimeGenerated desc
| take 100
```

**To do**
- [ ] Merge `AppExceptions` (structured) with `ContainerAppConsoleLogs_CL` (raw)
      so the Logs agent sees both the typed exception and the full trace.
- [ ] Normalize `Details` (JSON array of frames) into the existing
      `LogEntry.stack_trace` string shape the Logs agent already consumes.

---

## 3. Incident generation

Maps to `TelemetryProvider.detect_incidents`. Goal: turn a stream of telemetry
into a small set of *investigation-worthy* incidents — no human filing required.

### Detection query (threshold scan across all services)
```kql
AppRequests
| where TimeGenerated > ago(5m)
| summarize total = count(), failures = countif(Success == false),
            p99 = percentile(DurationMs, 99)
    by AppRoleName
| extend errorRate = iff(total == 0, 0.0, todouble(failures) / total * 100.0)
| where errorRate >= 10.0 or p99 >= 1000.0     // unhealthy thresholds
| project AppRoleName, errorRate, p99, total, failures
```

### Pipeline
1. **Poll** the detection query on a timer (e.g. every 60 s) — a background task
   or an Azure Monitor scheduled alert webhook into `POST /api/incidents`.
2. **Classify severity** from breach magnitude:
   - P1: errorRate ≥ 25% or p99 ≥ 2000 ms
   - P2: errorRate ≥ 10% or p99 ≥ 1000 ms
   - P3: degraded (errorRate ≥ 1% or p99 ≥ 250 ms)
3. **Deduplicate**: keep an open incident per `(service, signal)`; suppress
   re-firing while one is open (mirrors commit `1e68b5d` — "prevent SSE
   reconnects from re-running investigations").
4. **Seed `OpsPilotState`**: `incident_description` from the breached signal,
   `affected_services=[AppRoleName]`, then hand off to the existing orchestrator.

**To do**
- [ ] Add `app/services/incident_detector.py` — async poller calling
      `provider.detect_incidents()` and opening incidents via the event stream.
- [ ] Persist open-incident keys (Cosmos) so dedup survives restarts.
- [ ] Optional: replace polling with Azure Monitor alert rules → webhook (lower
      cost, lower latency).

---

## 4. Root cause analysis

The existing multi-agent graph (Metrics → Logs → Deployment → Time Machine →
Root Cause → Recommendation → Commander) is **unchanged**. Phase 8 only swaps the
*data source* feeding the specialist agents, via the TelemetryProvider seam.

### Wiring the agents to the provider (the one remaining code change)
Today `MetricsAgent` / `LogsAgent` import the fixture functions directly:
```python
from app.tools.metrics_tools import query_error_rate, query_latency_p99, ...
```
Switch them to the provider so they honor `TELEMETRY_MODE`:
```python
from app.telemetry import get_telemetry_provider
tp = get_telemetry_provider()
error_rate = tp.query_error_rate(primary)     # synthetic OR azure, transparently
latency    = tp.query_latency_p99(primary)
logs       = tp.query_error_logs(primary)
```
Because `SyntheticTelemetryProvider` returns the **same** `MetricSeries` /
`LogQueryResult` shapes the agents already parse, this is a drop-in change with
zero behavioral difference in synthetic mode.

### RCA flow for the canonical demo (voting-app loses redis)
1. **Incident generation** detects voting-app errorRate spike (redis down).
2. **Metrics agent** (`query_error_rate` + `query_latency_p99`): error spike,
   latency climb, throughput collapse.
3. **Logs agent** (`query_error_logs`): `redis.exceptions.ConnectionError` from
   `AppExceptions` + container traces.
4. **Dependency signal** (`AppDependencies`): redis Target failures = 100%.
5. **Root Cause agent** synthesizes: *"voting-app failing because its Redis
   dependency is unreachable (all dependency calls failing since T0)."*
6. **Recommendation agent**: scale `voting-redis` back up / restore the
   dependency.
7. **Reasoning escalation** (o4-mini) fires if combined confidence < threshold
   (existing `reasoning_escalation_threshold` behavior, unchanged).

**To do**
- [ ] Point `MetricsAgent` / `LogsAgent` at `get_telemetry_provider()` (above).
- [ ] Add a lightweight Dependency agent (or fold `AppDependencies` into Metrics).
- [ ] Feed `detect_incidents()` output into the Root Cause prompt as the
      triggering signal, improving first-pass confidence.

---

## Configuration checklist (to go live)

```dotenv
# backend/.env
TELEMETRY_MODE=azure
AZURE_LOG_ANALYTICS_WORKSPACE_ID=<workspace customerId GUID>
APPLICATIONINSIGHTS_CONNECTION_STRING=<shared App Insights connection string>
# plus existing Foundry settings for the LLM path
EXECUTION_MODE=foundry
FOUNDRY_ENDPOINT=...
```

Python deps for the Azure path:
```
pip install azure-monitor-query azure-identity
```

RBAC for the backend identity (managed identity or `az login` locally):
- **Monitoring Reader** on `opspilot-logs` + `opspilot-appinsights`
- **Reader** on `rg-opspilot-demo` (to enumerate Container Apps)

## Sequencing

| Step | Work | Outcome |
|------|------|---------|
| 1 | Deploy workloads (`deploy-*.ps1`) | album-api / voting-app emitting telemetry |
| 2 | Set `.env` + install azure deps | `GET /api/system/services` returns live health |
| 3 | Point Metrics/Logs agents at provider | Agents investigate live data |
| 4 | Add `incident_detector.py` poller | Incidents auto-open from telemetry |
| 5 | Add Dependency agent + RCA prompt tweak | End-to-end live RCA (redis demo) |
