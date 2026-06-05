# Demo Workloads

Real Azure sample applications that OpsPilot investigates in **`TELEMETRY_MODE=azure`**.
Instead of synthetic fixtures, OpsPilot's `AzureMonitorTelemetryProvider` queries the
Application Insights / Log Analytics telemetry emitted by these live workloads.

> **eShop is intentionally NOT included.** Phase 8 scope is limited to the two
> lightweight Container Apps below to keep the demo footprint (and cost) small.

## Workloads

| Folder | Source | Stack | Container port | External? |
|--------|--------|-------|----------------|-----------|
| [`album-api/`](./album-api) | [Azure-Samples/containerapps-albumapi-javascript](https://github.com/Azure-Samples/containerapps-albumapi-javascript) | Node.js / Express | `8080` | Yes (HTTP API) |
| [`voting-app/`](./voting-app) | [Azure-Samples/azure-voting-app-redis](https://github.com/Azure-Samples/azure-voting-app-redis) | Python / Flask + Redis | `80` | Yes (web UI) |

### `album-api`
Single stateless container exposing a small REST API (`GET /albums`). Built from
`album-api/src/Dockerfile` (`EXPOSE 8080`, `npm start` → `node ./bin/www`).
Good for **latency / error-rate** investigations.

### `voting-app`
Flask web app backed by **Redis**. Reads its backend host from the `REDIS`
environment variable (`port 6379`, optional `REDIS_PWD`). The deploy script
provisions a second internal Container App running `redis:6` and wires the
`REDIS` env var to its internal FQDN. Good for **dependency-failure** investigations
(kill Redis → app errors → OpsPilot root-causes the broken dependency).

## Deploying

Deploy scripts live in [`../infra`](../infra):

```powershell
# From repo root (opspilot/)
./infra/deploy-album-api.ps1   -ResourceGroup rg-opspilot-demo -Location eastus2
./infra/deploy-voting-app.ps1  -ResourceGroup rg-opspilot-demo -Location eastus2
```

Both scripts use `az containerapp up`, which builds the image from the local
source, pushes it to an Azure Container Registry, and deploys it to a shared
Container Apps Environment wired to the Phase 8 Log Analytics workspace +
Application Insights. See [`../infra/ARCHITECTURE.md`](../infra/ARCHITECTURE.md).

## Re-cloning

These folders are shallow clones (`--depth 1`). To refresh:

```powershell
Remove-Item -Recurse -Force demo-workloads/album-api, demo-workloads/voting-app
git clone --depth 1 https://github.com/Azure-Samples/containerapps-albumapi-javascript.git demo-workloads/album-api
git clone --depth 1 https://github.com/Azure-Samples/azure-voting-app-redis.git demo-workloads/voting-app
```
