// Azure AI Foundry module
//
// Deploys:
//   - Azure AI Hub (workspace-level resource)
//   - Azure AI Project (opspilot-foundry)
//   - Azure OpenAI resource with deployments:
//       gpt-4o            (Commander Agent + Time Machine Agent)
//       gpt-4o-mini       (Metrics, Logs, Deployment agents)
//       o3                (deep reasoning fallback — gated by feature flag)
//       text-embedding-3-large (Azure AI Search indexing)
//
// The AI Foundry project provides:
//   - Tracing for all LLM calls (OpenTelemetry compatible)
//   - Prompt Registry for versioned agent system prompts
//   - Evaluation Hub for golden dataset eval runs

param location string
param environmentName string
param projectName string

// Resource definitions go here during implementation sprint 1
