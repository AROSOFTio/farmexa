import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, HelpCircle } from 'lucide-react'

type ConfirmTone = 'default' | 'danger'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmTone
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Professional in-app confirmation dialog — replaces native window.confirm().
 * Centered modal with a tone-aware icon and a clear primary/secondary action pair.
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isDanger = tone === 'danger'

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[rgba(15,23,42,0.35)] backdrop-blur-[2px] animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[calc(100vw-1.5rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[16px] border border-neutral-200 bg-white shadow-modal outline-none animate-slide-up">
          <div className="px-6 pt-6">
            <div className="flex gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                  isDanger ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600'
                }`}
              >
                {isDanger ? <AlertTriangle className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-[1.05rem] font-semibold text-neutral-900">{title}</Dialog.Title>
                <Dialog.Description className="mt-1.5 text-[13.5px] leading-6 text-neutral-600">
                  {message}
                </Dialog.Description>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-neutral-100 bg-neutral-50/60 px-6 py-4">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={isLoading}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={
                isDanger
                  ? 'inline-flex items-center justify-center gap-2 rounded-[10px] border border-red-600 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60'
                  : 'btn-primary'
              }
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? 'Working...' : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
