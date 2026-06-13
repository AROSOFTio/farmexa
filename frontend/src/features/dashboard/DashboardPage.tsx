import {
  BarChart3,
  Bird,
  Building2,
  ClipboardList,
  Database,
  DollarSign,
  FileWarning,
  Lock,
  Pill,
  Scissors,
  ShoppingCart,
  TrendingUp,
  Wheat,
  ArrowRight,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import api from '@/services/api'

interface DashboardOverview {
  kpis: {
    total_birds: number
    active_houses: number
    feed_stock_kg: number
    meat_stock_kg: number
    sales_today: number
    compliance_alerts: number
  }
}

function formatNumber(value: number) {
  return value.toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatMoney(value: number) {
  if (value >= 1_000_000_000) return `UGX ${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `UGX ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `UGX ${(value / 1_000).toFixed(0)}K`
  return `UGX ${formatNumber(value)}`
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, tenant } = useAuth()

  const { data: overview } = useQuery<DashboardOverview>({
    queryKey: ['dashboard-overview'],
    queryFn: () => api.get<DashboardOverview>('/dashboard/overview').then((r) => r.data),
  })

  const kpis = overview?.kpis || {
    total_birds: 0,
    active_houses: 0,
    feed_stock_kg: 0,
    meat_stock_kg: 0,
    sales_today: 0,
    compliance_alerts: 0,
  }

  const modules = [
    {
      id: 'feed-mill',
      name: 'Feed Mill',
      description: 'Manage formulations, production, and inventory',
      icon: Wheat,
      color: 'from-amber-500 to-orange-600',
      route: '/feed-mill',
      metric: `${formatNumber(kpis.feed_stock_kg)} kg`,
    },
    {
      id: 'farm-operations',
      name: 'Farm Operations',
      description: 'Manage houses, flocks, vaccinations, and mortality',
      icon: Building2,
      color: 'from-green-500 to-emerald-600',
      route: '/farm',
      metric: `${kpis.active_houses} houses`,
    },
    {
      id: 'inventory',
      name: 'Inventory & Transfers',
      description: 'GRN, GIV, stock movements, and tracking',
      icon: Database,
      color: 'from-blue-500 to-cyan-600',
      route: '/inventory',
      metric: `${formatNumber(kpis.feed_stock_kg)} kg stock`,
    },
    {
      id: 'slaughter',
      name: 'Slaughter & Processing',
      description: 'Process birds, track meat, manage cold storage',
      icon: Scissors,
      color: 'from-red-500 to-rose-600',
      route: '/slaughter',
      metric: `${formatNumber(kpis.meat_stock_kg)} kg`,
    },
    {
      id: 'sales',
      name: 'Sales & POS',
      description: 'Invoicing, payments, and customer orders',
      icon: ShoppingCart,
      color: 'from-purple-500 to-violet-600',
      route: '/sales',
      metric: `${formatMoney(kpis.sales_today)}`,
    },
    {
      id: 'finance',
      name: 'Finance & CoA',
      description: 'Journal entries, reports, and financial analysis',
      icon: BarChart3,
      color: 'from-indigo-500 to-blue-600',
      route: '/finance',
      metric: 'Accounting ready',
    },
    {
      id: 'compliance',
      name: 'Compliance & Alerts',
      description: 'Document tracking and expiry management',
      icon: FileWarning,
      color: 'from-orange-500 to-amber-600',
      route: '/compliance',
      metric: `${kpis.compliance_alerts} alerts`,
    },
    {
      id: 'users',
      name: 'Users & Roles',
      description: 'Manage team members and access control',
      icon: Lock,
      color: 'from-slate-500 to-gray-600',
      route: '/settings/users',
      metric: 'Multi-user',
    },
  ]

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div>
            <p className="text-sm font-medium text-neutral-600">Welcome back, {user?.full_name}</p>
            <h1 className="mt-1 text-3xl font-bold text-neutral-900">{tenant?.name || 'Farm'} Dashboard</h1>
            <p className="mt-2 text-neutral-600">Manage your complete poultry operation from one place</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Key Metrics */}
        <div className="mb-12">
          <h2 className="mb-6 text-lg font-semibold text-neutral-900">Key Metrics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <MetricCard
              label="Total Birds"
              value={formatNumber(kpis.total_birds)}
              icon={Bird}
              color="bg-blue-100 text-blue-600"
            />
            <MetricCard
              label="Active Houses"
              value={kpis.active_houses.toString()}
              icon={Building2}
              color="bg-green-100 text-green-600"
            />
            <MetricCard
              label="Feed Stock"
              value={`${formatNumber(kpis.feed_stock_kg)} kg`}
              icon={Wheat}
              color="bg-amber-100 text-amber-600"
            />
            <MetricCard
              label="Meat Stock"
              value={`${formatNumber(kpis.meat_stock_kg)} kg`}
              icon={Scissors}
              color="bg-red-100 text-red-600"
            />
            <MetricCard
              label="Sales Today"
              value={formatMoney(kpis.sales_today)}
              icon={DollarSign}
              color="bg-purple-100 text-purple-600"
            />
            <MetricCard
              label="Alerts"
              value={kpis.compliance_alerts.toString()}
              icon={FileWarning}
              color="bg-orange-100 text-orange-600"
            />
          </div>
        </div>

        {/* Modules Grid */}
        <div>
          <h2 className="mb-6 text-lg font-semibold text-neutral-900">All Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {modules.map((module) => {
              const Icon = module.icon
              return (
                <button
                  key={module.id}
                  onClick={() => navigate(module.route)}
                  className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-white p-6 text-left transition duration-300 hover:border-neutral-300 hover:shadow-md active:shadow-sm"
                >
                  {/* Background gradient on hover */}
                  <div className="absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-5" />

                  {/* Content */}
                  <div className="relative">
                    <div className={`inline-flex rounded-lg bg-gradient-to-br ${module.color} p-3 mb-4`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>

                    <h3 className="mb-2 font-bold text-neutral-900 group-hover:text-neutral-700 transition">
                      {module.name}
                    </h3>

                    <p className="mb-4 text-sm text-neutral-600">{module.description}</p>

                    <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
                      <span className="text-xs font-semibold text-neutral-600">{module.metric}</span>
                      <ArrowRight className="h-4 w-4 text-neutral-400 group-hover:text-neutral-600 transition translate-x-0 group-hover:translate-x-1 transition" />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-12 rounded-xl border border-neutral-200 bg-white p-8">
          <h3 className="mb-6 text-lg font-semibold text-neutral-900">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickAction
              label="Record Feeding"
              description="Log feed usage for today"
              onClick={() => navigate('/farm')}
              icon={Pill}
            />
            <QuickAction
              label="New Sale"
              description="Create a sales invoice"
              onClick={() => navigate('/sales')}
              icon={ShoppingCart}
            />
            <QuickAction
              label="Process Birds"
              description="Start a slaughter run"
              onClick={() => navigate('/slaughter')}
              icon={Scissors}
            />
            <QuickAction
              label="Stock Transfer"
              description="Record GRN or GIV"
              onClick={() => navigate('/inventory')}
              icon={Database}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-neutral-600">{label}</p>
          <p className="mt-2 text-2xl font-bold text-neutral-900">{value}</p>
        </div>
        <div className={`rounded-lg p-2.5 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function QuickAction({
  label,
  description,
  onClick,
  icon: Icon,
}: {
  label: string
  description: string
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-lg border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-300 hover:bg-neutral-50 active:bg-white"
    >
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-blue-100 p-2.5 text-blue-600">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-neutral-900 group-hover:text-neutral-700 transition">{label}</p>
          <p className="text-xs text-neutral-600">{description}</p>
        </div>
      </div>
    </button>
  )
}
