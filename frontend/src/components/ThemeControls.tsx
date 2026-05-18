import { useEffect, useState } from 'react'
import { Check, Moon, Palette, Sun } from 'lucide-react'
import { clsx } from 'clsx'
import {
  type AppearanceMode,
  type BrandTheme,
  type ThemePreference,
  THEME_CHANGE_EVENT,
  persistThemePreference,
  resolveInitialTheme,
} from '@/lib/theme'

const themeOptions: Array<{ value: BrandTheme; label: string; note: string; swatches: string[] }> = [
  { value: 'navy-gold', label: 'Navy & Gold', note: 'Default', swatches: ['#0b1018', '#d6a62e'] },
  { value: 'green-black', label: 'Green & Black', note: 'Agriculture', swatches: ['#07130d', '#2fa66a'] },
]

function useThemePreference() {
  const [preference, setPreference] = useState<ThemePreference>(() => resolveInitialTheme())
  const updatePreference = (next: ThemePreference) => {
    setPreference(next)
    persistThemePreference(next)
  }

  useEffect(() => {
    const sync = (event: Event) => {
      const next = (event as CustomEvent<ThemePreference>).detail
      if (next?.brandTheme && next?.appearance) {
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
      className={clsx('theme-icon-button', className)}
      onClick={() => setPreference({ ...preference, appearance: next })}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const [preference, setPreference] = useThemePreference()

  if (compact) {
    const current = themeOptions.find((option) => option.value === preference.brandTheme) ?? themeOptions[0]
    const next = themeOptions.find((option) => option.value !== preference.brandTheme) ?? themeOptions[1]
    return (
      <button
        type="button"
        className="theme-icon-button"
        onClick={() => setPreference({ ...preference, brandTheme: next.value })}
        aria-label={`Switch brand theme. Current theme is ${current.label}`}
        title={`Theme: ${current.label}`}
      >
        <Palette className="h-4 w-4" />
      </button>
    )
  }

  return (
    <div className="grid gap-2">
      {themeOptions.map((option) => {
        const selected = option.value === preference.brandTheme
        return (
          <button
            key={option.value}
            type="button"
            className={clsx('theme-choice', selected && 'theme-choice-selected')}
            onClick={() => setPreference({ ...preference, brandTheme: option.value })}
            aria-pressed={selected}
          >
            <span className="flex items-center gap-2">
              {option.swatches.map((swatch) => (
                <span key={swatch} className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: swatch }} />
              ))}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[13px] font-semibold text-ink-900">{option.label}</span>
              <span className="block text-[11px] text-ink-500">{option.note}</span>
            </span>
            {selected ? <Check className="h-4 w-4 text-[var(--brand-primary)]" /> : null}
          </button>
        )
      })}
    </div>
  )
}
