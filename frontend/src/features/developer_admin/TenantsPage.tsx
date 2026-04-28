import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  BadgeDollarSign,
  Building2,
  CreditCard,
  Globe,
  Layers3,
  Plus,
  Power,
  PowerOff,
} from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'
import { Modal } from '@/components/Modal'

type AdminSection = 'tenants' | 'domains' | 'plans' | 'modules' | 'billing' | 'control'

interface TenantModule {
  id: number
  module_key: string
  is_enabled: boolean
}

interface TenantDomain {
  id: number
  host: string
  is_primary: boolean
  status: string
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
  status: string
  plan: string
  billing_cycle: string
  subscription_expiry: string | null
  is_suspended: boolean
  modules: TenantModule[]
  domains: TenantDomain[]
  subscriptions: Subscription[]
}

interface CatalogModule {
  key: string
  name: string
  category: string
  description: string | null
  is_core: boolean
}

interface PlanModule {
  module_key: string
  is_included: boolean
}

interface Plan {
  code: string
  name: string
  description: string | null
  billing_cycle: string
  is_custom: boolean
  modules: PlanModule[]
}

interface ModulePrice {
  id: number
  module_key: string
  billing_cycle: string
  price: string
  currency: string
  notes: string | null
}

interface CatalogResponse {
  modules: CatalogModule[]
  plans: Plan[]
  module_prices: ModulePrice[]
}

interface BillingTenant {
  tenant_id: number
  tenant_name: string
  plan: string
  status: string
  billing_cycle: string
  expiry_date: string | null
  amount: string | null
  currency: string
  domains: string[]
}

interface BillingOverview {
  total_tenants: number
  active_tenants: number
  suspended_tenants: number
  expiring_soon: number
  tenants: BillingTenant[]
}

const tenantSchema = z.object({
  name: z.string().min(2, 'Tenant name is required'),
  business_name: z.string().optional(),
  contact_person: z.string().optional(),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  domain: z.string().optional(),
  plan: z.string().min(1, 'Plan is required'),
  billing_cycle: z.string().min(1, 'Billing cycle is required'),
  subscription_start: z.string().optional(),
  subscription_expiry: z.string().optional(),
  notes: z.string().optional(),
})

const domainSchema = z.object({
  host: z.string().min(3, 'Domain or subdomain is required'),
  is_primary: z.boolean().default(true),
})

type TenantFormValues = z.infer<typeof tenantSchema>
type DomainFormValues = z.infer<typeof domainSchema>

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

function formatMoney(value: string | null, currency = 'UGX') {
  if (!value) return 'Not set'
  return `${currency} ${Number(value).toLocaleString()}`
}

function sectionMeta(section: AdminSection) {
  switch (section) {
    case 'domains':
      return { title: 'Domains', subtitle: 'Map and monitor tenant domains and subdomains.' }
    case 'plans':
      return { title: 'Plans', subtitle: 'Review plan structure and included modules.' }
    case 'modules':
      return { title: 'Modules', subtitle: 'Inspect module catalog and configurable pricing.' }
    case 'billing':
      return { title: 'Billing', subtitle: 'Track tenant subscription status and renewals.' }
    case 'control':
      return { title: 'Tenant Control', subtitle: 'Suspend, reactivate, and manage tenant access.' }
    default:
      return { title: 'Tenants', subtitle: 'Onboard farms, assign plans, and manage module access.' }
  }
}

