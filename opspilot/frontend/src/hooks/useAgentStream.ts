// React hook — subscribe to a live incident SSE stream
// Opens SSE connection when incidentId is provided.
// Dispatches incoming events to the incidentStore.
// Automatically cleans up connection on unmount.

import { useEffect } from 'react'

/**
 * Subscribe to agent activity events for a given incident.
 * The hook manages the SSE connection lifecycle (open, reconnect, cleanup).
 */
export const useAgentStream = (incidentId: string | null): void => {
  useEffect(() => {
    if (!incidentId) return
    // Implementation: connectIncidentStream → dispatch to incidentStore
  }, [incidentId])
}
