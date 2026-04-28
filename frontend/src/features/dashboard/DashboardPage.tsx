import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Bird,
  DollarSign,
  Egg,
  Package2,
  Scissors,
  ShieldAlert,
  Syringe,
  Wheat,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '@/services/api'
import { useAuth } from '@/features/auth/AuthContext'

interface KpiData {
  total_revenue: number
  total_expenses: number
  net_profit: number
  total_orders: number
  active_customers: number
  total_birds_slaughtered: number
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
  arrival_date: string
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

interface SlaughterOutput {
  id: number
  quantity: number
}

interface SlaughterRecord {
  id: number
  slaughter_date: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  yield_percentage?: number | null
  total_dressed_weight?: number | null
  live_birds_count: number
  created_at: string
  outputs?: SlaughterOutput[]
}

interface Invoice {
  id: number
  invoice_number: string
  status: 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'cancelled'
  due_date: string
  total_amount: number
  paid_amount: number
}

interface EggLog {
  id: number
  record_date: string
  total_eggs: number
  good_eggs: number
  production_rate: number | null
}

interface MortalityLog {
  id: number
  record_date: string
  quantity: number
}

interface EggSummary {
  total_eggs: number
  total_good: number
  avg_production_rate: number | null
}

interface DashboardOverview {
  kpis: KpiData
  houses: House[]
  batches: Batch[]
  feedItems: FeedItem[]
  consumptions: FeedConsumption[]
  slaughterRecords: SlaughterRecord[]
  invoices: Invoice[]
  eggSummary: EggSummary
  eggLogs: EggLog[]
  mortalityByBatch: Record<number, MortalityLog[]>
}

function sameDay(value: string) {
  return new Date(value).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)
}