export function TenantsPage({ section = 'tenants' }: { section?: AdminSection }) {
  const queryClient = useQueryClient()
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false)
  const [isModulesModalOpen, setIsModulesModalOpen] = useState(false)
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)

  const meta = sectionMeta(section)

  const { data: tenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ['dev-admin-tenants'],
    queryFn: async () => (await api.get('/dev-admin/tenants')).data,
  })

  const { data: catalog } = useQuery<CatalogResponse>({
    queryKey: ['dev-admin-catalog'],
    queryFn: async () => (await api.get('/dev-admin/catalog')).data,
  })

  const { data: billing } = useQuery<BillingOverview>({
    queryKey: ['dev-admin-billing'],
    queryFn: async () => (await api.get('/dev-admin/billing')).data,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: { plan: 'basic', billing_cycle: 'monthly' },
  })

  const {
    register: registerDomain,
    handleSubmit: handleSubmitDomain,
    reset: resetDomain,
    formState: { errors: domainErrors },
  } = useForm<DomainFormValues>({
    resolver: zodResolver(domainSchema),
    defaultValues: { is_primary: true },
  })

  const createTenantMutation = useMutation({
    mutationFn: (payload: TenantFormValues) =>
      api.post('/dev-admin/tenants', {
        ...payload,
        subscription_start: payload.subscription_start || null,
        subscription_expiry: payload.subscription_expiry || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dev-admin-tenants'] })
      queryClient.invalidateQueries({ queryKey: ['dev-admin-billing'] })
      toast.success('Tenant onboarded')
      setIsTenantModalOpen(false)
      reset()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to create tenant.')),
  })

  const suspendMutation = useMutation({
    mutationFn: (tenantId: number) => api.post(`/dev-admin/tenants/${tenantId}/suspend`, { reason: 'Suspended by developer admin' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dev-admin-tenants'] })
      queryClient.invalidateQueries({ queryKey: ['dev-admin-billing'] })
      toast.success('Tenant suspended')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to suspend tenant.')),
  })

  const reactivateMutation = useMutation({
    mutationFn: (tenantId: number) => api.post(`/dev-admin/tenants/${tenantId}/reactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dev-admin-tenants'] })
      queryClient.invalidateQueries({ queryKey: ['dev-admin-billing'] })
      toast.success('Tenant reactivated')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to reactivate tenant.')),
  })

  const toggleModuleMutation = useMutation({
    mutationFn: (payload: { tenantId: number; moduleKey: string; isEnabled: boolean }) =>
      api.post(`/dev-admin/tenants/${payload.tenantId}/modules`, {
        module_key: payload.moduleKey,
        is_enabled: payload.isEnabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dev-admin-tenants'] })
      toast.success('Module access updated')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to update module access.')),
  })

  const addDomainMutation = useMutation({
    mutationFn: (payload: { tenantId: number; values: DomainFormValues }) =>
      api.post(`/dev-admin/tenants/${payload.tenantId}/domains`, payload.values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dev-admin-tenants'] })
      queryClient.invalidateQueries({ queryKey: ['dev-admin-billing'] })
      toast.success('Domain saved')
      setIsDomainModalOpen(false)
      resetDomain()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to save domain.')),
  })

  const monthlyPriceMap = useMemo(() => {
    const map = new Map<string, ModulePrice>()
    ;(catalog?.module_prices ?? [])
      .filter((price) => price.billing_cycle === 'monthly')
      .forEach((price) => map.set(price.module_key, price))
    return map
  }, [catalog?.module_prices])

  const groupedModules = useMemo(() => {
    const groups = new Map<string, CatalogModule[]>()
    ;(catalog?.modules ?? []).forEach((module) => {
      const list = groups.get(module.category) ?? []
      list.push(module)
      groups.set(module.category, list)
    })
    return Array.from(groups.entries())
  }, [catalog?.modules])

  const domainRows = useMemo(
    () =>
      (tenants ?? []).flatMap((tenant) =>
        tenant.domains.map((domain) => ({
          tenantName: tenant.name,
          plan: tenant.plan,
          host: domain.host,
          status: domain.status,
          isPrimary: domain.is_primary,
        }))
      ),
    [tenants]
  )

  const onSubmitTenant = (values: TenantFormValues) => createTenantMutation.mutate(values)
  const onSubmitDomain = (values: DomainFormValues) => {
    if (!selectedTenant) return
    addDomainMutation.mutate({ tenantId: selectedTenant.id, values })
  }

  const renderTenantsTable = () => (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Tenant Directory</h2>
          <p className="mt-1 text-sm text-slate-500">Each tenant includes plan, module, domain, and status state.</p>
        </div>
        <button onClick={() => setIsTenantModalOpen(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          Onboard Tenant
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Plan</th>
              <th>Primary Domain</th>
              <th>Modules</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-500">Loading tenants...</td>
              </tr>
            ) : tenants?.length ? (
              tenants.map((tenant) => {
                const primaryDomain = tenant.domains.find((domain) => domain.is_primary)?.host ?? 'Not assigned'
                return (
                  <tr key={tenant.id}>
                    <td>
                      <div className="font-semibold text-slate-900">{tenant.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{tenant.email}</div>
                    </td>
                    <td><span className="badge badge-brand uppercase">{tenant.plan}</span></td>
                    <td className="text-slate-600">{primaryDomain}</td>
                    <td className="text-slate-600">{tenant.modules.filter((module) => module.is_enabled).length} enabled</td>
                    <td>
                      <span className={`badge ${tenant.is_suspended ? 'badge-danger' : 'badge-success'}`}>
                        {tenant.is_suspended ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTenant(tenant)
                            setIsModulesModalOpen(true)
                          }}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Modules
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTenant(tenant)
                            setIsDomainModalOpen(true)
                            resetDomain({ host: tenant.domains.find((domain) => domain.is_primary)?.host ?? '', is_primary: true })
                          }}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Domain
                        </button>
                        {tenant.is_suspended ? (
                          <button
                            type="button"
                            onClick={() => reactivateMutation.mutate(tenant.id)}
                            className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            <Power className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => suspendMutation.mutate(tenant.id)}
                            className="rounded-xl border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
                          >
                            <PowerOff className="h-4 w-4" />
                          </button>
                        )}
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
  )

  const renderDomains = () => (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Tenant Domains</h2>
        <p className="mt-1 text-sm text-slate-500">Primary domains and subdomains assigned to customer environments.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Domain</th>
              <th>Primary</th>
              <th>Status</th>
              <th>Plan</th>
            </tr>
          </thead>
          <tbody>
            {domainRows.length ? domainRows.map((row) => (
              <tr key={`${row.tenantName}-${row.host}`}>
                <td className="font-semibold text-slate-900">{row.tenantName}</td>
                <td>{row.host}</td>
                <td>{row.isPrimary ? 'Yes' : 'No'}</td>
                <td><span className="badge badge-neutral uppercase">{row.status}</span></td>
                <td><span className="badge badge-brand uppercase">{row.plan}</span></td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-500">No domains assigned yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderPlans = () => (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      {(catalog?.plans ?? []).map((plan) => (
        <div key={plan.code} className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{plan.code}</div>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">{plan.name}</h2>
            </div>
            <CreditCard className="h-5 w-5 text-slate-700" />
          </div>
          <p className="mt-3 text-sm text-slate-500">{plan.description}</p>
          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {plan.modules.length} included modules
          </div>
        </div>
      ))}
    </div>
  )

  const renderModules = () => (
    <div className="space-y-5">
      {groupedModules.map(([category, modules]) => (
        <div key={category} className="card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold capitalize text-slate-900">{category.replace(/_/g, ' ')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Description</th>
                  <th>Core</th>
                  <th>Monthly Price</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((module) => (
                  <tr key={module.key}>
                    <td className="font-semibold text-slate-900">{module.name}</td>
                    <td className="text-slate-500">{module.description}</td>
                    <td>{module.is_core ? <span className="badge badge-brand">Core</span> : <span className="badge badge-neutral">Optional</span>}</td>
                    <td>{formatMoney(monthlyPriceMap.get(module.key)?.price ?? null, monthlyPriceMap.get(module.key)?.currency ?? 'UGX')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )

  const renderBilling = () => (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="kpi-card"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total Tenants</div><div className="mt-3 text-3xl font-bold text-slate-900">{billing?.total_tenants ?? 0}</div></div>
        <div className="kpi-card"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Active</div><div className="mt-3 text-3xl font-bold text-slate-900">{billing?.active_tenants ?? 0}</div></div>
        <div className="kpi-card"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Suspended</div><div className="mt-3 text-3xl font-bold text-slate-900">{billing?.suspended_tenants ?? 0}</div></div>
        <div className="kpi-card"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Expiring Soon</div><div className="mt-3 text-3xl font-bold text-slate-900">{billing?.expiring_soon ?? 0}</div></div>
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Subscription Status</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Billing Cycle</th>
                <th>Expiry</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(billing?.tenants ?? []).map((row) => (
                <tr key={row.tenant_id}>
                  <td className="font-semibold text-slate-900">{row.tenant_name}</td>
                  <td><span className="badge badge-brand uppercase">{row.plan}</span></td>
                  <td><span className="badge badge-neutral uppercase">{row.status}</span></td>
                  <td className="capitalize">{row.billing_cycle}</td>
                  <td>{row.expiry_date ?? 'Open'}</td>
                  <td>{formatMoney(row.amount, row.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderSection = () => {
    switch (section) {
      case 'domains':
        return renderDomains()
      case 'plans':
        return renderPlans()
      case 'modules':
        return renderModules()
      case 'billing':
        return renderBilling()
      case 'control':
      case 'tenants':
      default:
        return renderTenantsTable()
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">{meta.title}</h1>
          <p className="section-subtitle">{meta.subtitle}</p>
        </div>
      </div>

      {(section === 'tenants' || section === 'control') && billing ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="kpi-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tenants</div>
                <div className="mt-3 text-3xl font-bold text-slate-900">{billing.total_tenants}</div>
              </div>
              <Building2 className="h-5 w-5 text-slate-700" />
            </div>
          </div>
          <div className="kpi-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Domains</div>
                <div className="mt-3 text-3xl font-bold text-slate-900">{domainRows.length}</div>
              </div>
              <Globe className="h-5 w-5 text-slate-600" />
            </div>
          </div>
          <div className="kpi-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Plans</div>
                <div className="mt-3 text-3xl font-bold text-slate-900">{catalog?.plans.length ?? 0}</div>
              </div>
              <Layers3 className="h-5 w-5 text-amber-500" />
            </div>
          </div>
          <div className="kpi-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Expiring Soon</div>
                <div className="mt-3 text-3xl font-bold text-slate-900">{billing.expiring_soon}</div>
              </div>
              <BadgeDollarSign className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </div>
      ) : null}

      {renderSection()}

      <Modal
        isOpen={isTenantModalOpen}
        onClose={() => {
          setIsTenantModalOpen(false)
          reset()
        }}
        title="Onboard Tenant"
        description="Create the tenant, assign the plan, and provision the initial domain and subscription."
      >
        <form onSubmit={handleSubmit(onSubmitTenant)} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="form-label">Tenant / Farm Name</label>
            <input className="form-input" {...register('name')} />
            {errors.name ? <p className="form-error">{errors.name.message}</p> : null}
          </div>
          <div>
            <label className="form-label">Business Name</label>
            <input className="form-input" {...register('business_name')} />
          </div>
          <div>
            <label className="form-label">Contact Person</label>
            <input className="form-input" {...register('contact_person')} />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input type="email" className="form-input" {...register('email')} />
            {errors.email ? <p className="form-error">{errors.email.message}</p> : null}
          </div>
          <div>
            <label className="form-label">Phone</label>
            <input className="form-input" {...register('phone')} />
          </div>
          <div>
            <label className="form-label">Domain / Subdomain</label>
            <input className="form-input" placeholder="farm.example.com" {...register('domain')} />
          </div>
          <div>
            <label className="form-label">Plan</label>
            <select className="form-input" {...register('plan')}>
              {(catalog?.plans ?? []).map((plan) => <option key={plan.code} value={plan.code}>{plan.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Billing Cycle</label>
            <select className="form-input" {...register('billing_cycle')}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <div>
            <label className="form-label">Subscription Start</label>
            <input type="date" className="form-input" {...register('subscription_start')} />
          </div>
          <div>
            <label className="form-label">Subscription Expiry</label>
            <input type="date" className="form-input" {...register('subscription_expiry')} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Notes</label>
            <textarea className="form-input min-h-[108px]" {...register('notes')} />
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
        isOpen={isModulesModalOpen}
        onClose={() => {
          setIsModulesModalOpen(false)
          setSelectedTenant(null)
        }}
        title={selectedTenant ? `Module Access - ${selectedTenant.name}` : 'Module Access'}
        description="Enable or disable modules per tenant. Backend access is enforced immediately."
      >
        <div className="space-y-5">
          {groupedModules.map(([category, modules]) => (
            <div key={category}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{category.replace(/_/g, ' ')}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {modules.map((module) => {
                  const enabled = !!selectedTenant?.modules.find((tenantModule) => tenantModule.module_key === module.key && tenantModule.is_enabled)
                  return (
                    <div key={module.key} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <div className="font-semibold text-slate-900">{module.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{module.description}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedTenant) return
                          toggleModuleMutation.mutate({ tenantId: selectedTenant.id, moduleKey: module.key, isEnabled: !enabled })
                          setSelectedTenant((current) => {
                            if (!current) return current
                            const modulesCopy = [...current.modules]
                            const index = modulesCopy.findIndex((item) => item.module_key === module.key)
                            if (index >= 0) {
                              modulesCopy[index] = { ...modulesCopy[index], is_enabled: !enabled }
                            } else {
                              modulesCopy.push({ id: 0, module_key: module.key, is_enabled: true })
                            }
                            return { ...current, modules: modulesCopy }
                          })
                        }}
                        className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-slate-700' : 'bg-slate-300'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        isOpen={isDomainModalOpen}
        onClose={() => {
          setIsDomainModalOpen(false)
          setSelectedTenant(null)
          resetDomain()
        }}
        title={selectedTenant ? `Assign Domain - ${selectedTenant.name}` : 'Assign Domain'}
        description="Set or replace the primary domain for the tenant."
      >
        <form onSubmit={handleSubmitDomain(onSubmitDomain)} className="space-y-4">
          <div>
            <label className="form-label">Domain / Subdomain</label>
            <input className="form-input" {...registerDomain('host')} />
            {domainErrors.host ? <p className="form-error">{domainErrors.host.message}</p> : null}
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input type="checkbox" {...registerDomain('is_primary')} />
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
    </div>
  )
}
