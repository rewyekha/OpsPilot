// Azure Container Apps module
//
// Deploys:
//   - Container Apps Environment (with Log Analytics workspace)
//   - User-assigned managed identity (shared by all container apps)
//   - opspilot-frontend container app
//   - opspilot-api container app
//   - opspilot-agents container app
//   - Role assignments for managed identity
//
// All containers use the same managed identity. Secrets are injected
// from Key Vault using Key Vault reference bindings — never stored in ACA secrets.

param location string
param environmentName string
param cosmosDbEndpoint string
param aiSearchEndpoint string
param aiFoundryEndpoint string
param keyVaultUri string

// Resource definitions go here during implementation sprint 1
