import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  Bird,
  Boxes,
  CircleDollarSign,
  Download,
  FileDown,
  LineChart,
  Pill,
  RefreshCw,
  Scissors,
  ShoppingCart,
  Skull,
  Wheat,
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
import { toast } from 'sonner'
import api from '@/services/api'
import { useAuth } from '@/features/auth/AuthContext'

interface KpiSummary {
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
  arrival_date: string
  initial_quantity: number
  active_quantity: number
  status: string
  house?: House | null
}

interface MortalityLog {
  id: number
  batch_id: number
  record_date: string
  quantity: number
  cause?: string | null
  notes?: string | null
}

interface VaccinationLog {
  id: number
  batch_id: number
  vaccine_name: string
  scheduled_date: string
  administered_date?: string | null
  status: 'pending' | 'completed' | 'cancelled'
  notes?: string | null
}

interface GrowthLog {
  id: number
  batch_id: number
  record_date: string
  avg_weight_grams: number
  notes?: string | null
}

interface FeedItem {
  id: number
  name: string
  unit: string
  current_stock: number
  reorder_threshold: number
  category?: { name: string } | null
}

interface FeedConsumption {
  id: number
  batch_id: number
  feed_item_id: number
  record_date: string
  quantity: number
  notes?: string | null
}

interface SlaughterOutput {
  id: number
  stock_item_id: number
  quantity: number
  total_cost?: number | null
}

interface SlaughterRecord {
  id: number
  batch_id: number
  slaughter_date: string
  live_birds_count: number
  total_live_weight: number
  total_dressed_weight?: number | null
  waste_weight: number
  condemned_birds_count: number
  yield_percentage?: number | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  outputs: SlaughterOutput[]
}

interface StockItem {
  id: number
  name: string
  category: string
  unit_of_measure: string
  reorder_level: number
  average_cost: number
  current_quantity: number
  is_active: boolean
}

interface StockMovement {
  id: number
  item_id: number
  movement_type: 'in' | 'out' | 'adjustment'
  quantity: number
  previous_quantity: number
  new_quantity: number
  reference_type?: string | null
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
  expense_date: string
  amount: number
  description?: string | null
  reference?: string | null
  category?: { name: string } | null
}

interface Income {
  id: number
  income_date: string
  amount: number
  description?: string | null
  reference?: string | null
  category?: { name: string } | null
}

interface ReportsCenterData {
  profit: {
    summary: KpiSummary
    timeline: ProfitPoint[]
  }
  sales: {
    total_revenue: number
    timeline: SalesPoint[]
  }
  houses: House[]
  batches: Batch[]
  mortalities: MortalityLog[]
  vaccinations: VaccinationLog[]
  growthLogs: GrowthLog[]
  feedItems: FeedItem[]
  feedConsumptions: FeedConsumption[]
  slaughterRecords: SlaughterRecord[]
  stockItems: StockItem[]
  stockMovements: StockMovement[]
  invoices: Invoice[]
  expenses: Expense[]
  incomes: Income[]
}

