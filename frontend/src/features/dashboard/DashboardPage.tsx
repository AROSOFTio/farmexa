import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Bird,
  Boxes,
  ClipboardCheck,
  Egg,
  FilePlus2,
  Package,
  Receipt,
  Scissors,
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
  outputs?: Array<{
    id: number
    output_type: string
    quantity: number
  }>
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
  partialErrors: string[]
}

const chartTooltipStyle = {
  border: '1px solid var(--border-subtle)',
  borderRadius: '14px',
  background: 'var(--surface-card)',
  boxShadow: '0 12px 24px -20px rgba(0, 0, 0, 0.72)',
}

const saleableOutputTypes = new Set<string>([
  'dressed_chicken',
  'chicken_breast',
  'chicken_thighs',
  'chicken_wings',
  'chicken_drumsticks',
  'gizzards',
  'liver',
  'neck_backs',
])

const byproductOutputTypes = new Set<string>(['poultry_manure', 'feet', 'head'])

function sameDay(value: string) {
  return new Date(value).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)
}

function formatCurrency(value: number) {
  return `UGX ${value.toLocaleString()}`
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { enabledModules, hasModuleAccess, hasPermission, permissions } = useAuth()

  const overview = useQuery<DashboardOverview>({
    queryKey: ['dashboard-overview-v4', permissions.join('|'), enabledModules.join('|')],
    queryFn: async () => {
      const canBatches = hasPermission('farm:read') && hasModuleAccess('batches')
      const canEggProduction = hasPermission('farm:read') && hasModuleAccess('egg_production')
      const canFeedStock = hasPermission('feed:read') && hasModuleAccess('feed_stock')
      const canFeedConsumption = hasPermission('feed:read') && hasModuleAccess('feed_consumption')
      const canSalesInvoices = hasPermission('sales:read') && hasModuleAccess('invoices')
      const canSlaughterRecords = hasPermission('slaughter:read') && hasModuleAccess('slaughter_records')
      const canMortality = hasPermission('farm:read') && hasModuleAccess('mortality')
      const partialErrors: string[] = []

      const loadOrFallback = async <T,>(label: string, enabled: boolean, fallback: T, request: () => Promise<T>) => {
        if (!enabled) return fallback
        try {
          return await request()
        } catch {
          partialErrors.push(label)
          return fallback
        }
      }

      const [kpis, batches, feedItems, consumptions, eggSummary, eggLogs, invoices, slaughterRecords] = await Promise.all([
        loadOrFallback('overview', true, { total_revenue: 0 }, () =>
          api.get<KpiData>('/analytics/kpis').then((response) => response.data)
        ),
        loadOrFallback('batches', canBatches, [] as Batch[], () =>
          api.get<Batch[]>('/farm/batches').then((response) => response.data)
        ),
        loadOrFallback('feed stock', canFeedStock, [] as FeedItem[], () =>
          api.get<FeedItem[]>('/feed/items').then((response) => response.data)
        ),
        loadOrFallback('feed usage', canFeedConsumption, [] as FeedConsumption[], () =>
          api.get<FeedConsumption[]>('/feed/consumptions').then((response) => response.data)
        ),
        loadOrFallback('egg summary', canEggProduction, { total_eggs: 0, total_good: 0, avg_production_rate: null }, () =>
          api.get<EggSummary>('/eggs/summary').then((response) => response.data)
        ),
        loadOrFallback('egg logs', canEggProduction, [] as EggLog[], () =>
          api.get<EggLog[]>('/eggs').then((response) => response.data)
        ),
        loadOrFallback('invoices', canSalesInvoices, [] as Invoice[], () =>
          api.get<Invoice[]>('/sales/invoices').then((response) => response.data)
        ),
        loadOrFallback('slaughter', canSlaughterRecords, [] as SlaughterRecord[], () =>
          api.get<SlaughterRecord[]>('/slaughter/records').then((response) => response.data)
        ),
      ])

      const mortalityByBatch: Record<number, MortalityLog[]> = {}
      if (canMortality && batches.length) {
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
        partialErrors,
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

  const processingOutputs = useMemo(
    () =>
      (data?.slaughterRecords ?? []).flatMap((record) =>
        (record.outputs ?? []).map((output) => ({
          ...output,
          slaughter_date: record.slaughter_date,
        }))
      ),
    [data?.slaughterRecords]
  )

  const processingSummary = useMemo(() => {
    const cutLines = processingOutputs.filter((output) => saleableOutputTypes.has(output.output_type))
    const byproductLines = processingOutputs.filter((output) => byproductOutputTypes.has(output.output_type))
    return {
      cutLines: cutLines.length,
      byproductLines: byproductLines.length,
      totalKg: processingOutputs.reduce((sum, output) => sum + Number(output.quantity || 0), 0),
    }
  }, [processingOutputs])

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
    const items: Array<{ title: string; detail: string }> = []

    ;(data?.feedItems ?? [])
      .filter((item) => item.current_stock <= item.reorder_threshold)
      .slice(0, 2)
      .forEach((item) => {
        items.push({
          title: 'Low feed',
          detail: `${item.name}: ${item.current_stock.toLocaleString()} ${item.unit}`,
        })
      })

    Object.entries(data?.mortalityByBatch ?? {})
      .map(([batchId, logs]) => ({ batchId, total: logs.reduce((sum, log) => sum + log.quantity, 0) }))
      .filter((entry) => entry.total >= 5)
      .slice(0, 2)
      .forEach((entry) => {
        items.push({
          title: 'Mortality',
          detail: `Batch ${entry.batchId}: ${entry.total.toLocaleString()}`,
        })
      })

    ;(data?.invoices ?? [])
      .filter((invoice) => invoice.status === 'overdue')
      .slice(0, 2)
      .forEach((invoice) => {
        items.push({
          title: 'Overdue',
          detail: `${invoice.invoice_number}: ${formatCurrency(invoice.total_amount - invoice.paid_amount)}`,
        })
      })

    return items.slice(0, 5)
  }, [data?.feedItems, data?.invoices, data?.mortalityByBatch])

  const todayTasks = useMemo(() => {
    const items: Array<{ title: string; detail: string; path: string }> = []

    if ((data?.batches?.length ?? 0) > 0 && eggsToday === 0) {
      items.push({ title: 'Record eggs', detail: 'No entry today', path: '/farm/eggs' })
    }

    const feedLoggedToday = (data?.consumptions ?? []).some((entry) => sameDay(entry.record_date))
    if ((data?.batches?.length ?? 0) > 0 && !feedLoggedToday) {
      items.push({ title: 'Record feed', detail: 'No entry today', path: '/feed/consumption' })
    }

    const overdueInvoice = (data?.invoices ?? []).find((invoice) => invoice.status === 'overdue')
    if (overdueInvoice) {
      items.push({ title: 'Collect invoice', detail: overdueInvoice.invoice_number, path: '/sales/payments' })
    }

    if (alerts.length) {
      items.push({ title: 'Check alerts', detail: `${alerts.length} open`, path: '/feed/stock' })
    }

    return items.slice(0, 4)
  }, [alerts.length, data?.batches?.length, data?.consumptions, data?.invoices, eggsToday])

  const recentActivity = useMemo(() => {
    const activity = [
      ...(data?.eggLogs ?? []).slice(-3).map((entry) => ({
        type: 'Eggs',
        detail: `${entry.total_eggs.toLocaleString()} recorded`,
        date: entry.record_date,
      })),
      ...(data?.slaughterRecords ?? []).slice(-2).map((entry) => ({
        type: 'Slaughter',
        detail: `${entry.live_birds_count.toLocaleString()} birds`,
        date: entry.slaughter_date,
      })),
      ...(data?.invoices ?? []).slice(-3).map((entry) => ({
        type: 'Invoice',
        detail: entry.invoice_number,
        date: entry.due_date,
      })),
    ]

    return activity
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
      .slice(0, 6)
  }, [data?.eggLogs, data?.invoices, data?.slaughterRecords])

  const quickActions = [
    hasPermission('farm:read') && hasModuleAccess('batches') ? { label: 'Batch', icon: Bird, path: '/farm/batches' } : null,
    hasPermission('farm:read') && hasModuleAccess('egg_production') ? { label: 'Eggs', icon: Egg, path: '/farm/eggs' } : null,
    hasPermission('feed:read') && hasModuleAccess('feed_consumption') ? { label: 'Feed', icon: Wheat, path: '/feed/consumption' } : null,
    hasPermission('farm:read') && hasModuleAccess('mortality') ? { label: 'Mortality', icon: Skull, path: '/farm/mortality' } : null,
    hasPermission('dev_admin:read')
      ? { label: 'Vendor', icon: FilePlus2, path: '/dev-admin/tenants' }
      : hasPermission('sales:read') && hasModuleAccess('sales_orders')
        ? { label: 'Sale', icon: Receipt, path: '/sales/orders' }
        : null,
    hasPermission('reports:read') && hasModuleAccess('reports') ? { label: 'Reports', icon: ClipboardCheck, path: '/reports/production' } : null,
  ].filter((item): item is { label: string; icon: typeof Bird; path: string } => item !== null)

  const primaryCards = [
    { title: 'Birds', value: activeBirds.toLocaleString(), icon: Bird },
    { title: 'Eggs', value: eggsToday.toLocaleString(), icon: Egg },
    { title: 'Feed', value: `${feedRemaining.toLocaleString()} kg`, icon: Package },
    { title: 'Sales', value: formatCurrency(salesThisMonth), icon: Receipt },
  ]

  return (
    <div className="animate-fade-in space-y-4 pb-5">
      <section className="section-header">
        <div>
          <h1 className="section-title">Dashboard</h1>
          <p className="section-subtitle">Overview</p>
        </div>
      </section>

      {overview.isError ? (
        <div className="card flex items-center gap-4 p-6 text-[var(--text-default)]">
          <AlertTriangle className="h-6 w-6 text-[var(--brand-primary)]" />
          <div className="font-semibold">Dashboard data could not be loaded.</div>
        </div>
      ) : null}

      {!overview.isError && (data?.partialErrors?.length ?? 0) > 0 ? (
        <div className="card flex items-center gap-4 p-4 text-[var(--text-default)]">
          <AlertTriangle className="h-5 w-5 text-[var(--brand-primary)]" />
          <div className="text-[13px] font-medium">
            Some dashboard widgets are unavailable right now: {data?.partialErrors.join(', ')}.
          </div>
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {primaryCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.title} className="kpi-card px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">{card.title}</div>
                  <div className="mt-2 text-[1.05rem] font-semibold text-[var(--text-strong)] sm:text-[1.75rem]">{card.value}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(52,168,83,0.1)] text-[var(--brand-primary)]">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </div>
          )
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.2fr_0.82fr]">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[1rem] font-semibold text-[var(--text-strong)]">Tasks</h2>
            <ClipboardCheck className="h-[18px] w-[18px] text-[var(--brand-primary)]" />
          </div>
          <div className="mt-4 space-y-2.5">
            {todayTasks.length ? todayTasks.map((task) => (
              <button
                key={task.title}
                type="button"
                onClick={() => navigate(task.path)}
                className="flex w-full items-start justify-between rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3 text-left hover:bg-[var(--surface-muted)]"
              >
                <div>
                  <div className="text-[14px] font-semibold text-[var(--text-strong)]">{task.title}</div>
                  <div className="mt-0.5 text-[13px] text-[var(--text-muted)]">{task.detail}</div>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 text-[var(--brand-primary)]" />
              </button>
            )) : (
              <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
                No tasks
              </div>
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[1rem] font-semibold text-[var(--text-strong)]">Production</h2>
            <Egg className="h-[18px] w-[18px] text-[var(--brand-primary)]" />
          </div>
          <div className="mt-3 h-[292px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={productionTrend}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="eggs" stroke="#34a853" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[1rem] font-semibold text-[var(--text-strong)]">Alerts</h2>
            <AlertTriangle className="h-[18px] w-[18px] text-[var(--brand-primary)]" />
          </div>
          <div className="mt-4 space-y-2.5">
            {alerts.length ? alerts.map((alert) => (
              <div key={`${alert.title}-${alert.detail}`} className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="status-dot bg-[var(--brand-primary)]" />
                  <div className="text-[14px] font-semibold text-[var(--text-strong)]">{alert.title}</div>
                </div>
                <div className="mt-0.5 text-[13px] text-[var(--text-muted)]">{alert.detail}</div>
              </div>
            )) : (
              <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
                No alerts
              </div>
            )}
          </div>
        </div>
      </section>

      {hasPermission('slaughter:read') &&
      (hasModuleAccess('slaughter_outputs') || hasModuleAccess('slaughter_cut_parts') || hasModuleAccess('slaughter_byproducts')) ? (
        <section className="grid gap-3 md:grid-cols-3">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <Scissors className="h-4 w-4 text-[var(--brand-primary)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Cut parts</span>
            </div>
            <div className="mt-3 text-[1.6rem] font-semibold text-[var(--text-strong)]">{processingSummary.cutLines}</div>
            <div className="mt-1 text-[13px] text-[var(--text-muted)]">Saleable cuts and processed poultry items already posted.</div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <Boxes className="h-4 w-4 text-[var(--brand-primary)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Byproducts</span>
            </div>
            <div className="mt-3 text-[1.6rem] font-semibold text-[var(--text-strong)]">{processingSummary.byproductLines}</div>
            <div className="mt-1 text-[13px] text-[var(--text-muted)]">Manure, feet, and head batches transferred into inventory.</div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <Package className="h-4 w-4 text-[var(--brand-primary)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Processed kg</span>
            </div>
            <div className="mt-3 text-[1.6rem] font-semibold text-[var(--text-strong)]">{processingSummary.totalKg.toLocaleString()} kg</div>
            <div className="mt-1 text-[13px] text-[var(--text-muted)]">Combined output quantity from approved slaughter postings.</div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <div className="card p-5">
          <h2 className="text-[1rem] font-semibold text-[var(--text-strong)]">Recent</h2>
          <div className="mt-4 space-y-2.5">
            {recentActivity.length ? recentActivity.map((entry) => (
              <div key={`${entry.type}-${entry.detail}-${entry.date}`} className="flex items-start justify-between rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3">
                <div>
                  <div className="text-[14px] font-semibold text-[var(--text-strong)]">{entry.type}</div>
                  <div className="mt-0.5 text-[13px] text-[var(--text-muted)]">{entry.detail}</div>
                </div>
                <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  {new Date(entry.date).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            )) : (
              <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
                No activity
              </div>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-[1rem] font-semibold text-[var(--text-strong)]">Quick</h2>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className="flex items-center gap-3 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-2.5 text-left hover:bg-[var(--surface-muted)]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(52,168,83,0.1)] text-[var(--brand-primary)]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[14px] font-semibold text-[var(--text-strong)]">{action.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
