// Typed API client
// All HTTP calls go through this client, which attaches auth headers
// and base URL from environment variables.
// Error responses are parsed into typed ApiError objects — never raw fetch errors.

export interface ApiError {
  status: number
  message: string
  detail?: unknown
}
