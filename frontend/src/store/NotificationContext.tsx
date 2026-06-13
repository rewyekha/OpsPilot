/**
 * NotificationContext — app-wide toast notifications.
 *
 * Mounts a single Fluent <Toaster> at the root and exposes a tiny `useNotify()`
 * helper so any component can raise a success/info/warning/error toast without
 * wiring up its own controller. Used by the action-execution flow, New
 * Investigation, and the user menu.
 */
import React, { createContext, useCallback, useContext, useMemo } from 'react'
import {
  Toaster,
  useToastController,
  useId,
  Toast,
  ToastTitle,
  ToastBody,
} from '@fluentui/react-components'

export type ToastIntent = 'info' | 'success' | 'warning' | 'error'

export interface NotifyOptions {
  title: string
  body?: string
  intent?: ToastIntent
}

interface NotificationContextValue {
  notify: (opts: NotifyOptions) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toasterId = useId('opspilot-toaster')
  const { dispatchToast } = useToastController(toasterId)

  const notify = useCallback(
    ({ title, body, intent = 'info' }: NotifyOptions) => {
      dispatchToast(
        <Toast>
          <ToastTitle>{title}</ToastTitle>
          {body != null && <ToastBody>{body}</ToastBody>}
        </Toast>,
        { intent, timeout: intent === 'error' ? 6000 : 4000 },
      )
    },
    [dispatchToast],
  )

  const value = useMemo<NotificationContextValue>(() => ({ notify }), [notify])

  return (
    <NotificationContext.Provider value={value}>
      <Toaster toasterId={toasterId} position="bottom-end" pauseOnHover />
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotify(): (opts: NotifyOptions) => void {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotify must be used within <NotificationProvider>')
  return ctx.notify
}
