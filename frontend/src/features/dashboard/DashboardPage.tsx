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
      className="kpi-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{title}</div>
          <div className="text-2xl font-bold text-neutral-900 mt-1.5">{value}</div>
          {subtitle && <div className="text-xs text-neutral-400 mt-1">{subtitle}</div>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
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

      {/* Module Panels — Phase 2+ will populate these */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Farm Activity */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.4 }}
        >
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bird className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-neutral-800">Farm Activity</h3>
            </div>
            <span className="badge badge-neutral">Live</span>
          </div>
          <div className="px-5 py-4">
            {(data?.farm.active_batches ?? 0) === 0 ? (
              <SectionEmpty label="No active batches" />
            ) : (
              <p className="text-sm text-neutral-500">Batch data loads in Phase 2</p>
            )}
          </div>
        </motion.div>

        {/* Sales Summary */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.45 }}
        >
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-violet-600" />
              <h3 className="text-sm font-semibold text-neutral-800">Sales Summary</h3>
            </div>
            <span className="badge badge-neutral">This Month</span>
          </div>
          <div className="px-5 py-4">
            {(data?.sales.revenue_this_month ?? 0) === 0 ? (
              <SectionEmpty label="No sales recorded" />
            ) : (
              <p className="text-sm text-neutral-500">Sales data loads in Phase 4</p>
            )}
          </div>
        </motion.div>

        {/* Finance */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.5 }}
        >
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-neutral-800">Financial Overview</h3>
            </div>
            <span className="badge badge-neutral">This Month</span>
          </div>
          <div className="px-5 py-4">
            {(data?.finance.income_this_month ?? 0) === 0 ? (
              <SectionEmpty label="No financial data" />
            ) : (
              <p className="text-sm text-neutral-500">Finance data loads in Phase 4</p>
            )}
          </div>
        </motion.div>

        {/* Feed Stock */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.55 }}
        >
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wheat className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-neutral-800">Feed Stock Status</h3>
            </div>
            {(data?.feed.low_stock_alerts ?? 0) > 0 && (
              <span className="badge badge-warning">
                <AlertTriangle className="w-2.5 h-2.5" />
                {data?.feed.low_stock_alerts} alerts
              </span>
            )}
          </div>
          <div className="px-5 py-4">
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
