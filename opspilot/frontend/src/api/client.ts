const BASE_URL = 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    const msg: string =
      body && typeof body.detail === 'string' ? body.detail : res.statusText
    throw new ApiError(res.status, msg)
  }
  return res.json() as Promise<T>
}
