import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Bird, Wheat, Users, TrendingUp, AlertTriangle,
  BarChart3, DollarSign, ShoppingCart, Package, Scissors
} from 'lucide-react'
import api from '@/services/api'
import { DashboardSummary } from '@/types'

function fetchDashboard(): Promise<DashboardSummary> {
  return api.get('/analytics/dashboard-summary').then((r) => r.data)
}

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  delay?: number
}

function KpiCard({ title, value, subtitle, icon: Icon, iconColor, iconBg, delay = 0 }: KpiCardProps) {
  return (
    <motion.div
      className="bg-white rounded-xl border border-neutral-150 shadow-sm p-5 relative overflow-hidden group hover:shadow-card-hover transition-all duration-300"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: `var(--tw-colors-${iconColor.replace('text-', '')})`, opacity: 0.8 }} />
      <div className="flex items-start justify-between relative z-10 pl-2">
        <div className="flex flex-col">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">{title}</div>
          <div className="text-3xl font-bold text-neutral-900 mt-2 tracking-tight">{value}</div>
          {subtitle && <div className="text-sm text-neutral-400 mt-1.5 font-medium">{subtitle}</div>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </div>
    </motion.div>
  )
}

function SectionEmpty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3">
        <BarChart3 className="w-5 h-5 text-neutral-300" />
      </div>
      <p className="text-sm font-medium text-neutral-500">{label}</p>
      <p className="text-xs text-neutral-400 mt-1">Data will appear here once records are added</p>
    </div>
  )
}

