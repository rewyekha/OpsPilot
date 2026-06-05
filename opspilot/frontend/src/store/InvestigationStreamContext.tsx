/**
 * InvestigationStreamProvider — the SINGLE EventSource for the whole app.
 *
 * Why this exists:
 *   Previously every page (Dashboard, Agents, Timeline) opened its own
 *   EventSource, and each connection (plus every auto-reconnect) re-ran the
 *   whole investigation → runaway Foundry token burn. Now:
 *     • ONE subscribe-only EventSource is shared by all pages.
 *     • It NEVER triggers an investigation (the stream endpoint is read-only).
 *     • On `investigation.complete` it closes cleanly, so the browser never
 *       auto-reconnects and re-runs agents.
 *     • An investigation is launched ONLY by an explicit user action
 *       (`startInvestigation` → POST .../investigate).
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ACTIVE_INCIDENT_ID } from '../utils/constants'

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

export interface StreamEvent {
  event_type: string
  agent_name: string
  incident_id: string
  timestamp: string
  payload: Record<string, unknown>
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

interface InvestigationStreamValue {
  status: ConnectionStatus
  lastEvent: StreamEvent | null
  events: StreamEvent[]
  startInvestigation: () => Promise<void>
}

const Ctx = createContext<InvestigationStreamValue | null>(null)

export const InvestigationStreamProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [status, setStatus] = useState<ConnectionStatus>('reconnecting')
  const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null)
  const [events, setEvents] = useState<StreamEvent[]>([])
  const esRef = useRef<EventSource | null>(null)

  // Open the one subscribe-only stream. Read-only: launches nothing.
  const connect = useCallback(() => {
    esRef.current?.close()
    const url = `${API_BASE}/api/incidents/${encodeURIComponent(ACTIVE_INCIDENT_ID)}/stream`
    const es = new EventSource(url)
    esRef.current = es
    es.onopen = () => setStatus('connected')
    es.onmessage = (ev: MessageEvent<string>) => {
      try {
        const data = JSON.parse(ev.data) as StreamEvent
        // Append-only (functional update) — batching-safe, no event dropped.
        setEvents((prev) => [...prev, data])
        setLastEvent(data)
        // Close on completion so the browser's EventSource never auto-reconnects
        // (the reconnect is what previously re-ran the whole investigation).
        if (data.event_type === 'investigation.complete') {
          es.close()
          setStatus('disconnected')
        }
      } catch {
        /* malformed frame — skip */
      }
    }
    es.onerror = () => {
      setStatus(es.readyState === EventSource.CLOSED ? 'disconnected' : 'reconnecting')
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      esRef.current?.close()
      esRef.current = null
    }
  }, [connect])

  // Explicit user action → launch exactly one investigation.
  const startInvestigation = useCallback(async () => {
    // Fresh run: clear prior events and reconnect the subscribe-only stream so
    // it receives this run, then trigger the backend exactly once.
    setEvents([])
    setLastEvent(null)
    connect()
    try {
      await fetch(
        `${API_BASE}/api/incidents/${encodeURIComponent(ACTIVE_INCIDENT_ID)}/investigate?force=true`,
        { method: 'POST' },
      )
    } catch {
      /* network error surfaced via stream status */
    }
  }, [connect])

  return (
    <Ctx.Provider value={{ status, lastEvent, events, startInvestigation }}>{children}</Ctx.Provider>
  )
}

export function useInvestigationStream(): InvestigationStreamValue {
  const value = useContext(Ctx)
  if (!value) {
    // Safe no-op fallback for consumers rendered outside the provider (e.g. tests).
    return { status: 'disconnected', lastEvent: null, events: [], startInvestigation: async () => {} }
  }
  return value
}
