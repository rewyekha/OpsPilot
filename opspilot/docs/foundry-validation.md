# Azure AI Foundry — Validation Guide

How to validate the `FoundryProvider` (generate + structured_generate) across
**GPT-4o (commander)**, **GPT-4o-mini (specialist)**, and **o4-mini (reasoning)**.

> No real credentials are required to run the app or the test suite — `EXECUTION_MODE=mock`
> is the default and the build never fails when credentials are absent.

## 1. Required environment variables

| Variable | Purpose | Default |
|---|---|---|
| `EXECUTION_MODE` | `mock` \| `foundry` \| `auto` | `mock` |
| `FOUNDRY_ENDPOINT` | Azure OpenAI / Foundry inference endpoint (`https://<res>.openai.azure.com/`) | _(empty)_ |
| `FOUNDRY_API_KEY` | API key; leave empty to use managed identity (`DefaultAzureCredential`) | _(empty)_ |
| `FOUNDRY_API_VERSION` | API version (≥ `2024-08-01-preview` for structured output) | `2024-08-01-preview` |
| `COMMANDER_MODEL_DEPLOYMENT` | deployment for `COMMANDER` role | `gpt-4o` |
| `SPECIALIST_MODEL_DEPLOYMENT` | deployment for `SPECIALIST` role | `gpt-4o-mini` |
| `REASONING_MODEL_DEPLOYMENT` | deployment for `REASONING` role | `o4-mini` |
| `DEV_API_KEY` | optional `X-API-KEY` for the test endpoints (see §4) | _(empty)_ |

`foundry` mode **fails fast** if `FOUNDRY_ENDPOINT` is missing; `auto` falls back to `mock`.

## 2. Reasoning-model (o4-mini) parameter handling

`FoundryProvider` is hardened so the same code path is valid for chat **and** reasoning models:

- **No `temperature`** is sent for the `REASONING` role (o4-mini rejects non-default temperature). Chat models get `temperature=0.2`.
- **No `max_tokens`** is sent (o4-mini uses `max_completion_tokens`); service defaults apply — no unsupported token parameter is ever passed.
- **Structured output** uses `beta.chat.completions.parse(response_format=<PydanticModel>)` with **no temperature**, keeping it valid for gpt-4o / gpt-4o-mini / o4-mini.
- Failures are logged as `foundry.generate.error` / `foundry.structured_generate.error` with **role + deployment + error type only** (never endpoint or key material); the agent then degrades to its mock finding.

## 3. Validation commands

### Mock (no credentials)
```bash
# from opspilot/backend
uvicorn app.main:app --port 8000 &
curl -s -X POST localhost:8000/api/test/foundry \
  -H 'Content-Type: application/json' \
  -d '{"message":"Analyze checkout-service outage","role":"commander"}'
```

### Live Foundry — per role
```bash
export EXECUTION_MODE=foundry
export FOUNDRY_ENDPOINT=https://<resource>.openai.azure.com/
export FOUNDRY_API_KEY=<key>

for ROLE in commander specialist reasoning; do
  curl -s -X POST localhost:8000/api/test/foundry \
    -H 'Content-Type: application/json' \
    -d "{\"message\":\"Why did checkout fail after v2.4.1?\",\"role\":\"$ROLE\"}"
  echo
done
```

## 4. Expected outputs

| Mode | `provider` | `model` (by role) | `response` |
|---|---|---|---|
| mock | `mock` | commander→`gpt-4o`, specialist→`gpt-4o-mini`, reasoning→`o4-mini` | deterministic `[MOCK · <role> · <model>] …` |
| foundry | `foundry` | same deployment names | live model text |

```json
{ "provider": "mock", "model": "o4-mini", "role": "reasoning", "response": "[MOCK · reasoning · o4-mini] …" }
```

## 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `503 EXECUTION_MODE=foundry requires FOUNDRY_ENDPOINT` | foundry mode, no endpoint | set `FOUNDRY_ENDPOINT` or use `auto`/`mock` |
| `401 Invalid or missing X-API-KEY` | `DEV_API_KEY` set | send header `X-API-KEY: <DEV_API_KEY>` |
| `502 Provider call failed` | network/auth/model error (logged as `foundry.*.error`) | check endpoint/key/deployment names + region |
| o4-mini rejects `temperature`/`max_tokens` | wrong params | already handled — `REASONING` sends neither; verify a custom deployment name maps to an actual o4-mini deployment |
| structured output empty/parse error | API version too old or model lacks structured output | use `FOUNDRY_API_VERSION ≥ 2024-08-01-preview`; agent auto-falls back to mock on failure |
