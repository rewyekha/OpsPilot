import { useState, useEffect } from 'react'
import { timelineApi, type ApiTimelineResponse } from '../api/timeline'

export interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useTimeline(incidentId: string): FetchState<ApiTimelineResponse> {
  const [state, setState] = useState<FetchState<ApiTimelineResponse>>({
    data: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    timelineApi
      .get(incidentId)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load timeline',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [incidentId])

  return state
}