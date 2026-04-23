import { useMemo, type ElementType } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Bird,
  Boxes,
  CircleAlert,
  DollarSign,
  Receipt,
  RefreshCw,
  Scissors,
  ShoppingCart,
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

type ActivityRecord = {
  id: string
  label: string
  meta: string
  timestamp: string
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

      const [
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
      ] = await Promise.all([
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
    () =>
      outstandingInvoices.reduce(
        (sum, invoice) => sum + Math.max(invoice.total_amount - invoice.paid_amount, 0),
        0
      ),
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
    const completedRecords = (data?.slaughterRecords ?? []).filter((record) => typeof record.yield_percentage === 'number')
    if (completedRecords.length === 0) {
      return 0
    }
    return completedRecords.reduce((sum, record) => sum + (record.yield_percentage || 0), 0) / completedRecords.length
  }, [data?.slaughterRecords])

  const alerts = useMemo(() => {
    const items: Array<{ title: string; detail: string; tone: 'warning' | 'danger' | 'brand' }> = []

    lowStockItems.slice(0, 3).forEach((item) => {
      items.push({
        title: `Low feed stock: ${item.name}`,
        detail: `${item.current_stock.toLocaleString()} ${item.unit} remaining against reorder point ${item.reorder_threshold.toLocaleString()}.`,
        tone: 'warning',
      })
    })

    outstandingInvoices
      .filter((invoice) => new Date(invoice.due_date) < new Date() && invoice.status !== 'paid')
      .slice(0, 3)
      .forEach((invoice) => {
        items.push({
          title: `Overdue invoice: ${invoice.invoice_number}`,
          detail: `Outstanding UGX ${Math.max(invoice.total_amount - invoice.paid_amount, 0).toLocaleString()} due on ${formatDate(invoice.due_date)}.`,
          tone: 'danger',
        })
      })

    houseOccupancy
      .filter((house) => house.occupancy >= 90)
      .slice(0, 2)
      .forEach((house) => {
        items.push({
          title: `High occupancy: ${house.name}`,
          detail: `${house.occupancy.toFixed(0)}% occupied with ${house.birds.toLocaleString()} birds.`,
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
        meta: movement.reference_type ? `Reference: ${movement.reference_type}` : 'Manual inventory movement',
        timestamp: movement.created_at,
      })),
      ...(data?.slaughterRecords ?? []).slice(0, 5).map((record) => ({
        id: `slaughter-${record.id}`,
        label: `Slaughter record ${record.status.replace('_', ' ')}`,
        meta: `${record.live_birds_count.toLocaleString()} birds on ${formatDate(record.slaughter_date)}`,
        timestamp: record.created_at,
      })),
      ...(data?.expenses ?? []).slice(0, 5).map((expense) => ({
        id: `expense-${expense.id}`,
        label: 'Expense recorded',
        meta: `${expense.category?.name || 'General'} - UGX ${expense.amount.toLocaleString()}`,
        timestamp: expense.created_at,
      })),
      ...(data?.incomes ?? []).slice(0, 5).map((income) => ({
        id: `income-${income.id}`,
        label: 'Income recorded',
        meta: `${income.category?.name || 'General'} - UGX ${income.amount.toLocaleString()}`,
        timestamp: income.created_at,
      })),
      ...(data?.invoices ?? []).slice(0, 5).map((invoice) => ({
        id: `invoice-${invoice.id}`,
        label: `Invoice ${invoice.invoice_number}`,
        meta: `Status ${invoice.status} - UGX ${invoice.total_amount.toLocaleString()}`,
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
    return { todaysFeed, todaysExpense, todaysIncome, todaysSlaughter }
  }, [data?.consumptions, data?.expenses, data?.incomes, data?.slaughterRecords])

  const roleLabel = user?.role?.name ? ROLE_LABELS[user.role.name] ?? user.role.name : 'Operations lead'

  const leadingMetrics = [
    hasPermission('farm:read')
      ? {
          title: 'Active birds',
          value: activeBirds.toLocaleString(),
          subtitle: 'Across live production batches',
          icon: Bird,
        }
      : null,
    hasPermission('feed:read')
      ? {
          title: 'Low stock items',
          value: lowStockItems.length.toLocaleString(),
          subtitle: 'Feed items below reorder threshold',
          icon: Boxes,
        }
      : null,
    hasPermission('slaughter:read')
      ? {
          title: 'Average yield',
          value: averageYield ? `${averageYield.toFixed(1)}%` : 'No data',
          subtitle: 'From completed slaughter records',
          icon: Scissors,
        }
      : null,
    hasPermission('sales:read')
      ? {
          title: 'Receivables',
          value: `UGX ${outstandingValue.toLocaleString()}`,
          subtitle: `${outstandingInvoices.length.toLocaleString()} open invoices`,
          icon: Receipt,
        }
      : null,
    hasPermission('finance:read')
      ? {
          title: 'Net profit',
          value: `UGX ${(data?.kpis?.net_profit ?? 0).toLocaleString()}`,
          subtitle: 'Rolling 30-day margin',
          icon: DollarSign,
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; value: string; subtitle: string; icon: ElementType }>

  return (
    <div className="animate-fade-in space-y-6 pb-8">
      <div className="section-header">
        <div>
          <div className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-brand-700">Role aware dashboard</div>
          <h1 className="section-title">Welcome back, {roleLabel}</h1>
          <p className="section-subtitle">
            Review today&apos;s poultry operations, commercial activity, and financial performance from live Farmexa data.
          </p>
        </div>

        <button type="button" onClick={() => overview.refetch()} className="btn-secondary">
          <RefreshCw className={`h-4.5 w-4.5 ${overview.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {overview.isError ? (
        <div className="card flex items-center gap-4 p-5 text-danger">
          <AlertTriangle className="h-6 w-6" />
          <div>
            <div className="font-semibold">Dashboard data could not be loaded.</div>
            <div className="text-sm text-ink-500">Check backend connectivity and retry the workspace refresh.</div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="card overflow-hidden">
          <div className="border-b border-neutral-150 bg-brand-fade px-6 py-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="text-[0.7rem] font-bold uppercase tracking-[0.24em] text-brand-700">Executive overview</div>
                <h2 className="mt-3 text-3xl font-semibold text-ink-900">UGX {(data?.kpis?.total_revenue ?? 0).toLocaleString()}</h2>
                <p className="mt-2 text-sm text-ink-500">Revenue captured in the current 30-day analytics window.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-neutral-150 bg-white px-4 py-4">
                  <div className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-ink-500">Orders</div>
                  <div className="mt-2 text-2xl font-semibold text-ink-900">{(data?.kpis?.total_orders ?? 0).toLocaleString()}</div>
                </div>
                <div className="rounded-3xl border border-neutral-150 bg-white px-4 py-4">
                  <div className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-ink-500">Customers</div>
                  <div className="mt-2 text-2xl font-semibold text-ink-900">{(data?.kpis?.active_customers ?? 0).toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-6 md:grid-cols-2 xl:grid-cols-3">
            {leadingMetrics.map((metric) => {
              const Icon = metric.icon
              return (
                <div key={metric.title} className="rounded-3xl border border-neutral-150 bg-neutral-50 px-4 py-4">
                  <div className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-ink-500">
                    <Icon className="h-4 w-4 text-brand-600" />
                    {metric.title}
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-ink-900">{metric.value}</div>
                  <div className="mt-1 text-sm text-ink-500">{metric.subtitle}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card p-6">
          <div className="text-[0.7rem] font-bold uppercase tracking-[0.24em] text-brand-700">Today summary</div>
          <div className="mt-5 space-y-4">
            <div className="rounded-3xl border border-neutral-150 bg-neutral-50 px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink-600">Feed consumed</span>
                <span className="font-semibold text-ink-900">{todaySummary.todaysFeed.toLocaleString()}</span>
              </div>
            </div>
            <div className="rounded-3xl border border-neutral-150 bg-neutral-50 px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink-600">Expenses logged</span>
                <span className="font-semibold text-ink-900">UGX {todaySummary.todaysExpense.toLocaleString()}</span>
              </div>
            </div>
            <div className="rounded-3xl border border-neutral-150 bg-neutral-50 px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink-600">Income logged</span>
                <span className="font-semibold text-ink-900">UGX {todaySummary.todaysIncome.toLocaleString()}</span>
              </div>
            </div>
            <div className="rounded-3xl border border-neutral-150 bg-neutral-50 px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink-600">Birds processed</span>
                <span className="font-semibold text-ink-900">{todaySummary.todaysSlaughter.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink-900">Revenue vs expenses</h2>
              <p className="mt-1 text-sm text-ink-500">Thirty-day finance movement from the reporting layer.</p>
            </div>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.profit?.timeline ?? []} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashboardRevenue" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#259d35" stopOpacity={0.26} />
                    <stop offset="95%" stopColor="#259d35" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashboardExpenses" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#c24034" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#c24034" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3ebe4" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#5f6f7b', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#5f6f7b', fontSize: 12 }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                <Tooltip formatter={(value: number) => `UGX ${value.toLocaleString()}`} />
                <Area type="monotone" dataKey="revenue" stroke="#1b832c" fill="url(#dashboardRevenue)" strokeWidth={3} />
                <Area type="monotone" dataKey="expenses" stroke="#c24034" fill="url(#dashboardExpenses)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <div>
            <h2 className="text-xl font-semibold text-ink-900">House occupancy</h2>
            <p className="mt-1 text-sm text-ink-500">Live batch population distributed across configured houses.</p>
          </div>
          <div className="mt-4 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={houseOccupancy}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3ebe4" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#5f6f7b', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#5f6f7b', fontSize: 12 }} />
                <Tooltip formatter={(value: number, name) => (name === 'occupancy' ? `${value}%` : value.toLocaleString())} />
                <Bar dataKey="birds" fill="#259d35" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink-900">Operations summaries</h2>
              <p className="mt-1 text-sm text-ink-500">Cross-module operating health at a glance.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {hasPermission('farm:read') ? (
              <div className="rounded-3xl border border-neutral-150 bg-neutral-50 px-5 py-5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-ink-500">
                  <Bird className="h-4 w-4 text-brand-600" />
                  Production
                </div>
                <div className="mt-3 space-y-2 text-sm text-ink-600">
                  <div className="flex items-center justify-between"><span>Active houses</span><span className="font-semibold text-ink-900">{(data?.houses ?? []).filter((house) => house.status === 'active').length}</span></div>
                  <div className="flex items-center justify-between"><span>Active batches</span><span className="font-semibold text-ink-900">{(data?.batches ?? []).filter((batch) => batch.status === 'active').length}</span></div>
                  <div className="flex items-center justify-between"><span>Live birds</span><span className="font-semibold text-ink-900">{activeBirds.toLocaleString()}</span></div>
                </div>
              </div>
            ) : null}

            {hasPermission('feed:read') ? (
              <div className="rounded-3xl border border-neutral-150 bg-neutral-50 px-5 py-5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-ink-500">
                  <Boxes className="h-4 w-4 text-brand-600" />
                  Feed
                </div>
                <div className="mt-3 space-y-2 text-sm text-ink-600">
                  <div className="flex items-center justify-between"><span>Tracked feed items</span><span className="font-semibold text-ink-900">{(data?.feedItems ?? []).length}</span></div>
                  <div className="flex items-center justify-between"><span>Low stock alerts</span><span className="font-semibold text-ink-900">{lowStockItems.length}</span></div>
                  <div className="flex items-center justify-between"><span>Today&apos;s feed usage</span><span className="font-semibold text-ink-900">{todaySummary.todaysFeed.toLocaleString()}</span></div>
                </div>
              </div>
            ) : null}

            {hasPermission('slaughter:read') ? (
              <div className="rounded-3xl border border-neutral-150 bg-neutral-50 px-5 py-5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-ink-500">
                  <Scissors className="h-4 w-4 text-brand-600" />
                  Slaughter
                </div>
                <div className="mt-3 space-y-2 text-sm text-ink-600">
                  <div className="flex items-center justify-between"><span>Scheduled / in progress</span><span className="font-semibold text-ink-900">{(data?.slaughterRecords ?? []).filter((record) => record.status === 'scheduled' || record.status === 'in_progress').length}</span></div>
                  <div className="flex items-center justify-between"><span>Completed runs</span><span className="font-semibold text-ink-900">{(data?.slaughterRecords ?? []).filter((record) => record.status === 'completed').length}</span></div>
                  <div className="flex items-center justify-between"><span>Average yield</span><span className="font-semibold text-ink-900">{averageYield ? `${averageYield.toFixed(1)}%` : 'No data'}</span></div>
                </div>
              </div>
            ) : null}

            {hasPermission('sales:read') || hasPermission('finance:read') ? (
              <div className="rounded-3xl border border-neutral-150 bg-neutral-50 px-5 py-5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-ink-500">
                  <ShoppingCart className="h-4 w-4 text-brand-600" />
                  Commercial
                </div>
                <div className="mt-3 space-y-2 text-sm text-ink-600">
                  <div className="flex items-center justify-between"><span>Open invoices</span><span className="font-semibold text-ink-900">{outstandingInvoices.length}</span></div>
                  <div className="flex items-center justify-between"><span>Receivables</span><span className="font-semibold text-ink-900">UGX {outstandingValue.toLocaleString()}</span></div>
                  <div className="flex items-center justify-between"><span>30-day orders</span><span className="font-semibold text-ink-900">{(data?.kpis?.total_orders ?? 0).toLocaleString()}</span></div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-ink-500">
              <CircleAlert className="h-4 w-4 text-brand-600" />
              Alerts and reminders
            </div>
            <div className="mt-4 space-y-3">
              {alerts.length === 0 ? (
                <div className="rounded-3xl border border-neutral-150 bg-neutral-50 px-4 py-4 text-sm text-ink-500">
                  No urgent alerts from the current live dataset.
                </div>
              ) : (
                alerts.map((alert) => (
                  <div key={`${alert.title}-${alert.detail}`} className="rounded-3xl border border-neutral-150 bg-neutral-50 px-4 py-4">
                    <div className={`text-sm font-semibold ${alert.tone === 'danger' ? 'text-danger' : alert.tone === 'warning' ? 'text-warning' : 'text-brand-700'}`}>
                      {alert.title}
                    </div>
                    <div className="mt-1 text-sm text-ink-500">{alert.detail}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-ink-500">
              <Warehouse className="h-4 w-4 text-brand-600" />
              Recent activity
            </div>
            <div className="mt-4 space-y-3">
              {recentActivity.length === 0 ? (
                <div className="rounded-3xl border border-neutral-150 bg-neutral-50 px-4 py-4 text-sm text-ink-500">
                  No recent operational events have been posted yet.
                </div>
              ) : (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start justify-between gap-4 rounded-3xl border border-neutral-150 bg-neutral-50 px-4 py-4">
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

      {hasPermission('reports:read') ? (
        <div className="card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-ink-900">Sales velocity</h2>
              <p className="mt-1 text-sm text-ink-500">Orders processed and cash generated across the current reporting window.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-700">
              Reports
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-5 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.salesReport?.timeline ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3ebe4" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#5f6f7b', fontSize: 12 }} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: '#5f6f7b', fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fill: '#5f6f7b', fontSize: 12 }} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="orders_count" fill="#1f2a36" radius={[8, 8, 0, 0]} />
                <Bar yAxisId="right" dataKey="revenue" fill="#259d35" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </div>
  )
}
