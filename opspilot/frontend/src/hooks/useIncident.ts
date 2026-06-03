import { useState, useEffect } from 'react'
import { incidentApi, type ApiIncidentRecord } from '../api/incidents'
import { recommendationApi, type ApiRecommendationResponse } from '../api/recommendations'

export interface IncidentWithRec {
  incident: ApiIncidentRecord
  recommendations: ApiRecommendationResponse | null
}

export interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useActiveIncidentWithRecommendations(): FetchState<IncidentWithRec> {
  const [state, setState] = useState<FetchState<IncidentWithRec>>({
    data: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const incidents = await incidentApi.getActive()
        if (cancelled) return

        if (incidents.length === 0) {
          setState({ data: null, loading: false, error: 'No active incidents found' })
          return
        }

        const incident = incidents[0]
        let recommendations: ApiRecommendationResponse | null = null

        try {
          recommendations = await recommendationApi.get(incident.id)
        } catch {
          // recommendations may not be available yet; non-fatal
        }

        if (!cancelled) {
          setState({ data: { incident, recommendations }, loading: false, error: null })
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load incident',
          })
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
