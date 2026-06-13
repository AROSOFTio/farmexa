import {
  Activity,
  AlertCircle,
  Banknote,
  Bird,
  Building2,
  ChevronRight,
  ClipboardList,
  Coins,
  DollarSign,
  Egg,
  Package,
  Plus,
  RefreshCw,
  ShoppingCart,
  Skull,
  Syringe,
  TrendingUp,
  Truck,
  Wallet,
  Wheat,
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useAuth } from '@/features/auth/AuthContext'
import api from '@/services/api'

type IconType = ComponentType<{ className?: string }>

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
    eggs_today?: number
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
}

function formatNumber(value: number, decimals = 0) {
  return value.toLocaleString('en-UG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatMoney(value: number) {
  if (value >= 1_000_000_000) return `UGX ${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `UGX ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `UGX ${(value / 1_000).toFixed(0)}K`
  return `UGX ${formatNumber(value)}`
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

// ─────────────────────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({ title, value, note, icon: Icon, trendStr, trendVal }: { title: string; value: string; note: string; icon: IconType; trendStr: string; trendVal: number }) {
  const isPositive = trendVal >= 0
  const isNeutral = trendVal === 0
  const isDanger = title.toLowerCase().includes('mortality') ? trendVal > 0 : trendVal < 0

  return (
    <div className="flex flex-col justify-between rounded-card border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-[var(--surface-muted)] text-primary shadow-sm">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-text-secondary">{title}</div>
            <div className="mt-1 text-[23px] font-semibold leading-none text-[var(--text-strong)]">{value}</div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1.5 text-[12px]">
        {!isNeutral && (
          <span className={`font-semibold ${isDanger ? 'text-danger' : 'text-success'}`}>
            {isDanger ? '↓' : '↑'} {Math.abs(trendVal)}%
          </span>
        )}
        <span className="text-text-secondary">{trendStr}</span>
      </div>
    </div>
  )
}

function DashboardPanel({ title, viewAllTo, children, action }: { title: string; viewAllTo?: string; children: ReactNode; action?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-card border border-border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-card">
        <h2 className="text-[14px] font-semibold text-[var(--text-strong)]">{title}</h2>
        {action ? (
          action
        ) : viewAllTo ? (
          <button
            type="button"
            onClick={() => navigate(viewAllTo)}
            className="text-[12px] font-semibold text-primary hover:underline"
          >
            View Details
          </button>
        ) : null}
      </div>
      <div className="flex-1 p-5">{children}</div>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const s = status.toLowerCase()
  const isGood = s.includes('good') || s.includes('ok') || s.includes('active')
  const color = isGood ? 'bg-success' : 'bg-warning'
  return (
    <div className="flex items-center gap-2">
      <span className={`block h-2 w-2 rounded-full ${color}`} />
      <span className="text-[12px] text-text-primary capitalize">{status}</span>
    </div>
  )
}

function QuickActionButton({ icon: Icon, label, to }: { icon: IconType; label: string; to: string }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2.5 text-[13px] font-semibold text-text-primary transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary outline-none"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()
  const canViewFinance = hasPermission('finance:read')
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['erp-dashboard'],
    queryFn: () => api.get<DashboardOverview>('/analytics/erp-dashboard').then((r) => r.data),
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="page-container space-y-6">
        <div className="h-20 w-full animate-pulse rounded-card bg-card" />
        <div className="grid gap-5 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-card bg-card" />)}
        </div>
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="h-[400px] animate-pulse rounded-card bg-card lg:col-span-8" />
          <div className="h-[400px] animate-pulse rounded-card bg-card lg:col-span-4" />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="page-container flex h-[60vh] flex-col items-center justify-center text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-danger" />
        <h1 className="text-lg font-bold text-text-primary">Failed to load dashboard</h1>
        <p className="mt-2 text-sm text-text-secondary">Could not fetch ERP metrics from the server.</p>
        <button type="button" onClick={() => refetch()} className="mt-6 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
      </div>
    )
  }

  const { kpis, feed_stock, houses, sales } = data
  const firstName = user?.full_name?.split(' ')[0] ?? 'there'

  // Computed / Mocked Enterprise Metrics
  const totalRevenue = sales.cash_sales + sales.mobile_money_sales + sales.bank_sales + sales.pending_payments + kpis.sales_today
  const netProfit = totalRevenue * 0.34 // Est margin for demo
  const cashPosition = sales.cash_sales + sales.bank_sales + sales.mobile_money_sales
  const eggsToday = kpis.eggs_today || 98440 // fallback if not in API

  // Mock chart data for Row 2
  const chartData = [
    { name: '1 Jun', revenue: 700, expenses: 400 },
    { name: '6 Jun', revenue: 950, expenses: 650 },
    { name: '11 Jun', revenue: 1050, expenses: 550 },
    { name: '16 Jun', revenue: 1100, expenses: 750 },
    { name: '21 Jun', revenue: 900, expenses: 600 },
    { name: '26 Jun', revenue: 1300, expenses: 800 },
    { name: '30 Jun', revenue: 1400, expenses: 850 },
  ]

  // Mock activity data for Row 4 (financial items hidden without finance:read)
  const activities = [
    { id: 1, title: 'Feed received: Layer Mash 5,000 KG', sub: 'Mukono Hatchery', time: '2h ago', icon: Wheat, color: 'text-info', bg: 'bg-info/10', financial: false },
    { id: 2, title: 'Egg collection recorded: 98,440 eggs', sub: 'Kampala Farm', time: '4h ago', icon: Egg, color: 'text-warning', bg: 'bg-warning/10', financial: false },
    { id: 3, title: 'Mortality recorded: 120 birds', sub: 'Jinja Farm - Batch B2405', time: '6h ago', icon: Skull, color: 'text-danger', bg: 'bg-danger/10', financial: false },
    { id: 4, title: 'Invoice created: INV-000245', sub: 'ABC Traders Ltd', time: '8h ago', icon: ClipboardList, color: 'text-primary', bg: 'bg-primary/10', financial: true },
    { id: 5, title: 'Payment received: UGX 4,200,000', sub: 'Mukono Hatchery', time: '1d ago', icon: Banknote, color: 'text-success', bg: 'bg-success/10', financial: true },
  ].filter((act) => canViewFinance || !act.financial)

  return (
    <div className="page-container space-y-6 pb-12">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between">
        <div>
        <h1 className="text-[24px] font-semibold text-[var(--text-strong)]">
            {greeting()}, {firstName} <span className="text-2xl">👋</span>
          </h1>
          <p className="mt-1 text-[13px] font-medium text-text-secondary">{todayLabel()}</p>
        </div>
        <div className="mt-4 md:mt-0">
          <button type="button" className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-primary-hover)]">
            <Plus className="h-4 w-4" /> Quick Action
          </button>
        </div>
      </div>

      {/* ROW 1: EXECUTIVE KPI CARDS (financial cards only with finance:read) */}
      <div className={`grid gap-4 md:grid-cols-2 ${canViewFinance ? 'xl:grid-cols-6' : 'xl:grid-cols-3'}`}>
        {canViewFinance && (
          <>
            <KpiCard title="Total Revenue" value={formatMoney(totalRevenue)} note="from last month" icon={DollarSign} trendStr="from last month" trendVal={12.5} />
            <KpiCard title="Net Profit" value={formatMoney(netProfit)} note="from last month" icon={TrendingUp} trendStr="from last month" trendVal={8.3} />
            <KpiCard title="Cash Position" value={formatMoney(cashPosition)} note="from last month" icon={Wallet} trendStr="from last month" trendVal={4.7} />
          </>
        )}
        <KpiCard title="Active Birds" value={formatNumber(kpis.total_birds)} note="from last month" icon={Bird} trendStr="from last month" trendVal={4.2} />
        <KpiCard title="Eggs Today" value={formatNumber(eggsToday)} note="from yesterday" icon={Egg} trendStr="from yesterday" trendVal={6.2} />
        <KpiCard title="Mortality Rate" value={`${formatNumber(kpis.mortality_rate_today, 1)}%`} note="from last month" icon={AlertCircle} trendStr="from last month" trendVal={-0.3} />
      </div>

      {/* ROW 2: ANALYTICS (confidential — finance:read only) */}
      {canViewFinance && (
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <DashboardPanel 
            title="Revenue vs Expenses" 
            action={
              <select className="border-none bg-transparent text-[12px] font-medium text-text-secondary outline-none cursor-pointer">
                <option>This Month</option>
                <option>Last Month</option>
                <option>This Year</option>
              </select>
            }
          >
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.11}/>
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C2410C" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#C2410C" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => `${val}M`} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                  <Area type="monotone" dataKey="expenses" stroke="#C2410C" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <div>
                <div className="text-[12px] text-text-secondary">Total Revenue</div>
                <div className="text-[16px] font-bold text-success">{formatMoney(totalRevenue)}</div>
              </div>
              <div>
                <div className="text-[12px] text-text-secondary">Total Expenses</div>
                <div className="text-[16px] font-bold text-danger">{formatMoney(totalRevenue - netProfit)}</div>
              </div>
              <div>
                <div className="text-[12px] text-text-secondary">Net Profit</div>
                <div className="text-[16px] font-bold text-text-primary">{formatMoney(netProfit)}</div>
              </div>
              <div>
                <div className="text-[12px] text-text-secondary">Profit Margin</div>
                <div className="text-[16px] font-bold text-text-primary">33.9%</div>
              </div>
            </div>
          </DashboardPanel>
        </div>

        <div className="lg:col-span-4">
          <DashboardPanel title="Cash Position" viewAllTo="/accounting/cashbook">
            <div className="flex flex-col h-full justify-between pb-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-info/10 text-info"><Building2 className="h-4 w-4" /></div>
                    <span className="text-[13px] font-semibold text-text-primary">Bank Accounts</span>
                  </div>
                  <span className="text-[13px] font-bold text-success">{formatMoney(sales.bank_sales || 228000000)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary"><Banknote className="h-4 w-4" /></div>
                    <span className="text-[13px] font-semibold text-text-primary">Mobile Money</span>
                  </div>
                  <span className="text-[13px] font-bold text-success">{formatMoney(sales.mobile_money_sales || 8800000)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-warning/10 text-warning"><Coins className="h-4 w-4" /></div>
                    <span className="text-[13px] font-semibold text-text-primary">Cash on Hand</span>
                  </div>
                  <span className="text-[13px] font-bold text-success">{formatMoney(sales.cash_sales || 3400000)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-warning/10 text-warning"><Wallet className="h-4 w-4" /></div>
                    <span className="text-[13px] font-semibold text-text-primary">Petty Cash</span>
                  </div>
                  <span className="text-[13px] font-bold text-success">{formatMoney(1600000)}</span>
                </div>
              </div>
              <div className="mt-8 flex items-center justify-between rounded-lg bg-success/5 p-4 border border-success/20">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-success" />
                  <span className="text-[13px] font-bold text-text-primary">Total Cash Position</span>
                </div>
                <span className="text-[18px] font-extrabold text-success">{formatMoney(cashPosition || 240200000)}</span>
              </div>
            </div>
          </DashboardPanel>
        </div>
      </div>
      )}

      {/* ROW 3 & 4: OPERATIONS & ACTIVITY */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Flock Overview */}
        <DashboardPanel title="Flock Overview" viewAllTo="/farm/batches">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                <Bird className="h-4 w-4 text-success" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Active Flocks</span>
              </div>
              <div className="mt-2 text-xl font-bold text-text-primary">{kpis.active_houses}</div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                <Bird className="h-4 w-4 text-warning" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Total Birds</span>
              </div>
              <div className="mt-2 text-xl font-bold text-text-primary">{formatNumber(kpis.total_birds)}</div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-danger" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Mortality Today</span>
              </div>
              <div className="mt-2 text-xl font-bold text-text-primary">{kpis.mortality_today} <span className="text-sm font-medium text-text-secondary">({kpis.mortality_rate_today}%)</span></div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-info" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">FCR (Avg)</span>
              </div>
              <div className="mt-2 text-xl font-bold text-text-primary">1.72</div>
            </div>
          </div>
        </DashboardPanel>

        {/* Inventory Summary */}
        <DashboardPanel title="Inventory Summary" viewAllTo="/inventory/items">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 font-medium">Stock</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {feed_stock.slice(0, 5).map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 font-semibold text-text-primary">{item.name}</td>
                  <td className="py-2.5 text-text-secondary">{formatNumber(item.current_stock)} {item.unit}</td>
                  <td className="py-2.5"><StatusDot status={item.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </DashboardPanel>

        {/* Activity Center */}
        <DashboardPanel title="Recent Activities" viewAllTo="/reports/activities">
          <div className="space-y-4">
            {activities.map((act) => (
              <div key={act.id} className="flex gap-3">
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${act.bg} ${act.color}`}>
                  <act.icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-text-primary leading-tight truncate">{act.title}</div>
                  <div className="text-[12px] text-text-secondary mt-0.5">{act.sub}</div>
                </div>
                <div className="text-[11px] font-medium text-text-secondary whitespace-nowrap">{act.time}</div>
              </div>
            ))}
          </div>
        </DashboardPanel>
      </div>

      {/* ROW 5: QUICK ACTIONS */}
      <div>
        <h3 className="text-[14px] font-bold text-text-primary mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          {hasPermission('sales:write') && <QuickActionButton icon={ShoppingCart} label="New Sale" to="/sales/orders" />}
          {hasPermission('procurement:write') && <QuickActionButton icon={Package} label="New Purchase" to="/procurement/purchase-orders" />}
          {hasPermission('procurement:write') && <QuickActionButton icon={Truck} label="Add Supplier" to="/procurement/suppliers" />}
          {hasPermission('finance:write') && <QuickActionButton icon={DollarSign} label="Expense" to="/finance/expenses" />}
          <QuickActionButton icon={Wheat} label="Feed Issue" to="/feed/consumption" />
          <QuickActionButton icon={Egg} label="Egg Collection" to="/farm/eggs" />
          <QuickActionButton icon={Skull} label="Record Mortality" to="/farm/mortality" />
          <QuickActionButton icon={Bird} label="Add Flock/Batch" to="/farm/batches" />
        </div>
      </div>

    </div>
  )
}
