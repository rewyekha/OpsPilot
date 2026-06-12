// Configurable for deployment; falls back to local dev. Set VITE_API_BASE_URL
// in frontend/.env (see frontend/.env.example) — no source edits required.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch<T>(
  path: string,
  opts?: { timeoutMs?: number },
): Promise<T> {
  // Optional hard timeout so a slow backend call can never hang a widget: it
  // aborts and rejects, and SWR data hooks keep their last-known data on screen.
  const timeoutMs = opts?.timeoutMs
  const controller = timeoutMs ? new AbortController() : undefined
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined
  try {
    const res = await fetch(`${BASE_URL}${path}`, controller ? { signal: controller.signal } : undefined)
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }))
      const msg: string =
        body && typeof body.detail === 'string' ? body.detail : res.statusText
      throw new ApiError(res.status, msg)
    }
    return res.json() as Promise<T>
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(408, `Request to ${path} timed out after ${timeoutMs}ms`)
    }
    throw err
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const msg: string =
      err && typeof err.detail === 'string' ? err.detail : res.statusText
    throw new ApiError(res.status, msg)
  }
  return res.json() as Promise<T>
}
