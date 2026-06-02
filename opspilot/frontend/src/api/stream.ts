// SSE stream connection management
// Opens and manages an EventSource connection to /api/incidents/{id}/stream.
// Parses typed SSEEvent objects from the raw event stream.
// Handles reconnection with exponential backoff.

import type { SSEEvent } from '@/types/events'

export type StreamEventHandler = (event: SSEEvent) => void

export interface StreamConnection {
  disconnect: () => void
}

/**
 * Connect to the incident SSE stream.
 * Returns a handle with a disconnect() method for cleanup.
 */
export const connectIncidentStream = (
  _incidentId: string,
  _onEvent: StreamEventHandler,
  _onError?: (error: Event) => void,
): StreamConnection => {
  throw new Error('Not implemented — Sprint 2')
}
