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
