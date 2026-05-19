import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Bird,
  Building2,
  ChevronDown,
  ClipboardCheck,
  Loader2,
  CreditCard,
  DollarSign,
  Drumstick,
  HelpCircle,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  Scale,
  Search,
  ShoppingCart,
  Skull,
  Syringe,
  UserRound,
  Wheat,
  type LucideIcon,
} from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthContext'
import { ThemeSelector, ThemeToggle } from '@/components/ThemeControls'
import api from '@/services/api'

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

interface TopbarProps {
  onToggleSidebar: () => void
  isSidebarOpen: boolean
  leftOffset?: number
  onOpenSearch: () => void
}

type NotificationTone = 'info' | 'warning' | 'danger'

interface NotificationItem {
  id: string
  title: string
  description: string
  icon: LucideIcon
  tone: NotificationTone
  href?: string
}

interface QuickAction {
  label: string
  description: string
  icon: LucideIcon
  href: string
  enabled: boolean
  state?: Record<string, unknown>
}

interface QuickSection {
  title: string
  items: QuickAction[]
}

interface ComplianceAlertSummary {
  document_id: number
  title: string
  document_type: string
  status: string
  expiry_date: string | null
  days_to_expiry: number | null
  reminder_offsets: number[]
}

interface ComplianceSummaryResponse {
  alerts: ComplianceAlertSummary[]
}

interface InventoryItemSummary {
  id: number
  name: string
  unit_of_measure: string
  current_quantity: number
  reorder_level: number
}

interface InvoiceCustomerSummary {
  name?: string | null
}

interface InvoiceSummary {
  id: number
  invoice_number: string
  status: 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'cancelled'
  due_date: string
  total_amount: number
  paid_amount: number
  customer?: InvoiceCustomerSummary | null
}

interface SlaughterRecordSummary {
  id: number
  slaughter_date: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  inventory_posted_at?: string | null
  batch?: { batch_number?: string | null } | null
}

export function Topbar({ onToggleSidebar, isSidebarOpen, leftOffset = 0, onOpenSearch }: TopbarProps) {
  const { user, tenant, logout, hasPermission, hasModuleAccess } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const [farmOpen, setFarmOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)

  const searchShortcut = useMemo(() => {
    if (typeof navigator === 'undefined') return 'Ctrl K'
    return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? '⌘ K' : 'Ctrl K'
  }, [])
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
    <header
      className={clsx('topbar fixed right-0 top-0 z-30 flex h-[56px] items-center gap-4 border-b px-4 lg:px-5', isDevAdmin && 'bg-[var(--brand-secondary)] text-white')}
      style={{ left: leftOffset, transition: 'left 300ms cubic-bezier(0.4,0,0.2,1)' }}
    >
      <button type="button" onClick={onToggleSidebar} className={clsx('flex h-8 w-8 items-center justify-center rounded-md transition-colors', isDevAdmin ? 'text-white hover:bg-white/10' : 'text-[#111827] hover:bg-slate-100')} aria-label="Toggle navigation">
        {isSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
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

      {!isDevAdmin ? (
        <div className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setQuickOpen((open) => !open)}
            className="flex items-center gap-1.5 rounded-[7px] border border-transparent bg-[var(--brand-primary)] px-3 py-1.5 text-[12px] font-extrabold text-[#111827] hover:bg-[#e1b23b] transition-colors"
          >
            ⚡ Quick
            <ChevronDown className={clsx('h-3 w-3 transition-transform', quickOpen && 'rotate-180')} />
          </button>
          {quickOpen ? (
            <>
              <button type="button" className="fixed inset-0 z-30" onClick={() => setQuickOpen(false)} />
            <div className="absolute left-0 top-full z-40 mt-1.5 w-56 overflow-hidden rounded-[10px] border border-[#e8dcc3] bg-white shadow-xl">
              <div className="border-b border-[#efe5d2] px-4 py-2">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-400">Farm Operations</div>
              </div>
              {[
                { label: 'New Batch', path: '/farm/batches', icon: Bird },
                { label: 'Record Mortality', path: '/farm/mortality', icon: Skull },
                { label: 'Log Vaccination', path: '/farm/vaccination', icon: Syringe },
                { label: 'Log Growth / Weight', path: '/farm/growth', icon: Scale },
                { label: 'Log Feed Usage', path: '/farm/feed-usage', icon: Wheat },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <button key={item.path} type="button" onClick={() => { setQuickOpen(false); navigate(item.path) }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-[#111827] hover:bg-[#fff7e2]">
                    <Icon className="h-4 w-4 text-[#b98512] shrink-0" />
                    {item.label}
                  </button>
                )
              })}
              <div className="border-t border-[#efe5d2] px-4 py-2">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-400">Sales & Finance</div>
              </div>
              {[
                { label: 'New Sale / Invoice', path: '/sales/invoices', icon: ShoppingCart },
                { label: 'New Expense', path: '/finance/expenses', icon: DollarSign },
                { label: 'Slaughter Record', path: '/slaughter', icon: Drumstick },
                { label: 'Inventory', path: '/inventory', icon: Package },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <button key={item.path} type="button" onClick={() => { setQuickOpen(false); navigate(item.path) }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-[#111827] hover:bg-[#fff7e2]">
                    <Icon className="h-4 w-4 text-[#b98512] shrink-0" />
                    {item.label}
                  </button>
                )
              })}
            </div>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="flex-1" />

      <div className="hidden w-full max-w-[270px] lg:block">
        <button
          type="button"
          onClick={onOpenSearch}
          className="group flex h-9 w-full items-center justify-between gap-3 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 text-[12px] text-[var(--text-muted)] transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--text-strong)]"
          aria-label="Open global search"
        >
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-500 transition-colors group-hover:text-[var(--brand-primary)]" />
            <span className="truncate">Search anything…</span>
          </span>
          <span className="hidden rounded-[6px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)] sm:block">
            {searchShortcut}
          </span>
        </button>
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
