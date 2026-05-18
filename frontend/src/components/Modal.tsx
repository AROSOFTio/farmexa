import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
}

export function Modal({ isOpen, onClose, title, description, children }: ModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.30)] backdrop-blur-[2px] animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-[740px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[14px] border border-neutral-200 bg-white shadow-modal outline-none animate-slide-up">
          <div className="surface-header">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-[1.2rem] font-semibold text-ink-900">{title}</Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-1 max-w-2xl text-[13px] leading-6 text-ink-500">
                    {description}
                  </Dialog.Description>
                ) : null}
              </div>

              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close dialog"
                  className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-neutral-200 bg-white text-ink-500 transition-colors hover:bg-neutral-100"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-5 py-5 sm:px-6">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
