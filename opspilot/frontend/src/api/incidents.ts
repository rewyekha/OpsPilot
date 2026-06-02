// Incident API calls
// Wraps /api/incidents endpoints. Used by React Query hooks in hooks/useIncident.ts

import type { CreateIncidentRequest, IncidentRecord } from '@/types/incident'

export type { CreateIncidentRequest, IncidentRecord }

export const incidentApi = {
  /** POST /api/incidents — create and begin investigation */
  create: (_req: CreateIncidentRequest): Promise<IncidentRecord> => {
    throw new Error('Not implemented — Sprint 2')
  },

  /** GET /api/incidents — paginated list */
  list: (_page?: number): Promise<IncidentRecord[]> => {
    throw new Error('Not implemented — Sprint 2')
  },

  /** GET /api/incidents/:id — single incident with full findings */
  get: (_id: string): Promise<IncidentRecord> => {
    throw new Error('Not implemented — Sprint 2')
  },
}
