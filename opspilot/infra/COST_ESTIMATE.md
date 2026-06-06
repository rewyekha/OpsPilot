# OpsPilot — Demo Cost Estimate

Pay-as-you-go list prices, **East US 2**, low-traffic demo. Estimates only — verify
with the [Azure Pricing Calculator](https://azure.com/e/) for your subscription.
Azure AI Foundry is an **external dependency** and is billed on your existing
account; o4-mini inference is shown separately.

## Monthly estimate (core infra + both demo workloads, left running)

| Resource | Basis | ~Monthly (USD) |
|----------|-------|----------------|
| Container Apps — album-api | Consumption; scales to zero when idle, light vCPU/mem-sec | $2 – $8 |
| Container Apps — voting-app | Consumption; light traffic | $2 – $8 |
| Container Apps — voting-redis | **min 1 replica (always-on)** ~0.25 vCPU / 0.5 GiB | $8 – $14 |
| Container Apps Environment | No base fee (consumption) | $0 |
| Azure Container Registry (Basic) | $0.167/day fixed | ~$5 |
| Log Analytics ingestion | ~1–2 GB/mo (≤ 5 GB/mo often free) | $0 – $6 |
| Application Insights | Billed via the workspace (same ingestion) | included |
| Managed Identity / Key Vault | Identity free; KV ~$0.03/10k ops | < $1 |
| **Core + workloads total** | | **≈ $20 – $42 / month** |
| **o4-mini (Foundry)** | event-driven; ~$0.05–0.20 per investigation | **< $5 / mo at demo volume** |

The **always-on Redis** is the largest fixed cost. Scale it to zero between demos.

## Demo-day estimate (a few hours)

| Item | ~Cost |
|------|-------|
| Container Apps (3 apps, few hours active) | $0.30 – $1.50 |
| ACR Basic (prorated) | ~$0.02 |
| Log Analytics (≪ 1 GB) | $0 (free tier) |
| o4-mini (dozens of investigations) | $1 – $3 |
| **Demo-day total** | **≈ $1.50 – $5** |

## Cleanup steps (stop all charges)

```powershell
# 1. Remove demo workloads (Foundry preserved)
./scripts/destroy-demo-apps.ps1 -ResourceGroup rg-opspilot

# 2. Also remove core infra (never Foundry, never the RG)
./scripts/destroy-demo-apps.ps1 -ResourceGroup rg-opspilot -IncludeCoreInfra -Force

# 3. Verify only Foundry remains
az resource list -g rg-opspilot -o table
```
Log Analytics is deleted with `--force` (no soft-delete retention). Key Vault
soft-deletes (7-day) — purge with `az keyvault purge -n <name>` if you need the name back.

## Cost-saving recommendations

1. **Scale Redis to zero when idle** — `az containerapp update -n voting-redis -g rg-opspilot --min-replicas 0 --max-replicas 0` (also the canonical dependency-failure demo). Removes the biggest fixed cost.
2. **Skip the registry** — deploy `deploy-core-infra.ps1 -DeployContainerRegistry:$false` and use prebuilt public images / an existing ACR; saves ~$5/mo.
3. **Cap Log Analytics** — the `dev` params set a 1 GB/day ingestion cap + 30-day retention. Keep ≤ the 5 GB/mo free grant.
4. **Deploy one workload at a time** — the runbook deploys album-api then voting-app independently; tear down each after its demo.
5. **o4-mini only** — OpsPilot is pinned to o4-mini (no GPT-4o); investigations are event-driven (no polling), so Foundry spend tracks actual demo usage.
6. **Delete the resource group** only if it does **not** host Foundry. Here it does — use the destroy script (resource-by-resource) instead of `az group delete`.
