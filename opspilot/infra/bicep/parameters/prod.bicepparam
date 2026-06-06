using '../main.bicep'

// ── Production environment ───────────────────────────────────────────────────
param environmentName = 'prod'
param location = 'eastus2'
param namePrefix = 'opspilot'

param deployContainerRegistry = true

// Longer retention; no daily cap (do not drop telemetry in prod).
param logRetentionInDays = 90
param logDailyQuotaGb = -1

// Protect production secrets from accidental/early deletion.
param keyVaultPurgeProtection = true