function daysOld(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

function formatCurrency(value: number) {
  return `UGX ${value.toLocaleString()}`
}

const CHART_COLORS = ['#1E7A3A', '#2563EB', '#F59E0B', '#DC2626', '#6B7280']

export function DashboardPage() {
  const navigate = useNavigate()
  const { hasPermission, permissions } = useAuth()

  const overview = useQuery<DashboardOverview>({
    queryKey: ['dashboard-overview-v2', permissions.join('|')],
    queryFn: async () => {
      const canFarm = hasPermission('farm:read')
      const canFeed = hasPermission('feed:read')
      const canSlaughter = hasPermission('slaughter:read')
      const canSales = hasPermission('sales:read')

      const [kpis, houses, batches, feedItems, consumptions, slaughterRecords, invoices, eggSummary, eggLogs] = await Promise.all([
        api.get<KpiData>('/analytics/kpis').then((response) => response.data),
        canFarm ? api.get<House[]>('/farm/houses').then((response) => response.data) : Promise.resolve([] as House[]),
        canFarm ? api.get<Batch[]>('/farm/batches').then((response) => response.data) : Promise.resolve([] as Batch[]),
        canFeed ? api.get<FeedItem[]>('/feed/items').then((response) => response.data) : Promise.resolve([] as FeedItem[]),
        canFeed ? api.get<FeedConsumption[]>('/feed/consumptions').then((response) => response.data) : Promise.resolve([] as FeedConsumption[]),
        canSlaughter ? api.get<SlaughterRecord[]>('/slaughter/records').then((response) => response.data) : Promise.resolve([] as SlaughterRecord[]),
        canSales ? api.get<Invoice[]>('/sales/invoices').then((response) => response.data) : Promise.resolve([] as Invoice[]),
        canFarm ? api.get<EggSummary>('/eggs/summary').then((response) => response.data) : Promise.resolve({ total_eggs: 0, total_good: 0, avg_production_rate: null }),
        canFarm ? api.get<EggLog[]>('/eggs').then((response) => response.data) : Promise.resolve([] as EggLog[]),
      ])

      const mortalityByBatch: Record<number, MortalityLog[]> = {}
      if (canFarm && batches.length) {
        const recent = batches.slice(0, 8)
        const mortalityResults = await Promise.all(
          recent.map((batch) =>
            api
              .get<MortalityLog[]>(`/farm/batches/${batch.id}/mortality`)
              .then((response) => ({ batchId: batch.id, logs: response.data }))
              .catch(() => ({ batchId: batch.id, logs: [] as MortalityLog[] }))
          )
        )

        mortalityResults.forEach(({ batchId, logs }) => {
          mortalityByBatch[batchId] = logs
        })
      }

      return {
        kpis,
        houses,
        batches,
        feedItems,
        consumptions,
        slaughterRecords,
        invoices,
        eggSummary,
        eggLogs,
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

  const feedInStock = useMemo(
    () => (data?.feedItems ?? []).reduce((sum, item) => sum + item.current_stock, 0),
    [data?.feedItems]
  )

  const totalMortality = useMemo(
    () => Object.values(data?.mortalityByBatch ?? {}).flat().reduce((sum, log) => sum + log.quantity, 0),
    [data?.mortalityByBatch]
  )

  const mortalityRate = activeBirds > 0 ? (totalMortality / (activeBirds + totalMortality)) * 100 : 0

  const birdsSlaughteredToday = useMemo(
    () => (data?.slaughterRecords ?? []).filter((record) => sameDay(record.slaughter_date)).reduce((sum, record) => sum + record.live_birds_count, 0),
    [data?.slaughterRecords]
  )

  const totalMeatProduced = useMemo(
    () => (data?.slaughterRecords ?? []).reduce((sum, record) => sum + (record.total_dressed_weight ?? 0), 0),
    [data?.slaughterRecords]
  )

  const avgYield = useMemo(() => {
    const completed = (data?.slaughterRecords ?? []).filter((record) => typeof record.yield_percentage === 'number')
    if (!completed.length) return 0
    return completed.reduce((sum, record) => sum + (record.yield_percentage ?? 0), 0) / completed.length
  }, [data?.slaughterRecords])

  const eggChart = useMemo(() => {
    return [...(data?.eggLogs ?? [])]
      .sort((left, right) => new Date(left.record_date).getTime() - new Date(right.record_date).getTime())
      .slice(-14)
      .map((entry) => ({
        day: new Date(entry.record_date).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' }),
        eggs: entry.total_eggs,
      }))
  }, [data?.eggLogs])

  const feedChart = useMemo(() => {
    return [...(data?.consumptions ?? [])]
      .sort((left, right) => new Date(left.record_date).getTime() - new Date(right.record_date).getTime())
      .slice(-14)
      .map((entry) => ({
        day: new Date(entry.record_date).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' }),
        quantity: entry.quantity,
      }))
  }, [data?.consumptions])

  const batchStatusChart = useMemo(() => {
    const counts = new Map<string, number>()
    ;(data?.batches ?? []).forEach((batch) => {
      counts.set(batch.status, (counts.get(batch.status) ?? 0) + 1)
    })
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }))
  }, [data?.batches])

  const recentBatches = useMemo(() => {
    return [...(data?.batches ?? [])]
      .sort((left, right) => new Date(right.arrival_date).getTime() - new Date(left.arrival_date).getTime())
      .slice(0, 6)
      .map((batch) => {
        const mortality = (data?.mortalityByBatch?.[batch.id] ?? []).reduce((sum, log) => sum + log.quantity, 0)
        const rate = batch.initial_quantity > 0 ? (mortality / batch.initial_quantity) * 100 : 0
        return {
          ...batch,
          ageDays: daysOld(batch.arrival_date),
          mortalityRate: rate,
        }
      })
  }, [data?.batches, data?.mortalityByBatch])

  const alerts = useMemo(() => {
    const items: Array<{ tone: 'danger' | 'warning' | 'success' | 'info'; title: string; detail: string }> = []

    recentBatches
      .filter((batch) => batch.mortalityRate >= 2)
      .slice(0, 2)
      .forEach((batch) => {
        items.push({
          tone: 'danger',
          title: 'High Mortality',
          detail: `${batch.batch_number} is at ${batch.mortalityRate.toFixed(1)}% mortality`,
        })
      })

    ;(data?.feedItems ?? [])
      .filter((item) => item.current_stock <= item.reorder_threshold)
      .slice(0, 2)
      .forEach((item) => {
        items.push({
          tone: 'warning',
          title: 'Low Feed Stock',
          detail: `${item.name} has ${item.current_stock.toLocaleString()} ${item.unit} remaining`,
        })
      })

    if (avgYield > 0) {
      items.push({
        tone: 'success',
        title: 'Yield Tracking',
        detail: `Average slaughter yield is ${avgYield.toFixed(1)}%`,
      })
    }

    if ((data?.eggSummary?.avg_production_rate ?? 0) > 0) {
      items.push({
        tone: 'info',
        title: 'Production Info',
        detail: `Average egg production rate is ${(data?.eggSummary?.avg_production_rate ?? 0).toFixed(1)}%`,
      })
    }

    return items.slice(0, 4)
  }, [avgYield, data?.eggSummary?.avg_production_rate, data?.feedItems, recentBatches])

  const chartTooltipStyle = {
    border: '1px solid #E5E7EB',
    borderRadius: '14px',
    background: '#FFFFFF',
    color: '#111827',
    boxShadow: '0 20px 45px -24px rgba(15,23,42,0.28)',
  }

  const primaryCards = [
    { title: 'Total Birds', value: activeBirds.toLocaleString(), icon: Bird, accent: '#1E7A3A' },
    { title: 'Eggs Today', value: eggsToday.toLocaleString(), icon: Egg, accent: '#F59E0B' },
    { title: 'Feed In Stock', value: `${feedInStock.toLocaleString()} kg`, icon: Package2, accent: '#2563EB' },
    { title: 'Mortality Rate', value: `${mortalityRate.toFixed(2)}%`, icon: ShieldAlert, accent: '#DC2626' },
    { title: 'Revenue', value: formatCurrency(data?.kpis.total_revenue ?? 0), icon: DollarSign, accent: '#16A34A' },
  ]

  const slaughterCards = [
    { title: 'Birds Slaughtered Today', value: birdsSlaughteredToday.toLocaleString(), icon: Bird },
    { title: 'Total Meat Produced', value: `${totalMeatProduced.toLocaleString()} kg`, icon: Scissors },
    { title: 'Yield %', value: avgYield ? `${avgYield.toFixed(1)}%` : '0%', icon: Egg },
  ]

  if (overview.isError) {
    return (
      <div className="card flex items-center gap-4 p-6 text-danger">
        <AlertTriangle className="h-6 w-6" />
        <div className="font-semibold">Dashboard data could not be loaded.</div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6 pb-8">
      <section className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[2.15rem] font-semibold tracking-[-0.03em] text-[#111827]">Dashboard</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Operational overview, production flow, subscription-aware access.</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/farm/batches')} className="btn-primary px-4 py-2.5 text-sm font-semibold">
            Add Batch
          </button>
          <button type="button" onClick={() => navigate('/farm/eggs')} className="btn-secondary px-4 py-2.5 text-sm font-semibold">
            Record Egg
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {primaryCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.title} className="rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-[0_22px_50px_-30px_rgba(15,23,42,0.24)]">
              <div className="mb-4 flex items-center gap-3">
                <span className="h-12 w-1 rounded-full" style={{ backgroundColor: card.accent }} />
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${card.accent}15`, color: card.accent }}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6B7280]">{card.title}</div>
              <div className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-[#111827]">{card.value}</div>
            </div>
          )
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {slaughterCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.title} className="rounded-3xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.24)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1E7A3A]/10 text-[#1E7A3A]">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6B7280]">{card.title}</div>
                  <div className="mt-1 text-[1.45rem] font-semibold tracking-[-0.03em] text-[#111827]">{card.value}</div>
                </div>
              </div>
            </div>
          )
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr_0.9fr]">
        <div className="rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-[0_22px_50px_-30px_rgba(15,23,42,0.24)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#111827]">Egg Production</h2>
              <p className="text-sm text-[#6B7280]">Daily output trend</p>
            </div>
            <Egg className="h-5 w-5 text-[#1E7A3A]" />
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={eggChart}>
                <CartesianGrid stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="eggs" stroke="#1E7A3A" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-[0_22px_50px_-30px_rgba(15,23,42,0.24)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#111827]">Feed Consumption</h2>
              <p className="text-sm text-[#6B7280]">Recent feed usage</p>
            </div>
            <Wheat className="h-5 w-5 text-[#1E7A3A]" />
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={feedChart}>
                <CartesianGrid stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="quantity" fill="#1E7A3A" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-[0_22px_50px_-30px_rgba(15,23,42,0.24)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#111827]">Batch Status</h2>
              <p className="text-sm text-[#6B7280]">Current flock distribution</p>
            </div>
            <Bird className="h-5 w-5 text-[#1E7A3A]" />
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={batchStatusChart} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3}>
                  {batchStatusChart.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-[#E5E7EB] bg-white shadow-[0_22px_50px_-30px_rgba(15,23,42,0.24)]">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-[#111827]">Recent Batches</h2>
              <p className="text-sm text-[#6B7280]">Latest flock performance snapshot</p>
            </div>
            <button type="button" onClick={() => navigate('/farm/batches')} className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E7A3A]">
              View all
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F8FAFC] text-[#6B7280]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Batch ID</th>
                  <th className="px-5 py-3 font-semibold">Breed</th>
                  <th className="px-5 py-3 font-semibold">Birds</th>
                  <th className="px-5 py-3 font-semibold">Age</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Mortality Rate</th>
                  <th className="px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentBatches.map((batch) => (
                  <tr key={batch.id} className="border-t border-[#E5E7EB] hover:bg-[#F9FAFB]">
                    <td className="px-5 py-3 font-semibold text-[#111827]">{batch.batch_number}</td>
                    <td className="px-5 py-3 text-[#6B7280]">{batch.breed}</td>
                    <td className="px-5 py-3 text-[#111827]">{batch.active_quantity.toLocaleString()}</td>
                    <td className="px-5 py-3 text-[#6B7280]">{batch.ageDays} days</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-full bg-[#1E7A3A]/10 px-2.5 py-1 text-xs font-semibold capitalize text-[#1E7A3A]">
                        {batch.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[#111827]">{batch.mortalityRate.toFixed(2)}%</td>
                    <td className="px-5 py-3">
                      <button type="button" onClick={() => navigate('/farm/batches')} className="text-sm font-semibold text-[#1E7A3A]">
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
                {recentBatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-[#6B7280]">
                      No batch data available.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-[#E5E7EB] bg-white shadow-[0_22px_50px_-30px_rgba(15,23,42,0.24)]">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-[#111827]">Alerts & Notifications</h2>
              <p className="text-sm text-[#6B7280]">Operational issues that need attention</p>
            </div>
            <Syringe className="h-5 w-5 text-[#1E7A3A]" />
          </div>
          <div className="divide-y divide-[#E5E7EB]">
            {alerts.map((alert) => (
              <div key={`${alert.title}-${alert.detail}`} className="flex gap-4 px-5 py-4">
                <div
                  className="mt-1 h-10 w-10 shrink-0 rounded-2xl"
                  style={{
                    background:
                      alert.tone === 'danger'
                        ? 'rgba(220,38,38,0.12)'
                        : alert.tone === 'warning'
                          ? 'rgba(245,158,11,0.14)'
                          : alert.tone === 'success'
                            ? 'rgba(22,163,74,0.12)'
                            : 'rgba(37,99,235,0.12)',
                  }}
                />
                <div>
                  <div className="font-semibold text-[#111827]">{alert.title}</div>
                  <div className="mt-1 text-sm text-[#6B7280]">{alert.detail}</div>
                </div>
              </div>
            ))}
            {alerts.length === 0 ? (
              <div className="px-5 py-10 text-center text-[#6B7280]">No active alerts.</div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
