import {
  Activity,
  BadgeAlert,
  Bird,
  ClipboardCheck,
  Factory,
  Home,
  Package,
  ShieldCheck,
  ShoppingCart,
  Soup,
  Syringe,
  Truck,
  Warehouse,
  Wheat,
  Zap,
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

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
  return `UGX ${formatNumber(value)}`
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ActionButton({ children, to, primary = false }: { children: string; to: string; primary?: boolean }) {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate(to)} className={primary ? 'erp-action-primary' : 'erp-action'}>
      {children}
    </button>
  )
}

function KpiCard({ title, value, note, icon: Icon }: { title: string; value: string; note: string; icon: IconType }) {
  return (
    <div className="erp-kpi">
      <div className="erp-kpi-icon"><Icon className="h-8 w-8" /></div>
      <div>
        <div className="erp-kpi-title">{title}</div>
        <div className="erp-kpi-value">{value}</div>
        <div className="erp-kpi-note">{note}</div>
      </div>
    </div>
  )
}

function MiniStat({ title, value, note, icon: Icon }: { title: string; value: string; note?: string; icon: IconType }) {
  return (
    <div className="erp-mini-stat">
      <Icon className="h-5 w-5 text-[#c99316]" />
      <div>
        <div className="text-[10px] font-bold text-slate-500">{title}</div>
        <div className="text-[15px] font-extrabold leading-5 text-[#111827]">{value}</div>
        {note ? <div className="text-[10px] text-slate-500">{note}</div> : null}
      </div>
    </div>
  )
}

