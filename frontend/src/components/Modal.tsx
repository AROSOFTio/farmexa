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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-950/45 backdrop-blur-sm animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-white shadow-modal outline-none animate-slide-up">
          <div className="border-b border-neutral-150 bg-neutral-50 px-5 py-4 sm:px-7 sm:py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-xl font-semibold text-ink-900">{title}</Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-1 max-w-xl text-sm text-ink-500">
                    {description}
                  </Dialog.Description>
                ) : null}
              </div>

              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close dialog"
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-ink-500 transition-colors hover:bg-neutral-100"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          <div className="max-h-[calc(100vh-10rem)] overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
