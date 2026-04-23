import { useMemo, type ElementType } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  Bird,
  Boxes,
  CircleAlert,
  DollarSign,
  Receipt,
  RefreshCw,
  Scissors,
  Warehouse,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '@/services/api'
import { useAuth } from '@/features/auth/AuthContext'
import { ROLE_LABELS } from '@/lib/branding'

interface KpiData {
  total_revenue: number
  total_expenses: number
  net_profit: number
  total_orders: number
  active_customers: number
  total_birds_slaughtered: number
}

interface ProfitPoint {
  date: string
  revenue: number
  expenses: number
  profit: number
}

interface SalesPoint {
  date: string
  orders_count: number
  revenue: number
}

interface House {
  id: number
  name: string
  capacity: number
  status: 'active' | 'maintenance' | 'inactive'
}

interface Batch {
  id: number
  batch_number: string
  house_id: number
  breed: string
  active_quantity: number
  initial_quantity: number
  status: string
  house?: House | null
}

interface FeedItem {
  id: number
  name: string
  unit: string
  current_stock: number
  reorder_threshold: number
}

interface FeedConsumption {
  id: number
  record_date: string
  quantity: number
}

interface SlaughterRecord {
  id: number
  slaughter_date: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  yield_percentage?: number | null
  live_birds_count: number
  created_at: string
}

interface Invoice {
  id: number
  invoice_number: string
  status: 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'cancelled'
  due_date: string
  total_amount: number
  paid_amount: number
  created_at: string
  customer?: { name: string } | null
}

interface Expense {
  id: number
  amount: number
  expense_date: string
  created_at: string
  category?: { name: string } | null
}

interface Income {
  id: number
  amount: number
  income_date: string
  created_at: string
  category?: { name: string } | null
}

interface StockMovement {
  id: number
  movement_type: 'in' | 'out' | 'adjustment'
  quantity: number
  created_at: string
  reference_type?: string | null
}

interface DashboardOverview {
  kpis: KpiData
  profit: {
    summary: KpiData
    timeline: ProfitPoint[]
  }
  salesReport: {
    total_revenue: number
    timeline: SalesPoint[]
  }
  houses: House[]
  batches: Batch[]
  feedItems: FeedItem[]
  consumptions: FeedConsumption[]
  slaughterRecords: SlaughterRecord[]
  invoices: Invoice[]
  expenses: Expense[]
  incomes: Income[]
  movements: StockMovement[]
}

type ActivityRecord = {
  id: string
  label: string
  meta: string
  timestamp: string
}

type MetricTone = 'emerald' | 'sky' | 'amber' | 'coral' | 'slate'

