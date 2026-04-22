import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Users, TrendingUp, DollarSign, Package, Scissors,
  ArrowUpRight, RefreshCw, AlertTriangle
} from 'lucide-react'
import api from '@/services/api'

interface KpiData {
  total_revenue: number
  total_expenses: number
  net_profit: number
  total_orders: number
  active_customers: number
  total_birds_slaughtered: number
}

function fetchKpis(): Promise<KpiData> {
  return api.get('/analytics/kpis').then((r) => r.data)
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
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(circle at top right, ${accentColor}08 0%, transparent 65%)` }} />
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: gradient }} />

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col min-w-0">
          <span className="text-2xs font-bold uppercase tracking-[0.09em] text-neutral-400 mb-2">{title}</span>
          <span className="text-3xl font-bold tracking-tight text-neutral-900 leading-none">{value}</span>
          {subtitle && <span className="text-xs font-medium text-neutral-400 mt-2 leading-snug">{subtitle}</span>}
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: gradient }}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </motion.div>
  )
}

export function DashboardPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: fetchKpis,
    refetchInterval: 60_000,
  })

  const fmt = (n: number) => n === 0 ? '—' : n.toLocaleString()
  const fmtMoney = (n: number) => n === 0 ? '—' : `UGX ${n.toLocaleString()}`

  const kpis: KpiCardProps[] = [
    {
      title: 'Total Revenue',
      value: isLoading ? '…' : fmtMoney(data?.total_revenue ?? 0),
      subtitle: 'From completed payments',
      icon: TrendingUp,
      gradient: 'linear-gradient(135deg, #0369a1 0%, #0c4a6e 100%)',
      accentColor: '#0369a1',
      delay: 0,
    },
    {
      title: 'Total Expenses',
      value: isLoading ? '…' : fmtMoney(data?.total_expenses ?? 0),
      subtitle: 'Operational costs',
      icon: Package,
      gradient: 'linear-gradient(135deg, #ea580c 0%, #7c2d12 100%)',
      accentColor: '#ea580c',
      delay: 0.06,
    },
    {
      title: 'Net Profit',
      value: isLoading ? '…' : fmtMoney(data?.net_profit ?? 0),
      subtitle: 'Last 30 Days',
      icon: DollarSign,
      gradient: 'linear-gradient(135deg, #166534 0%, #124227 100%)',
      accentColor: '#166534',
      delay: 0.12,
    },
    {
      title: 'Active Customers',
      value: isLoading ? '…' : fmt(data?.active_customers ?? 0),
      subtitle: 'Registered accounts',
      icon: Users,
      gradient: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)',
      accentColor: '#7c3aed',
      delay: 0.18,
    },
    {
      title: 'Total Orders',
      value: isLoading ? '…' : fmt(data?.total_orders ?? 0),
      subtitle: 'Processed this period',
      icon: Package,
      gradient: 'linear-gradient(135deg, #16a34a 0%, #14532d 100%)',
      accentColor: '#16a34a',
      delay: 0.24,
    },
    {
      title: 'Birds Slaughtered',
      value: isLoading ? '…' : fmt(data?.total_birds_slaughtered ?? 0),
      subtitle: 'Production output',
      icon: Scissors,
      gradient: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)',
      accentColor: '#dc2626',
      delay: 0.30,
    },
  ]

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1 font-medium">Real-time enterprise overview</p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary flex items-center gap-2">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {isError && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl mb-6 border bg-red-50 border-red-200">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <p className="text-sm font-semibold text-red-800">Failed to load analytics</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {kpis.map((kpi) => <KpiCard key={kpi.title} {...kpi} />)}
      </div>
      
      <div className="card p-12 text-center bg-white">
        <h3 className="text-lg font-bold text-neutral-900 mb-2">Reporting Center</h3>
        <p className="text-neutral-500 text-sm">
          Open analytics to review margin trends, revenue movement, and financial performance from live backend data.
        </p>
      </div>
    </div>
  )
}
