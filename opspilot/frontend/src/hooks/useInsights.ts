/**
 * Hooks over the persisted investigation store (single source of truth) used by
 * History, Analytics, the Agents page and the dashboard. They re-fetch whenever
 * an `opspilot:refresh` event fires (e.g. after a re-run completes) so every
 * surface updates automatically from real stored investigations.
 */
import { useEffect, useRef, useState } from 'react'
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
  // True once the FIRST fetch has settled. We cannot use `data === null` for this:
  // `null` is a VALID loaded value (the empty state — no investigations yet), so a
  // data===null check would re-enter `loading` on every poll and flash the spinner.
  const settledRef = useRef(false)

  useEffect(() => {
    const bump = () => setNonce((n) => n + 1)
    // `opspilot:refresh` = explicit refresh; `opspilot:poll` = silent periodic
    // poll (autonomous real-time updates, no remount/toast).
    window.addEventListener('opspilot:refresh', bump)
    window.addEventListener('opspilot:poll', bump)
    return () => {
      window.removeEventListener('opspilot:refresh', bump)
      window.removeEventListener('opspilot:poll', bump)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    // Surface `loading` ONLY before the first fetch has ever settled. Background
    // refetches (opspilot:poll / opspilot:refresh) keep the current view on screen
    // and swap in new data when it arrives — no spinner, no skeleton, no remount,
    // no state clearing. This is what makes polling silent, INCLUDING the empty
    // (data === null) state.
    if (!settledRef.current) setState((s) => ({ ...s, loading: true }))
    load()
      .then((data) => {
        if (cancelled) return
        settledRef.current = true
        setState({ data, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (settledRef.current) {
          // Background-refetch error → keep the existing view (no blanking, no flash).
          setState((s) => ({ ...s, loading: false }))
        } else {
          // First-load error → surface it.
          settledRef.current = true
          setState({ data: null, loading: false, error: err instanceof Error ? err.message : 'Failed to load' })
        }
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
