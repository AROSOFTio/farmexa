import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Bird, Wheat, Users, TrendingUp, AlertTriangle,
  BarChart3, DollarSign, ShoppingCart, Package, Scissors,
  ArrowUpRight, RefreshCw,
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
  gradient: string
  accentColor: string
  delay?: number
}

function KpiCard({ title, value, subtitle, icon: Icon, gradient, accentColor, delay = 0 }: KpiCardProps) {
  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl bg-white border border-neutral-150 p-5 group cursor-default"
      style={{ boxShadow: '0 1px 4px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -2, boxShadow: '0 8px 28px 0 rgb(0 0 0 / 0.10), 0 3px 8px -2px rgb(0 0 0 / 0.07)' }}
    >
      {/* Decorative background gradient */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(circle at top right, ${accentColor}08 0%, transparent 65%)` }}
      />

      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
        style={{ background: gradient }}
      />

      <div className="flex items-start justify-between gap-4">
        {/* Text content */}
        <div className="flex flex-col min-w-0">
          <span className="text-2xs font-bold uppercase tracking-[0.09em] text-neutral-400 mb-2">
            {title}
          </span>
          <span className="text-3xl font-bold tracking-tight text-neutral-900 leading-none">
            {value}
          </span>
          {subtitle && (
            <span className="text-xs font-medium text-neutral-400 mt-2 leading-snug">
              {subtitle}
            </span>
          )}
        </div>

        {/* Icon box */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
          style={{ background: gradient }}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* View detail hint */}
      <div className="mt-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <span className="text-2xs font-semibold" style={{ color: accentColor }}>View details</span>
        <ArrowUpRight className="w-3 h-3" style={{ color: accentColor }} />
      </div>
    </motion.div>
  )
}

function SectionEmpty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'linear-gradient(135deg, #f3f1ed 0%, #eae7e1 100%)' }}
      >
        <BarChart3 className="w-6 h-6 text-neutral-300" />
      </div>
      <p className="text-sm font-semibold text-neutral-500">{label}</p>
      <p className="text-xs text-neutral-400 mt-1.5 max-w-[200px] leading-relaxed">
        Data will appear here once records are added
      </p>
    </div>
  )
}

interface PanelProps {
  title: string
  badge?: React.ReactNode
  icon: React.ElementType
  iconGradient: string
  children: React.ReactNode
  delay?: number
}

function Panel({ title, badge, icon: Icon, iconGradient, children, delay = 0 }: PanelProps) {
  return (
    <motion.div
      className="bg-white rounded-2xl border border-neutral-150 overflow-hidden"
      style={{ boxShadow: '0 1px 4px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.23, 1, 0.32, 1] }}
    >
      {/* Panel header */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid #eae7e1', background: '#faf9f7' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
            style={{ background: iconGradient }}
          >
            <Icon className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
        </div>
        {badge}
      </div>
      <div className="p-6">
        {children}
      </div>
    </motion.div>
  )
}

const BADGE_LIVE = (
  <span
    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-semibold"
    style={{ background: '#dcf2e6', color: '#237d5a', border: '1px solid #bbe5cf' }}
  >
    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
    Live
  </span>
)

const BADGE_MONTH = (
  <span
    className="inline-flex items-center px-2.5 py-1 rounded-full text-2xs font-semibold"
    style={{ background: '#f3f1ed', color: '#655c51', border: '1px solid #dedad2' }}
  >
    This Month
  </span>
)

export function DashboardPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchDashboard,
    refetchInterval: 60_000,
  })

  const fmt = (n: number) => {
    if (n === 0) return '—'
    return n.toLocaleString()
  }
  const fmtMoney = (n: number) => n === 0 ? '—' : `UGX ${n.toLocaleString()}`

  const kpis: KpiCardProps[] = [
    {
      title: 'System Users',
      value: isLoading ? '…' : (data?.users.total ?? 0),
      subtitle: `${data?.users.active ?? 0} active users`,
      icon: Users,
      gradient: 'linear-gradient(135deg, #237d5a 0%, #164131 100%)',
      accentColor: '#237d5a',
      delay: 0,
    },
    {
      title: 'Active Batches',
      value: isLoading ? '…' : fmt(data?.farm.active_batches ?? 0),
      subtitle: fmt(data?.farm.total_birds ?? 0) !== '—'
        ? `${fmt(data?.farm.total_birds ?? 0)} birds on farm`
        : 'No batches yet',
      icon: Bird,
      gradient: 'linear-gradient(135deg, #16a34a 0%, #14532d 100%)',
      accentColor: '#16a34a',
      delay: 0.06,
    },
    {
      title: 'Feed Stock Items',
      value: isLoading ? '…' : fmt(data?.feed.stock_items ?? 0),
      subtitle: data?.feed.low_stock_alerts
        ? `${data.feed.low_stock_alerts} low stock alerts`
        : 'Stock levels normal',
      icon: Wheat,
      gradient: 'linear-gradient(135deg, #d97706 0%, #92400e 100%)',
      accentColor: '#d97706',
      delay: 0.12,
    },
    {
      title: 'Slaughter This Month',
      value: isLoading ? '…' : fmt(data?.slaughter.records_this_month ?? 0),
      subtitle: data?.slaughter.yield_avg_pct
        ? `${data.slaughter.yield_avg_pct.toFixed(1)}% average yield`
        : 'No records yet',
      icon: Scissors,
      gradient: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)',
      accentColor: '#dc2626',
      delay: 0.18,
    },
    {
      title: 'Outstanding Invoices',
      value: isLoading ? '…' : fmt(data?.sales.invoices_outstanding ?? 0),
      subtitle: 'Unpaid or partial',
      icon: ShoppingCart,
      gradient: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)',
      accentColor: '#7c3aed',
      delay: 0.24,
    },
    {
      title: 'Revenue This Month',
      value: isLoading ? '…' : fmtMoney(data?.sales.revenue_this_month ?? 0),
      subtitle: 'From invoices',
      icon: TrendingUp,
      gradient: 'linear-gradient(135deg, #0369a1 0%, #0c4a6e 100%)',
      accentColor: '#0369a1',
      delay: 0.30,
    },
    {
      title: 'Expenses This Month',
      value: isLoading ? '…' : fmtMoney(data?.finance.expenses_this_month ?? 0),
      subtitle: 'All categories',
      icon: Package,
      gradient: 'linear-gradient(135deg, #ea580c 0%, #7c2d12 100%)',
      accentColor: '#ea580c',
      delay: 0.36,
    },
    {
      title: 'Net Profit This Month',
      value: isLoading ? '…' : fmtMoney(data?.finance.net_profit_this_month ?? 0),
      subtitle: 'Income minus expenses',
      icon: DollarSign,
      gradient: 'linear-gradient(135deg, #379b71 0%, #0b2820 100%)',
      accentColor: '#379b71',
      delay: 0.42,
    },
  ]

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Farm Dashboard
          </h1>
          <p className="text-sm text-neutral-500 mt-1 font-medium">
            {new Date().toLocaleDateString('en-UG', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 transition-all duration-150 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {isError && (
        <div
          className="flex items-center gap-3 px-5 py-4 rounded-2xl mb-6 border"
          style={{
            background: '#fee2e2',
            borderColor: '#fca5a5',
          }}
        >
          <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-800">Failed to load dashboard</p>
            <p className="text-xs text-red-600 mt-0.5">Check your connection and click Refresh to try again.</p>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </div>

      {/* Module Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pb-10">
        {/* Farm Activity */}
        <Panel
          title="Farm Activity"
          badge={BADGE_LIVE}
          icon={Bird}
          iconGradient="linear-gradient(135deg, #16a34a 0%, #14532d 100%)"
          delay={0.48}
        >
          {(data?.farm.active_batches ?? 0) === 0 ? (
            <SectionEmpty label="No active batches" />
          ) : (
            <p className="text-sm text-neutral-500">Batch data loads in Phase 2</p>
          )}
        </Panel>

        {/* Sales Summary */}
        <Panel
          title="Sales Summary"
          badge={BADGE_MONTH}
          icon={ShoppingCart}
          iconGradient="linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)"
          delay={0.52}
        >
          {(data?.sales.revenue_this_month ?? 0) === 0 ? (
            <SectionEmpty label="No sales recorded" />
          ) : (
            <p className="text-sm text-neutral-500">Sales data loads in Phase 4</p>
          )}
        </Panel>

        {/* Financial Overview */}
        <Panel
          title="Financial Overview"
          badge={BADGE_MONTH}
          icon={DollarSign}
          iconGradient="linear-gradient(135deg, #237d5a 0%, #0b2820 100%)"
          delay={0.56}
        >
          {(data?.finance.income_this_month ?? 0) === 0 ? (
            <SectionEmpty label="No financial data" />
          ) : (
            <p className="text-sm text-neutral-500">Finance data loads in Phase 4</p>
          )}
        </Panel>

        {/* Feed Stock Status */}
        <Panel
          title="Feed Stock Status"
          badge={
            (data?.feed.low_stock_alerts ?? 0) > 0 ? (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-semibold"
                style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
              >
                <AlertTriangle className="w-3 h-3" />
                {data?.feed.low_stock_alerts} alerts
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-semibold"
                style={{ background: '#dcf2e6', color: '#237d5a', border: '1px solid #bbe5cf' }}
              >
                All Good
              </span>
            )
          }
          icon={Wheat}
          iconGradient="linear-gradient(135deg, #d97706 0%, #92400e 100%)"
          delay={0.60}
        >
          {(data?.feed.stock_items ?? 0) === 0 ? (
            <SectionEmpty label="No feed items in stock" />
          ) : (
            <p className="text-sm text-neutral-500">Feed data loads in Phase 2</p>
          )}
        </Panel>
      </div>
    </div>
  )
}
