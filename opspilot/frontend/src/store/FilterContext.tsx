/**
 * FilterContext — single shared filter model for the whole console.
 *
 * Every enterprise surface (incidents, agents, timeline, recommendations,
 * findings) filters along the same axes. Rather than each panel re-deriving
 * its own filter state and predicate logic, they read this one store and use
 * the shared `matchers` so behaviour stays consistent and DRY.
 *
 * Mock-friendly today, real-query-ready later: the same FilterState shape can
 * be serialised into a backend query string without touching call sites.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type TimeRange = 'all' | '1h' | '24h' | '7d'

export interface FilterState {
  severity: string[] // P0..P3 (empty = all)
  status: string[] // open | investigating | mitigated | resolved
  agent: string[] // agent role ids
  source: string[] // metrics | logs | deployment | …
  minConfidence: number // 0–100
  timeRange: TimeRange
  query: string // free-text
}

export const EMPTY_FILTERS: FilterState = {
  severity: [],
  status: [],
  agent: [],
  source: [],
  minConfidence: 0,
  timeRange: 'all',
  query: '',
}

interface FilterContextValue {
  filters: FilterState
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  toggleIn: (key: 'severity' | 'status' | 'agent' | 'source', value: string) => void
  reset: () => void
  /** Number of axes that deviate from the empty default — drives a badge. */
  activeCount: number
}

const FilterContext = createContext<FilterContextValue | null>(null)

const TIME_RANGE_MS: Record<Exclude<TimeRange, 'all'>, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
}

export const FilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)

  const setFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
      setFilters((prev) => ({ ...prev, [key]: value })),
    [],
  )

  const toggleIn = useCallback(
    (key: 'severity' | 'status' | 'agent' | 'source', value: string) =>
      setFilters((prev) => {
        const set = new Set(prev[key])
        if (set.has(value)) set.delete(value)
        else set.add(value)
        return { ...prev, [key]: [...set] }
      }),
    [],
  )

  const reset = useCallback(() => setFilters(EMPTY_FILTERS), [])

  const activeCount = useMemo(() => {
    let n = 0
    if (filters.severity.length) n++
    if (filters.status.length) n++
    if (filters.agent.length) n++
    if (filters.source.length) n++
    if (filters.minConfidence > 0) n++
    if (filters.timeRange !== 'all') n++
    if (filters.query.trim()) n++
    return n
  }, [filters])

  const value = useMemo<FilterContextValue>(
    () => ({ filters, setFilter, toggleIn, reset, activeCount }),
    [filters, setFilter, toggleIn, reset, activeCount],
  )

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
}

export function useFilters(): FilterContextValue {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilters must be used within <FilterProvider>')
  return ctx
}

// ── Shared predicates — the single place filtering logic lives ────────────────

export const matchers = {
  inSet: (selected: string[], value: string | null | undefined): boolean =>
    selected.length === 0 || (value != null && selected.includes(value)),

  minConfidence: (min: number, confidence: number | null | undefined): boolean =>
    min <= 0 || (confidence != null && confidence >= min),

  inTimeRange: (range: TimeRange, iso: string | null | undefined, now = Date.now()): boolean => {
    if (range === 'all') return true
    if (!iso) return false
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) return false
    return now - t <= TIME_RANGE_MS[range]
  },

  text: (query: string, ...fields: (string | null | undefined)[]): boolean => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return fields.some((f) => f?.toLowerCase().includes(q))
  },
}
