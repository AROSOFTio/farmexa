import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Bird,
  ClipboardCheck,
  Egg,
  FilePlus2,
  Package,
  Receipt,
  Skull,
  Wheat,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '@/services/api'
import { useAuth } from '@/features/auth/AuthContext'

interface KpiData {
  total_revenue: number
}

interface Batch {
  id: number
  batch_number: string
  breed: string
  arrival_date: string
  active_quantity: number
  status: string
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

interface EggSummary {
  total_eggs: number
  total_good: number
  avg_production_rate: number | null
}

interface EggLog {
  id: number
  record_date: string
  total_eggs: number
}

interface Invoice {
  id: number
  invoice_number: string
  status: 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'cancelled'
  total_amount: number
  paid_amount: number
  due_date: string
}

interface SlaughterRecord {
  id: number
  slaughter_date: string
  live_birds_count: number
  total_dressed_weight?: number | null
}

interface MortalityLog {
  id: number
  record_date: string
  quantity: number
}

interface DashboardOverview {
  kpis: KpiData
  batches: Batch[]
  feedItems: FeedItem[]
  consumptions: FeedConsumption[]
  eggSummary: EggSummary
  eggLogs: EggLog[]
  invoices: Invoice[]
  slaughterRecords: SlaughterRecord[]
  mortalityByBatch: Record<number, MortalityLog[]>
}

const chartTooltipStyle = {
  border: '1px solid #dbe8f6',
  borderRadius: '16px',
  background: '#FFFFFF',
  boxShadow: '0 18px 35px -28px rgba(15, 23, 42, 0.32)',
}

function sameDay(value: string) {
  return new Date(value).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)
}

