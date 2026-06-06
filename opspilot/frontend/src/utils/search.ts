/**
 * Global search provider.
 *
 * The UI talks to a single `search(query)` function; the data source behind it
 * is swappable. Today it queries a static in-memory index (mock). To go live,
 * replace `mockSearch` with a fetch to a backend `/api/search?q=` endpoint that
 * returns the same `SearchResult[]` shape — no call-site changes required.
 */

export type SearchCategory =
  | 'incident'
  | 'agent'
  | 'recommendation'
  | 'timeline'
  | 'finding'

export interface SearchResult {
  id: string
  category: SearchCategory
  title: string
  subtitle: string
  /** Page id the result routes to (consumed by the shell). */
  target: string
}

export const CATEGORY_LABELS: Record<SearchCategory, string> = {
  incident: 'Incidents',
  agent: 'Agents',
  recommendation: 'Recommendations',
  timeline: 'Timeline Events',
  finding: 'Findings',
}

// Navigational index only — agents + workspaces. Contains NO hardcoded incident
// data (ids, confidence, findings, recommendations). Real incident/finding search
// is served from the persisted investigation store.
const INDEX: SearchResult[] = [
  { id: 'agent-commander', category: 'agent', title: 'Commander Agent', subtitle: 'Incident triage & orchestration', target: 'agents' },
  { id: 'agent-metrics', category: 'agent', title: 'Metrics Agent', subtitle: 'APM & infrastructure telemetry', target: 'agents' },
  { id: 'agent-logs', category: 'agent', title: 'Logs Agent', subtitle: 'Log analytics & pattern recognition', target: 'agents' },
  { id: 'agent-deployment', category: 'agent', title: 'Deployment Agent', subtitle: 'Change intelligence & release analysis', target: 'agents' },
  { id: 'agent-time_machine', category: 'agent', title: 'Time Machine Agent', subtitle: 'Historical baseline & anomaly correlation', target: 'agents' },
  { id: 'agent-root_cause', category: 'agent', title: 'Root Cause Agent', subtitle: 'Hypothesis synthesis & ranking', target: 'agents' },
  { id: 'agent-recommendation', category: 'agent', title: 'Recommendation Agent', subtitle: 'Remediation planning', target: 'agents' },
]

function mockSearch(query: string): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return INDEX.filter(
    (r) =>
      r.id.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.subtitle.toLowerCase().includes(q) ||
      r.category.includes(q),
  ).slice(0, 12)
}

/** The seam the UI depends on. Swap the body for a real backend call later. */
export function search(query: string): SearchResult[] {
  return mockSearch(query)
}

/** Group flat results by category, preserving category order. */
export function groupResults(results: SearchResult[]): [SearchCategory, SearchResult[]][] {
  const order: SearchCategory[] = ['incident', 'agent', 'recommendation', 'timeline', 'finding']
  return order
    .map((cat): [SearchCategory, SearchResult[]] => [cat, results.filter((r) => r.category === cat)])
    .filter(([, rs]) => rs.length > 0)
}