function formatCurrency(value: number) {
  return `UGX ${Math.round(value || 0).toLocaleString()}`
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function csvValue(value: unknown) {
  const raw = value == null ? '' : String(value)
  return `"${raw.replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    toast.error('No rows are available for export yet.')
    return
  }

  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(',')),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function ProfitDashboard() {
  const { hasPermission, permissions } = useAuth()

  const reports = useQuery<ReportsCenterData>({
    queryKey: ['reports-center', permissions.join('|')],
    queryFn: async () => {
      const canFarm = hasPermission('farm:read')
      const canFeed = hasPermission('feed:read')
      const canSlaughter = hasPermission('slaughter:read')
      const canInventory = hasPermission('inventory:read')
      const canSales = hasPermission('sales:read')
      const canFinance = hasPermission('finance:read')

      const [profit, sales, houses, batches, feedItems, feedConsumptions, slaughterRecords, stockItems, stockMovements, invoices, expenses, incomes] =
        await Promise.all([
          api.get<{ summary: KpiSummary; timeline: ProfitPoint[] }>('/analytics/profit').then((response) => response.data),
          api.get<{ total_revenue: number; timeline: SalesPoint[] }>('/analytics/sales').then((response) => response.data),
          canFarm ? api.get<House[]>('/farm/houses').then((response) => response.data) : Promise.resolve([] as House[]),
          canFarm ? api.get<Batch[]>('/farm/batches').then((response) => response.data) : Promise.resolve([] as Batch[]),
          canFeed ? api.get<FeedItem[]>('/feed/items').then((response) => response.data) : Promise.resolve([] as FeedItem[]),
          canFeed
            ? api.get<FeedConsumption[]>('/feed/consumptions').then((response) => response.data)
            : Promise.resolve([] as FeedConsumption[]),
          canSlaughter
            ? api.get<SlaughterRecord[]>('/slaughter/records').then((response) => response.data)
            : Promise.resolve([] as SlaughterRecord[]),
          canInventory
            ? api.get<StockItem[]>('/inventory/items').then((response) => response.data)
            : Promise.resolve([] as StockItem[]),
          canInventory
            ? api.get<StockMovement[]>('/inventory/movements').then((response) => response.data)
            : Promise.resolve([] as StockMovement[]),
          canSales ? api.get<Invoice[]>('/sales/invoices').then((response) => response.data) : Promise.resolve([] as Invoice[]),
          canFinance ? api.get<Expense[]>('/finance/expenses').then((response) => response.data) : Promise.resolve([] as Expense[]),
          canFinance ? api.get<Income[]>('/finance/incomes').then((response) => response.data) : Promise.resolve([] as Income[]),
        ])

      let mortalities: MortalityLog[] = []
      let vaccinations: VaccinationLog[] = []
      let growthLogs: GrowthLog[] = []

      if (canFarm && batches.length > 0) {
        const [mortalityLists, vaccinationLists, growthLists] = await Promise.all([
          Promise.all(
            batches.map((batch) =>
              api
                .get<MortalityLog[]>(`/farm/batches/${batch.id}/mortality`)
                .then((response) => response.data)
            )
          ),
          Promise.all(
            batches.map((batch) =>
              api
                .get<VaccinationLog[]>(`/farm/batches/${batch.id}/vaccinations`)
                .then((response) => response.data)
            )
          ),
          Promise.all(
            batches.map((batch) =>
              api
                .get<GrowthLog[]>(`/farm/batches/${batch.id}/growth`)
                .then((response) => response.data)
            )
          ),
        ])

        mortalities = mortalityLists.flat()
        vaccinations = vaccinationLists.flat()
        growthLogs = growthLists.flat()
      }

      return {
        profit,
        sales,
        houses,
        batches,
        mortalities,
        vaccinations,
        growthLogs,
        feedItems,
        feedConsumptions,
        slaughterRecords,
        stockItems,
        stockMovements,
        invoices,
        expenses,
        incomes,
      }
    },
    refetchInterval: 60_000,
  })

  const data = reports.data

  const totalInitialBirds = useMemo(
    () => (data?.batches ?? []).reduce((sum, batch) => sum + batch.initial_quantity, 0),
    [data?.batches]
  )

  const liveBirds = useMemo(
    () => (data?.batches ?? []).reduce((sum, batch) => sum + batch.active_quantity, 0),
    [data?.batches]
  )

  const totalMortality = useMemo(
    () => (data?.mortalities ?? []).reduce((sum, log) => sum + log.quantity, 0),
    [data?.mortalities]
  )

  const mortalityRate = totalInitialBirds > 0 ? (totalMortality / totalInitialBirds) * 100 : 0

  const pendingVaccinations = useMemo(
    () => (data?.vaccinations ?? []).filter((log) => log.status === 'pending'),
    [data?.vaccinations]
  )

  const completedVaccinations = useMemo(
    () => (data?.vaccinations ?? []).filter((log) => log.status === 'completed').length,
    [data?.vaccinations]
  )

  const latestGrowthAverage = useMemo(() => {
    const latestByBatch = new Map<number, GrowthLog>()
    for (const log of data?.growthLogs ?? []) {
      const existing = latestByBatch.get(log.batch_id)
      if (!existing || log.record_date > existing.record_date) {
        latestByBatch.set(log.batch_id, log)
      }
    }

    const latestValues = [...latestByBatch.values()]
    if (!latestValues.length) return 0
    return latestValues.reduce((sum, log) => sum + log.avg_weight_grams, 0) / latestValues.length
  }, [data?.growthLogs])

  const lowFeedItems = useMemo(
    () => (data?.feedItems ?? []).filter((item) => item.current_stock <= item.reorder_threshold),
    [data?.feedItems]
  )

  const totalFeedConsumed = useMemo(
    () => (data?.feedConsumptions ?? []).reduce((sum, record) => sum + record.quantity, 0),
    [data?.feedConsumptions]
  )

  const averageYield = useMemo(() => {
    const completed = (data?.slaughterRecords ?? []).filter((record) => typeof record.yield_percentage === 'number')
    if (!completed.length) return 0
    return completed.reduce((sum, record) => sum + (record.yield_percentage || 0), 0) / completed.length
  }, [data?.slaughterRecords])

  const totalCondemnedBirds = useMemo(
    () => (data?.slaughterRecords ?? []).reduce((sum, record) => sum + record.condemned_birds_count, 0),
    [data?.slaughterRecords]
  )

  const lowStockItems = useMemo(
    () => (data?.stockItems ?? []).filter((item) => item.current_quantity <= item.reorder_level),
    [data?.stockItems]
  )

  const inventoryValue = useMemo(
    () => (data?.stockItems ?? []).reduce((sum, item) => sum + item.current_quantity * item.average_cost, 0),
    [data?.stockItems]
  )

  const outstandingInvoices = useMemo(
    () => (data?.invoices ?? []).filter((invoice) => invoice.status !== 'paid' && invoice.status !== 'cancelled'),
    [data?.invoices]
  )

  const receivables = useMemo(
    () =>
      outstandingInvoices.reduce(
        (sum, invoice) => sum + Math.max(invoice.total_amount - invoice.paid_amount, 0),
        0
      ),
    [outstandingInvoices]
  )

  const totalIncome = useMemo(
    () => (data?.incomes ?? []).reduce((sum, record) => sum + record.amount, 0),
    [data?.incomes]
  )

  const totalExpense = useMemo(
    () => (data?.expenses ?? []).reduce((sum, record) => sum + record.amount, 0),
    [data?.expenses]
  )

  const highOccupancyHouses = useMemo(
    () =>
      (data?.houses ?? []).filter((house) => {
        if (house.capacity <= 0) return false
        const birds = (data?.batches ?? [])
          .filter((batch) => batch.house_id === house.id && batch.status === 'active')
          .reduce((sum, batch) => sum + batch.active_quantity, 0)
        return birds / house.capacity >= 0.9
      }),
    [data?.batches, data?.houses]
  )

  const productionRows = useMemo(
    () =>
      (data?.batches ?? []).map((batch) => ({
        batch_number: batch.batch_number,
        breed: batch.breed,
        house: batch.house?.name ?? 'Unassigned',
        arrival_date: formatDate(batch.arrival_date),
        initial_quantity: batch.initial_quantity,
        active_quantity: batch.active_quantity,
        status: batch.status,
      })),
    [data?.batches]
  )

  const mortalityRows = useMemo(
    () =>
      [...(data?.mortalities ?? [])]
        .sort((left, right) => right.record_date.localeCompare(left.record_date))
        .map((log) => ({
          batch_number: data?.batches.find((batch) => batch.id === log.batch_id)?.batch_number ?? `Batch #${log.batch_id}`,
          record_date: formatDate(log.record_date),
          quantity: log.quantity,
          cause: log.cause ?? 'Not stated',
          notes: log.notes ?? '',
        })),
    [data?.batches, data?.mortalities]
  )

  const vaccinationRows = useMemo(
    () =>
      [...(data?.vaccinations ?? [])]
        .sort((left, right) => right.scheduled_date.localeCompare(left.scheduled_date))
        .map((log) => ({
          batch_number: data?.batches.find((batch) => batch.id === log.batch_id)?.batch_number ?? `Batch #${log.batch_id}`,
          vaccine_name: log.vaccine_name,
          scheduled_date: formatDate(log.scheduled_date),
          administered_date: formatDate(log.administered_date),
          status: log.status,
          notes: log.notes ?? '',
        })),
    [data?.batches, data?.vaccinations]
  )

  const feedRows = useMemo(
    () =>
      (data?.feedItems ?? []).map((item) => ({
        item_name: item.name,
        category: item.category?.name ?? 'Uncategorized',
        current_stock: item.current_stock,
        unit: item.unit,
        reorder_threshold: item.reorder_threshold,
        low_stock: item.current_stock <= item.reorder_threshold ? 'Yes' : 'No',
      })),
    [data?.feedItems]
  )

  const slaughterRows = useMemo(
    () =>
      (data?.slaughterRecords ?? []).map((record) => ({
        slaughter_date: formatDate(record.slaughter_date),
        batch_number: data?.batches.find((batch) => batch.id === record.batch_id)?.batch_number ?? `Batch #${record.batch_id}`,
        live_birds_count: record.live_birds_count,
        dressed_weight: record.total_dressed_weight ?? 0,
        waste_weight: record.waste_weight,
        condemned_birds_count: record.condemned_birds_count,
        yield_percentage: record.yield_percentage ?? 0,
        status: record.status,
      })),
    [data?.batches, data?.slaughterRecords]
  )

  const inventoryRows = useMemo(
    () =>
      (data?.stockItems ?? []).map((item) => ({
        item_name: item.name,
        category: item.category,
        quantity: item.current_quantity,
        unit: item.unit_of_measure,
        average_cost: item.average_cost,
        inventory_value: item.current_quantity * item.average_cost,
        reorder_level: item.reorder_level,
        status: item.current_quantity <= item.reorder_level ? 'Low stock' : item.is_active ? 'Active' : 'Inactive',
      })),
    [data?.stockItems]
  )

  const salesRows = useMemo(
    () =>
      (data?.invoices ?? []).map((invoice) => ({
        invoice_number: invoice.invoice_number,
        customer: invoice.customer?.name ?? 'Walk-in',
        issue_date: formatDate(invoice.created_at),
        due_date: formatDate(invoice.due_date),
        status: invoice.status,
        total_amount: invoice.total_amount,
        paid_amount: invoice.paid_amount,
        outstanding_balance: Math.max(invoice.total_amount - invoice.paid_amount, 0),
      })),
    [data?.invoices]
  )

  const financeRows = useMemo(
    () => [
      ...(data?.expenses ?? []).map((expense) => ({
        record_type: 'expense',
        category: expense.category?.name ?? 'General',
        record_date: formatDate(expense.expense_date),
        amount: expense.amount,
        reference: expense.reference ?? '',
        description: expense.description ?? '',
      })),
      ...(data?.incomes ?? []).map((income) => ({
        record_type: 'income',
        category: income.category?.name ?? 'General',
        record_date: formatDate(income.income_date),
        amount: income.amount,
        reference: income.reference ?? '',
        description: income.description ?? '',
      })),
    ],
    [data?.expenses, data?.incomes]
  )

  const reportCards = [
    {
      title: 'Production report',
      icon: Bird,
      permission: hasPermission('farm:read'),
      summary: `${liveBirds.toLocaleString()} live birds across ${(data?.batches ?? []).length.toLocaleString()} batches`,
      detail: `${(data?.houses ?? []).filter((house) => house.status === 'active').length} active houses, ${highOccupancyHouses.length} near capacity`,
      exportRows: productionRows,
      filename: 'farmexa-production-report.csv',
    },
    {
      title: 'Mortality report',
      icon: Skull,
      permission: hasPermission('farm:read'),
      summary: `${totalMortality.toLocaleString()} losses recorded`,
      detail: `${mortalityRate.toFixed(1)}% cumulative mortality rate`,
      exportRows: mortalityRows,
      filename: 'farmexa-mortality-report.csv',
    },
    {
      title: 'Vaccination report',
      icon: Pill,
      permission: hasPermission('farm:read'),
      summary: `${completedVaccinations.toLocaleString()} completed vaccinations`,
      detail: `${pendingVaccinations.length.toLocaleString()} still pending`,
      exportRows: vaccinationRows,
      filename: 'farmexa-vaccination-report.csv',
    },
    {
      title: 'Feed report',
      icon: Wheat,
      permission: hasPermission('feed:read'),
      summary: `${totalFeedConsumed.toLocaleString()} units consumed`,
      detail: `${lowFeedItems.length.toLocaleString()} feed items below threshold`,
      exportRows: feedRows,
      filename: 'farmexa-feed-report.csv',
    },
    {
      title: 'Slaughter report',
      icon: Scissors,
      permission: hasPermission('slaughter:read'),
      summary: `${(data?.slaughterRecords ?? []).length.toLocaleString()} slaughter runs logged`,
      detail: `${averageYield.toFixed(1)}% average yield, ${totalCondemnedBirds.toLocaleString()} condemned birds`,
      exportRows: slaughterRows,
      filename: 'farmexa-slaughter-report.csv',
    },
    {
      title: 'Inventory report',
      icon: Boxes,
      permission: hasPermission('inventory:read'),
      summary: formatCurrency(inventoryValue),
      detail: `${lowStockItems.length.toLocaleString()} stock items below reorder level`,
      exportRows: inventoryRows,
      filename: 'farmexa-inventory-report.csv',
    },
    {
      title: 'Sales report',
      icon: ShoppingCart,
      permission: hasPermission('sales:read'),
      summary: `${outstandingInvoices.length.toLocaleString()} open invoices`,
      detail: `${formatCurrency(receivables)} in receivables`,
      exportRows: salesRows,
      filename: 'farmexa-sales-report.csv',
    },
    {
      title: 'Finance report',
      icon: CircleDollarSign,
      permission: hasPermission('finance:read'),
      summary: `${formatCurrency(totalIncome)} income, ${formatCurrency(totalExpense)} expenses`,
      detail: `${formatCurrency((data?.profit.summary.net_profit ?? 0) || totalIncome - totalExpense)} net contribution`,
      exportRows: financeRows,
      filename: 'farmexa-finance-report.csv',
    },
  ].filter((card) => card.permission)

  const recentMortality = useMemo(() => mortalityRows.slice(0, 5), [mortalityRows])
  const pendingVaccinationRows = useMemo(
    () =>
      vaccinationRows
        .filter((row) => row.status === 'pending')
        .sort((left, right) => String(left.scheduled_date).localeCompare(String(right.scheduled_date)))
        .slice(0, 5),
    [vaccinationRows]
  )
  const receivableRows = useMemo(
    () =>
      salesRows
        .filter((row) => Number(row.outstanding_balance) > 0)
        .sort((left, right) => Number(right.outstanding_balance) - Number(left.outstanding_balance))
        .slice(0, 5),
    [salesRows]
  )
  const lowStockRows = useMemo(
    () =>
      inventoryRows
        .filter((row) => row.status === 'Low stock')
        .sort((left, right) => Number(left.quantity) - Number(right.quantity))
        .slice(0, 5),
    [inventoryRows]
  )

  return (
    <div className="animate-fade-in space-y-6 pb-10">
      <div className="section-header">
        <div>
          <h1 className="section-title">Reports</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => window.print()} className="btn-secondary">
            <FileDown className="h-4.5 w-4.5" />
            Print / PDF
          </button>
          <button type="button" onClick={() => reports.refetch()} className="btn-primary" disabled={reports.isFetching}>
            <RefreshCw className={`h-4.5 w-4.5 ${reports.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {reports.isError ? (
        <div className="card flex items-center gap-4 p-5 text-danger">
          <AlertTriangle className="h-6 w-6" />
          <div>
            <div className="font-semibold">Reports could not be loaded.</div>
            <div className="text-sm text-ink-500">Try again.</div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="card p-5">
          <div className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-ink-500">Revenue</div>
          <div className="mt-3 text-2xl font-semibold text-ink-900">{formatCurrency(data?.profit.summary.total_revenue ?? 0)}</div>
          <p className="mt-1 text-sm text-ink-500">Payments captured across the current reporting window.</p>
        </div>
        <div className="card p-5">
          <div className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-ink-500">Net profit</div>
          <div className="mt-3 text-2xl font-semibold text-ink-900">{formatCurrency(data?.profit.summary.net_profit ?? 0)}</div>
          <p className="mt-1 text-sm text-ink-500">Rolling margin after recorded expenses.</p>
        </div>
        <div className="card p-5">
          <div className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-ink-500">Live birds</div>
          <div className="mt-3 text-2xl font-semibold text-ink-900">{liveBirds.toLocaleString()}</div>
          <p className="mt-1 text-sm text-ink-500">Population currently held in active batches.</p>
        </div>
        <div className="card p-5">
          <div className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-ink-500">Inventory value</div>
          <div className="mt-3 text-2xl font-semibold text-ink-900">{formatCurrency(inventoryValue)}</div>
          <p className="mt-1 text-sm text-ink-500">Current stock valued on moving average cost.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-ink-900">Revenue vs expenses</h2>
              <p className="mt-1 text-sm text-ink-500">Daily finance movement from the analytics layer.</p>
            </div>
            <button type="button" className="btn-ghost btn-sm" onClick={() => downloadCsv('farmexa-finance-report.csv', financeRows)}>
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.profit.timeline ?? []} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="reportsRevenue" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand-primary)" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="var(--brand-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="reportsExpenses" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Area type="monotone" dataKey="revenue" stroke="var(--brand-primary)" fill="url(#reportsRevenue)" strokeWidth={3} />
                <Area type="monotone" dataKey="expenses" stroke="var(--danger)" fill="url(#reportsExpenses)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-ink-900">Orders and collections</h2>
              <p className="mt-1 text-sm text-ink-500">Commercial velocity from orders and collected revenue.</p>
            </div>
            <button type="button" className="btn-ghost btn-sm" onClick={() => downloadCsv('farmexa-sales-report.csv', salesRows)}>
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.sales.timeline ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="orders_count" fill="var(--brand-secondary)" radius={[8, 8, 0, 0]} />
                <Bar yAxisId="right" dataKey="revenue" fill="var(--brand-primary)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {reportCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.title} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  <Icon className="h-5 w-5" />
                </div>
                <button type="button" className="btn-ghost btn-sm" onClick={() => downloadCsv(card.filename, card.exportRows)}>
                  <Download className="h-4 w-4" />
                </button>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-ink-900">{card.title}</h3>
              <div className="mt-3 text-base font-semibold text-ink-900">{card.summary}</div>
              <p className="mt-1 text-sm text-ink-500">{card.detail}</p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-neutral-150 px-6 py-5">
            <h2 className="text-xl font-semibold text-ink-900">Mortality watch</h2>
            <p className="mt-1 text-sm text-ink-500">Latest mortality entries across active and completed batches.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-6">Batch</th>
                  <th>Date</th>
                  <th>Loss</th>
                  <th className="pr-6">Cause</th>
                </tr>
              </thead>
              <tbody>
                {recentMortality.length === 0 ? (
                  <tr>
                    <td className="pl-6 py-14 text-sm text-ink-500" colSpan={4}>
                      No mortality records posted yet.
                    </td>
                  </tr>
                ) : (
                  recentMortality.map((row) => (
                    <tr key={`${row.batch_number}-${row.record_date}-${row.quantity}`}>
                      <td className="pl-6 font-semibold text-ink-900">{row.batch_number}</td>
                      <td>{String(row.record_date)}</td>
                      <td>{Number(row.quantity).toLocaleString()}</td>
                      <td className="pr-6">{String(row.cause)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-neutral-150 px-6 py-5">
            <h2 className="text-xl font-semibold text-ink-900">Vaccination follow-up</h2>
            <p className="mt-1 text-sm text-ink-500">Pending vaccination work requiring operational attention.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-6">Batch</th>
                  <th>Vaccine</th>
                  <th>Scheduled</th>
                  <th className="pr-6">Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingVaccinationRows.length === 0 ? (
                  <tr>
                    <td className="pl-6 py-14 text-sm text-ink-500" colSpan={4}>
                      No pending vaccination entries are outstanding.
                    </td>
                  </tr>
                ) : (
                  pendingVaccinationRows.map((row) => (
                    <tr key={`${row.batch_number}-${row.vaccine_name}-${row.scheduled_date}`}>
                      <td className="pl-6 font-semibold text-ink-900">{row.batch_number}</td>
                      <td>{String(row.vaccine_name)}</td>
                      <td>{String(row.scheduled_date)}</td>
                      <td className="pr-6">
                        <span className="badge badge-warning">{String(row.status)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-neutral-150 px-6 py-5">
            <h2 className="text-xl font-semibold text-ink-900">Receivables ledger</h2>
            <p className="mt-1 text-sm text-ink-500">Highest outstanding balances currently awaiting settlement.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-6">Invoice</th>
                  <th>Customer</th>
                  <th>Due</th>
                  <th className="pr-6">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {receivableRows.length === 0 ? (
                  <tr>
                    <td className="pl-6 py-14 text-sm text-ink-500" colSpan={4}>
                      No outstanding invoices are open right now.
                    </td>
                  </tr>
                ) : (
                  receivableRows.map((row) => (
                    <tr key={String(row.invoice_number)}>
                      <td className="pl-6 font-semibold text-ink-900">{String(row.invoice_number)}</td>
                      <td>{String(row.customer)}</td>
                      <td>{String(row.due_date)}</td>
                      <td className="pr-6 font-semibold text-ink-900">{formatCurrency(Number(row.outstanding_balance))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-neutral-150 px-6 py-5">
            <h2 className="text-xl font-semibold text-ink-900">Low stock watchlist</h2>
            <p className="mt-1 text-sm text-ink-500">Items that need immediate replenishment attention.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-6">Item</th>
                  <th>Category</th>
                  <th>Quantity</th>
                  <th className="pr-6">Reorder level</th>
                </tr>
              </thead>
              <tbody>
                {lowStockRows.length === 0 ? (
                  <tr>
                    <td className="pl-6 py-14 text-sm text-ink-500" colSpan={4}>
                      No inventory items are below reorder level.
                    </td>
                  </tr>
                ) : (
                  lowStockRows.map((row) => (
                    <tr key={String(row.item_name)}>
                      <td className="pl-6 font-semibold text-ink-900">{String(row.item_name)}</td>
                      <td>{String(row.category)}</td>
                      <td>{Number(row.quantity).toLocaleString()} {String(row.unit)}</td>
                      <td className="pr-6">{Number(row.reorder_level).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-[0.72rem] font-bold uppercase tracking-[0.2em] text-ink-500">
            <Bird className="h-4 w-4 text-brand-600" />
            Growth summary
          </div>
          <div className="mt-3 text-2xl font-semibold text-ink-900">
            {latestGrowthAverage ? `${latestGrowthAverage.toFixed(0)} g` : 'No data'}
          </div>
          <p className="mt-1 text-sm text-ink-500">Average latest recorded batch weight.</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-[0.72rem] font-bold uppercase tracking-[0.2em] text-ink-500">
            <Wheat className="h-4 w-4 text-brand-600" />
            Feed alerts
          </div>
          <div className="mt-3 text-2xl font-semibold text-ink-900">{lowFeedItems.length.toLocaleString()}</div>
          <p className="mt-1 text-sm text-ink-500">Feed SKUs already at or below reorder threshold.</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-[0.72rem] font-bold uppercase tracking-[0.2em] text-ink-500">
            <Scissors className="h-4 w-4 text-brand-600" />
            Yield
          </div>
          <div className="mt-3 text-2xl font-semibold text-ink-900">{averageYield ? `${averageYield.toFixed(1)}%` : 'No data'}</div>
          <p className="mt-1 text-sm text-ink-500">Average dressed yield from completed slaughter runs.</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-[0.72rem] font-bold uppercase tracking-[0.2em] text-ink-500">
            <LineChart className="h-4 w-4 text-brand-600" />
            Active customers
          </div>
          <div className="mt-3 text-2xl font-semibold text-ink-900">{(data?.profit.summary.active_customers ?? 0).toLocaleString()}</div>
          <p className="mt-1 text-sm text-ink-500">Commercial relationships currently active in the ERP.</p>
        </div>
      </div>
    </div>
  )
}
