/**
 * useIncidentStream — thin accessor over the app-wide InvestigationStreamProvider.
 *
 * All pages (Dashboard, Agents, Timeline) call this, but they now share the
 * SINGLE EventSource owned by the provider rather than each opening their own
 * connection (which previously multiplied investigations). The incidentId arg
 * is accepted for backwards compatibility; the provider streams the active
 * incident.
 */
import {
  useInvestigationStream,
  type ConnectionStatus,
  type StreamEvent,
} from '../store/InvestigationStreamContext'

export type { ConnectionStatus, StreamEvent }

export function useIncidentStream(_incidentId: string): {
  status: ConnectionStatus
  lastEvent: StreamEvent | null
  events: StreamEvent[]
} {
  const { status, lastEvent, events } = useInvestigationStream()
  return { status, lastEvent, events }
}
