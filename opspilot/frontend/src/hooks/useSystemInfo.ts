import { useEffect, useState } from 'react'
import { systemApi, type ApiFoundryHealth, type ApiServiceHealth } from '../api/system'
import { servicesApi, type ApiMonitoredServicesResponse } from '../api/services'

export interface SystemInfo {
  foundry: ApiFoundryHealth | null
  health: ApiServiceHealth | null
  services: ApiMonitoredServicesResponse | null
}

export interface SystemInfoState {
  data: SystemInfo
  loading: boolean
  /** True when the backend could not be reached at all. */
  offline: boolean
}

/**
 * Loads live backend configuration for the Settings/System views. Resilient: a
 * failed call leaves that slice null and flips `offline` rather than throwing,
 * so the Settings page always renders.
 */
export function useSystemInfo(): SystemInfoState {
  const [state, setState] = useState<SystemInfoState>({
    data: { foundry: null, health: null, services: null },
    loading: true,
    offline: false,
  })

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      systemApi.foundryHealth(),
      systemApi.health(),
      servicesApi.list(),
    ]).then((results) => {
      if (cancelled) return
      const [foundry, health, services] = results
      const allFailed = results.every((r) => r.status === 'rejected')
      setState({
        data: {
          foundry: foundry.status === 'fulfilled' ? foundry.value : null,
          health: health.status === 'fulfilled' ? health.value : null,
          services: services.status === 'fulfilled' ? services.value : null,
        },
        loading: false,
        offline: allFailed,
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
