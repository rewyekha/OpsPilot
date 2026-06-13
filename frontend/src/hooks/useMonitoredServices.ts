import { useEffect, useRef, useState } from 'react'
import {
  servicesApi,
  type ApiMonitoredServicesResponse,
} from '../api/services'
import type { FetchState } from './fetchState'

// Hard client-side timeout so the 'Monitored Services' card can NEVER hang on a
// slow telemetry backend. The backend already bounds /system/services to ~2s and
// serves stale-while-revalidate; this is the belt-and-braces client guard.
const SERVICES_TIMEOUT_MS = 2500

/**
 * Loads the 'Monitored Services' health roster from GET /api/system/services,
 * stale-while-revalidate: it keeps the last roster on screen and refetches on the
 * silent `opspilot:poll` (and explicit `opspilot:refresh`) WITHOUT re-showing a
 * spinner or blanking. A slow/failed background refetch keeps the current data —
 * the card never gets stuck loading. The spinner shows only before the first
 * successful load.
 */
export function useMonitoredServices(): FetchState<ApiMonitoredServicesResponse> {
  const [state, setState] = useState<FetchState<ApiMonitoredServicesResponse>>({
    data: null,
    loading: true,
    error: null,
  })
  const [nonce, setNonce] = useState(0)
  // True once the first fetch has settled — gates the spinner so background
  // refetches never re-enter the loading state.
  const settledRef = useRef(false)

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
    if (!settledRef.current) setState((s) => ({ ...s, loading: true }))
    servicesApi
      .list(SERVICES_TIMEOUT_MS)
      .then((data) => {
        if (cancelled) return
        settledRef.current = true
        setState({ data, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (settledRef.current) {
          // Background-refetch error (incl. timeout) → keep the current roster on
          // screen, just stop the (non-visible) loading flag. No blank, no spinner.
          setState((s) => ({ ...s, loading: false }))
        } else {
          settledRef.current = true
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load monitored services',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [nonce])

  return state
}
