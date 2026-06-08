import {
  Activity,
  BadgeAlert,
  Bird,
  ChevronRight,
  ClipboardCheck,
  Home,
  Package,
  ShieldCheck,
  ShoppingCart,
  Soup,
  Syringe,
  Truck,
  Warehouse,
  Wheat,
  TrendingUp,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'

import api from '@/services/api'

interface DashboardOverview {
  kpis: {
    total_birds: number
    active_houses: number
    total_houses: number
    feed_stock_kg: number
    feed_used_today_kg: number
    mortality_today: number
    mortality_rate_today: number
    meat_stock_kg: number
    sales_today: number
    compliance_alerts: number
  }
  feed_stock: Array<{
    id: number
    name: string
    category: string
    unit: string
    current_stock: number
    reorder_threshold: number
    status: string
  }>
  houses: Array<{
    id: number
    name: string
    birds: number
    active_batches: number
    feed_today_kg: number
    mortality_today: number
    vaccination_due: number
    status: string
  }>
  slaughter_stock: Array<{
    id: number
    product: string
    kg: number
    unit: string
    status: string
  }>
  sales: {
    cash_sales: number
    mobile_money_sales: number
    bank_sales: number
    pending_payments: number
    orders_today: number
    top_product: string | null
  }
  recent_transfers: Array<{
    id: number
    reference: string
    movement_type: string
    item: string
    quantity: number
    unit: string
    status: string
    created_at: string
  }>
  compliance_documents: Array<{
    id: number
    title: string
    document_type: string
    expiry_date: string | null
    days_left: number | null
    status: string
  }>
  slaughter_summary: {
    birds_received_today: number
    dressed_weight_today_kg: number
    average_yield_percentage: number
    byproducts_kg: number
  }
}

type IconType = ComponentType<{ className?: string }>

function formatNumber(value: number, decimals = 0) {
  return value.toLocaleString('en-UG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatMoney(value: number) {
  if (value >= 1_000_000) return `UGX ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `UGX ${(value / 1_000).toFixed(0)}K`
  return `UGX ${formatNumber(value)}`
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' })
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function todayLabel() {
  return new Date().toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function ActionButton({ children, to, primary = false }: { children: string; to: string; primary?: boolean }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className={primary ? 'erp-action-primary' : 'erp-action'}
    >
      {children}
    </button>
  )
}

interface KpiCardProps {
  title: string
  value: string
  note: string
  icon: IconType
  accent: string
  iconBg: string
  iconColor: string
  trend?: 'up' | 'down' | 'neutral'
}

function KpiCard({ title, value, note, icon: Icon, accent, iconBg, iconColor, trend }: KpiCardProps) {
  return (
    <div className="erp-kpi-premium" style={{ '--kpi-accent': accent } as React.CSSProperties}>
      <div className="erp-kpi-accent-bar" />
      <div className="flex items-start gap-3 p-4 pt-5">
        <div className="erp-kpi-icon-premium shrink-0" style={{ background: iconBg, color: iconColor }}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="erp-kpi-title">{title}</div>
          <div className="erp-kpi-value mt-1">{value}</div>
          <div className="mt-1.5 flex items-center gap-1.5">
            {trend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" />}
            {trend === 'down' && <TrendingUp className="h-3 w-3 text-red-400 shrink-0 rotate-180" />}
            <span className="erp-kpi-note">{note}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SignalCard({ label, value, icon: Icon, tone = 'neutral' }: { label: string; value: string; icon: IconType; tone?: 'danger' | 'warning' | 'success' | 'neutral' }) {
  const iconCls: Record<string, string> = {
    danger: 'text-red-500',
    warning: 'text-amber-500',
    success: 'text-emerald-500',
    neutral: 'text-[var(--brand-primary)]',
  }
  return (
    <div className="erp-signal-premium">
      <div className="erp-signal-icon">
        <Icon className={`h-4 w-4 ${iconCls[tone]}`} />
      </div>
      <div className="min-w-0">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{label}</div>
        <div className="mt-0.5 text-[15px] font-bold leading-5 text-[var(--text-strong)]">{value}</div>
      </div>
    </div>
  )
}

function MiniStat({ title, value, note, icon: Icon, color = 'var(--brand-primary)' }: { title: string; value: string; note?: string; icon: IconType; color?: string }) {
  return (
    <div className="erp-mini-stat-premium">
      <div className="erp-mini-icon" style={{ background: `${color}14`, color }}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{title}</div>
        <div className="mt-0.5 text-[16px] font-bold leading-5 text-[var(--text-strong)]">{value}</div>
        {note ? <div className="text-[10.5px] text-[var(--text-muted)] mt-0.5">{note}</div> : null}
      </div>
    </div>
  )
}

function PanelHeader({ title, viewAllTo, icon: Icon }: { title: string; viewAllTo: string; icon?: IconType }) {
  const navigate = useNavigate()
  return (
    <div className="erp-panel-header">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[rgba(var(--brand-primary-rgb),0.1)]">
            <Icon className="h-4 w-4 text-[var(--brand-primary)]" />
          </div>
        )}
        <h2 className="text-[13.5px] font-bold text-[var(--text-strong)]">{title}</h2>
      </div>
      <button
        type="button"
        onClick={() => navigate(viewAllTo)}
        className="flex items-center gap-0.5 text-[11px] font-semibold text-[var(--brand-primary)] hover:underline"
      >
        View all <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function Panel({ title, viewAllTo, children, icon }: { title: string; viewAllTo: string; children: ReactNode; icon?: IconType }) {
  return (
    <section className="erp-panel-premium">
      <PanelHeader title={title} viewAllTo={viewAllTo} icon={icon} />
      <div className="p-4">{children}</div>
    </section>
  )
}

function Status({ value }: { value: string }) {
  const normalized = value.toLowerCase()
  const isRed = normalized.includes('low') || normalized.includes('expired') || normalized.includes('critical')
  const isAmber = normalized.includes('pending') || normalized.includes('warning') || normalized.includes('soon')
  const isGreen = normalized.includes('ok') || normalized.includes('active') || normalized.includes('good')

  const cls = isRed
    ? 'bg-red-500/10 text-red-600 border-red-200'
    : isAmber
      ? 'bg-amber-500/10 text-amber-700 border-amber-200'
      : isGreen
        ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
        : 'bg-slate-100 text-slate-600 border-slate-200'

  return (
    <span className={`inline-flex items-center gap-1 rounded-[5px] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] ${cls}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${isRed ? 'bg-red-500' : isAmber ? 'bg-amber-500' : isGreen ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {value}
    </span>
  )
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center">
        <div className="flex flex-col items-center gap-2">
          <AlertCircle className="h-6 w-6 text-slate-300" />
          <span className="text-[12px] font-semibold text-slate-400">{label}</span>
        </div>
      </td>
    </tr>
  )
}