function sameDay(value: string) {
  return new Date(value).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-UG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const metricTones: MetricTone[] = ['emerald', 'sky', 'amber', 'coral', 'slate']

const chartTooltipStyle = {
  border: '1px solid var(--border-subtle)',
  borderRadius: '1.2rem',
  background: 'var(--surface-strong)',
  boxShadow: 'var(--shadow-card)',
  color: 'var(--text-strong)',
}

export function DashboardPage() {
  const { hasPermission, user, permissions } = useAuth()

  const overview = useQuery<DashboardOverview>({
    queryKey: ['dashboard-overview', permissions.join('|')],
    queryFn: async () => {
      const canFarm = hasPermission('farm:read')
      const canFeed = hasPermission('feed:read')
      const canSlaughter = hasPermission('slaughter:read')
      const canSales = hasPermission('sales:read')
      const canFinance = hasPermission('finance:read')
      const canInventory = hasPermission('inventory:read')
      const canReports = hasPermission('reports:read')

      const [kpis, profit, salesReport, houses, batches, feedItems, consumptions, slaughterRecords, invoices, expenses, incomes, movements] =
        await Promise.all([
          api.get<KpiData>('/analytics/kpis').then((response) => response.data),
          canReports
            ? api.get<{ summary: KpiData; timeline: ProfitPoint[] }>('/analytics/profit').then((response) => response.data)
            : Promise.resolve({ summary: {} as KpiData, timeline: [] as ProfitPoint[] }),
          canReports
            ? api.get<{ total_revenue: number; timeline: SalesPoint[] }>('/analytics/sales').then((response) => response.data)
            : Promise.resolve({ total_revenue: 0, timeline: [] as SalesPoint[] }),
          canFarm ? api.get<House[]>('/farm/houses').then((response) => response.data) : Promise.resolve([] as House[]),
          canFarm ? api.get<Batch[]>('/farm/batches').then((response) => response.data) : Promise.resolve([] as Batch[]),
          canFeed ? api.get<FeedItem[]>('/feed/items').then((response) => response.data) : Promise.resolve([] as FeedItem[]),
          canFeed
            ? api.get<FeedConsumption[]>('/feed/consumptions').then((response) => response.data)
            : Promise.resolve([] as FeedConsumption[]),
          canSlaughter
            ? api.get<SlaughterRecord[]>('/slaughter/records').then((response) => response.data)
            : Promise.resolve([] as SlaughterRecord[]),
          canSales ? api.get<Invoice[]>('/sales/invoices').then((response) => response.data) : Promise.resolve([] as Invoice[]),
          canFinance ? api.get<Expense[]>('/finance/expenses').then((response) => response.data) : Promise.resolve([] as Expense[]),
          canFinance ? api.get<Income[]>('/finance/incomes').then((response) => response.data) : Promise.resolve([] as Income[]),
          canInventory
            ? api.get<StockMovement[]>('/inventory/movements').then((response) => response.data)
            : Promise.resolve([] as StockMovement[]),
        ])

      return {
        kpis,
        profit,
        salesReport,
        houses,
        batches,
        feedItems,
        consumptions,
        slaughterRecords,
        invoices,
        expenses,
        incomes,
        movements,
      }
    },
    refetchInterval: 60_000,
  })

  const data = overview.data

  const activeBirds = useMemo(
    () => (data?.batches ?? []).filter((batch) => batch.status === 'active').reduce((sum, batch) => sum + batch.active_quantity, 0),
    [data?.batches]
  )

  const lowStockItems = useMemo(
    () => (data?.feedItems ?? []).filter((item) => item.current_stock <= item.reorder_threshold),
    [data?.feedItems]
  )

  const outstandingInvoices = useMemo(
    () => (data?.invoices ?? []).filter((invoice) => invoice.status !== 'paid' && invoice.status !== 'cancelled'),
    [data?.invoices]
  )

  const outstandingValue = useMemo(
    () => outstandingInvoices.reduce((sum, invoice) => sum + Math.max(invoice.total_amount - invoice.paid_amount, 0), 0),
    [outstandingInvoices]
  )

  const houseOccupancy = useMemo(
    () =>
      (data?.houses ?? []).map((house) => {
        const birds = (data?.batches ?? [])
          .filter((batch) => batch.house_id === house.id && batch.status === 'active')
          .reduce((sum, batch) => sum + batch.active_quantity, 0)

        return {
          name: house.name,
          birds,
          capacity: house.capacity,
          occupancy: house.capacity > 0 ? Number(((birds / house.capacity) * 100).toFixed(1)) : 0,
        }
      }),
    [data?.batches, data?.houses]
  )

  const averageYield = useMemo(() => {
    const completed = (data?.slaughterRecords ?? []).filter((record) => typeof record.yield_percentage === 'number')
    if (!completed.length) return 0
    return completed.reduce((sum, record) => sum + (record.yield_percentage || 0), 0) / completed.length
  }, [data?.slaughterRecords])

  const alerts = useMemo(() => {
    const items: Array<{ title: string; detail: string; tone: 'warning' | 'danger' | 'brand' }> = []

    lowStockItems.slice(0, 3).forEach((item) => {
      items.push({
        title: item.name,
        detail: `${item.current_stock.toLocaleString()} ${item.unit}`,
        tone: 'warning',
      })
    })

    outstandingInvoices
      .filter((invoice) => new Date(invoice.due_date) < new Date() && invoice.status !== 'paid')
      .slice(0, 3)
      .forEach((invoice) => {
        items.push({
          title: invoice.invoice_number,
          detail: `UGX ${Math.max(invoice.total_amount - invoice.paid_amount, 0).toLocaleString()}`,
          tone: 'danger',
        })
      })

    houseOccupancy
      .filter((house) => house.occupancy >= 90)
      .slice(0, 2)
      .forEach((house) => {
        items.push({
          title: house.name,
          detail: `${house.occupancy.toFixed(0)}% full`,
          tone: 'brand',
        })
      })

    return items.slice(0, 6)
  }, [houseOccupancy, lowStockItems, outstandingInvoices])

  const recentActivity = useMemo(() => {
    const activity: ActivityRecord[] = [
      ...(data?.movements ?? []).slice(0, 5).map((movement) => ({
        id: `movement-${movement.id}`,
        label: movement.movement_type === 'in' ? 'Inventory received' : movement.movement_type === 'out' ? 'Inventory issued' : 'Inventory adjusted',
        meta: movement.reference_type ? movement.reference_type : 'Manual',
        timestamp: movement.created_at,
      })),
      ...(data?.slaughterRecords ?? []).slice(0, 5).map((record) => ({
        id: `slaughter-${record.id}`,
        label: `Slaughter ${record.status.replace('_', ' ')}`,
        meta: `${record.live_birds_count.toLocaleString()} birds`,
        timestamp: record.created_at,
      })),
      ...(data?.expenses ?? []).slice(0, 5).map((expense) => ({
        id: `expense-${expense.id}`,
        label: 'Expense',
        meta: `UGX ${expense.amount.toLocaleString()}`,
        timestamp: expense.created_at,
      })),
      ...(data?.incomes ?? []).slice(0, 5).map((income) => ({
        id: `income-${income.id}`,
        label: 'Income',
        meta: `UGX ${income.amount.toLocaleString()}`,
        timestamp: income.created_at,
      })),
      ...(data?.invoices ?? []).slice(0, 5).map((invoice) => ({
        id: `invoice-${invoice.id}`,
        label: invoice.invoice_number,
        meta: invoice.status,
        timestamp: invoice.created_at,
      })),
    ]

    return activity.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()).slice(0, 8)
  }, [data?.expenses, data?.incomes, data?.invoices, data?.movements, data?.slaughterRecords])

  const todaySummary = useMemo(() => {
    const todaysFeed = (data?.consumptions ?? []).filter((entry) => sameDay(entry.record_date)).reduce((sum, entry) => sum + entry.quantity, 0)
    const todaysExpense = (data?.expenses ?? []).filter((entry) => sameDay(entry.expense_date)).reduce((sum, entry) => sum + entry.amount, 0)
    const todaysIncome = (data?.incomes ?? []).filter((entry) => sameDay(entry.income_date)).reduce((sum, entry) => sum + entry.amount, 0)
    const todaysSlaughter = (data?.slaughterRecords ?? []).filter((entry) => sameDay(entry.slaughter_date)).reduce((sum, entry) => sum + entry.live_birds_count, 0)

    return [
      { label: 'Feed used', value: todaysFeed.toLocaleString() },
      { label: 'Expense', value: `UGX ${todaysExpense.toLocaleString()}` },
      { label: 'Income', value: `UGX ${todaysIncome.toLocaleString()}` },
      { label: 'Processed', value: todaysSlaughter.toLocaleString() },
    ]
  }, [data?.consumptions, data?.expenses, data?.incomes, data?.slaughterRecords])

  const roleLabel = user?.role?.name ? ROLE_LABELS[user.role.name] ?? user.role.name : 'Operations'

  const leadingMetrics = [
    hasPermission('farm:read')
      ? {
          title: 'Active birds',
          value: activeBirds.toLocaleString(),
          icon: Bird,
          hint: 'Birds currently in active batches',
        }
      : null,
    hasPermission('feed:read')
      ? {
          title: 'Low stock',
          value: lowStockItems.length.toLocaleString(),
          icon: Boxes,
          hint: 'Feed items at or below reorder point',
        }
      : null,
    hasPermission('slaughter:read')
      ? {
          title: 'Yield',
          value: averageYield ? `${averageYield.toFixed(1)}%` : 'No data',
          icon: Scissors,
          hint: 'Average dressed yield from completed runs',
        }
      : null,
    hasPermission('sales:read')
      ? {
          title: 'Receivables',
          value: `UGX ${outstandingValue.toLocaleString()}`,
          icon: Receipt,
          hint: 'Outstanding invoice value',
        }
      : null,
    hasPermission('finance:read')
      ? {
          title: 'Net profit',
          value: `UGX ${(data?.kpis?.net_profit ?? 0).toLocaleString()}`,
          icon: DollarSign,
          hint: 'Current result for the selected window',
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; value: string; icon: ElementType; hint: string }>

  return (
    <div className="dashboard-shell animate-fade-in space-y-6 pb-8">
      <section className="dashboard-hero">
        <div className="dashboard-eyebrow">Live command center</div>
        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="dashboard-hero__title">Dashboard</h1>
            <p className="dashboard-hero__subtitle">{roleLabel} with a live view of farm operations, inventory, sales, and finance.</p>
          </div>

          <button type="button" onClick={() => overview.refetch()} className="dashboard-refresh-btn">
            <RefreshCw className={`h-4.5 w-4.5 ${overview.isFetching ? 'animate-spin' : ''}`} />
            {overview.isFetching ? 'Refreshing...' : 'Refresh data'}
          </button>
        </div>

        <div className="dashboard-hero__grid">
          <div className="dashboard-pill">
            <span>Today</span>
            <strong>{formatDate(new Date().toISOString())}</strong>
          </div>
          <div className="dashboard-pill">
            <span>Alerts</span>
            <strong>{alerts.length.toLocaleString()}</strong>
          </div>
          <div className="dashboard-pill">
            <span>Recent activity</span>
            <strong>{recentActivity.length.toLocaleString()}</strong>
          </div>
          <div className="dashboard-pill">
            <span>Open invoices</span>
            <strong>{outstandingInvoices.length.toLocaleString()}</strong>
          </div>
        </div>
      </section>

      {overview.isError ? (
        <div className="card flex items-center gap-4 p-5 text-danger">
          <AlertTriangle className="h-6 w-6" />
          <div className="font-semibold">Dashboard data could not be loaded.</div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {leadingMetrics.map((metric, index) => {
          const Icon = metric.icon
          const tone = metricTones[index % metricTones.length]

          return (
            <div key={metric.title} className={`dashboard-metric dashboard-metric--${tone}`}>
              <div className="dashboard-metric__label">
                <Icon className="h-4.5 w-4.5" />
                {metric.title}
              </div>
              <div className="dashboard-metric__value">{metric.value}</div>
              <p className="dashboard-metric__hint">{metric.hint}</p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {todaySummary.map((item) => (
          <div key={item.label} className="dashboard-mini-card">
            <div className="dashboard-mini-card__label">{item.label}</div>
            <div className="dashboard-mini-card__value">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="dashboard-panel">
          <div className="dashboard-panel__heading">
            <DollarSign className="h-4.5 w-4.5" />
            Financial momentum
          </div>
          <h2 className="dashboard-panel__title">Revenue vs expenses</h2>
          <p className="dashboard-panel__subtitle">Thirty-day operating view across recorded income and cost.</p>
          <div className="mt-5 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.profit.timeline ?? []} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value: number) => `UGX ${value.toLocaleString()}`}
                  labelStyle={{ color: 'var(--text-muted)' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--chart-revenue)" fill="var(--chart-revenue-fill)" strokeWidth={3} />
                <Area type="monotone" dataKey="expenses" stroke="var(--chart-expense)" fill="var(--chart-expense-fill)" strokeWidth={2.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel__heading">
            <Bird className="h-4.5 w-4.5" />
            House performance
          </div>
          <h2 className="dashboard-panel__title">Occupancy</h2>
          <p className="dashboard-panel__subtitle">Bird count by house against current capacity.</p>
          <div className="mt-5 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={houseOccupancy}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value: number) => value.toLocaleString()}
                  labelStyle={{ color: 'var(--text-muted)' }}
                />
                <Bar dataKey="birds" fill="var(--chart-bar)" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="dashboard-panel">
          <div className="dashboard-panel__heading">
            <CircleAlert className="h-4.5 w-4.5" />
            Priority alerts
          </div>
          <h2 className="dashboard-panel__title">What needs attention</h2>
          <div className="dashboard-list">
            {alerts.length === 0 ? (
              <div className="dashboard-list-item">
                <div>
                  <div className="text-sm font-semibold text-ink-900">All clear</div>
                  <div className="mt-1 text-sm text-ink-500">No urgent stock, invoice, or occupancy alerts right now.</div>
                </div>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={`${alert.title}-${alert.detail}`}
                  className={`dashboard-list-item dashboard-alert dashboard-alert--${alert.tone}`}
                >
                  <div>
                    <div className="text-sm font-semibold text-ink-900">{alert.title}</div>
                    <div className="mt-1 text-sm text-ink-500">{alert.detail}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel__heading">
            <Warehouse className="h-4.5 w-4.5" />
            Recent activity
          </div>
          <h2 className="dashboard-panel__title">Latest movement</h2>
          <div className="dashboard-list">
            {recentActivity.length === 0 ? (
              <div className="dashboard-list-item">
                <div>
                  <div className="text-sm font-semibold text-ink-900">No recent activity</div>
                  <div className="mt-1 text-sm text-ink-500">New operational records will appear here as the team works.</div>
                </div>
              </div>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="dashboard-list-item">
                  <div>
                    <div className="text-sm font-semibold text-ink-900">{activity.label}</div>
                    <div className="mt-1 text-sm text-ink-500">{activity.meta}</div>
                  </div>
                  <div className="whitespace-nowrap text-xs font-medium text-ink-500">{formatDateTime(activity.timestamp)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
