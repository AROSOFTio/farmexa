import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Building2, ChevronDown, CreditCard, HelpCircle, LogOut, Menu, Search, UserRound } from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthContext'
import { ThemeSelector, ThemeToggle } from '@/components/ThemeControls'

function titleFromPath(pathname: string) {
  if (pathname.startsWith('/dev-admin')) return 'Dev Admin Dashboard'
  if (pathname.startsWith('/feed-mill')) return 'Feed Mill'
  if (pathname.startsWith('/farm')) return 'Farm Operations'
  if (pathname.startsWith('/inventory')) return 'Inventory & Transfers'
  if (pathname.startsWith('/slaughter')) return 'Slaughter'
  if (pathname.startsWith('/sales')) return 'Sales & POS'
  if (pathname.startsWith('/finance')) return 'Finance'
  if (pathname.startsWith('/compliance')) return 'Compliance'
  if (pathname.startsWith('/reports')) return 'Reports'
  if (pathname.startsWith('/settings')) return 'Settings'
  return 'Dashboard'
}

export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user, tenant, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const [farmOpen, setFarmOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const initials = useMemo(() => {
    const source = user?.full_name || user?.email || 'NF'
    return source.split(/[ @.]/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  }, [user])

  const isDevAdmin = user?.role?.name === 'developer_admin'
  const title = titleFromPath(location.pathname)
  const trialLabel = useMemo(() => {
    if (!tenant) return null
    if (tenant.is_profile_only || tenant.subscription_status === 'expired') return 'Trial Expired'
    if (tenant.subscription_status === 'trial' && tenant.subscription_expiry) {
      const days = Math.max(Math.ceil((new Date(tenant.subscription_expiry).getTime() - Date.now()) / 86_400_000), 0)
      return `Trial: ${days} days remaining`
    }
    return 'Subscription Active'
  }, [tenant])

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      toast.error('Sign-out failed. Please try again.')
    }
  }

  return (
    <header className={clsx('topbar fixed right-0 top-0 z-30 flex h-[56px] items-center gap-4 border-b px-4 lg:px-5', isDevAdmin && 'bg-[var(--brand-secondary)] text-white')}>
      <button type="button" onClick={onOpenSidebar} className={clsx('flex h-8 w-8 items-center justify-center rounded-md', isDevAdmin ? 'text-white hover:bg-white/10' : 'text-[#111827] hover:bg-slate-100')} aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 items-center gap-7">
        <h1 className={clsx('text-[18px] font-extrabold', isDevAdmin ? 'text-white' : 'text-[#111827]')}>{title}</h1>
        {!isDevAdmin ? (
          <div className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setFarmOpen((open) => !open)}
              className="flex items-center gap-2 rounded-[7px] border border-transparent px-2 py-1.5 text-[13px] font-semibold text-[#111827] hover:border-[#e6ddc8] hover:bg-[#fffaf0]"
            >
              Farm: {tenant?.name ?? 'Tenant Workspace'}
              <ChevronDown className={clsx('h-3.5 w-3.5 transition-transform', farmOpen && 'rotate-180')} />
            </button>
            {farmOpen ? (
              <>
                <button type="button" className="fixed inset-0 z-30" onClick={() => setFarmOpen(false)} />
                <div className="absolute left-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-[10px] border border-[#e8dcc3] bg-white shadow-xl">
                  <div className="border-b border-[#efe5d2] px-4 py-3">
                    <div className="text-[13px] font-extrabold text-[#111827]">{tenant?.name ?? 'Tenant Workspace'}</div>
                    <div className="text-[12px] text-slate-500">{tenant?.subscription_status ?? 'active'} plan workspace</div>
                  </div>
                  {[
                    { label: 'Farm Profile', path: '/farm/profile', icon: Building2 },
                    { label: 'Subscription', path: '/subscription/upgrade', icon: CreditCard },
                    { label: 'Support', path: '/support', icon: HelpCircle },
                  ].map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => {
                          setFarmOpen(false)
                          navigate(item.path)
                        }}
                        className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] font-bold text-[#111827] hover:bg-[#fff7e2]"
                      >
                        <Icon className="h-4 w-4 text-[#b98512]" />
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex-1" />

      <div className="hidden w-full max-w-[270px] lg:block">
        <div className="relative">
          <input
            className="h-9 w-full rounded-[8px] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 pr-9 text-[12px] text-[var(--text-strong)] outline-none placeholder:text-slate-400 focus:border-[var(--brand-primary)]"
            placeholder="Search anything..."
          />
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </div>
      </div>

      {trialLabel ? (
        <button type="button" onClick={() => navigate('/subscription')} className="hidden h-9 rounded-[9px] bg-gradient-to-r from-[#e1b23b] to-[#c99316] px-4 text-[12px] font-extrabold text-[#111827] md:inline-flex md:items-center">
          {trialLabel}
        </button>
      ) : null}

      <div className="hidden items-center gap-2 md:flex">
        <ThemeSelector compact />
        <ThemeToggle />
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setNotificationsOpen((open) => !open)}
          className={clsx('relative flex h-9 w-9 items-center justify-center rounded-full border', isDevAdmin ? 'border-white/20 text-white' : 'border-[#e6ddc8] text-[#111827]')}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--brand-primary)]" />
        </button>
        {notificationsOpen ? (
          <>
            <button type="button" className="fixed inset-0 z-30" onClick={() => setNotificationsOpen(false)} />
            <div className="absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-[10px] border border-[#e8dcc3] bg-white shadow-xl">
              <div className="border-b border-[#efe5d2] px-4 py-3">
                <div className="text-[13px] font-extrabold text-[#111827]">Notifications</div>
                <div className="text-[12px] text-slate-500">Tenant alerts and trial messages.</div>
              </div>
              <button type="button" onClick={() => { setNotificationsOpen(false); navigate('/compliance/alerts') }} className="block w-full px-4 py-3 text-left hover:bg-[#fff7e2]">
                <div className="text-[13px] font-bold text-[#111827]">Compliance alerts</div>
                <div className="text-[12px] text-slate-500">Review documents due for renewal.</div>
              </button>
              <button type="button" onClick={() => { setNotificationsOpen(false); navigate('/subscription/upgrade') }} className="block w-full px-4 py-3 text-left hover:bg-[#fff7e2]">
                <div className="text-[13px] font-bold text-[#111827]">{trialLabel ?? 'Subscription'}</div>
                <div className="text-[12px] text-slate-500">Open billing and subscription options.</div>
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div className="relative">
        <button type="button" onClick={() => setProfileOpen((open) => !open)} className={clsx('flex items-center gap-2 rounded-[9px] px-2 py-1.5', isDevAdmin ? 'text-white hover:bg-white/10' : 'text-[#111827] hover:bg-slate-50')}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[11px] font-semibold text-[#111827]">{initials}</span>
          <span className="hidden min-w-0 text-left sm:block">
            <span className={clsx('block truncate text-[12px] font-extrabold leading-4', isDevAdmin ? 'text-white' : 'text-[#111827]')}>{tenant?.name ?? user?.full_name ?? 'Ngali Farm'}</span>
            <span className={clsx('block text-[10px] leading-3', isDevAdmin ? 'text-white/70' : 'text-slate-500')}>{user?.job_title ?? 'Admin'}</span>
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 sm:block" />
        </button>

        {profileOpen ? (
          <>
            <button type="button" className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
            <div className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-[10px] border border-[#e8dcc3] bg-white shadow-xl">
              <div className="border-b border-[#efe5d2] px-4 py-3">
                <div className="text-[13px] font-extrabold text-[#111827]">{user?.full_name}</div>
                <div className="text-[12px] text-slate-500">{user?.email}</div>
              </div>
              <button type="button" onClick={() => { setProfileOpen(false); navigate('/settings/profile') }} className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] font-bold text-[#111827] hover:bg-[#fff7e2]">
                <UserRound className="h-4 w-4 text-[#b98512]" />
                Profile
              </button>
              <div className="border-t border-[#efe5d2] px-4 py-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Theme</div>
                <ThemeSelector />
              </div>
              <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] font-bold text-[#111827] hover:bg-[#fff7e2]">
                <LogOut className="h-4 w-4 text-[#b98512]" />
                Logout
              </button>
            </div>
          </>
        ) : null}
      </div>
    </header>
  )
}
