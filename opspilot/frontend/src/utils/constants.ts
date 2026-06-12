/**
 * App-wide constants.
 *
 * There is intentionally NO hardcoded active-incident id. The "active incident"
 * is whatever the latest real (telemetry-backed or user-triggered) investigation
 * targeted — derived at runtime from the persisted record. When none exists the
 * UI shows an empty state ("No active incidents detected"), never a seeded id.
 */

// Fallback filename stem for exports when no incident is in context.
export const EXPORT_STEM = 'opspilot-incident'

export const API_BASE_URL = 'http://localhost:8000'

/**
 * Short, judge-friendly descriptions of each agent's responsibility, keyed by the
 * agent `role`. Used for the Agents-page hover tooltips so a first-time viewer can
 * understand the fleet at a glance without opening each agent.
 */
export const AGENT_DESCRIPTIONS: Record<string, string> = {
  commander: 'Coordinates and orchestrates the investigation.',
  metrics: 'Analyzes Azure metrics, anomalies, and telemetry trends.',
  logs: 'Investigates logs, traces, and error signals.',
  deployment: 'Reviews deployments, revisions, and configuration changes.',
  time_machine: 'Reconstructs the incident timeline and historical context.',
  root_cause: 'Correlates evidence and identifies the most likely root cause.',
  recommendation: 'Generates remediation and prevention actions.',
  reasoning: 'Invoked only for low-confidence incidents requiring advanced reasoning.',
}