function formatCurrency(value: number) {
  return `UGX ${value.toLocaleString()}`
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { hasPermission, permissions } = useAuth()

  const overview = useQuery<DashboardOverview>({
    queryKey: ['dashboard-overview-v3', permissions.join('|')],
    queryFn: async () => {
      const canFarm = hasPermission('farm:read')
      const canFeed = hasPermission('feed:read')
      const canSales = hasPermission('sales:read')
      const canSlaughter = hasPermission('slaughter:read')

      const [kpis, batches, feedItems, consumptions, eggSummary, eggLogs, invoices, slaughterRecords] = await Promise.all([
        api.get<KpiData>('/analytics/kpis').then((response) => response.data),
        canFarm ? api.get<Batch[]>('/farm/batches').then((response) => response.data) : Promise.resolve([] as Batch[]),
        canFeed ? api.get<FeedItem[]>('/feed/items').then((response) => response.data) : Promise.resolve([] as FeedItem[]),
        canFeed ? api.get<FeedConsumption[]>('/feed/consumptions').then((response) => response.data) : Promise.resolve([] as FeedConsumption[]),
        canFarm ? api.get<EggSummary>('/eggs/summary').then((response) => response.data) : Promise.resolve({ total_eggs: 0, total_good: 0, avg_production_rate: null }),
        canFarm ? api.get<EggLog[]>('/eggs').then((response) => response.data) : Promise.resolve([] as EggLog[]),
        canSales ? api.get<Invoice[]>('/sales/invoices').then((response) => response.data) : Promise.resolve([] as Invoice[]),
        canSlaughter ? api.get<SlaughterRecord[]>('/slaughter/records').then((response) => response.data) : Promise.resolve([] as SlaughterRecord[]),
      ])

      const mortalityByBatch: Record<number, MortalityLog[]> = {}
      if (canFarm && batches.length) {
        const results = await Promise.all(
          batches.slice(0, 6).map((batch) =>
            api
              .get<MortalityLog[]>(`/farm/batches/${batch.id}/mortality`)
              .then((response) => ({ batchId: batch.id, logs: response.data }))
              .catch(() => ({ batchId: batch.id, logs: [] as MortalityLog[] }))
          )
        )
        results.forEach(({ batchId, logs }) => {
          mortalityByBatch[batchId] = logs
        })
      }

      return {
        kpis,
        batches,
        feedItems,
        consumptions,
        eggSummary,
        eggLogs,
        invoices,
        slaughterRecords,
        mortalityByBatch,
      }
    },
    refetchInterval: 60_000,
  })

  const data = overview.data

  const activeBirds = useMemo(
    () => (data?.batches ?? []).filter((batch) => batch.status === 'active').reduce((sum, batch) => sum + batch.active_quantity, 0),
    [data?.batches]
  )

  const eggsToday = useMemo(
    () => (data?.eggLogs ?? []).filter((entry) => sameDay(entry.record_date)).reduce((sum, entry) => sum + entry.total_eggs, 0),
    [data?.eggLogs]
  )

  const feedRemaining = useMemo(
    () => (data?.feedItems ?? []).reduce((sum, item) => sum + item.current_stock, 0),
    [data?.feedItems]
  )

  const salesThisMonth = useMemo(() => data?.kpis.total_revenue ?? 0, [data?.kpis.total_revenue])

  const productionTrend = useMemo(
    () =>
      [...(data?.eggLogs ?? [])]
        .sort((left, right) => new Date(left.record_date).getTime() - new Date(right.record_date).getTime())
        .slice(-14)
        .map((entry) => ({
          day: new Date(entry.record_date).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' }),
          eggs: entry.total_eggs,
        })),
    [data?.eggLogs]
  )

  const alerts = useMemo(() => {
    const items: Array<{ tone: 'warning' | 'danger' | 'info'; title: string; detail: string }> = []

    ;(data?.feedItems ?? [])
      .filter((item) => item.current_stock <= item.reorder_threshold)
      .slice(0, 2)
      .forEach((item) => {
        items.push({
          tone: 'warning',
          title: 'Low Feed',
          detail: `${item.name} is below reorder level with ${item.current_stock.toLocaleString()} ${item.unit} left.`,
        })
      })

    Object.entries(data?.mortalityByBatch ?? {})
      .map(([batchId, logs]) => ({ batchId, total: logs.reduce((sum, log) => sum + log.quantity, 0) }))
      .filter((entry) => entry.total >= 5)
      .slice(0, 2)
      .forEach((entry) => {
        items.push({
          tone: 'danger',
          title: 'High Mortality',
          detail: `Batch #${entry.batchId} has ${entry.total.toLocaleString()} recorded mortalities.`,
        })
      })

    ;(data?.invoices ?? [])
      .filter((invoice) => invoice.status === 'overdue')
      .slice(0, 2)
      .forEach((invoice) => {
        items.push({
          tone: 'info',
          title: 'Overdue Invoice',
          detail: `${invoice.invoice_number} is overdue with ${formatCurrency(invoice.total_amount - invoice.paid_amount)} outstanding.`,
        })
      })

    return items.slice(0, 5)
  }, [data?.feedItems, data?.invoices, data?.mortalityByBatch])

  const todayTasks = useMemo(() => {
    const items: Array<{ title: string; detail: string; path: string }> = []

    if ((data?.batches?.length ?? 0) > 0 && eggsToday === 0) {
      items.push({ title: 'Record egg collection', detail: 'No egg collection has been logged today.', path: '/farm/eggs' })
    }

    const feedLoggedToday = (data?.consumptions ?? []).some((entry) => sameDay(entry.record_date))
    if ((data?.batches?.length ?? 0) > 0 && !feedLoggedToday) {
      items.push({ title: 'Capture feed usage', detail: 'Feed usage has not been recorded for today.', path: '/feed/consumption' })
    }

    const overdueInvoice = (data?.invoices ?? []).find((invoice) => invoice.status === 'overdue')
    if (overdueInvoice) {
      items.push({ title: 'Follow up overdue invoice', detail: `${overdueInvoice.invoice_number} needs collection action.`, path: '/sales/payments' })
    }

    if (alerts.some((alert) => alert.tone === 'warning')) {
      items.push({ title: 'Review stock alert', detail: 'At least one feed item has reached reorder level.', path: '/feed/stock' })
    }

    return items.slice(0, 4)
  }, [alerts, data?.batches?.length, data?.consumptions, data?.invoices, eggsToday])

  const recentActivity = useMemo(() => {
    const activity = [
      ...(data?.eggLogs ?? []).slice(-3).map((entry) => ({
        type: 'Egg Collection',
        detail: `${entry.total_eggs.toLocaleString()} eggs recorded`,
        date: entry.record_date,
      })),
      ...(data?.slaughterRecords ?? []).slice(-2).map((entry) => ({
        type: 'Slaughter',
        detail: `${entry.live_birds_count.toLocaleString()} birds processed`,
        date: entry.slaughter_date,
      })),
      ...(data?.invoices ?? []).slice(-3).map((entry) => ({
        type: 'Invoice',
        detail: `${entry.invoice_number} created at ${formatCurrency(entry.total_amount)}`,
        date: entry.due_date,
      })),
    ]

    return activity
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
      .slice(0, 6)
  }, [data?.eggLogs, data?.invoices, data?.slaughterRecords])

  const quickActions = [
    { label: 'Add Batch', icon: Bird, path: '/farm/batches' },
    { label: 'Record Eggs', icon: Egg, path: '/farm/eggs' },
    { label: 'Record Feed Usage', icon: Wheat, path: '/feed/consumption' },
    { label: 'Record Mortality', icon: Skull, path: '/farm/mortality' },
    hasPermission('dev_admin:read')
      ? { label: 'Register Vendor', icon: FilePlus2, path: '/dev-admin/tenants' }
      : { label: 'Create Sale', icon: Receipt, path: '/sales/orders' },
    { label: 'Open Reports', icon: ClipboardCheck, path: '/reports/production' },
  ]

  const primaryCards = [
    { title: 'Active Birds', value: activeBirds.toLocaleString(), icon: Bird, accent: 'bg-blue-50 text-blue-600' },
    { title: 'Eggs Today', value: eggsToday.toLocaleString(), icon: Egg, accent: 'bg-amber-50 text-amber-600' },
    { title: 'Feed Remaining', value: `${feedRemaining.toLocaleString()} kg`, icon: Package, accent: 'bg-slate-100 text-slate-600' },
    { title: 'Sales This Month', value: formatCurrency(salesThisMonth), icon: Receipt, accent: 'bg-emerald-50 text-emerald-600' },
  ]

  if (overview.isError) {
    return (
      <div className="card flex items-center gap-4 p-6 text-red-600">
        <AlertTriangle className="h-6 w-6" />
        <div className="font-semibold">Dashboard data could not be loaded.</div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6 pb-8">
      <section className="section-header">
        <div>
          <h1 className="section-title">Operations Dashboard</h1>
          <p className="section-subtitle">Today's priorities, key farm signals, and recent operational activity.</p>
        </div>
      </section>

      <section className="hero-surface overflow-hidden rounded-[2rem] px-6 py-6 text-white">
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr] xl:items-end">
          <div>
            <div className="hero-pill">Admin workspace</div>
            <h2 className="mt-4 font-display text-4xl uppercase leading-none tracking-[0.04em] text-white sm:text-5xl">
              Welcome back
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-white/80 sm:text-base">
              Review live performance, act on alerts quickly, and keep vendor, stock, and farm operations moving from one clean control center.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.6rem] border border-white/16 bg-white/10 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/72">Revenue</div>
              <div className="mt-2 text-2xl font-bold text-white">{formatCurrency(salesThisMonth)}</div>
            </div>
            <div className="rounded-[1.6rem] border border-white/16 bg-white/10 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/72">Active Alerts</div>
              <div className="mt-2 text-2xl font-bold text-white">{alerts.length.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {primaryCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.title} className="kpi-card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{card.title}</div>
                  <div className="mt-3 text-[1.85rem] font-bold tracking-[-0.04em] text-slate-900">{card.value}</div>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          )
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.15fr_0.95fr]">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Today's Tasks</h2>
              <p className="mt-1 text-sm text-slate-500">Immediate actions for the team.</p>
            </div>
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-5 space-y-3">
            {todayTasks.length ? todayTasks.map((task) => (
              <button
                key={task.title}
                type="button"
                onClick={() => navigate(task.path)}
                className="flex w-full items-start justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-white"
              >
                <div>
                  <div className="font-semibold text-slate-900">{task.title}</div>
                  <div className="mt-1 text-sm text-slate-500">{task.detail}</div>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 text-slate-400" />
              </button>
            )) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No urgent tasks right now.
              </div>
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Production Trend</h2>
              <p className="mt-1 text-sm text-slate-500">Last 14 recorded egg collection days.</p>
            </div>
            <Egg className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={productionTrend}>
                <CartesianGrid stroke="#d9e7f5" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#5d7691', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#5d7691', fontSize: 12 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="eggs" stroke="#1b74d8" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Important Alerts</h2>
              <p className="mt-1 text-sm text-slate-500">Items needing attention.</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div className="mt-5 space-y-3">
            {alerts.length ? alerts.map((alert) => (
              <div key={`${alert.title}-${alert.detail}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`status-dot ${alert.tone === 'danger' ? 'bg-red-500' : alert.tone === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                  <div className="font-semibold text-slate-900">{alert.title}</div>
                </div>
                <div className="mt-1 text-sm text-slate-500">{alert.detail}</div>
              </div>
            )) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No active alerts.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
              <p className="mt-1 text-sm text-slate-500">Latest production, slaughter, and sales events.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {recentActivity.length ? recentActivity.map((entry) => (
              <div key={`${entry.type}-${entry.detail}-${entry.date}`} className="flex items-start justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div>
                  <div className="font-semibold text-slate-900">{entry.type}</div>
                  <div className="mt-1 text-sm text-slate-500">{entry.detail}</div>
                </div>
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                  {new Date(entry.date).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No recent activity available.
              </div>
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
              <p className="mt-1 text-sm text-slate-500">Fast entry points for daily work.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-white"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="font-semibold text-slate-900">{action.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
