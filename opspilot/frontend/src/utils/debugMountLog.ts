import { useEffect } from 'react'

/**
 * TEMP-DEBUG — mount/unmount tracer used to diagnose the "dashboard visibly
 * reloads during polling" issue. A component that REMOUNTS during background
 * polling prints repeated [MOUNT]/[UNMOUNT] pairs every poll tick; a component
 * that updates silently prints [MOUNT] exactly once.
 *
 * Remove this file and its call sites once verified (see useMountLog callers).
 */
export function useMountLog(name: string): void {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(`[MOUNT]   ${name} @ ${new Date().toISOString()}`)
    return () => {
      // eslint-disable-next-line no-console
      console.log(`[UNMOUNT] ${name} @ ${new Date().toISOString()}`)
    }
  }, [name])
}
