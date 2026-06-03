import { useState, useEffect } from 'react'
import { agentApi, type ApiAgentActivityResponse } from '../api/agents'

export interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useAgentActivity(incidentId: string): FetchState<ApiAgentActivityResponse> {
  const [state, setState] = useState<FetchState<ApiAgentActivityResponse>>({
    data: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    agentApi
      .getActivity(incidentId)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load agent activity',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [incidentId])

  return state
}
