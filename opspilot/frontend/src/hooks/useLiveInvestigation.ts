/**
 * useLiveInvestigation — the live agent queue, driven entirely by real SSE events
 * from the backend orchestrator (Task 2). No static data, no timers, no simulated
 * progress: every agent transition (pending → running → complete) comes from an
 * actual agent.started / agent.finding / agent.completed event.
 *
 * One EventSource per incident (opening it triggers the real orchestrator run on
 * the backend). Aggregates the stream into an ordered agent roster + live
 * combined confidence + run status, so the dashboard queue reflects actual
 * execution state.
 */
import { useEffect, useRef, useState } from 'react'

export type LiveStatus = 'idle' | 'running' | 'complete'
export type AgentRunStatus = 'pending' | 'running' | 'complete'
export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

export interface LiveAgent {
  role: string
  label: string
  status: AgentRunStatus
  confidence: number
  finding: string
  durationMs: number
}

interface StreamEvent {
  event_type: string
  agent_name: string
  incident_id: string
  timestamp: string
  payload: Record<string, unknown>
}

const STREAM_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

// Canonical execution order (reasoning is inserted before recommendation only
// when an escalation event arrives).
const ROSTER: { role: string; label: string }[] = [
  { role: 'commander', label: 'Commander' },
  { role: 'metrics', label: 'Metrics' },
  { role: 'logs', label: 'Logs' },
  { role: 'deployment', label: 'Deployment' },
  { role: 'time_machine', label: 'Time Machine' },
  { role: 'root_cause', label: 'Root Cause' },
  { role: 'recommendation', label: 'Recommendation' },
]
const LABELS: Record<string, string> = {
  ...Object.fromEntries(ROSTER.map((r) => [r.role, r.label])),
  reasoning: 'Deep Reasoning',
}

function initialAgents(): LiveAgent[] {
  return ROSTER.map((r) => ({ role: r.role, label: r.label, status: 'pending', confidence: 0, finding: '', durationMs: 0 }))
}

export interface LiveInvestigation {
  status: LiveStatus
  connection: ConnectionStatus
  agents: LiveAgent[]
  confidence: number | null
  escalated: boolean
}

export function useLiveInvestigation(incidentId: string): LiveInvestigation {
  const [connection, setConnection] = useState<ConnectionStatus>('reconnecting')
  const [status, setStatus] = useState<LiveStatus>('idle')
  const [agents, setAgents] = useState<LiveAgent[]>(initialAgents)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [escalated, setEscalated] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const url = `${STREAM_BASE}/api/incidents/${encodeURIComponent(incidentId)}/stream`
    const es = new EventSource(url)
    esRef.current = es
    es.onopen = () => setConnection('connected')
    es.onerror = () => setConnection(es.readyState === EventSource.CLOSED ? 'disconnected' : 'reconnecting')

    const patch = (role: string, fn: (a: LiveAgent) => LiveAgent) =>
      setAgents((prev) => {
        const exists = prev.some((a) => a.role === role)
        const base = exists
          ? prev
          : // Insert a late-appearing agent (e.g. reasoning) before recommendation.
            (() => {
              const i = prev.findIndex((a) => a.role === 'recommendation')
              const inject: LiveAgent = { role, label: LABELS[role] ?? role, status: 'pending', confidence: 0, finding: '', durationMs: 0 }
              if (i === -1) return [...prev, inject]
              return [...prev.slice(0, i), inject, ...prev.slice(i)]
            })()
        return base.map((a) => (a.role === role ? fn(a) : a))
      })

    es.onmessage = (ev: MessageEvent<string>) => {
      let e: StreamEvent
      try { e = JSON.parse(ev.data) as StreamEvent } catch { return }
      const role = e.agent_name
      switch (e.event_type) {
        case 'investigation.started':
          setStatus('running'); setAgents(initialAgents()); setConfidence(null); setEscalated(false)
          break
        case 'agent.started':
          setStatus('running')
          patch(role, (a) => ({ ...a, status: 'running' }))
          break
        case 'agent.finding':
          patch(role, (a) => ({
            ...a,
            status: 'complete',
            confidence: typeof e.payload.confidence === 'number' ? e.payload.confidence : a.confidence,
            finding: typeof e.payload.summary === 'string' ? e.payload.summary : a.finding,
            durationMs: typeof e.payload.duration_ms === 'number' ? e.payload.duration_ms : a.durationMs,
          }))
          break
        case 'agent.completed':
          patch(role, (a) => ({ ...a, status: 'complete' }))
          break
        case 'reasoning.escalated':
          setEscalated(true)
          break
        case 'root_cause.updated':
          if (typeof e.payload.confidence === 'number') setConfidence(e.payload.confidence)
          break
        case 'investigation.complete':
          setStatus('complete')
          if (typeof e.payload.combined_confidence === 'number') setConfidence((c) => c ?? (e.payload.combined_confidence as number))
          break
      }
    }

    return () => { es.close(); esRef.current = null }
  }, [incidentId])

  return { status, connection, agents, confidence, escalated }
}
