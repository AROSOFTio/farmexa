import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  Activity,
  BadgeDollarSign,
  Building2,
  CheckCircle2,
  CreditCard,
  Database,
  Globe,
  Layers3,
  Plus,
  Power,
  PowerOff,
  Settings,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'
import { Modal } from '@/components/Modal'
import { useAuth } from '@/features/auth/AuthContext'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

type AdminSection = 'dashboard' | 'tenants' | 'domains' | 'plans' | 'activity' | 'settings'

interface DeveloperAdminOverview {
  total_tenants: number
  active_domains: number
  active_plans: number
  monthly_revenue: string
  pending_setup: number
  suspended_tenants: number
}

interface TenantModule {
  id: number
  module_key: string
  is_enabled: boolean
  is_manual_override: boolean
  updated_at: string
}

interface TenantDomain {
  id: number
  host: string
  normalized_host: string
  domain_type: string
  is_primary: boolean
  status: string
  verification_target?: string | null
  dns_verified_at?: string | null
  ssl_requested_at?: string | null
  ssl_issued_at?: string | null
  activated_at?: string | null
  disabled_at?: string | null
  last_error?: string | null
  created_at: string
}

interface Subscription {
  id: number
  plan_code: string
  status: string
  billing_cycle: string
  start_date: string
  expiry_date: string | null
  amount: string | null
  currency: string
}

interface Tenant {
  id: number
  name: string
  slug: string
  business_name: string | null
  contact_person: string | null
  email: string
  phone: string | null
  address: string | null
  country: string | null
  status: string
  plan: string
  billing_cycle: string
  subscription_start: string | null
  subscription_expiry: string | null
  is_suspended: boolean
  notes: string | null
  operational_db_name: string | null
  operational_db_status: string
  operational_db_ready_at: string | null
  operational_db_last_error: string | null
  modules: TenantModule[]
  domains: TenantDomain[]
  subscriptions: Subscription[]
  onboarding_admin?: {
    email: string
    full_name: string
    temporary_password: string
    must_change_password: boolean
  } | null
}

interface PlatformModule {
  key: string
  name: string
  category: string
  description: string | null
  is_core: boolean
  is_active: boolean
}

interface PlanModule {
  module_key: string
  module_name: string
  category: string
  description: string | null
  is_core: boolean
  is_included: boolean
}

interface Plan {
  code: string
  name: string
  description: string | null
  billing_cycle: string
  monthly_price: string
  quarterly_price: string
  annual_price: string
  currency: string
  trial_days: number
  is_custom: boolean
  is_active: boolean
  module_count: number
  tenant_count: number
  modules: PlanModule[]
}

interface ActivityLog {
  id: number
  action: string
  entity: string
  entity_id: number | null
  meta: string | null
  created_at: string
  actor_name?: string | null
  actor_email?: string | null
}

interface DeveloperAdminSettings {
  primary_platform_domain: string
  default_tenant_domain_suffix: string
  automatic_ssl_provisioning: boolean
  certbot_enabled: boolean
  mandatory_module_keys: string[]
  total_modules: number
  total_plans: number
}

const tenantSchema = z.object({
  name: z.string().min(2, 'Tenant name is required'),
  slug: z.string().optional(),
  business_name: z.string().optional(),
  contact_person: z.string().optional(),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  country: z.string().optional(),
  domain: z.string().optional(),
  plan: z.string().min(1, 'Plan is required'),
  billing_cycle: z.string().min(1, 'Billing cycle is required'),
  subscription_start: z.string().optional(),
  subscription_expiry: z.string().optional(),
  is_suspended: z.boolean().default(false),
  notes: z.string().optional(),
})

const domainSchema = z.object({
  host: z.string().min(3, 'Domain or subdomain is required'),
  is_primary: z.boolean().default(true),
})

const planSchema = z.object({
  name: z.string().min(2, 'Plan name is required'),
  code: z.string().min(2, 'Plan code is required'),
  description: z.string().optional(),
  billing_cycle: z.enum(['monthly', 'quarterly', 'annual']),
  monthly_price: z.coerce.number().min(0),
  quarterly_price: z.coerce.number().min(0),
  annual_price: z.coerce.number().min(0),
  currency: z.string().min(1).max(10),
  trial_days: z.coerce.number().int().min(0),
  is_active: z.boolean().default(true),
  modules: z.array(z.string()).default([]),
})

type TenantFormValues = z.infer<typeof tenantSchema>
type DomainFormValues = z.infer<typeof domainSchema>
type PlanFormValues = z.infer<typeof planSchema>

function getApiErrorMessage(error: any, fallback: string) {
  const detail = error?.response?.data?.detail
  const errors = error?.response?.data?.errors

  if (Array.isArray(errors) && errors.length > 0) {
    return errors.map((item: { field?: string; message?: string }) => item.message || item.field || 'Validation error').join(', ')
  }
  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }
  return fallback
}

