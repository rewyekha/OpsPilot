/** Shared async fetch state used by the data hooks. */
export interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
}
