import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, ClipboardPlus, Egg, FilePlus2, LogOut, Menu, Moon, Search, Settings, Skull, Sun } from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/features/auth/AuthContext'
import { ROLE_LABELS } from '@/lib/branding'
import { THEME_STORAGE_KEY, applyTheme, type ThemeMode } from '@/lib/theme'

export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user, logout, hasPermission, tenant } = useAuth()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>('light')

  useEffect(() => {
    const currentTheme = document.documentElement.dataset.theme
    setTheme(currentTheme === 'dark' ? 'dark' : 'light')
  }, [])

  const initials = useMemo(
    () =>
      user?.full_name
        .split(' ')
        .map((name) => name[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() ?? 'FX',
    [user?.full_name]
  )

  const roleLabel = user?.role?.name ? ROLE_LABELS[user.role.name] ?? user.role.name : 'User'
  const quickActions = [
    { label: 'Batch', icon: ClipboardPlus, path: '/farm/batches' },
    { label: 'Eggs', icon: Egg, path: '/farm/eggs' },
    { label: 'Mortality', icon: Skull, path: '/farm/mortality' },
    hasPermission('dev_admin:read')
      ? { label: 'Vendor', icon: FilePlus2, path: '/dev-admin/tenants' }
      : { label: 'Settings', icon: Settings, path: '/settings/config' },
  ]

  const handleLogout = async () => {
    setProfileOpen(false)
    try {
      await logout()
    } catch {
      toast.error('Sign-out failed. Please try again.')
    }
  }

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'light' ? 'dark' : 'light'
    applyTheme(nextTheme)
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    setTheme(nextTheme)
  }

  return (
    <header className="topbar fixed right-0 top-0 z-30 flex h-[72px] items-center gap-3 px-4 sm:px-6">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="flex h-10 w-10 items-center justify-center rounded-2xl border bg-[var(--surface-card)] text-[var(--text-default)] lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      <div className="lg:hidden">
        <BrandMark compact />
      </div>

      <div className="hidden w-full max-w-sm lg:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input type="search" placeholder="Search" className="form-input h-11 pl-10" />
        </div>
      </div>

      <div className="flex-1" />

      <div className="relative hidden sm:block">
        <button
          type="button"
          onClick={() => setQuickOpen((open) => !open)}
          className="btn-secondary"
        >
          <ClipboardPlus className="h-4 w-4 text-[var(--brand-primary)]" />
          Quick
          <ChevronDown className={clsx('h-4 w-4 text-[var(--text-muted)] transition-transform', quickOpen && 'rotate-180')} />
        </button>
        {quickOpen ? (
          <>
            <button type="button" className="fixed inset-0 z-30" onClick={() => setQuickOpen(false)} />
            <div className="card absolute right-0 top-full z-40 mt-2 w-56 p-2">
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.path}
                    type="button"
                    onClick={() => {
                      setQuickOpen(false)
                      navigate(action.path)
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-[var(--text-default)] hover:bg-[var(--surface-soft)]"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(52,168,83,0.12)] text-[var(--brand-primary)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    {action.label}
                  </button>
                )
              })}
            </div>
          </>
        ) : null}
      </div>

      <button
        type="button"
        onClick={toggleTheme}
        className="flex h-10 w-10 items-center justify-center rounded-2xl border bg-[var(--surface-card)] text-[var(--brand-primary)]"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
      </button>

      <button
        type="button"
        className="relative flex h-10 w-10 items-center justify-center rounded-2xl border bg-[var(--surface-card)] text-[var(--text-default)]"
        aria-label="Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[var(--brand-primary)] ring-2 ring-[var(--surface-card)]" />
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setProfileOpen((open) => !open)}
          className="flex items-center gap-3 rounded-2xl border bg-[var(--surface-card)] px-3 py-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--brand-primary)] text-xs font-bold text-white">{initials}</div>
          <div className="hidden text-left sm:block">
            <div className="text-sm font-semibold text-[var(--text-strong)]">{user?.full_name ?? 'Loading...'}</div>
            <div className="text-xs text-[var(--text-muted)]">{tenant?.name ?? roleLabel}</div>
          </div>
          <ChevronDown className={clsx('hidden h-4 w-4 text-[var(--text-muted)] sm:block', profileOpen && 'rotate-180')} />
        </button>

        {profileOpen ? (
          <>
            <button type="button" className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
            <div className="card absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden">
              <div className="border-b px-4 py-4">
                <div className="text-sm font-semibold text-[var(--text-strong)]">{user?.full_name}</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">{user?.email}</div>
              </div>
              <div className="p-2">
                {hasPermission('settings:read') ? (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false)
                      navigate('/settings/config')
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-[var(--text-default)] hover:bg-[var(--surface-soft)]"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--brand-primary)]">
                      <Settings className="h-4 w-4" />
                    </span>
                    Settings
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-[var(--text-default)] hover:bg-[var(--surface-soft)]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--brand-primary)]">
                    <LogOut className="h-4 w-4" />
                  </span>
                  Sign out
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </header>
  )
}
