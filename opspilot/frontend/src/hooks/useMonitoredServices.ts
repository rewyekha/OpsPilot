import { useEffect, useState } from 'react'
import {
  servicesApi,
  type ApiMonitoredServicesResponse,
} from '../api/services'
import type { FetchState } from './useRecommendations'

/**
 * Loads the 'Monitored Services' health roster from GET /api/system/services.
 * The backend sources it from the active TelemetryProvider (synthetic | azure),
 * so this hook is agnostic to whether the data is fixtures or live Azure Monitor.
 */
export function useMonitoredServices(): FetchState<ApiMonitoredServicesResponse> {
  const [state, setState] = useState<FetchState<ApiMonitoredServicesResponse>>({
    data: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    servicesApi
      .list()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
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
  }, [])

  return state
}