function formatMoney(value: string | number | null | undefined, currency = 'UGX') {
  const amount = Number(value ?? 0)
  return `${currency} ${amount.toLocaleString()}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusBadge(status: string) {
  switch (status) {
    case 'active':
    case 'dns_verified':
      return 'badge badge-success'
    case 'suspended':
    case 'failed':
    case 'disabled':
      return 'badge badge-danger'
    default:
      return 'badge badge-brand'
  }
}

function sectionMeta(section: AdminSection) {
  switch (section) {
    case 'dashboard':
      return { title: 'Welcome back, Developer Admin', subtitle: 'Platform overview and system control center.' }
    case 'tenants':
      return { title: 'Tenants Control', subtitle: 'Onboard, manage, and monitor tenant workspaces globally.' }
    case 'domains':
      return { title: 'Domains & Routing', subtitle: 'Review tenant domains globally, verify setup, activate SSL, and retire broken mappings safely.' }
    case 'plans':
      return { title: 'Subscription Plans', subtitle: 'Define pricing, billing cycles, included modules, and commercial packaging.' }
    case 'activity':
      return { title: 'System Activity', subtitle: 'Track developer-admin actions across tenants, domains, plans, and access overrides.' }
    case 'settings':
      return { title: 'Platform Settings', subtitle: 'Manage central domain defaults, provisioning controls, and mandatory modules.' }
    default:
      return { title: 'Developer Admin', subtitle: 'Platform management.' }
  }
}

const MOCK_REVENUE_DATA = [
  { month: 'Jan', tenants: 12, revenue: 1500000 },
  { month: 'Feb', tenants: 18, revenue: 2200000 },
  { month: 'Mar', tenants: 24, revenue: 3100000 },
  { month: 'Apr', tenants: 35, revenue: 4500000 },
  { month: 'May', tenants: 42, revenue: 5800000 },
  { month: 'Jun', tenants: 50, revenue: 7200000 },
]

export function TenantsPage({ section = 'tenants' }: { section?: AdminSection }) {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null)
  const [selectedPlanCode, setSelectedPlanCode] = useState<string | null>(null)
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false)
  const [isEditTenantModalOpen, setIsEditTenantModalOpen] = useState(false)
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [createdTenant, setCreatedTenant] = useState<Tenant | null>(null)
  const [pendingDeleteDomain, setPendingDeleteDomain] = useState<{ tenantId: number; domain: TenantDomain } | null>(null)

  const canManage = hasPermission('dev_admin:write')
  const meta = sectionMeta(section)

  const { data: overview } = useQuery<DeveloperAdminOverview>({
    queryKey: ['dev-admin-overview'],
    queryFn: () => api.get('/dev-admin/overview').then((response) => response.data),
  })

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery<Tenant[]>({
    queryKey: ['dev-admin-tenants'],
    queryFn: () => api.get('/dev-admin/tenants').then((response) => response.data),
  })

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['dev-admin-plans'],
    queryFn: () => api.get('/dev-admin/plans').then((response) => response.data),
  })

  const { data: modules = [] } = useQuery<PlatformModule[]>({
    queryKey: ['dev-admin-modules'],
    queryFn: () => api.get('/dev-admin/modules').then((response) => response.data),
  })

  const { data: activityLogs = [] } = useQuery<ActivityLog[]>({
    queryKey: ['dev-admin-activity'],
    queryFn: () => api.get('/dev-admin/activity').then((response) => response.data),
  })

  const { data: settingsSummary } = useQuery<DeveloperAdminSettings>({
    queryKey: ['dev-admin-settings'],
    queryFn: () => api.get('/dev-admin/settings').then((response) => response.data),
  })

  const tenantForm = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: { plan: '', billing_cycle: 'monthly', is_suspended: false },
  })

  const editTenantForm = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: { plan: '', billing_cycle: 'monthly', is_suspended: false },
  })

  const domainForm = useForm<DomainFormValues>({
    resolver: zodResolver(domainSchema),
    defaultValues: { is_primary: true },
  })

  const planForm = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      billing_cycle: 'monthly',
      monthly_price: 0,
      quarterly_price: 0,
      annual_price: 0,
      currency: 'UGX',
      trial_days: 0,
      is_active: true,
      modules: [],
    },
  })

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [selectedTenantId, tenants]
  )

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.code === selectedPlanCode) ?? null,
    [plans, selectedPlanCode]
  )

  const groupedModules = useMemo(() => {
    const groups = new Map<string, PlatformModule[]>()
    modules.forEach((module) => {
      const list = groups.get(module.category) ?? []
      list.push(module)
      groups.set(module.category, list)
    })
    return Array.from(groups.entries())
  }, [modules])

  const domainRows = useMemo(
    () =>
      tenants.flatMap((tenant) =>
        tenant.domains.map((domain) => ({
          ...domain,
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          tenant_plan: tenant.plan,
          tenant_db_status: tenant.operational_db_status,
        }))
      ),
    [tenants]
  )

  const plansSummary = useMemo(() => {
    const subscribedTenants = plans.reduce((sum, plan) => sum + plan.tenant_count, 0)
    const activePlans = plans.filter((plan) => plan.is_active).length
    return {
      totalPlans: plans.length,
      activePlans,
      subscribedTenants,
    }
  }, [plans])

  useEffect(() => {
    if (!selectedTenantId && tenants.length > 0) {
      setSelectedTenantId(tenants[0].id)
    }
  }, [selectedTenantId, tenants])

  useEffect(() => {
    if (!selectedPlanCode && plans.length > 0) {
      setSelectedPlanCode(plans[0].code)
    }
  }, [plans, selectedPlanCode])

  useEffect(() => {
    if (!tenantForm.getValues('plan') && plans[0]) {
      tenantForm.setValue('plan', plans[0].code)
      tenantForm.setValue('billing_cycle', plans[0].billing_cycle)
    }
  }, [plans, tenantForm])

  const refreshAdminData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dev-admin-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['dev-admin-tenants'] }),
      queryClient.invalidateQueries({ queryKey: ['dev-admin-plans'] }),
      queryClient.invalidateQueries({ queryKey: ['dev-admin-activity'] }),
      queryClient.invalidateQueries({ queryKey: ['dev-admin-settings'] }),
    ])
  }

  const createTenantMutation = useMutation({
    mutationFn: (values: TenantFormValues) =>
      api.post('/dev-admin/tenants', {
        ...values,
        subscription_start: values.subscription_start || null,
        subscription_expiry: values.subscription_expiry || null,
      }),
    onSuccess: async (response) => {
      await refreshAdminData()
      toast.success('Tenant registered.')
      setCreatedTenant(response.data)
      setIsTenantModalOpen(false)
      tenantForm.reset({ plan: plans[0]?.code ?? '', billing_cycle: plans[0]?.billing_cycle ?? 'monthly', is_suspended: false })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to create tenant.')),
  })

  const updateTenantMutation = useMutation({
    mutationFn: (payload: { tenantId: number; values: TenantFormValues }) =>
      api.put(`/dev-admin/tenants/${payload.tenantId}`, {
        ...payload.values,
        subscription_start: payload.values.subscription_start || null,
        subscription_expiry: payload.values.subscription_expiry || null,
        domain: payload.values.domain || null,
      }),
    onSuccess: async () => {
      await refreshAdminData()
      toast.success('Tenant updated.')
      setIsEditTenantModalOpen(false)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to update tenant.')),
  })

  const changePlanMutation = useMutation({
    mutationFn: (payload: { tenantId: number; plan: string; billing_cycle: string; subscription_expiry?: string | null }) =>
      api.post(`/dev-admin/tenants/${payload.tenantId}/plan`, payload),
    onSuccess: async () => {
      await refreshAdminData()
      toast.success('Tenant plan updated.')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to update tenant plan.')),
  })

  const suspendMutation = useMutation({
    mutationFn: (tenantId: number) => api.post(`/dev-admin/tenants/${tenantId}/suspend`, { reason: 'Suspended by developer admin' }),
    onSuccess: async () => {
      await refreshAdminData()
      toast.success('Tenant suspended.')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to suspend tenant.')),
  })

  const reactivateMutation = useMutation({
    mutationFn: (tenantId: number) => api.post(`/dev-admin/tenants/${tenantId}/reactivate`),
    onSuccess: async () => {
      await refreshAdminData()
      toast.success('Tenant reactivated.')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to reactivate tenant.')),
  })

  const toggleModuleMutation = useMutation({
    mutationFn: (payload: { tenantId: number; moduleKey: string; isEnabled: boolean }) =>
      api.post(`/dev-admin/tenants/${payload.tenantId}/modules`, {
        module_key: payload.moduleKey,
        is_enabled: payload.isEnabled,
      }),
    onSuccess: async () => {
      await refreshAdminData()
      toast.success('Tenant module override updated.')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to update module access.')),
  })

  const addDomainMutation = useMutation({
    mutationFn: (payload: { tenantId: number; values: DomainFormValues }) =>
      api.post(`/dev-admin/tenants/${payload.tenantId}/domains`, payload.values),
    onSuccess: async () => {
      await refreshAdminData()
      toast.success('Domain saved.')
      setIsDomainModalOpen(false)
      domainForm.reset({ is_primary: true, host: '' })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to save domain.')),
  })

  const domainActionMutation = useMutation({
    mutationFn: (payload: { tenantId: number; domainId: number; action: 'verify' | 'ssl' | 'activate' | 'disable' | 'retry' }) =>
      api.post(`/dev-admin/tenants/${payload.tenantId}/domains/${payload.domainId}/${payload.action}`),
    onSuccess: async () => {
      await refreshAdminData()
      toast.success('Domain action completed.')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to complete the domain action.')),
  })

  const deleteDomainMutation = useMutation({
    mutationFn: (payload: { tenantId: number; domainId: number }) =>
      api.delete(`/dev-admin/tenants/${payload.tenantId}/domains/${payload.domainId}`),
    onSuccess: async () => {
      await refreshAdminData()
      toast.success('Domain deleted.')
      setPendingDeleteDomain(null)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to delete domain.')),
  })

  const createPlanMutation = useMutation({
    mutationFn: (values: PlanFormValues) => api.post('/dev-admin/plans', values),
    onSuccess: async () => {
      await refreshAdminData()
      toast.success('Plan created.')
      setIsPlanModalOpen(false)
      setEditingPlan(null)
      planForm.reset({
        name: '',
        code: '',
        description: '',
        billing_cycle: 'monthly',
        monthly_price: 0,
        quarterly_price: 0,
        annual_price: 0,
        currency: 'UGX',
        trial_days: 0,
        is_active: true,
        modules: [],
      })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to create plan.')),
  })

  const updatePlanMutation = useMutation({
    mutationFn: (payload: { code: string; values: PlanFormValues }) => api.put(`/dev-admin/plans/${payload.code}`, payload.values),
    onSuccess: async () => {
      await refreshAdminData()
      toast.success('Plan updated.')
      setIsPlanModalOpen(false)
      setEditingPlan(null)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to update plan.')),
  })

  const updatePlanStatusMutation = useMutation({
    mutationFn: (payload: { code: string; is_active: boolean }) => api.post(`/dev-admin/plans/${payload.code}/status`, { is_active: payload.is_active }),
    onSuccess: async () => {
      await refreshAdminData()
      toast.success('Plan status updated.')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to update plan status.')),
  })

  const openEditTenant = (tenant: Tenant) => {
    setSelectedTenantId(tenant.id)
    editTenantForm.reset({
      name: tenant.name,
      slug: tenant.slug,
      business_name: tenant.business_name ?? '',
      contact_person: tenant.contact_person ?? '',
      email: tenant.email,
      phone: tenant.phone ?? '',
      address: tenant.address ?? '',
      country: tenant.country ?? '',
      domain: tenant.domains.find((domain) => domain.is_primary)?.host ?? '',
      plan: tenant.plan,
      billing_cycle: tenant.billing_cycle,
      subscription_start: tenant.subscription_start ?? '',
      subscription_expiry: tenant.subscription_expiry ?? '',
      is_suspended: tenant.is_suspended,
      notes: tenant.notes ?? '',
    })
    setIsEditTenantModalOpen(true)
  }

  const openPlanEditor = (plan?: Plan | null) => {
    setEditingPlan(plan ?? null)
    if (plan) {
      planForm.reset({
        name: plan.name,
        code: plan.code,
        description: plan.description ?? '',
        billing_cycle: plan.billing_cycle as 'monthly' | 'quarterly' | 'annual',
        monthly_price: Number(plan.monthly_price),
        quarterly_price: Number(plan.quarterly_price),
        annual_price: Number(plan.annual_price),
        currency: plan.currency,
        trial_days: plan.trial_days,
        is_active: plan.is_active,
        modules: plan.modules.map((module) => module.module_key),
      })
    } else {
      planForm.reset({
        name: '',
        code: '',
        description: '',
        billing_cycle: 'monthly',
        monthly_price: 0,
        quarterly_price: 0,
        annual_price: 0,
        currency: 'UGX',
        trial_days: 0,
        is_active: true,
        modules: [],
      })
    }
    setIsPlanModalOpen(true)
  }

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {[
          {
            title: "Total Tenants",
            value: overview?.total_tenants ?? 0,
            note: "Active tenants on platform",
            change: "+12%",
            icon: Users,
            tone: "bg-blue-50 text-blue-700",
          },
          {
            title: "Active Domains",
            value: overview?.active_domains ?? 0,
            note: "Verified custom domains",
            change: "+8%",
            icon: Globe,
            tone: "bg-indigo-50 text-indigo-700",
          },
          {
            title: "Active Plans",
            value: overview?.active_plans ?? 0,
            note: "Subscription plans",
            change: "No change",
            icon: CreditCard,
            tone: "bg-amber-50 text-amber-700",
          },
          {
            title: "Monthly Revenue",
            value: formatMoney(overview?.monthly_revenue, 'UGX'),
            note: "Total this month",
            change: "+15%",
            icon: BadgeDollarSign,
            tone: "bg-yellow-50 text-yellow-700",
          },
          {
            title: "Pending Setup",
            value: overview?.pending_setup ?? 0,
            note: "Tenants awaiting setup",
            change: "+25%",
            icon: Database,
            tone: "bg-red-50 text-red-600",
          },
          {
            title: "Suspended Tenants",
            value: overview?.suspended_tenants ?? 0,
            note: "Tenants suspended",
            change: "-50%",
            icon: PowerOff,
            tone: "bg-purple-50 text-purple-700",
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${card.tone}`}>
                  <Icon className="h-7 w-7" />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-600 uppercase tracking-wider">{card.title}</p>
                  <h3 className="mt-1 truncate text-xl font-black text-slate-950">{card.value}</h3>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm font-bold text-emerald-600">{card.change}</p>
                <p className="mt-1 text-xs text-slate-500">{card.note}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="card overflow-hidden">
          <div className="surface-header">
            <div>
              <h2 className="surface-title">Tenants vs Revenue Growth</h2>
              <p className="surface-subtitle">Historical overview of platform adoption.</p>
            </div>
          </div>
          <div className="px-5 py-5 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MOCK_REVENUE_DATA} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}
                  formatter={(value: number, name: string) => [name === 'revenue' ? formatMoney(value, '') : value, name === 'revenue' ? 'Revenue' : 'Tenants']}
                />
                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="var(--brand-primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--brand-primary)' }} activeDot={{ r: 6 }} />
                <Line yAxisId="right" type="monotone" dataKey="tenants" stroke="var(--text-strong)" strokeWidth={3} dot={{ r: 4, fill: 'var(--text-strong)' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 p-6">
            <h2 className="text-lg font-black text-slate-950">Recent Tenants</h2>
            <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50" onClick={() => setSection('tenants')}>
              View all
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-bold">
                <tr>
                  <th className="px-6 py-4">Tenant</th>
                  <th className="px-6 py-4">Plan</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {tenants.slice(0, 5).map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <button type="button" className="text-left font-bold text-slate-900 hover:text-brand-primary" onClick={() => setSelectedTenantId(tenant.id)}>
                        {tenant.name}
                      </button>
                      <div className="mt-0.5 text-xs text-slate-500 font-medium">{tenant.domains.find(d => d.is_primary)?.host ?? 'No domain'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#b88a1d] border border-amber-100">
                        {tenant.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                        tenant.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      )}>
                        {tenant.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <MoreHorizontal className="h-5 w-5 text-slate-400 cursor-pointer" />
                    </td>
                  </tr>
                ))}
                {!tenants.length && (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-slate-500">No tenants found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 p-6">
            <h2 className="text-lg font-black text-slate-950">Plan Overview</h2>
            <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50" onClick={() => setSection('plans')}>
              View all
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-bold">
                <tr>
                  <th className="px-6 py-4">Plan</th>
                  <th className="px-6 py-4">Price</th>
                  <th className="px-6 py-4">Tenants</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.code} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-950">{plan.name}</td>
                    <td className="px-6 py-4 text-slate-700 font-semibold">{formatMoney(plan.monthly_price, plan.currency)}/mo</td>
                    <td className="px-6 py-4 text-slate-700 font-semibold">{plan.tenant_count}</td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                        plan.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                      )}>
                        {plan.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-black text-slate-950">Revenue Overview</h2>
          </div>
          <div className="flex items-center justify-center h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={plans.map(p => ({ name: p.name, value: p.tenant_count }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {plans.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#b88a1d', '#0f172a', '#64748b', '#e2e8f0'][index % 4]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px -2px rgba(15, 23, 42, 0.05)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm overflow-hidden">
          <h2 className="text-lg font-black text-slate-950 mb-5">Quick Actions</h2>
          <div className="grid gap-4">
            {[
              { label: "Add Tenant", note: "Onboard new farm", onClick: () => setIsTenantModalOpen(true) },
              { label: "Add Domain", note: "Configure routing", onClick: () => setSection('domains') },
              { label: "Create Plan", note: "Define new offering", onClick: () => setIsPlanModalOpen(true) },
              { label: "View Billing", note: "Platform financials", onClick: () => {} },
            ].map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-[#c79a31] hover:bg-amber-50 group"
              >
                <p className="font-bold text-slate-900 group-hover:text-[#b88a1d]">{action.label}</p>
                <p className="mt-1 text-xs text-slate-500">{action.note}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const renderTenants = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Tenants</div>
          <div className="metric-value">{overview?.total_tenants ?? 0}</div>
          <div className="metric-note">Registered tenant workspaces on the platform.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Suspended</div>
          <div className="metric-value">{overview?.suspended_tenants ?? 0}</div>
          <div className="metric-note">Tenants blocked from operating until reactivated.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Pending Setup</div>
          <div className="metric-value">{overview?.pending_setup ?? 0}</div>
          <div className="metric-note">Operational DB or domain setup still needs intervention.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Monthly Revenue</div>
          <div className="metric-value text-[1.5rem]">{formatMoney(overview?.monthly_revenue, 'UGX')}</div>
          <div className="metric-note">Monthly revenue equivalent from assigned plans.</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card overflow-hidden">
          <div className="surface-header">
            <div>
              <h2 className="surface-title">Tenant Directory</h2>
              <p className="surface-subtitle">Plan assignment, primary domain, database readiness, and management actions in one table.</p>
            </div>
            {canManage ? (
              <button type="button" className="btn-primary" onClick={() => setIsTenantModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Register Tenant
              </button>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Plan</th>
                  <th>Primary Domain</th>
                  <th>Database</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenantsLoading ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">Loading tenants...</td>
                  </tr>
                ) : tenants.length ? (
                  tenants.map((tenant) => {
                    const primaryDomain = tenant.domains.find((domain) => domain.is_primary)
                    return (
                      <tr key={tenant.id} className={selectedTenantId === tenant.id ? 'bg-[rgba(var(--brand-primary-rgb),0.04)]' : ''}>
                        <td>
                          <button type="button" className="text-left font-semibold text-slate-900" onClick={() => setSelectedTenantId(tenant.id)}>
                            {tenant.name}
                          </button>
                          <div className="mt-1 text-xs text-slate-500">{tenant.email}</div>
                        </td>
                        <td><span className="badge badge-brand uppercase">{tenant.plan}</span></td>
                        <td>
                          <div>{primaryDomain?.host ?? 'Not assigned'}</div>
                          <div className="mt-1 text-xs text-slate-500">{primaryDomain?.status?.replace(/_/g, ' ') ?? 'No primary domain'}</div>
                        </td>
                        <td><span className={statusBadge(tenant.operational_db_status)}>{tenant.operational_db_status.replace(/_/g, ' ')}</span></td>
                        <td><span className={statusBadge(tenant.is_suspended ? 'suspended' : tenant.status)}>{tenant.is_suspended ? 'Suspended' : tenant.status.replace(/_/g, ' ')}</span></td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2">
                            <button type="button" className="btn-secondary btn-sm" onClick={() => setSelectedTenantId(tenant.id)}>
                              Manage
                            </button>
                            {canManage ? (
                              <button type="button" className="btn-secondary btn-sm" onClick={() => openEditTenant(tenant)}>
                                Edit
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">No tenants found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-5">
          {selectedTenant ? (
            <>
              <div className="card overflow-hidden">
                <div className="surface-header">
                  <div>
                    <h2 className="surface-title">{selectedTenant.name}</h2>
                    <p className="surface-subtitle">Tenant management, module overrides, and operational setup status.</p>
                  </div>
                  <span className={statusBadge(selectedTenant.is_suspended ? 'suspended' : selectedTenant.status)}>
                    {selectedTenant.is_suspended ? 'Suspended' : selectedTenant.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="space-y-4 px-5 py-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Primary Domain</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{selectedTenant.domains.find((domain) => domain.is_primary)?.host ?? 'Not assigned'}</div>
                    </div>
                    <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Database Status</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{selectedTenant.operational_db_status.replace(/_/g, ' ')}</div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="form-label">Assigned Plan</label>
                      <select
                        className="form-input"
                        value={selectedTenant.plan}
                        disabled={!canManage || changePlanMutation.isPending}
                        onChange={(event) =>
                          changePlanMutation.mutate({
                            tenantId: selectedTenant.id,
                            plan: event.target.value,
                            billing_cycle: selectedTenant.billing_cycle,
                            subscription_expiry: selectedTenant.subscription_expiry,
                          })
                        }
                      >
                        {plans.map((plan) => (
                          <option key={plan.code} value={plan.code}>{plan.name} ({plan.code})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Billing Cycle</label>
                      <div className="form-input flex items-center">{selectedTenant.billing_cycle}</div>
                    </div>
                  </div>

                  {canManage ? (
                    <div className="flex gap-2">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => {
                        setSelectedTenantId(selectedTenant.id)
                        domainForm.reset({ host: '', is_primary: true })
                        setIsDomainModalOpen(true)
                      }}>
                        <Globe className="h-4 w-4" />
                        Add Domain
                      </button>
                      {selectedTenant.is_suspended ? (
                        <button type="button" className="btn-primary btn-sm" onClick={() => reactivateMutation.mutate(selectedTenant.id)}>
                          <Power className="h-4 w-4" />
                          Reactivate
                        </button>
                      ) : (
                        <button type="button" className="btn-danger btn-sm" onClick={() => suspendMutation.mutate(selectedTenant.id)}>
                          <PowerOff className="h-4 w-4" />
                          Suspend
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="surface-header">
                  <div>
                    <h2 className="surface-title">Tenant Domains</h2>
                    <p className="surface-subtitle">Primary domain, verification status, SSL actions, and safe deletion rules.</p>
                  </div>
                </div>
                <div className="divide-y divide-[var(--border-subtle)]">
                  {selectedTenant.domains.length ? selectedTenant.domains.map((domain) => (
                    <div key={domain.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-slate-900">{domain.host}</div>
                            {domain.is_primary ? <span className="badge badge-brand">Primary</span> : null}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{domain.domain_type.replace(/_/g, ' ')} • {domain.status.replace(/_/g, ' ')}</div>
                          {domain.last_error ? <div className="mt-2 text-xs text-red-600">{domain.last_error}</div> : null}
                        </div>
                        {canManage ? (
                          <div className="flex flex-wrap justify-end gap-2">
                            <button type="button" className="btn-secondary btn-sm" onClick={() => domainActionMutation.mutate({ tenantId: selectedTenant.id, domainId: domain.id, action: 'verify' })}>Verify</button>
                            <button type="button" className="btn-secondary btn-sm" onClick={() => domainActionMutation.mutate({ tenantId: selectedTenant.id, domainId: domain.id, action: 'ssl' })}>SSL</button>
                            <button type="button" className="btn-secondary btn-sm" onClick={() => domainActionMutation.mutate({ tenantId: selectedTenant.id, domainId: domain.id, action: 'activate' })}>Activate</button>
                            <button type="button" className="btn-secondary btn-sm" onClick={() => domainActionMutation.mutate({ tenantId: selectedTenant.id, domainId: domain.id, action: 'disable' })}>Disable</button>
                            <button type="button" className="btn-secondary btn-sm" onClick={() => setPendingDeleteDomain({ tenantId: selectedTenant.id, domain })}>
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )) : (
                    <div className="px-5 py-8 text-sm text-slate-500">No domains assigned yet.</div>
                  )}
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="surface-header">
                  <div>
                    <h2 className="surface-title">Module Override View</h2>
                    <p className="surface-subtitle">Plan-driven modules stay synchronized. Manual overrides are clearly flagged here.</p>
                  </div>
                </div>
                <div className="divide-y divide-[var(--border-subtle)]">
                  {modules.map((module) => {
                    const tenantModule = selectedTenant.modules.find((item) => item.module_key === module.key)
                    const enabled = tenantModule?.is_enabled ?? false
                    const overridden = tenantModule?.is_manual_override ?? false
                    return (
                      <div key={module.key} className="flex items-center justify-between gap-3 px-5 py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-slate-900">{module.name}</div>
                            {module.is_core ? <span className="badge badge-brand">Core</span> : null}
                            {overridden ? <span className="badge badge-warning">Manual Override</span> : null}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{module.category.replace(/_/g, ' ')} • {module.description}</div>
                        </div>
                        <button
                          type="button"
                          disabled={!canManage || toggleModuleMutation.isPending}
                          onClick={() => toggleModuleMutation.mutate({ tenantId: selectedTenant.id, moduleKey: module.key, isEnabled: !enabled })}
                          className={`relative inline-flex h-[24px] w-[44px] shrink-0 rounded-full transition-colors ${enabled ? 'bg-[var(--brand-primary)]' : 'bg-slate-300'}`}
                        >
                          <span className={`inline-block h-[20px] w-[20px] transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-[20px]' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="card px-6 py-12 text-center text-slate-500">Select a tenant to manage plan assignment, domains, and module overrides.</div>
          )}
        </div>
      </div>
    </div>
  )

  const renderDomains = () => (
    <div className="card overflow-hidden">
      <div className="surface-header">
        <div>
          <h2 className="surface-title">All Tenant Domains</h2>
          <p className="surface-subtitle">Use this global view to verify, activate, disable, or delete domains across every tenant.</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Host</th>
              <th>Type</th>
              <th>Status</th>
              <th>Database</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {domainRows.length ? domainRows.map((row) => (
              <tr key={row.id}>
                <td>{row.tenant_name}</td>
                <td>
                  <div className="font-semibold text-slate-900">{row.host}</div>
                  {row.is_primary ? <div className="mt-1 text-xs text-slate-500">Primary domain</div> : null}
                </td>
                <td>{row.domain_type.replace(/_/g, ' ')}</td>
                <td><span className={statusBadge(row.status)}>{row.status.replace(/_/g, ' ')}</span></td>
                <td>{row.tenant_db_status.replace(/_/g, ' ')}</td>
                <td className="text-right">
                  {canManage ? (
                    <div className="flex justify-end gap-2">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => domainActionMutation.mutate({ tenantId: row.tenant_id, domainId: row.id, action: 'verify' })}>Verify</button>
                      <button type="button" className="btn-secondary btn-sm" onClick={() => domainActionMutation.mutate({ tenantId: row.tenant_id, domainId: row.id, action: 'ssl' })}>SSL</button>
                      <button type="button" className="btn-secondary btn-sm" onClick={() => setPendingDeleteDomain({ tenantId: row.tenant_id, domain: row })}>Delete</button>
                    </div>
                  ) : null}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-500">No domains found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderPlans = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Total Plans</div>
          <div className="metric-value">{plansSummary.totalPlans}</div>
          <div className="metric-note">Commercial plans currently configured on the platform.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Active Plans</div>
          <div className="metric-value">{plansSummary.activePlans}</div>
          <div className="metric-note">Plans available for new assignments and onboarding flows.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Subscribed Tenants</div>
          <div className="metric-value">{plansSummary.subscribedTenants}</div>
          <div className="metric-note">Total tenant assignments across the commercial plan catalog.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Monthly Revenue</div>
          <div className="metric-value text-[1.5rem]">{formatMoney(overview?.monthly_revenue, 'UGX')}</div>
          <div className="metric-note">Monthly revenue equivalent tied to current plan assignments.</div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-4">
        {[
          ["Total Plans", plans.length],
          ["Active Plans", plans.filter(p => p.is_active).length],
          ["Subscribed Tenants", overview?.total_tenants ?? 0],
          ["Monthly Revenue", formatMoney(overview?.monthly_revenue, 'UGX')],
        ].map(([label, value]) => (
          <div key={label.toString()} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <h3 className="mt-3 text-3xl font-black text-slate-950">{value}</h3>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 p-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">Subscription Plans</h2>
              <p className="mt-1 text-sm text-slate-500">Modules and billing are configured inside each plan.</p>
            </div>
            {canManage && (
              <button type="button" className="flex items-center gap-2 rounded-2xl bg-[#c79a31] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#b98624]" onClick={() => openPlanEditor()}>
                <Plus className="h-5 w-5" />
                New Plan
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-bold">
                <tr>
                  <th className="px-6 py-4">Plan</th>
                  <th className="px-6 py-4">Price</th>
                  <th className="px-6 py-4">Modules</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.length ? plans.map((plan) => (
                  <tr key={plan.code} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-950">{plan.name}</p>
                      <p className="mt-1 text-xs text-slate-500 truncate max-w-[200px]">{plan.description}</p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-900">{formatMoney(plan.monthly_price, plan.currency)}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-tight font-medium">per month</p>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1.5 max-w-[180px]">
                        {plan.modules.slice(0, 3).map(m => (
                          <span key={m.module_key} className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-[#b98624] border border-amber-100">
                            {m.module_name.split(' ')[0]}
                          </span>
                        ))}
                        {plan.modules.length > 3 && <span className="text-[9px] font-bold text-slate-400">+{plan.modules.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={clsx(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                        plan.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                      )}>
                        {plan.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50" onClick={() => setSelectedPlanCode(plan.code)}>
                          Manage
                        </button>
                        {canManage && (
                          <button type="button" className="rounded-xl border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50" onClick={() => openPlanEditor(plan)}>
                            <Settings className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500 font-medium">No plans configured.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-lg font-black text-slate-950">{selectedPlan ? `${selectedPlan.name} Details` : 'Plan Details'}</h2>
            <p className="mt-1 text-sm text-slate-500">Billing terms and included modules.</p>
          </div>
          {selectedPlan ? (
            <div className="space-y-5 px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Plan Code</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{selectedPlan.code}</div>
                </div>
                <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Billing Cycle</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{selectedPlan.billing_cycle}</div>
                </div>
                <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Monthly</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{formatMoney(selectedPlan.monthly_price, selectedPlan.currency)}</div>
                </div>
                <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Quarterly</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{formatMoney(selectedPlan.quarterly_price, selectedPlan.currency)}</div>
                </div>
                <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Annual</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{formatMoney(selectedPlan.annual_price, selectedPlan.currency)}</div>
                </div>
                <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Trial Days</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{selectedPlan.trial_days}</div>
                </div>
              </div>
              {selectedPlan.description ? <div className="inline-note">{selectedPlan.description}</div> : null}

              <div>
                <div className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Included Modules</div>
                <div className="space-y-2">
                  {modules.map((module) => {
                    const included = selectedPlan.modules.some((item) => item.module_key === module.key)
                    return (
                      <div key={module.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">{module.name}</div>
                        </div>
                        {included ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-slate-200 shrink-0" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="px-6 py-20 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 mb-4">
                <Layers3 className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-slate-500">Select a plan to inspect its configuration.</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h3 className="font-black text-slate-950">Important Structure</h3>
        <p className="mt-2 text-sm text-slate-700">
          Modules should not appear as a separate Developer Admin menu. They must be managed only inside
          each plan. Billing should also be configured here through plan prices.
        </p>
      </div>
    </div>
  )

  const renderActivity = () => (
    <div className="card overflow-hidden">
      <div className="surface-header">
        <div>
          <h2 className="surface-title">Developer Admin Activity</h2>
          <p className="surface-subtitle">Every tenant, domain, plan, and override action recorded through the platform layer.</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Meta</th>
            </tr>
          </thead>
          <tbody>
            {activityLogs.length ? activityLogs.map((entry) => (
              <tr key={entry.id}>
                <td>{formatDate(entry.created_at)}</td>
                <td>
                  <div className="font-semibold text-slate-900">{entry.actor_name ?? 'System'}</div>
                  <div className="mt-1 text-xs text-slate-500">{entry.actor_email ?? 'Automated action'}</div>
                </td>
                <td>{entry.action}</td>
                <td>{entry.entity.replace(/_/g, ' ')}</td>
                <td className="max-w-[460px] text-xs text-slate-500">{entry.meta ?? 'No metadata'}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-500">No activity logs found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Primary Platform Domain</div>
          <div className="metric-value text-[1.2rem] leading-tight">{settingsSummary?.primary_platform_domain ?? '...'}</div>
          <div className="metric-note">Central domain used for platform-admin sign-in and routing.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Tenant Domain Suffix</div>
          <div className="metric-value text-[1.2rem] leading-tight">{settingsSummary?.default_tenant_domain_suffix ?? '...'}</div>
          <div className="metric-note">Default suffix used when generating platform subdomains for tenants.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Module Catalog</div>
          <div className="metric-value">{settingsSummary?.total_modules ?? 0}</div>
          <div className="metric-note">Backend module catalog entries available for plan composition and overrides.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Plan Catalog</div>
          <div className="metric-value">{settingsSummary?.total_plans ?? 0}</div>
          <div className="metric-note">Plans currently available for tenant assignment and commercial packaging.</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="card overflow-hidden">
          <div className="surface-header">
            <div>
              <h2 className="surface-title">Provisioning Controls</h2>
              <p className="surface-subtitle">Platform-level defaults used during tenant onboarding and custom domain activation.</p>
            </div>
          </div>
          <div className="space-y-4 px-5 py-5">
            <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Automatic SSL Provisioning</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                {settingsSummary?.automatic_ssl_provisioning ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <ShieldCheck className="h-4 w-4 text-amber-600" />}
                {settingsSummary?.automatic_ssl_provisioning ? 'Enabled' : 'Manual'}
              </div>
            </div>
            <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Certbot Runtime</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{settingsSummary?.certbot_enabled ? 'Configured' : 'Not configured'}</div>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="surface-header">
            <div>
              <h2 className="surface-title">Mandatory Tenant Controls</h2>
              <p className="surface-subtitle">These modules stay enforced at the tenancy layer regardless of commercial plan changes.</p>
            </div>
          </div>
          <div className="grid gap-3 px-5 py-5 sm:grid-cols-2">
            {(settingsSummary?.mandatory_module_keys ?? []).map((moduleKey) => (
              <div key={moduleKey} className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">{moduleKey.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const renderSection = () => {
    switch (section) {
      case 'dashboard':
        return renderDashboard()
      case 'domains':
        return renderDomains()
      case 'plans':
        return renderPlans()
      case 'activity':
        return renderActivity()
      case 'settings':
        return renderSettings()
      default:
        return renderTenants()
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-950">{meta.title}</h1>
        <p className="mt-1 text-slate-500">{meta.subtitle}</p>
      </div>

      {renderSection()}

      {!canManage ? (
        <div className="card px-5 py-4 text-sm text-slate-500">
          You currently have read-only access in developer admin. Tenant registration, plan changes, overrides, and domain deletion require the `dev_admin:write` permission.
        </div>
      ) : null}

      <Modal
        isOpen={isTenantModalOpen}
        onClose={() => setIsTenantModalOpen(false)}
        title="Register Tenant"
        description="Create the tenant workspace, assign a plan, and provision the initial domain and tenancy access."
      >
        <form onSubmit={tenantForm.handleSubmit((values) => createTenantMutation.mutate(values))} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="form-label">Tenant Name</label>
            <input className="form-input" {...tenantForm.register('name')} />
            {tenantForm.formState.errors.name ? <p className="form-error">{tenantForm.formState.errors.name.message}</p> : null}
          </div>
          <div>
            <label className="form-label">Business Name</label>
            <input className="form-input" {...tenantForm.register('business_name')} />
          </div>
          <div>
            <label className="form-label">Slug</label>
            <input className="form-input" {...tenantForm.register('slug')} />
          </div>
          <div>
            <label className="form-label">Contact Person</label>
            <input className="form-input" {...tenantForm.register('contact_person')} />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input type="email" className="form-input" {...tenantForm.register('email')} />
          </div>
          <div>
            <label className="form-label">Phone</label>
            <input className="form-input" {...tenantForm.register('phone')} />
          </div>
          <div>
            <label className="form-label">Country</label>
            <input className="form-input" {...tenantForm.register('country')} />
          </div>
          <div>
            <label className="form-label">Primary Domain</label>
            <input className="form-input" placeholder="farm.example.com" {...tenantForm.register('domain')} />
          </div>
          <div>
            <label className="form-label">Plan</label>
            <select className="form-input" {...tenantForm.register('plan')}>
              {plans.map((plan) => (
                <option key={plan.code} value={plan.code}>{plan.name} ({plan.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Billing Cycle</label>
            <select className="form-input" {...tenantForm.register('billing_cycle')}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <div>
            <label className="form-label">Subscription Start</label>
            <input type="date" className="form-input" {...tenantForm.register('subscription_start')} />
          </div>
          <div>
            <label className="form-label">Subscription Expiry</label>
            <input type="date" className="form-input" {...tenantForm.register('subscription_expiry')} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Address</label>
            <input className="form-input" {...tenantForm.register('address')} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Notes</label>
            <textarea className="form-input min-h-[110px]" {...tenantForm.register('notes')} />
          </div>
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setIsTenantModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createTenantMutation.isPending}>
              {createTenantMutation.isPending ? 'Saving...' : 'Create Tenant'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isEditTenantModalOpen}
        onClose={() => setIsEditTenantModalOpen(false)}
        title={selectedTenant ? `Edit Tenant - ${selectedTenant.name}` : 'Edit Tenant'}
        description="Update tenant profile details, assigned plan metadata, and primary access domain."
      >
        <form onSubmit={editTenantForm.handleSubmit((values) => {
          if (!selectedTenant) return
          updateTenantMutation.mutate({ tenantId: selectedTenant.id, values })
        })} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="form-label">Tenant Name</label>
            <input className="form-input" {...editTenantForm.register('name')} />
          </div>
          <div>
            <label className="form-label">Slug</label>
            <input className="form-input" {...editTenantForm.register('slug')} />
          </div>
          <div>
            <label className="form-label">Business Name</label>
            <input className="form-input" {...editTenantForm.register('business_name')} />
          </div>
          <div>
            <label className="form-label">Contact Person</label>
            <input className="form-input" {...editTenantForm.register('contact_person')} />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input type="email" className="form-input" {...editTenantForm.register('email')} />
          </div>
          <div>
            <label className="form-label">Phone</label>
            <input className="form-input" {...editTenantForm.register('phone')} />
          </div>
          <div>
            <label className="form-label">Primary Domain</label>
            <input className="form-input" {...editTenantForm.register('domain')} />
          </div>
          <div>
            <label className="form-label">Plan</label>
            <select className="form-input" {...editTenantForm.register('plan')}>
              {plans.map((plan) => (
                <option key={plan.code} value={plan.code}>{plan.name} ({plan.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Billing Cycle</label>
            <select className="form-input" {...editTenantForm.register('billing_cycle')}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <div>
            <label className="form-label">Subscription Expiry</label>
            <input type="date" className="form-input" {...editTenantForm.register('subscription_expiry')} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Address</label>
            <input className="form-input" {...editTenantForm.register('address')} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Notes</label>
            <textarea className="form-input min-h-[110px]" {...editTenantForm.register('notes')} />
          </div>
          <label className="md:col-span-2 flex items-center gap-3 rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3 text-sm font-medium text-slate-700">
            <input type="checkbox" {...editTenantForm.register('is_suspended')} />
            Suspend tenant access
          </label>
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setIsEditTenantModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={updateTenantMutation.isPending}>
              {updateTenantMutation.isPending ? 'Saving...' : 'Save Tenant'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isDomainModalOpen}
        onClose={() => setIsDomainModalOpen(false)}
        title={selectedTenant ? `Add Domain - ${selectedTenant.name}` : 'Add Domain'}
        description="Custom domains remain pending until DNS and SSL are fully activated."
      >
        <form onSubmit={domainForm.handleSubmit((values) => {
          if (!selectedTenant) return
          addDomainMutation.mutate({ tenantId: selectedTenant.id, values })
        })} className="space-y-4">
          <div>
            <label className="form-label">Domain / Subdomain</label>
            <input className="form-input" {...domainForm.register('host')} />
            {domainForm.formState.errors.host ? <p className="form-error">{domainForm.formState.errors.host.message}</p> : null}
          </div>
          <label className="flex items-center gap-3 rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3 text-sm font-medium text-slate-700">
            <input type="checkbox" {...domainForm.register('is_primary')} />
            Set as primary domain
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setIsDomainModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={addDomainMutation.isPending}>
              {addDomainMutation.isPending ? 'Saving...' : 'Save Domain'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isPlanModalOpen}
        onClose={() => {
          setIsPlanModalOpen(false)
          setEditingPlan(null)
        }}
        title={editingPlan ? `Edit Plan - ${editingPlan.name}` : 'Create Plan'}
        description="Set commercial pricing and manage included modules directly inside the plan definition."
      >
        <form onSubmit={planForm.handleSubmit((values) => {
          if (editingPlan) {
            updatePlanMutation.mutate({ code: editingPlan.code, values })
            return
          }
          createPlanMutation.mutate(values)
        })} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="form-label">Plan Name</label>
              <input className="form-input" {...planForm.register('name')} />
            </div>
            <div>
              <label className="form-label">Plan Code</label>
              <input className="form-input" {...planForm.register('code')} />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Description</label>
              <textarea className="form-input min-h-[100px]" {...planForm.register('description')} />
            </div>
            <div>
              <label className="form-label">Billing Cycle</label>
              <select className="form-input" {...planForm.register('billing_cycle')}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div>
              <label className="form-label">Currency</label>
              <input className="form-input" {...planForm.register('currency')} />
            </div>
            <div>
              <label className="form-label">Monthly Price</label>
              <input type="number" className="form-input" {...planForm.register('monthly_price')} />
            </div>
            <div>
              <label className="form-label">Quarterly Price</label>
              <input type="number" className="form-input" {...planForm.register('quarterly_price')} />
            </div>
            <div>
              <label className="form-label">Annual Price</label>
              <input type="number" className="form-input" {...planForm.register('annual_price')} />
            </div>
            <div>
              <label className="form-label">Trial Days</label>
              <input type="number" className="form-input" {...planForm.register('trial_days')} />
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3 text-sm font-medium text-slate-700">
            <input type="checkbox" {...planForm.register('is_active')} />
            Keep this plan active for assignments
          </label>

          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Included Modules</div>
            <div className="space-y-4">
              {groupedModules.map(([category, items]) => (
                <div key={category} className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{category.replace(/_/g, ' ')}</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {items.map((module) => {
                      const selected = planForm.watch('modules').includes(module.key)
                      return (
                        <label key={module.key} className="flex items-start gap-3 rounded-[0.9rem] bg-white px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => {
                              const current = planForm.getValues('modules')
                              planForm.setValue(
                                'modules',
                                event.target.checked ? [...current, module.key] : current.filter((item) => item !== module.key)
                              )
                            }}
                          />
                          <span>
                            <span className="block text-sm font-semibold text-slate-900">{module.name}</span>
                            <span className="mt-1 block text-xs text-slate-500">{module.description}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setIsPlanModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createPlanMutation.isPending || updatePlanMutation.isPending}>
              {createPlanMutation.isPending || updatePlanMutation.isPending ? 'Saving...' : editingPlan ? 'Save Plan' : 'Create Plan'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!pendingDeleteDomain}
        onClose={() => setPendingDeleteDomain(null)}
        title="Delete Domain"
        description="This action removes the domain mapping from the tenant. Primary-domain safeguards are enforced on the backend."
      >
        {pendingDeleteDomain ? (
          <div className="space-y-4">
            <div className="inline-note">
              Delete <span className="font-semibold text-slate-900">{pendingDeleteDomain.domain.host}</span> from this tenant?
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setPendingDeleteDomain(null)}>Cancel</button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => deleteDomainMutation.mutate({ tenantId: pendingDeleteDomain.tenantId, domainId: pendingDeleteDomain.domain.id })}
              >
                Delete Domain
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={!!createdTenant}
        onClose={() => setCreatedTenant(null)}
        title={createdTenant ? `${createdTenant.name} created` : 'Tenant created'}
        description="Keep the generated tenant administrator credentials secure. The temporary password is only shown once."
      >
        {createdTenant?.onboarding_admin ? (
          <div className="space-y-4">
            <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Tenant Administrator</div>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <div><span className="font-semibold text-slate-900">Name:</span> {createdTenant.onboarding_admin.full_name}</div>
                <div><span className="font-semibold text-slate-900">Email:</span> {createdTenant.onboarding_admin.email}</div>
                <div><span className="font-semibold text-slate-900">Temporary password:</span> {createdTenant.onboarding_admin.temporary_password}</div>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="button" className="btn-primary" onClick={() => setCreatedTenant(null)}>Close</button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
