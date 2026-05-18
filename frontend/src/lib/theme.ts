export type AppearanceMode = 'light' | 'dark'
export type BrandTheme = 'navy-gold' | 'green-black'
export type ThemeMode = AppearanceMode

export interface ThemePreference {
  brandTheme: BrandTheme
  appearance: AppearanceMode
}

export const THEME_STORAGE_KEY = 'farmexa-theme'
export const BRAND_THEME_STORAGE_KEY = 'farmexa-brand-theme'
export const APPEARANCE_STORAGE_KEY = 'farmexa-appearance'
export const THEME_CHANGE_EVENT = 'farmexa-theme-change'

const DEFAULT_THEME: ThemePreference = {
  brandTheme: 'navy-gold',
  appearance: 'light',
}

function isAppearance(value: string | null): value is AppearanceMode {
  return value === 'light' || value === 'dark'
}

function isBrandTheme(value: string | null): value is BrandTheme {
  return value === 'navy-gold' || value === 'green-black'
}

export function resolveInitialTheme(): ThemePreference {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME
  }

  const legacyTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  const storedAppearance = window.localStorage.getItem(APPEARANCE_STORAGE_KEY)
  const storedBrandTheme = window.localStorage.getItem(BRAND_THEME_STORAGE_KEY)

  return {
    brandTheme: isBrandTheme(storedBrandTheme) ? storedBrandTheme : DEFAULT_THEME.brandTheme,
    appearance: isAppearance(storedAppearance) ? storedAppearance : isAppearance(legacyTheme) ? legacyTheme : DEFAULT_THEME.appearance,
  }
}

export function applyTheme(theme: ThemePreference | AppearanceMode) {
  if (typeof document === 'undefined') {
    return
  }

  const preference = typeof theme === 'string' ? { ...resolveInitialTheme(), appearance: theme } : theme

  document.documentElement.dataset.brandTheme = preference.brandTheme
  document.documentElement.dataset.appearance = preference.appearance
  document.documentElement.dataset.theme = preference.appearance
  document.documentElement.style.colorScheme = preference.appearance
  document.body.dataset.brandTheme = preference.brandTheme
  document.body.dataset.appearance = preference.appearance
  document.body.dataset.theme = preference.appearance
}

export function persistThemePreference(preference: ThemePreference) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(BRAND_THEME_STORAGE_KEY, preference.brandTheme)
  window.localStorage.setItem(APPEARANCE_STORAGE_KEY, preference.appearance)
  window.localStorage.setItem(THEME_STORAGE_KEY, preference.appearance)
  applyTheme(preference)
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: preference }))
}
