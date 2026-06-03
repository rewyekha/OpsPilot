import { useState, useEffect } from 'react'
import { recommendationApi, type ApiRecommendationResponse } from '../api/recommendations'

export interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useRecommendations(incidentId: string): FetchState<ApiRecommendationResponse> {
  const [state, setState] = useState<FetchState<ApiRecommendationResponse>>({
    data: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    recommendationApi
      .get(incidentId)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load recommendations',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [incidentId])

  return state
}
