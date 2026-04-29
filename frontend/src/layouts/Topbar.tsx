import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, ClipboardPlus, Egg, FilePlus2, LogOut, Menu, Search, Settings, Skull } from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/features/auth/AuthContext'
import { ROLE_LABELS } from '@/lib/branding'

export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user, logout, hasPermission, tenant } = useAuth()
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
  const quickActions = [
    { label: 'Add Batch', icon: ClipboardPlus, path: '/farm/batches' },
    { label: 'Record Eggs', icon: Egg, path: '/farm/eggs' },
    { label: 'Record Mortality', icon: Skull, path: '/farm/mortality' },
    hasPermission('dev_admin:read')
      ? { label: 'Register Vendor', icon: FilePlus2, path: '/dev-admin/tenants' }
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
    <header className="topbar fixed right-0 top-0 z-30 flex h-[72px] items-center gap-3 px-4 sm:px-6">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      <div className="lg:hidden">
        <BrandMark compact />
      </div>

      <div className="hidden w-full max-w-lg lg:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search batches, suppliers, invoices..."
            className="form-input h-11 rounded-2xl border-slate-200/80 bg-white/80 pl-10"
          />
        </div>
      </div>

      <div className="flex-1" />

      <div className="relative hidden sm:block">
        <button
          type="button"
          onClick={() => setQuickOpen((open) => !open)}
          className="btn-secondary rounded-2xl border-slate-200 bg-white/90"
        >
          <ClipboardPlus className="h-4 w-4 text-slate-600" />
          Quick Actions
          <ChevronDown className={clsx('h-4 w-4 text-slate-400 transition-transform', quickOpen && 'rotate-180')} />
        </button>
        {quickOpen ? (
          <>
            <button type="button" className="fixed inset-0 z-30" onClick={() => setQuickOpen(false)} />
            <div className="card absolute right-0 top-full z-40 mt-2 w-60 p-2">
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
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
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

      <button type="button" className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-slate-600" aria-label="Notifications">
        <Bell className="h-4.5 w-4.5" />
        <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setProfileOpen((open) => !open)}
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-xs font-bold text-white">{initials}</div>
          <div className="hidden text-left sm:block">
            <div className="text-sm font-semibold text-slate-900">{user?.full_name ?? 'Loading...'}</div>
            <div className="text-xs text-slate-500">{tenant?.name ?? roleLabel}</div>
          </div>
          <ChevronDown className={clsx('hidden h-4 w-4 text-slate-400 sm:block', profileOpen && 'rotate-180')} />
        </button>

        {profileOpen ? (
          <>
            <button type="button" className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
            <div className="card absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-4">
                <div className="text-sm font-semibold text-slate-900">{user?.full_name}</div>
                <div className="mt-1 text-xs text-slate-500">{user?.email}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="badge badge-brand">{roleLabel}</span>
                  {tenant?.plan ? <span className="badge badge-neutral uppercase">{tenant.plan}</span> : null}
                </div>
              </div>
              <div className="p-2">
                {hasPermission('settings:read') ? (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false)
                      navigate('/settings/config')
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <Settings className="h-4 w-4" />
                    </span>
                    Settings
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-500">
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
