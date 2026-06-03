/**
 * ConfirmDialog — generic confirmation modal.
 *
 * Lightweight, reusable "are you sure?" gate for lifecycle actions like Mark
 * Resolved and Close Incident. (ConfirmActionDialog is the richer, remediation-
 * specific variant; this one is plain title + message + confirm.)
 */
import React from 'react'
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@fluentui/react-components'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** 'primary' (default) or 'danger' for destructive confirms. */
  tone?: 'primary' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onCancel,
}) => (
  <Dialog open={open} onOpenChange={(_, d) => !d.open && onCancel()}>
    <DialogSurface>
      <DialogBody>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>{message}</DialogContent>
        <DialogActions>
          <Button appearance="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            appearance="primary"
            onClick={onConfirm}
            style={tone === 'danger' ? { backgroundColor: '#dc2626', borderColor: '#dc2626' } : undefined}
          >
            {confirmLabel}
          </Button>
        </DialogActions>
      </DialogBody>
    </DialogSurface>
  </Dialog>
)
