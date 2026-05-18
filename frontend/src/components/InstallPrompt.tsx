import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { BRAND_LOGO_ICON } from '@/lib/branding'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('farmexa_install_prompt_dismissed') === 'true')
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true)
    const handler = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (dismissed || isStandalone) return null

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  if (!promptEvent && !isIos) return null

  const dismiss = () => {
    localStorage.setItem('farmexa_install_prompt_dismissed', 'true')
    setDismissed(true)
  }

  const install = async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    await promptEvent.userChoice
    setPromptEvent(null)
    dismiss()
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md rounded-[8px] border border-brand-200 bg-white p-4 shadow-modal">
      <div className="flex items-start gap-3">
        <div className="rounded-[8px] bg-brand-50 p-1.5 text-brand-800">
          <img src={BRAND_LOGO_ICON} alt="Farmexa" className="h-7 w-7 object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-black text-ink-900">Install Farmexa App</div>
          <p className="mt-1 text-sm leading-6 text-ink-600">
            {isIos ? 'On iPhone or iPad, tap Share, then Add to Home Screen.' : 'Add Farmexa to your device for faster access.'}
          </p>
          {promptEvent ? (
            <button type="button" className="btn-primary mt-3 h-9 px-4 text-xs" onClick={install}>Install</button>
          ) : null}
        </div>
        <button type="button" className="rounded-md p-1 text-ink-500 hover:bg-neutral-100" onClick={dismiss} aria-label="Dismiss install prompt">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
