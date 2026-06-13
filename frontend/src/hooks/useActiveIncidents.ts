/**
 * useActiveIncidents — currently-active incidents from /api/incidents/active
 * (telemetry-detected + user-created). Re-fetches on `opspilot:refresh` and the
 * silent `opspilot:poll` so the dashboard picks up AUTONOMOUSLY-detected
 * incidents in real time, without a page refresh.
 */
import { useEffect, useState } from 'react'
import { incidentsApi, type ApiIncidentRecord } from '../api/incidents'
import type { FetchState } from './fetchState'

export function useActiveIncidents(): FetchState<ApiIncidentRecord[]> {
  const [state, setState] = useState<FetchState<ApiIncidentRecord[]>>({ data: null, loading: true, error: null })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const bump = () => setNonce((n) => n + 1)
    window.addEventListener('opspilot:refresh', bump)
    window.addEventListener('opspilot:poll', bump)
    return () => {
      window.removeEventListener('opspilot:refresh', bump)
      window.removeEventListener('opspilot:poll', bump)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    incidentsApi
      .active()
      .then((d) => { if (!cancelled) setState({ data: d, loading: false, error: null }) })
      .catch((e: unknown) => {
        if (cancelled) return
        // Keep existing active-incident data on a background-refetch error so the
        // dashboard's watched incident id (and its SSE) stay stable — no flicker.
        setState((s) => (s.data === null
          ? { data: null, loading: false, error: e instanceof Error ? e.message : 'Failed to load' }
          : { ...s, loading: false }))
      })
    return () => { cancelled = true }
  }, [nonce])

  return state
}
