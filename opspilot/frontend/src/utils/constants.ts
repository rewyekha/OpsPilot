/**
 * App-wide constants.
 *
 * The active incident id was previously hardcoded as the string literal
 * 'INC-2024-0847' in at least three components. Centralising it here removes
 * that duplication and gives a single seam to replace with routing/params
 * when multi-incident navigation lands.
 */
export const ACTIVE_INCIDENT_ID = 'INC-2024-0847'

export const API_BASE_URL = 'http://localhost:8000'
