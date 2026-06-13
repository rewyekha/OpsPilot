using '../main.bicep'

// ── Demo / development environment ───────────────────────────────────────────
param environmentName = 'dev'
param location = 'eastus2'
param namePrefix = 'opspilot'

// Build demo workloads from source → keep the registry.
param deployContainerRegistry = true

// Bound demo cost: short retention + a 1 GB/day ingestion cap.
param logRetentionInDays = 30
param logDailyQuotaGb = 1

// Allow the vault to be fully deleted after the demo.
param keyVaultPurgeProtection = false
