import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  ClipboardList,
  DollarSign,
  Egg,
  LogOut,
  Menu,
  PlusCircle,
  Search,
  Settings,
  Skull,
} from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/features/auth/AuthContext'
import { ROLE_LABELS } from '@/lib/branding'
import type { ThemeMode } from '@/lib/theme'

const QUICK_ACTIONS = [
  { label: 'Add Batch', icon: ClipboardList, path: '/farm/batches' },
  { label: 'Record Egg Production', icon: Egg, path: '/farm/eggs' },
  { label: 'Record Mortality', icon: Skull, path: '/farm/mortality' },
  { label: 'Add Expense', icon: DollarSign, path: '/finance/expenses' },
]

export function Topbar({
  onOpenSidebar,
  onToggleTheme,
  theme,
}: {
  onOpenSidebar: () => void
  onToggleTheme: () => void
  theme: ThemeMode
}) {
  const { user, logout, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const initials = useMemo(
    () =>
      user?.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() ?? 'FM',
    [user?.full_name]
  )

  const roleLabel = user?.role?.name ? ROLE_LABELS[user.role.name] ?? user.role.name : 'User'

  const handleLogout = async () => {
    setProfileOpen(false)
    try {
      await logout()
    } catch {
      toast.error('Sign-out failed. Please try again.')
    }
  }

  return (
    <header
      className="topbar"
      style={{
        left: 0,
        height: '3.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--topbar-bg)',
        backdropFilter: 'blur(18px)',
        position: 'fixed',
        top: 0,
        right: 0,
        zIndex: 30,
      }}
    >
      {/* Mobile menu button */}
      <button
        type="button"
        id="sidebar-toggle"
        onClick={onOpenSidebar}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)] lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      {/* Brand (mobile only) */}
      <div className="lg:hidden">
        <BrandMark compact />
      </div>

      {/* Search */}
      <div className="hidden flex-1 max-w-xs lg:flex">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            ref={searchRef}
            id="topbar-search"
            type="search"
            placeholder="Search…"
            className="h-9 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] pl-9 pr-3 text-sm text-[var(--text-default)] placeholder:text-[var(--text-muted)] focus:border-[#1E7A3A]/40 focus:bg-[var(--surface-strong)] focus:outline-none focus:ring-2 focus:ring-[#1E7A3A]/15 transition-all"
          />
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Quick Actions */}
      <div className="relative hidden sm:block">
        <button
          id="quick-actions-btn"
          type="button"
          onClick={() => setQuickOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-medium text-[var(--text-default)] transition-colors hover:border-[#1E7A3A]/30 hover:bg-[#1E7A3A]/5"
        >
          <PlusCircle className="h-4 w-4 text-[#1E7A3A]" />
          Quick Add
          <ChevronDown className={clsx('h-3.5 w-3.5 text-[var(--text-muted)] transition-transform', quickOpen ? 'rotate-180' : '')} />
        </button>
        {quickOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-30"
              onClick={() => setQuickOpen(false)}
            />
            <div className="absolute right-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[0_16px_48px_-20px_rgba(0,0,0,0.22)]">
              <div className="p-1.5">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon
                  return (
                    <button
                      key={action.path}
                      type="button"
                      onClick={() => {
                        setQuickOpen(false)
                        navigate(action.path)
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text-default)] transition-colors hover:bg-[var(--surface-soft)]"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1E7A3A]/10 text-[#1E7A3A]">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {action.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Notifications */}
      <button
        id="notifications-btn"
        type="button"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
        aria-label="Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {/* Unread dot */}
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#1E7A3A] ring-2 ring-[var(--surface-strong)]" />
      </button>

      {/* Profile dropdown */}
      <div className="relative">
        <button
          id="profile-menu-btn"
          type="button"
          onClick={() => setProfileOpen((o) => !o)}
          className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] px-2.5 py-1.5 transition-colors hover:border-[#1E7A3A]/20 hover:bg-[var(--surface-soft)]"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1E7A3A] text-[11px] font-bold text-white">
            {initials}
          </div>
          <div className="hidden text-left sm:block">
            <div className="text-[13px] font-semibold leading-none text-[var(--text-strong)]">
              {user?.full_name ?? '…'}
            </div>
          </div>
          <ChevronDown className={clsx('hidden h-3.5 w-3.5 text-[var(--text-muted)] transition-transform sm:block', profileOpen ? 'rotate-180' : '')} />
        </button>

        {profileOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-30"
              onClick={() => setProfileOpen(false)}
            />
            <div className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[0_16px_48px_-20px_rgba(0,0,0,0.22)]">
              <div className="border-b border-[var(--border-subtle)] px-4 py-3.5">
                <div className="text-sm font-semibold text-[var(--text-strong)]">{user?.full_name}</div>
                <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{user?.email}</div>
                <div className="mt-2 inline-flex items-center rounded-md bg-[#1E7A3A]/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1E7A3A]">
                  {roleLabel}
                </div>
              </div>

              <div className="p-1.5">
                {hasPermission('settings:read') && (
                  <button
                    type="button"
                    onClick={() => { setProfileOpen(false); navigate('/settings/config') }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text-default)] transition-colors hover:bg-[var(--surface-soft)]"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface-soft)]">
                      <Settings className="h-3.5 w-3.5" />
                    </span>
                    Settings
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/8"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10">
                    <LogOut className="h-3.5 w-3.5" />
                  </span>
                  Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
