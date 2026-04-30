export type ThemeMode = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'farmexa-theme'

export function resolveInitialTheme(): ThemeMode {
  return 'light'
}

export function applyTheme(_theme: ThemeMode) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.dataset.theme = 'light'
  document.documentElement.style.colorScheme = 'light'
  document.body.dataset.theme = 'light'
}
