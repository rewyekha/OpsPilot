/**
 * PreferencesContext — app-wide UI preferences.
 *
 * Currently holds the timezone display mode that drives every timestamp in
 * the app (see utils/formatters). One provider at the root means the future
 * UTC/local toggle reformats the entire console from a single switch, with no
 * prop drilling.
 *
 * `useFormatters()` returns mode-bound wrappers so components call
 * `fmt.timestamp(iso)` without threading the mode through manually.
 */
import React, { createContext, useContext, useMemo, useState, useCallback } from 'react'
import {
  formatRelative,
  formatTime,
  formatTimestamp,
  formatTimeWithSeconds,
  timeZoneAbbr,
  type DateInput,
  type TimeZoneMode,
} from '../utils/formatters'

interface PreferencesContextValue {
  timeZoneMode: TimeZoneMode
  setTimeZoneMode: (mode: TimeZoneMode) => void
  toggleTimeZoneMode: () => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timeZoneMode, setTimeZoneMode] = useState<TimeZoneMode>('local')

  const toggleTimeZoneMode = useCallback(
    () => setTimeZoneMode((m) => (m === 'local' ? 'utc' : 'local')),
    [],
  )

  const value = useMemo<PreferencesContextValue>(
    () => ({ timeZoneMode, setTimeZoneMode, toggleTimeZoneMode }),
    [timeZoneMode, toggleTimeZoneMode],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used within <PreferencesProvider>')
  return ctx
}

/** Mode-bound formatter helpers — the idiomatic way to render time in a component. */
export function useFormatters() {
  const { timeZoneMode } = usePreferences()
  return useMemo(
    () => ({
      mode: timeZoneMode,
      zoneAbbr: () => timeZoneAbbr(timeZoneMode),
      time: (v: DateInput) => formatTime(v, timeZoneMode),
      timeWithSeconds: (v: DateInput) => formatTimeWithSeconds(v, timeZoneMode),
      timestamp: (v: DateInput) => formatTimestamp(v, timeZoneMode),
      relative: (v: DateInput) => formatRelative(v),
    }),
    [timeZoneMode],
  )
}