function SkeletonBar({ w = 'w-full', h = 'h-3' }: { w?: string; h?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 ${h} ${w}`} />
}

function LoadingState() {
  return (
    <div className="erp-dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="erp-kpi-premium overflow-hidden">
            <div className="h-1 w-full animate-pulse bg-slate-200" />
            <div className="flex gap-3 p-4 pt-5">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-[8px] bg-slate-200" />
              <div className="flex-1 space-y-2 pt-1">
                <SkeletonBar w="w-20" h="h-2.5" />
                <SkeletonBar w="w-28" h="h-5" />
                <SkeletonBar w="w-32" h="h-2" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-[8px] bg-[var(--surface-soft)] p-3">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-slate-200" />
            <div className="flex-1 space-y-2">
              <SkeletonBar w="w-16" h="h-2" />
              <SkeletonBar w="w-12" h="h-4" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        {[8, 4].map((span, i) => (
          <div key={i} className={`h-[320px] animate-pulse rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-card)] xl:col-span-${span}`} />
        ))}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['erp-dashboard'],
    queryFn: () => api.get<DashboardOverview>('/analytics/erp-dashboard').then((r) => r.data),
    refetchInterval: 60_000,
  })

  if (isLoading) return <LoadingState />

  if (isError || !data) {
    return (
      <div className="erp-panel-premium">
        <div className="p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-400" />
          <h1 className="text-[16px] font-bold text-[var(--text-strong)]">Dashboard unavailable</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Could not load tenant data from the server.</p>
          <button type="button" onClick={() => refetch()} className="erp-action-primary mt-4 inline-flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      </div>
    )
  }

  const { kpis } = data
  const rawFeedStock = data.feed_stock.reduce((sum, item) => sum + item.current_stock, 0)
  const finishedFeedStock = data.feed_stock
    .filter((item) => item.category.toLowerCase().includes('finish') || item.name.toLowerCase().includes('feed'))
    .reduce((sum, item) => sum + item.current_stock, 0)
  const lowStockCount = data.feed_stock.filter((item) => item.status.toLowerCase().includes('low')).length
  const vaccinationDue = data.houses.reduce((sum, house) => sum + house.vaccination_due, 0)

  const onboardingItems = [
    { label: 'Complete farm profile', done: true, to: '/farm/profile' },
    { label: 'Add poultry house or pen', done: data.houses.length > 0, to: '/farm/houses' },
    { label: 'Add first flock or batch', done: kpis.total_birds > 0, to: '/farm/batches' },
    { label: 'Record first feed item', done: data.feed_stock.length > 0, to: '/feed/stock' },
    { label: 'Add users or staff', done: false, to: '/settings/users' },
    { label: 'View dashboard alerts', done: kpis.compliance_alerts + lowStockCount + vaccinationDue > 0, to: '/dashboard' },
  ]
  const onboardingDone = onboardingItems.filter((item) => item.done).length
  const hideOnboarding = localStorage.getItem('farmexa_onboarding_dismissed') === 'true'
  const totalAlerts = kpis.compliance_alerts + lowStockCount + vaccinationDue

  const firstName = user?.full_name?.split(' ')[0] ?? 'there'

  return (
    <div className="erp-dashboard">

      {/* ── Dashboard Header ── */}
      <div className="erp-dash-header">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--brand-primary)]">{todayLabel()}</p>
          <h1 className="mt-0.5 text-[22px] font-extrabold leading-7 tracking-tight text-[var(--text-strong)]">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">Here's what's happening on your farm today.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {totalAlerts > 0 && (
            <button type="button" onClick={() => navigate('/compliance/alerts')} className="flex items-center gap-2 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600 hover:bg-red-100">
              <AlertCircle className="h-3.5 w-3.5" />
              {totalAlerts} alert{totalAlerts !== 1 ? 's' : ''}
            </button>
          )}
          <button type="button" onClick={() => refetch()} className="flex items-center gap-1.5 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2 text-[12px] font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-soft)]">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Live Flock"
          value={formatNumber(kpis.total_birds)}
          note={`${kpis.active_houses} of ${kpis.total_houses} houses active`}
          icon={Bird}
          accent="#3b82f6"
          iconBg="rgba(59,130,246,0.1)"
          iconColor="#3b82f6"
          trend="neutral"
        />
        <KpiCard
          title="Feed Position"
          value={`${formatNumber(kpis.feed_stock_kg)} KG`}
          note={`${formatNumber(kpis.feed_used_today_kg)} KG used today`}
          icon={Package}
          accent="#d6a62e"
          iconBg="rgba(214,166,46,0.12)"
          iconColor="#c99520"
          trend={kpis.feed_stock_kg < 500 ? 'down' : 'up'}
        />
        <KpiCard
          title="Sales Today"
          value={formatMoney(kpis.sales_today)}
          note={`${formatNumber(kpis.meat_stock_kg)} KG meat stock available`}
          icon={ShoppingCart}
          accent="#10b981"
          iconBg="rgba(16,185,129,0.1)"
          iconColor="#10b981"
          trend="up"
        />
        <KpiCard
          title="Risk Watch"
          value={formatNumber(totalAlerts)}
          note={`${kpis.compliance_alerts} compliance · ${lowStockCount} stock · ${vaccinationDue} vaccine`}
          icon={ShieldCheck}
          accent={totalAlerts > 0 ? '#ef4444' : '#10b981'}
          iconBg={totalAlerts > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'}
          iconColor={totalAlerts > 0 ? '#ef4444' : '#10b981'}
          trend={totalAlerts > 0 ? 'down' : 'up'}
        />
      </section>

      {/* ── Signal Band ── */}
      <section className="erp-signal-band">
        <div className="mb-2 px-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Today's Signals</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <SignalCard label="Mortality today" value={`${formatNumber(kpis.mortality_today)} (${formatNumber(kpis.mortality_rate_today, 2)}%)`} icon={Activity} tone={kpis.mortality_rate_today > 1 ? 'danger' : 'success'} />
          <SignalCard label="Vaccinations due" value={formatNumber(vaccinationDue)} icon={Syringe} tone={vaccinationDue > 0 ? 'warning' : 'success'} />
          <SignalCard label="Slaughter received" value={formatNumber(data.slaughter_summary.birds_received_today)} icon={Soup} tone="neutral" />
          <SignalCard label="Orders today" value={formatNumber(data.sales.orders_today)} icon={ShoppingCart} tone="neutral" />
          <SignalCard label="Open payments" value={formatMoney(data.sales.pending_payments)} icon={BadgeAlert} tone={data.sales.pending_payments > 0 ? 'warning' : 'success'} />
        </div>
      </section>

      {/* ── Onboarding Checklist ── */}
      {!hideOnboarding && onboardingDone < onboardingItems.length ? (
        <section className="erp-panel-premium">
          <div className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-[var(--brand-primary)]" />
                  <h2 className="text-[14px] font-bold text-[var(--text-strong)]">Start using Farmexa</h2>
                  <span className="rounded-full bg-[rgba(var(--brand-primary-rgb),0.12)] px-2 py-0.5 text-[11px] font-bold text-[var(--brand-primary)]">
                    {onboardingDone}/{onboardingItems.length}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">Finish these steps to make your dashboard useful.</p>
              </div>
              <button
                type="button"
                className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                onClick={() => { localStorage.setItem('farmexa_onboarding_dismissed', 'true'); window.location.reload() }}
              >
                Dismiss
              </button>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-hover)] transition-all duration-500"
                style={{ width: `${Math.round((onboardingDone / onboardingItems.length) * 100)}%` }}
              />
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {onboardingItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navigate(item.to)}
                  className={`flex items-center gap-3 rounded-[8px] border px-3.5 py-2.5 text-left transition-colors ${
                    item.done
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-default)] hover:border-[var(--brand-primary)] hover:bg-[rgba(var(--brand-primary-rgb),0.04)]'
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${item.done ? 'bg-emerald-500 text-white' : 'bg-[rgba(var(--brand-primary-rgb),0.12)] text-[var(--brand-primary)]'}`}>
                    {item.done ? '✓' : '→'}
                  </span>
                  <span className="text-[12.5px] font-semibold">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Farm + Feed Row ── */}
      <section className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <Panel title="Farm Operations" viewAllTo="/farm/houses" icon={Home}>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat title="Houses" value={`${kpis.active_houses}/${kpis.total_houses}`} note="Active" icon={Home} color="#3b82f6" />
              <MiniStat title="Live Birds" value={formatNumber(kpis.total_birds)} note="Total flock" icon={Bird} color="#8b5cf6" />
              <MiniStat title="Feed Today" value={`${formatNumber(kpis.feed_used_today_kg)} KG`} note="Consumption" icon={Wheat} color="#d6a62e" />
              <MiniStat title="Mortality" value={formatNumber(kpis.mortality_today)} note="Today" icon={BadgeAlert} color={kpis.mortality_today > 0 ? '#ef4444' : '#10b981'} />
            </div>
            <div className="overflow-x-auto rounded-[8px] border border-[var(--border-subtle)]">
              <table className="erp-table-premium">
                <thead>
                  <tr>
                    <th>House</th><th>Birds</th><th>Batches</th><th>Feed Today</th><th>Mortality</th><th>Vaccination Due</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.houses.length === 0 ? (
                    <EmptyRow colSpan={7} label="No houses created yet. Add your first house to get started." />
                  ) : data.houses.slice(0, 6).map((house) => (
                    <tr key={house.id}>
                      <td className="font-semibold">{house.name}</td>
                      <td>{formatNumber(house.birds)}</td>
                      <td>{formatNumber(house.active_batches)}</td>
                      <td>{formatNumber(house.feed_today_kg)} KG</td>
                      <td className={house.mortality_today > 0 ? 'text-red-600 font-bold' : ''}>{formatNumber(house.mortality_today)}</td>
                      <td className={house.vaccination_due > 0 ? 'text-amber-600 font-bold' : ''}>{formatNumber(house.vaccination_due)}</td>
                      <td><Status value={house.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="erp-actions">
              <ActionButton primary to="/farm/mortality">Record Mortality</ActionButton>
              <ActionButton to="/farm/vaccination">Vaccination</ActionButton>
              <ActionButton to="/farm/feed-usage">Feed Usage</ActionButton>
              <ActionButton to="/slaughter/planning">Transfer Birds</ActionButton>
            </div>
          </Panel>
        </div>

        <div className="xl:col-span-4">
          <Panel title="Feed & Inventory" viewAllTo="/feed/stock" icon={Warehouse}>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <MiniStat title="Raw Materials" value={`${formatNumber(rawFeedStock)} KG`} note="All feed stock" icon={Warehouse} color="#d6a62e" />
              <MiniStat title="Finished Feed" value={`${formatNumber(finishedFeedStock)} KG`} note="Named items" icon={Package} color="#8b5cf6" />
              <MiniStat title="Feed Items" value={formatNumber(data.feed_stock.length)} note="Tracked" icon={Wheat} color="#3b82f6" />
              <MiniStat title="Low Stock" value={formatNumber(lowStockCount)} note={lowStockCount > 0 ? 'Needs attention' : 'All good'} icon={Truck} color={lowStockCount > 0 ? '#ef4444' : '#10b981'} />
            </div>
            <div className="overflow-x-auto rounded-[8px] border border-[var(--border-subtle)]">
              <table className="erp-table-premium">
                <thead>
                  <tr><th>Item</th><th>Stock</th><th>Reorder</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {data.feed_stock.length === 0 ? (
                    <EmptyRow colSpan={4} label="No feed stock entered yet." />
                  ) : data.feed_stock.slice(0, 5).map((item) => (
                    <tr key={item.id}>
                      <td className="font-semibold">{item.name}</td>
                      <td>{formatNumber(item.current_stock)} {item.unit}</td>
                      <td>{formatNumber(item.reorder_threshold)} {item.unit}</td>
                      <td><Status value={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="erp-actions">
              <ActionButton primary to="/feed/stock">Feed Items</ActionButton>
              <ActionButton to="/feed/purchases">Purchase</ActionButton>
              <ActionButton to="/feed/consumption">Usage</ActionButton>
            </div>
          </Panel>
        </div>
      </section>

      {/* ── Sales + Compliance Row ── */}
      <section className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <Panel title="Sales, Slaughter & Transfers" viewAllTo="/sales/orders" icon={ShoppingCart}>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat title="Sales Today" value={formatMoney(kpis.sales_today)} icon={ShoppingCart} color="#10b981" />
              <MiniStat title="Meat Stock" value={`${formatNumber(kpis.meat_stock_kg)} KG`} icon={Soup} color="#d6a62e" />
              <MiniStat title="Avg Yield" value={`${formatNumber(data.slaughter_summary.average_yield_percentage, 1)}%`} icon={Activity} color="#8b5cf6" />
              <MiniStat title="Movements" value={formatNumber(data.recent_transfers.length)} icon={Truck} color="#3b82f6" />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="overflow-x-auto rounded-[8px] border border-[var(--border-subtle)]">
                <table className="erp-table-premium">
                  <thead><tr><th>Product</th><th>Qty</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.slaughter_stock.length === 0 ? (
                      <EmptyRow colSpan={3} label="No stock posted yet." />
                    ) : data.slaughter_stock.slice(0, 4).map((item) => (
                      <tr key={item.id}>
                        <td className="font-semibold">{item.product}</td>
                        <td>{formatNumber(item.kg)} {item.unit}</td>
                        <td><Status value={item.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-[8px] border border-[var(--border-subtle)] overflow-hidden">
                <table className="erp-table-premium">
                  <tbody>
                    <tr><td className="text-[var(--text-muted)]">Cash Sales</td><td className="font-semibold text-right">{formatMoney(data.sales.cash_sales)}</td></tr>
                    <tr><td className="text-[var(--text-muted)]">Mobile Money</td><td className="font-semibold text-right">{formatMoney(data.sales.mobile_money_sales)}</td></tr>
                    <tr><td className="text-[var(--text-muted)]">Bank Transfer</td><td className="font-semibold text-right">{formatMoney(data.sales.bank_sales)}</td></tr>
                    <tr><td className="text-[var(--text-muted)]">Top Product</td><td className="font-semibold text-right truncate max-w-[100px]">{data.sales.top_product ?? '—'}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="erp-actions">
              <ActionButton primary to="/sales/orders">Open Sales</ActionButton>
              <ActionButton to="/slaughter/records">Slaughter</ActionButton>
              <ActionButton to="/inventory/movements">Transfers</ActionButton>
              <ActionButton to="/sales/payments">Payments</ActionButton>
            </div>
          </Panel>
        </div>

        <div className="xl:col-span-6">
          <Panel title="Compliance & Quality Control" viewAllTo="/compliance/documents" icon={ShieldCheck}>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <MiniStat title="Documents" value={formatNumber(data.compliance_documents.length)} icon={ShieldCheck} color="#3b82f6" />
              <MiniStat title="Alerts" value={formatNumber(kpis.compliance_alerts)} icon={BadgeAlert} color={kpis.compliance_alerts > 0 ? '#ef4444' : '#10b981'} />
              <MiniStat
                title="Expiring Soon"
                value={formatNumber(data.compliance_documents.filter((doc) => doc.days_left !== null && doc.days_left <= 7).length)}
                icon={ClipboardCheck}
                color="#f59e0b"
              />
            </div>
            <div className="overflow-x-auto rounded-[8px] border border-[var(--border-subtle)]">
              <table className="erp-table-premium">
                <thead>
                  <tr><th>Document</th><th>Type</th><th>Expiry</th><th>Days Left</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {data.compliance_documents.length === 0 ? (
                    <EmptyRow colSpan={5} label="No compliance documents uploaded yet." />
                  ) : data.compliance_documents.slice(0, 5).map((doc) => (
                    <tr key={doc.id}>
                      <td className="font-semibold">{doc.title}</td>
                      <td className="text-[var(--text-muted)]">{doc.document_type}</td>
                      <td>{formatDate(doc.expiry_date)}</td>
                      <td className={doc.days_left !== null && doc.days_left <= 7 ? 'font-bold text-red-600' : ''}>{doc.days_left ?? '—'}</td>
                      <td><Status value={doc.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="erp-actions">
              <ActionButton primary to="/compliance/documents">Upload Document</ActionButton>
              <ActionButton to="/compliance/alerts">Expiry Alerts</ActionButton>
              <ActionButton to="/reports/compliance-expiring">Reports</ActionButton>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  )
}