function Panel({ title, viewAllTo, children }: { title: string; viewAllTo: string; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <section className="erp-panel">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[#ecd8a9] bg-[#fff7e2] text-[#b98512]">
            <ClipboardCheck className="h-4 w-4" />
          </span>
          <h2 className="text-[14px] font-extrabold text-[#111827]">{title}</h2>
        </div>
        <button type="button" onClick={() => navigate(viewAllTo)} className="text-[11px] font-bold text-[#a56f07]">View all</button>
      </div>
      {children}
    </section>
  )
}

function Status({ value }: { value: string }) {
  const normalized = value.toLowerCase()
  const tone =
    normalized.includes('low') || normalized.includes('expired') ? 'bg-[#ef5d46]' :
      normalized.includes('pending') || normalized.includes('warning') ? 'bg-[#ef9f24]' :
        'bg-[#3f9a35]'

  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${tone}`}>{value}</span>
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-8 text-center text-[12px] font-semibold text-slate-500">
        {label}
      </td>
    </tr>
  )
}

function LoadingState() {
  return (
    <div className="erp-dashboard">
      <div className="grid gap-3 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-[96px] animate-pulse rounded-[10px] border border-[#ecd8a9] bg-white" />
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-[260px] animate-pulse rounded-[10px] border border-[#ecd8a9] bg-white" />
        ))}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['erp-dashboard'],
    queryFn: () => api.get<DashboardOverview>('/analytics/erp-dashboard').then((response) => response.data),
    refetchInterval: 60_000,
  })

  if (isLoading) return <LoadingState />

  if (isError || !data) {
    return (
      <div className="erp-panel">
        <h1 className="text-[16px] font-extrabold text-[#111827]">Dashboard unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">The dashboard could not load tenant data from the server.</p>
        <button type="button" onClick={() => refetch()} className="erp-action-primary mt-4">Retry</button>
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

  return (
    <div className="erp-dashboard">
      <section className="grid gap-3 xl:grid-cols-8">
        <KpiCard title="Total Birds" value={formatNumber(kpis.total_birds)} note="Live birds in active batches" icon={Bird} />
        <KpiCard title="Active Houses" value={`${formatNumber(kpis.active_houses)} / ${formatNumber(kpis.total_houses)}`} note="Operational houses" icon={Home} />
        <KpiCard title="Feed Stock" value={`${formatNumber(kpis.feed_stock_kg)} KG`} note="Current feed item balance" icon={Package} />
        <KpiCard title="Feed Used Today" value={`${formatNumber(kpis.feed_used_today_kg)} KG`} note="Recorded feed consumption" icon={Zap} />
        <KpiCard title="Mortality Rate" value={`${formatNumber(kpis.mortality_rate_today, 2)}%`} note={`${formatNumber(kpis.mortality_today)} mortality today`} icon={Activity} />
        <KpiCard title="Meat Stock" value={`${formatNumber(kpis.meat_stock_kg)} KG`} note="Finished product inventory" icon={Soup} />
        <KpiCard title="Sales Today" value={formatMoney(kpis.sales_today)} note="Posted payments today" icon={ShoppingCart} />
        <KpiCard title="Compliance Alerts" value={formatNumber(kpis.compliance_alerts)} note="Expired or due soon" icon={ShieldCheck} />
      </section>

      <section className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <Panel title="Feed Mill Overview" viewAllTo="/feed/stock">
            <div className="mb-3 grid grid-cols-4 gap-2">
              <MiniStat title="Raw Materials" value={`${formatNumber(rawFeedStock)} KG`} note="All feed stock" icon={Warehouse} />
              <MiniStat title="Finished Feed" value={`${formatNumber(finishedFeedStock)} KG`} note="Named feed items" icon={Package} />
              <MiniStat title="Feed Items" value={formatNumber(data.feed_stock.length)} note="Tracked" icon={Wheat} />
              <MiniStat title="Low Stock" value={formatNumber(lowStockCount)} note="Needs attention" icon={Truck} />
            </div>
            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead><tr><th>Feed Item</th><th>Category</th><th>Stock</th><th>Reorder</th><th>Status</th></tr></thead>
                <tbody>
                  {data.feed_stock.length === 0 ? (
                    <EmptyRow colSpan={5} label="No feed stock has been entered yet." />
                  ) : data.feed_stock.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.category}</td>
                      <td>{formatNumber(item.current_stock)} {item.unit}</td>
                      <td>{formatNumber(item.reorder_threshold)} {item.unit}</td>
                      <td><Status value={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="erp-actions">
              <ActionButton primary to="/feed/stock">Create Feed Item</ActionButton>
              <ActionButton to="/feed/purchases">Record Purchase</ActionButton>
              <ActionButton to="/feed/consumption">Record Usage</ActionButton>
              <ActionButton to="/inventory/movements">Stock Ledger</ActionButton>
            </div>
          </Panel>
        </div>

        <div className="xl:col-span-4">
          <Panel title="Farm Operations Overview" viewAllTo="/farm/houses">
            <div className="mb-3 grid grid-cols-4 gap-2">
              <MiniStat title="Mortality Today" value={formatNumber(kpis.mortality_today)} icon={BadgeAlert} />
              <MiniStat title="Vaccinations Due" value={formatNumber(vaccinationDue)} icon={Syringe} />
              <MiniStat title="Feed Used Today" value={`${formatNumber(kpis.feed_used_today_kg)} KG`} icon={Wheat} />
              <MiniStat title="Houses" value={formatNumber(kpis.total_houses)} icon={Home} />
            </div>
            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead><tr><th>House</th><th>Birds</th><th>Batches</th><th>Feed Today</th><th>Mortality</th><th>Vaccination Due</th><th>Status</th></tr></thead>
                <tbody>
                  {data.houses.length === 0 ? (
                    <EmptyRow colSpan={7} label="No houses have been created yet." />
                  ) : data.houses.map((house) => (
                    <tr key={house.id}>
                      <td>{house.name}</td>
                      <td>{formatNumber(house.birds)}</td>
                      <td>{formatNumber(house.active_batches)}</td>
                      <td>{formatNumber(house.feed_today_kg)} KG</td>
                      <td>{formatNumber(house.mortality_today)}</td>
                      <td>{formatNumber(house.vaccination_due)}</td>
                      <td><Status value={house.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="erp-actions">
              <ActionButton to="/farm/mortality">Record Mortality</ActionButton>
              <ActionButton to="/farm/vaccination">Record Vaccination</ActionButton>
              <ActionButton to="/farm/feed-usage">Feed Usage</ActionButton>
              <ActionButton to="/slaughter/planning">Transfer to Slaughter</ActionButton>
            </div>
          </Panel>
        </div>

        <div className="xl:col-span-4">
          <Panel title="Slaughter Overview" viewAllTo="/slaughter/records">
            <div className="mb-3 grid grid-cols-4 gap-2">
              <MiniStat title="Birds Received" value={formatNumber(data.slaughter_summary.birds_received_today)} icon={Bird} />
              <MiniStat title="Dressed Weight" value={`${formatNumber(data.slaughter_summary.dressed_weight_today_kg)} KG`} icon={Soup} />
              <MiniStat title="Avg Yield" value={`${formatNumber(data.slaughter_summary.average_yield_percentage, 1)}%`} icon={Activity} />
              <MiniStat title="By-products" value={`${formatNumber(data.slaughter_summary.byproducts_kg)} KG`} icon={Package} />
            </div>
            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead><tr><th>Product</th><th>Quantity</th><th>Unit</th><th>Status</th></tr></thead>
                <tbody>
                  {data.slaughter_stock.length === 0 ? (
                    <EmptyRow colSpan={4} label="No slaughter output stock has been posted yet." />
                  ) : data.slaughter_stock.map((item) => (
                    <tr key={item.id}>
                      <td>{item.product}</td>
                      <td>{formatNumber(item.kg)}</td>
                      <td>{item.unit}</td>
                      <td><Status value={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="erp-actions">
              <ActionButton to="/slaughter/planning">Receive Birds</ActionButton>
              <ActionButton to="/slaughter/records">Record Slaughter</ActionButton>
              <ActionButton to="/slaughter/outputs">Post Output</ActionButton>
              <ActionButton to="/slaughter/yield">Yield Analysis</ActionButton>
            </div>
          </Panel>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <Panel title="Sales & POS Overview" viewAllTo="/sales/orders">
            <div className="grid gap-3 lg:grid-cols-[0.95fr_1fr]">
              <table className="erp-table">
                <tbody>
                  <tr><td>Today's Sales</td><td>{formatMoney(kpis.sales_today)}</td></tr>
                  <tr><td>Cash Sales</td><td>{formatMoney(data.sales.cash_sales)}</td></tr>
                  <tr><td>Mobile Money</td><td>{formatMoney(data.sales.mobile_money_sales)}</td></tr>
                  <tr><td>Bank Sales</td><td>{formatMoney(data.sales.bank_sales)}</td></tr>
                  <tr><td>Pending Orders</td><td>{formatMoney(data.sales.pending_payments)}</td></tr>
                  <tr><td>Orders Today</td><td>{formatNumber(data.sales.orders_today)}</td></tr>
                </tbody>
              </table>
              <div className="rounded-[8px] border border-[#ecd8a9] bg-[#fffaf0] p-3">
                <div className="text-[10px] font-bold uppercase text-slate-500">Sales stock comes from inventory</div>
                <div className="mt-2 text-[22px] font-extrabold text-[#111827]">{formatNumber(kpis.meat_stock_kg)} KG</div>
                <div className="mt-1 text-[11px] text-slate-500">Top product: {data.sales.top_product ?? 'No completed sales yet'}</div>
              </div>
            </div>
            <div className="erp-actions">
              <ActionButton primary to="/sales/orders">Open Sales</ActionButton>
              <ActionButton to="/sales/customers">Customers</ActionButton>
              <ActionButton to="/sales/invoices">Invoices</ActionButton>
              <ActionButton to="/sales/payments">Payments</ActionButton>
            </div>
          </Panel>
        </div>

        <div className="xl:col-span-4">
          <Panel title="Transfers Overview" viewAllTo="/inventory/movements">
            <div className="mb-3 grid grid-cols-3 gap-2">
              <MiniStat title="Movements" value={formatNumber(data.recent_transfers.length)} icon={Truck} />
              <MiniStat title="Low Stock" value={formatNumber(lowStockCount)} icon={BadgeAlert} />
              <MiniStat title="Stock Items" value={formatNumber(data.slaughter_stock.length + data.feed_stock.length)} icon={Package} />
            </div>
            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead><tr><th>Ref</th><th>Type</th><th>Item</th><th>Qty</th><th>Status</th></tr></thead>
                <tbody>
                  {data.recent_transfers.length === 0 ? (
                    <EmptyRow colSpan={5} label="No stock movements have been posted yet." />
                  ) : data.recent_transfers.map((movement) => (
                    <tr key={movement.id}>
                      <td>{movement.reference}</td>
                      <td>{movement.movement_type}</td>
                      <td>{movement.item}</td>
                      <td>{formatNumber(movement.quantity)} {movement.unit}</td>
                      <td><Status value={movement.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="erp-actions">
              <ActionButton primary to="/inventory/movements">Post Movement</ActionButton>
              <ActionButton to="/inventory/items">Stock Items</ActionButton>
              <ActionButton to="/inventory/medicine">Medicine Stock</ActionButton>
              <ActionButton to="/reports/inventory">Reports</ActionButton>
            </div>
          </Panel>
        </div>

        <div className="xl:col-span-4">
          <Panel title="Compliance & Quality Control" viewAllTo="/compliance/documents">
            <div className="mb-3 grid grid-cols-3 gap-2">
              <MiniStat title="Documents" value={formatNumber(data.compliance_documents.length)} icon={ShieldCheck} />
              <MiniStat title="Alerts" value={formatNumber(kpis.compliance_alerts)} icon={BadgeAlert} />
              <MiniStat title="Due Soon" value={formatNumber(data.compliance_documents.filter((doc) => doc.days_left !== null && doc.days_left <= 7).length)} icon={ClipboardCheck} />
            </div>
            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead><tr><th>Document</th><th>Type</th><th>Expiry Date</th><th>Days Left</th><th>Status</th></tr></thead>
                <tbody>
                  {data.compliance_documents.length === 0 ? (
                    <EmptyRow colSpan={5} label="No compliance documents have been uploaded yet." />
                  ) : data.compliance_documents.map((document) => (
                    <tr key={document.id}>
                      <td>{document.title}</td>
                      <td>{document.document_type}</td>
                      <td>{formatDate(document.expiry_date)}</td>
                      <td>{document.days_left ?? '-'}</td>
                      <td><Status value={document.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="erp-actions">
              <ActionButton primary to="/compliance/documents">Upload Document</ActionButton>
              <ActionButton to="/compliance/alerts">Expiry Alerts</ActionButton>
              <ActionButton to="/reports/compliance">Reports</ActionButton>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  )
}
