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

// ── Mock index ────────────────────────────────────────────────────────────────
// Mirrors the demo INC-2024-0847 dataset. Real impl swaps this for a fetch.
const INDEX: SearchResult[] = [
  { id: 'INC-2024-0847', category: 'incident', title: 'Checkout Service Failure', subtitle: 'P1 · Investigating · INC-2024-0847', target: 'incidents' },
  { id: 'agent-commander', category: 'agent', title: 'Commander Agent', subtitle: 'Incident triage & orchestration', target: 'agents' },
  { id: 'agent-metrics', category: 'agent', title: 'Metrics Agent', subtitle: 'APM & infrastructure telemetry', target: 'agents' },
  { id: 'agent-logs', category: 'agent', title: 'Logs Agent', subtitle: 'Log analytics & pattern recognition', target: 'agents' },
  { id: 'agent-deployment', category: 'agent', title: 'Deployment Agent', subtitle: 'Change intelligence & release analysis', target: 'agents' },
  { id: 'agent-time_machine', category: 'agent', title: 'Time Machine Agent', subtitle: 'Historical baseline & anomaly correlation', target: 'agents' },
  { id: 'rec-rollback', category: 'recommendation', title: 'Immediate Rollback to v2.4.0', subtitle: 'Rollback · Safe · Priority 1', target: 'home' },
  { id: 'rec-hotfix', category: 'recommendation', title: 'Hotfix: Restore SQLALCHEMY_POOL_SIZE=20', subtitle: 'Hotfix · Medium risk · Priority 2', target: 'home' },
  { id: 'rec-infra', category: 'recommendation', title: 'Add Connection Pool Monitoring Alert', subtitle: 'Infrastructure · Priority 3', target: 'home' },
  { id: 'evt-deploy', category: 'timeline', title: 'v2.4.1 Deployment Started', subtitle: 'Deployment · CI/CD Pipeline', target: 'history' },
  { id: 'evt-rootcause', category: 'timeline', title: 'Root Cause Confirmed', subtitle: 'Root cause · Commander Agent · 94%', target: 'history' },
  { id: 'find-pool', category: 'finding', title: 'ORM connection pool exhaustion', subtitle: 'pool_size 20 → 5 regression in v2.4.1', target: 'agents' },
  { id: 'find-latency', category: 'finding', title: 'P99 latency 23ms → 1,847ms', subtitle: 'Metrics Agent', target: 'agents' },
]

function mockSearch(query: string): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return INDEX.filter(
    (r) =>
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
