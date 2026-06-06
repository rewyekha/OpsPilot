/**
 * Hooks over the persisted investigation store (single source of truth) used by
 * History, Analytics, the Agents page and the dashboard. They re-fetch whenever
 * an `opspilot:refresh` event fires (e.g. after a re-run completes) so every
 * surface updates automatically from real stored investigations.
 */
import { useEffect, useState } from 'react'
import {
  insightsApi,
  type InvestigationRecord,
  type AnalyticsData,
  type AgentStat,
} from '../api/insights'
import type { FetchState } from './fetchState'

function useAutoFetch<T>(load: () => Promise<T>, deps: unknown[]): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: null })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const bump = () => setNonce((n) => n + 1)
    window.addEventListener('opspilot:refresh', bump)
    return () => window.removeEventListener('opspilot:refresh', bump)
  }, [])

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    load()
      .then((data) => { if (!cancelled) setState({ data, loading: false, error: null }) })
      .catch((err: unknown) => {
        if (!cancelled) setState({ data: null, loading: false, error: err instanceof Error ? err.message : 'Failed to load' })
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps])

  return state
}

export function useInvestigations(incidentId?: string): FetchState<InvestigationRecord[]> {
  return useAutoFetch(() => insightsApi.investigations(incidentId), [incidentId])
}

export function useLatestInvestigation(incidentId?: string): FetchState<InvestigationRecord | null> {
  return useAutoFetch(() => insightsApi.latest(incidentId), [incidentId])
}

export function useAnalytics(): FetchState<AnalyticsData> {
  return useAutoFetch(() => insightsApi.analytics(), [])
}

export function useAgentStats(): FetchState<AgentStat[]> {
  return useAutoFetch(() => insightsApi.agentStats(), [])
}
