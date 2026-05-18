import {
  Activity,
  BadgeAlert,
  Bird,
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
      <div className="erp-kpi-icon"><Icon className="h-7 w-7" /></div>
      <div>
        <div className="erp-kpi-title">{title}</div>
        <div className="erp-kpi-value">{value}</div>
        <div className="erp-kpi-note">{note}</div>
      </div>
    </div>
  )
}

function SignalCard({ label, value, icon: Icon }: { label: string; value: string; icon: IconType }) {
  return (
    <div className="erp-signal">
      <Icon className="h-4 w-4 text-[#b98512]" />
      <div>
        <div className="text-[11px] font-bold text-slate-500">{label}</div>
        <div className="text-[14px] font-extrabold text-[#111827]">{value}</div>
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
      <div className="grid gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[118px] animate-pulse rounded-[10px] border border-[#ecd8a9] bg-white" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[310px] animate-pulse rounded-[10px] border border-[#ecd8a9] bg-white xl:col-span-6" />
        ))}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
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

  return (
    <div className="erp-dashboard">
      <section className="grid gap-4 xl:grid-cols-4">
        <KpiCard title="Live Flock" value={formatNumber(kpis.total_birds)} note={`${formatNumber(kpis.active_houses)} of ${formatNumber(kpis.total_houses)} houses active`} icon={Bird} />
        <KpiCard title="Feed Position" value={`${formatNumber(kpis.feed_stock_kg)} KG`} note={`${formatNumber(kpis.feed_used_today_kg)} KG used today`} icon={Package} />
        <KpiCard title="Sales Today" value={formatMoney(kpis.sales_today)} note={`${formatNumber(kpis.meat_stock_kg)} KG saleable meat stock`} icon={ShoppingCart} />
        <KpiCard title="Risk Watch" value={formatNumber(kpis.compliance_alerts + lowStockCount + vaccinationDue)} note={`${formatNumber(kpis.compliance_alerts)} compliance, ${formatNumber(lowStockCount)} stock, ${formatNumber(vaccinationDue)} vaccine`} icon={ShieldCheck} />
      </section>

      <section className="erp-status-band">
        <SignalCard label="Mortality today" value={`${formatNumber(kpis.mortality_today)} (${formatNumber(kpis.mortality_rate_today, 2)}%)`} icon={Activity} />
        <SignalCard label="Vaccinations due" value={formatNumber(vaccinationDue)} icon={Syringe} />
        <SignalCard label="Slaughter received" value={formatNumber(data.slaughter_summary.birds_received_today)} icon={Soup} />
        <SignalCard label="Orders today" value={formatNumber(data.sales.orders_today)} icon={ShoppingCart} />
        <SignalCard label="Open payments" value={formatMoney(data.sales.pending_payments)} icon={BadgeAlert} />
      </section>

      {!hideOnboarding && onboardingDone < onboardingItems.length ? (
        <section className="erp-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-extrabold text-[#111827]">Start using Farmexa</h2>
              <p className="mt-1 text-sm text-slate-600">Finish these simple steps to make your dashboard useful.</p>
            </div>
            <button type="button" className="erp-action" onClick={() => { localStorage.setItem('farmexa_onboarding_dismissed', 'true'); window.location.reload() }}>Hide checklist</button>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${Math.round((onboardingDone / onboardingItems.length) * 100)}%` }} />
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {onboardingItems.map((item) => (
              <button key={item.label} type="button" onClick={() => navigate(item.to)} className="flex items-center gap-3 rounded-[8px] border border-[#ecd8a9] bg-white px-4 py-3 text-left text-sm font-bold text-[#111827]">
                <span className={item.done ? 'text-emerald-600' : 'text-[#b98512]'}>{item.done ? '✓' : '○'}</span>
                {item.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <Panel title="Farm Operations" viewAllTo="/farm/houses">
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat title="Houses" value={`${formatNumber(kpis.active_houses)} / ${formatNumber(kpis.total_houses)}`} note="Active capacity" icon={Home} />
              <MiniStat title="Birds" value={formatNumber(kpis.total_birds)} note="Live flock" icon={Bird} />
              <MiniStat title="Feed Today" value={`${formatNumber(kpis.feed_used_today_kg)} KG`} note="Consumption" icon={Wheat} />
              <MiniStat title="Mortality" value={formatNumber(kpis.mortality_today)} note="Today" icon={BadgeAlert} />
            </div>
            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead><tr><th>House</th><th>Birds</th><th>Batches</th><th>Feed Today</th><th>Mortality</th><th>Vaccination Due</th><th>Status</th></tr></thead>
                <tbody>
                  {data.houses.length === 0 ? (
                    <EmptyRow colSpan={7} label="No houses have been created yet." />
                  ) : data.houses.slice(0, 6).map((house) => (
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
              <ActionButton primary to="/farm/mortality">Record Mortality</ActionButton>
              <ActionButton to="/farm/vaccination">Vaccination</ActionButton>
              <ActionButton to="/farm/feed-usage">Feed Usage</ActionButton>
              <ActionButton to="/slaughter/planning">Transfer Birds</ActionButton>
            </div>
          </Panel>
        </div>

        <div className="xl:col-span-4">
          <Panel title="Feed & Inventory" viewAllTo="/feed/stock">
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <MiniStat title="Raw Materials" value={`${formatNumber(rawFeedStock)} KG`} note="All feed stock" icon={Warehouse} />
              <MiniStat title="Finished Feed" value={`${formatNumber(finishedFeedStock)} KG`} note="Named feed items" icon={Package} />
              <MiniStat title="Feed Items" value={formatNumber(data.feed_stock.length)} note="Tracked" icon={Wheat} />
              <MiniStat title="Low Stock" value={formatNumber(lowStockCount)} note="Needs attention" icon={Truck} />
            </div>
            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead><tr><th>Item</th><th>Stock</th><th>Reorder</th><th>Status</th></tr></thead>
                <tbody>
                  {data.feed_stock.length === 0 ? (
                    <EmptyRow colSpan={4} label="No feed stock has been entered yet." />
                  ) : data.feed_stock.slice(0, 5).map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
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
              <ActionButton to="/inventory/movements">Ledger</ActionButton>
            </div>
          </Panel>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <Panel title="Sales, Slaughter & Transfers" viewAllTo="/sales/orders">
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat title="Sales" value={formatMoney(kpis.sales_today)} note="Today" icon={ShoppingCart} />
              <MiniStat title="Meat Stock" value={`${formatNumber(kpis.meat_stock_kg)} KG`} note="Available" icon={Soup} />
              <MiniStat title="Yield" value={`${formatNumber(data.slaughter_summary.average_yield_percentage, 1)}%`} note="Average" icon={Activity} />
              <MiniStat title="Movements" value={formatNumber(data.recent_transfers.length)} note="Recent" icon={Truck} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="overflow-x-auto">
                <table className="erp-table">
                  <thead><tr><th>Product</th><th>Qty</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.slaughter_stock.length === 0 ? (
                      <EmptyRow colSpan={3} label="No slaughter output stock has been posted yet." />
                    ) : data.slaughter_stock.slice(0, 4).map((item) => (
                      <tr key={item.id}>
                        <td>{item.product}</td>
                        <td>{formatNumber(item.kg)} {item.unit}</td>
                        <td><Status value={item.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="overflow-x-auto">
                <table className="erp-table">
                  <tbody>
                    <tr><td>Cash Sales</td><td>{formatMoney(data.sales.cash_sales)}</td></tr>
                    <tr><td>Mobile Money</td><td>{formatMoney(data.sales.mobile_money_sales)}</td></tr>
                    <tr><td>Bank Sales</td><td>{formatMoney(data.sales.bank_sales)}</td></tr>
                    <tr><td>Top Product</td><td>{data.sales.top_product ?? 'No completed sales yet'}</td></tr>
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
          <Panel title="Compliance & Quality Control" viewAllTo="/compliance/documents">
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
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
                  ) : data.compliance_documents.slice(0, 5).map((document) => (
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
