import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, ClipboardPlus, Egg, FilePlus2, LogOut, Menu, Search, Settings, Skull } from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/features/auth/AuthContext'
import { ROLE_LABELS } from '@/lib/branding'

export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user, logout, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)

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
  const profileLabel = user?.job_title ?? roleLabel
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

  return (
    <header className="topbar fixed right-0 top-0 z-30 flex h-[68px] items-center gap-3 px-4 sm:px-5 lg:px-6">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-default)] lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="lg:hidden">
        <BrandMark compact />
      </div>

      <div className="hidden w-full max-w-[420px] lg:block">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[var(--text-muted)]" />
          <input type="search" placeholder="Search records, modules, tenants" className="form-input h-11 rounded-full border-[var(--border-subtle)] bg-[var(--surface-soft)] pl-11" />
        </div>
      </div>

      <div className="flex-1" />

      <div className="relative hidden sm:block">
        <button
          type="button"
          onClick={() => setQuickOpen((open) => !open)}
          className="btn-secondary h-9 rounded-full px-4"
        >
          <ClipboardPlus className="h-[15px] w-[15px] text-[var(--brand-primary)]" />
          Quick
          <ChevronDown className={clsx('h-[15px] w-[15px] text-[var(--text-muted)] transition-transform', quickOpen && 'rotate-180')} />
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
                    className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-[13px] font-medium text-[var(--text-default)] hover:bg-[var(--surface-muted)]"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-50 text-[var(--brand-primary)]">
                      <Icon className="h-[15px] w-[15px]" />
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
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-default)]"
        aria-label="Notifications"
      >
        <Bell className="h-[15px] w-[15px]" />
        <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[var(--brand-primary)] ring-2 ring-[var(--surface-card)]" />
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setProfileOpen((open) => !open)}
          className="flex items-center gap-2.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[11px] font-bold text-[var(--brand-secondary)]">{initials}</div>
          <div className="hidden text-left sm:block">
            <div className="text-[12px] font-semibold leading-tight text-[var(--text-strong)]">{user?.full_name ?? 'Loading...'}</div>
            <div className="text-[11px] leading-tight text-[var(--text-muted)]">{profileLabel}</div>
          </div>
          <ChevronDown className={clsx('hidden h-[15px] w-[15px] text-[var(--text-muted)] sm:block', profileOpen && 'rotate-180')} />
        </button>

        {profileOpen ? (
          <>
            <button type="button" className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
            <div className="card absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden">
              <div className="border-b border-[var(--border-subtle)] px-4 py-4">
                <div className="text-sm font-semibold text-[var(--text-strong)]">{user?.full_name}</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">{user?.email}</div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{profileLabel}</div>
              </div>
              <div className="p-2">
                {hasPermission('settings:read') ? (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false)
                      navigate('/settings/config')
                    }}
                    className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-[13px] font-medium text-[var(--text-default)] hover:bg-[var(--surface-muted)]"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-[var(--brand-primary)]">
                      <Settings className="h-4 w-4" />
                    </span>
                    Settings
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-[13px] font-medium text-[var(--text-default)] hover:bg-[var(--surface-muted)]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-[var(--brand-primary)]">
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
