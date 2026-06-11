import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { clsx } from 'clsx'
import {
  type AppearanceMode,
  type ThemePreference,
  THEME_CHANGE_EVENT,
  persistThemePreference,
  resolveInitialTheme,
} from '@/lib/theme'

function useThemePreference() {
  const [preference, setPreference] = useState<ThemePreference>(() => resolveInitialTheme())
  const updatePreference = (next: ThemePreference) => {
    setPreference(next)
    persistThemePreference(next)
  }

  useEffect(() => {
    const sync = (event: Event) => {
      const next = (event as CustomEvent<ThemePreference>).detail
      if (next?.appearance) {
        setPreference(next)
      }
    }
    window.addEventListener(THEME_CHANGE_EVENT, sync)
    return () => window.removeEventListener(THEME_CHANGE_EVENT, sync)
  }, [])

  return [preference, updatePreference] as const
}

export function ThemeToggle({ className }: { className?: string }) {
  const [preference, setPreference] = useThemePreference()
  const next: AppearanceMode = preference.appearance === 'dark' ? 'light' : 'dark'
  const Icon = preference.appearance === 'dark' ? Sun : Moon

  return (
    <button
      type="button"
      className={clsx('flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-text-secondary transition-colors hover:bg-border/50 hover:text-text-primary', className)}
      onClick={() => setPreference({ ...preference, appearance: next })}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

export function ThemeSelector() {
  const [preference, setPreference] = useThemePreference()

  return (
    <div className="flex rounded-md border border-border bg-background p-1">
      <button
        type="button"
        onClick={() => setPreference({ ...preference, appearance: 'light' })}
        className={clsx(
          'flex flex-1 items-center justify-center gap-2 rounded px-3 py-1.5 text-[12px] font-semibold transition-colors',
          preference.appearance === 'light' ? 'bg-card text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
        )}
      >
        <Sun className="h-3.5 w-3.5" /> Light
      </button>
      <button
        type="button"
        onClick={() => setPreference({ ...preference, appearance: 'dark' })}
        className={clsx(
          'flex flex-1 items-center justify-center gap-2 rounded px-3 py-1.5 text-[12px] font-semibold transition-colors',
          preference.appearance === 'dark' ? 'bg-card text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
        )}
      >
        <Moon className="h-3.5 w-3.5" /> Dark
      </button>
    </div>
  )
}
