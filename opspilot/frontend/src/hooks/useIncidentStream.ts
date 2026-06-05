/**
 * useIncidentStream — native EventSource hook for SSE endpoint
 *
 * Connects to: GET /api/incidents/{incidentId}/stream
 *
 * Backend emits events with event_type:
 *   agent.started | agent.finding | agent.completed |
 *   root_cause.updated | investigation.complete
 */
import { useState, useEffect, useRef } from 'react'

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

export interface StreamEvent {
  event_type: string
  agent_name: string
  incident_id: string
  timestamp: string
  payload: Record<string, unknown>
}

const STREAM_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export function useIncidentStream(incidentId: string): {
  status: ConnectionStatus
  lastEvent: StreamEvent | null
  events: StreamEvent[]
} {
  const [status, setStatus] = useState<ConnectionStatus>('reconnecting')
  const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null)
  // Append-only log of every event. The functional update is batching-safe:
  // even when React 18 coalesces several SSE messages into one render, each
  // call still appends, so no event is dropped (unlike a single `lastEvent`).
  const [events, setEvents] = useState<StreamEvent[]>([])
  // Stable ref so the cleanup callback always closes the right instance
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    setEvents([])
    const url = `${STREAM_BASE}/api/incidents/${encodeURIComponent(incidentId)}/stream`
    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => setStatus('connected')

    es.onmessage = (ev: MessageEvent<string>) => {
      try {
        const data = JSON.parse(ev.data) as StreamEvent
        setEvents((prev) => [...prev, data])
        setLastEvent(data)
      } catch {
        // malformed frame — skip
      }
    }

    es.onerror = () => {
      // EventSource readyState: 0=CONNECTING, 1=OPEN, 2=CLOSED
      if (es.readyState === EventSource.CLOSED) {
        setStatus('disconnected')
      } else {
        setStatus('reconnecting')
      }
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [incidentId])

  return { status, lastEvent, events }
}