export function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchDashboard,
    refetchInterval: 60_000,
  })

  const fmt = (n: number, prefix = '') => {
    if (n === 0) return '—'
    return `${prefix}${n.toLocaleString()}`
  }
  const fmtMoney = (n: number) => n === 0 ? '—' : `UGX ${n.toLocaleString()}`

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div className="section-header mb-8">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Dashboard</h1>
          <p className="section-subtitle mt-1">
            Executive overview — {new Date().toLocaleDateString('en-UG', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-warning animate-pulse-soft' : 'bg-success'}`} />
          <span className="text-xs text-neutral-400">{isLoading ? 'Updating…' : 'Live'}</span>
        </div>
      </div>

      {isError && (
        <div className="card px-5 py-4 flex items-center gap-3 mb-6 border-l-4 border-danger">
          <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0" />
          <span className="text-sm text-neutral-700">
            Failed to load dashboard data. Check your connection and try again.
          </span>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        <KpiCard
          title="System Users"
          value={isLoading ? '…' : (data?.users.total ?? 0)}
          subtitle={`${data?.users.active ?? 0} active`}
          icon={Users}
          iconColor="text-brand-600"
          iconBg="bg-brand-50"
          delay={0}
        />
        <KpiCard
          title="Active Batches"
          value={isLoading ? '…' : fmt(data?.farm.active_batches ?? 0)}
          subtitle={fmt(data?.farm.total_birds ?? 0) !== '—' ? `${fmt(data?.farm.total_birds ?? 0)} birds` : 'No batches yet'}
          icon={Bird}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          delay={0.05}
        />
        <KpiCard
          title="Feed Stock Items"
          value={isLoading ? '…' : fmt(data?.feed.stock_items ?? 0)}
          subtitle={data?.feed.low_stock_alerts ? `${data.feed.low_stock_alerts} low stock alerts` : 'No alerts'}
          icon={Wheat}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          delay={0.1}
        />
        <KpiCard
          title="Slaughter This Month"
          value={isLoading ? '…' : fmt(data?.slaughter.records_this_month ?? 0)}
          subtitle={data?.slaughter.yield_avg_pct ? `${data.slaughter.yield_avg_pct.toFixed(1)}% avg yield` : 'No records'}
          icon={Scissors}
          iconColor="text-red-600"
          iconBg="bg-red-50"
          delay={0.15}
        />
        <KpiCard
          title="Outstanding Invoices"
          value={isLoading ? '…' : fmt(data?.sales.invoices_outstanding ?? 0)}
          subtitle="Unpaid or partial"
          icon={ShoppingCart}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
          delay={0.2}
        />
        <KpiCard
          title="Revenue This Month"
          value={isLoading ? '…' : fmtMoney(data?.sales.revenue_this_month ?? 0)}
          subtitle="From invoices"
          icon={TrendingUp}
          iconColor="text-sky-600"
          iconBg="bg-sky-50"
          delay={0.25}
        />
        <KpiCard
          title="Expenses This Month"
          value={isLoading ? '…' : fmtMoney(data?.finance.expenses_this_month ?? 0)}
          subtitle="All categories"
          icon={Package}
          iconColor="text-orange-600"
          iconBg="bg-orange-50"
          delay={0.3}
        />
        <KpiCard
          title="Net Profit This Month"
          value={isLoading ? '…' : fmtMoney(data?.finance.net_profit_this_month ?? 0)}
          subtitle="Income minus expenses"
          icon={DollarSign}
          iconColor="text-brand-700"
          iconBg="bg-brand-50"
          delay={0.35}
        />
      </div>

      {/* Module Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
        {/* Farm Activity */}
        <motion.div
          className="bg-white rounded-xl border border-neutral-150 shadow-sm overflow-hidden hover:shadow-card transition-shadow"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.4 }}
        >
          <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                <Bird className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-neutral-800">Farm Activity</h3>
            </div>
            <span className="badge badge-success text-xs px-2.5 py-1 rounded-md">Live</span>
          </div>
          <div className="p-6">
            {(data?.farm.active_batches ?? 0) === 0 ? (
              <SectionEmpty label="No active batches" />
            ) : (
              <p className="text-sm text-neutral-500">Batch data loads in Phase 2</p>
            )}
          </div>
        </motion.div>

        {/* Sales Summary */}
        <motion.div
          className="bg-white rounded-xl border border-neutral-150 shadow-sm overflow-hidden hover:shadow-card transition-shadow"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.45 }}
        >
          <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 text-violet-600 rounded-lg">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-neutral-800">Sales Summary</h3>
            </div>
            <span className="badge badge-neutral text-xs px-2.5 py-1 rounded-md">This Month</span>
          </div>
          <div className="p-6">
            {(data?.sales.revenue_this_month ?? 0) === 0 ? (
              <SectionEmpty label="No sales recorded" />
            ) : (
              <p className="text-sm text-neutral-500">Sales data loads in Phase 4</p>
            )}
          </div>
        </motion.div>

        {/* Finance */}
        <motion.div
          className="bg-white rounded-xl border border-neutral-150 shadow-sm overflow-hidden hover:shadow-card transition-shadow"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.5 }}
        >
          <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-100 text-brand-600 rounded-lg">
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-neutral-800">Financial Overview</h3>
            </div>
            <span className="badge badge-neutral text-xs px-2.5 py-1 rounded-md">This Month</span>
          </div>
          <div className="p-6">
            {(data?.finance.income_this_month ?? 0) === 0 ? (
              <SectionEmpty label="No financial data" />
            ) : (
              <p className="text-sm text-neutral-500">Finance data loads in Phase 4</p>
            )}
          </div>
        </motion.div>

        {/* Feed Stock */}
        <motion.div
          className="bg-white rounded-xl border border-neutral-150 shadow-sm overflow-hidden hover:shadow-card transition-shadow"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.55 }}
        >
          <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                <Wheat className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-neutral-800">Feed Stock Status</h3>
            </div>
            {(data?.feed.low_stock_alerts ?? 0) > 0 ? (
              <span className="badge badge-warning text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                {data?.feed.low_stock_alerts} alerts
              </span>
            ) : (
              <span className="badge badge-neutral text-xs px-2.5 py-1 rounded-md">All Good</span>
            )}
          </div>
          <div className="p-6">
            {(data?.feed.stock_items ?? 0) === 0 ? (
              <SectionEmpty label="No feed items in stock" />
            ) : (
              <p className="text-sm text-neutral-500">Feed data loads in Phase 2</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
