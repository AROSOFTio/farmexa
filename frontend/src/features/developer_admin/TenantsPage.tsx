import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Database, Edit, Power, PowerOff, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'
import { Modal } from '@/components/Modal'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

interface TenantModule {
  id: number
  module_key: string
  is_enabled: boolean
}

interface Tenant {
  id: int
  name: string
  slug: string
  email: string
  status: string
  plan: string
  is_suspended: boolean
  modules: TenantModule[]
}

const tenantSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  plan: z.string().min(1, 'Plan is required'),
})

type TenantFormValues = z.infer<typeof tenantSchema>

export function TenantsPage() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isModulesModalOpen, setIsModulesModalOpen] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)

  const { data: tenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ['dev_admin_tenants'],
    queryFn: async () => {
      const res = await api.get('/dev-admin/tenants')
      return res.data
    },
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: { plan: 'basic' }
  })

  const createMutation = useMutation({
    mutationFn: (data: TenantFormValues) => api.post('/dev-admin/tenants', { ...data, slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dev_admin_tenants'] })
      toast.success('Tenant created')
      closeModal()
    },
    onError: () => toast.error('Failed to create tenant')
  })

  const suspendMutation = useMutation({
    mutationFn: (id: number) => api.post(`/dev-admin/tenants/${id}/suspend`, { reason: 'Admin action' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dev_admin_tenants'] })
      toast.success('Tenant suspended')
    },
  })

  const reactivateMutation = useMutation({
    mutationFn: (id: number) => api.post(`/dev-admin/tenants/${id}/reactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dev_admin_tenants'] })
      toast.success('Tenant reactivated')
    },
  })
  
  const toggleModuleMutation = useMutation({
    mutationFn: (data: { tenantId: number, moduleKey: string, isEnabled: boolean }) => 
      api.post(`/dev-admin/tenants/${data.tenantId}/modules`, { module_key: data.moduleKey, is_enabled: data.isEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dev_admin_tenants'] })
      toast.success('Module updated')
    },
  })

  const openModal = () => {
    reset()
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    reset()
  }

  const openModulesModal = (tenant: Tenant) => {
    setSelectedTenant(tenant)
    setIsModulesModalOpen(true)
  }

  const closeModulesModal = () => {
    setIsModulesModalOpen(false)
    setSelectedTenant(null)
  }

  const onSubmit = (data: TenantFormValues) => {
    createMutation.mutate(data)
  }

  // List of all possible modules for custom toggling
  const ALL_MODULES = [
    'dashboard', 'houses', 'batches', 'egg_production', 'mortality', 'vaccination', 'growth_tracking',
    'feed_stock', 'feed_purchases', 'feed_consumption', 'feed_suppliers',
    'inventory_items', 'inventory_movements', 'medicine_supplies',
    'sales_orders', 'customers', 'invoices', 'payments',
    'slaughter_records', 'slaughter_outputs',
    'expenses', 'income', 'profit_loss',
    'reports', 'users', 'settings'
  ]

  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Tenants (Customers)</h1>
          <p className="section-subtitle">Manage customer accounts, subscriptions, and module access.</p>
        </div>
        <button onClick={openModal} className="btn-primary">
          <Plus className="h-4 w-4" /> Add Tenant
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tenant Name</th>
                <th>Email</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Modules</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[var(--text-muted)]">Loading tenants...</td>
                </tr>
              ) : tenants?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[var(--text-muted)]">No tenants found.</td>
                </tr>
              ) : (
                tenants?.map((tenant) => (
                  <tr key={tenant.id} className={tenant.is_suspended ? 'opacity-60' : ''}>
                    <td className="font-semibold">{tenant.name}</td>
                    <td>{tenant.email}</td>
                    <td><span className="uppercase text-xs font-bold">{tenant.plan}</span></td>
                    <td>
                      <span className={`badge ${tenant.is_suspended ? 'badge-danger' : 'badge-success'}`}>
                        {tenant.is_suspended ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => openModulesModal(tenant)} className="text-[#1E7A3A] text-sm font-medium hover:underline flex items-center gap-1">
                        <ShieldCheck className="h-4 w-4" /> Manage Access
                      </button>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        {tenant.is_suspended ? (
                          <button onClick={() => reactivateMutation.mutate(tenant.id)} className="p-1.5 text-success hover:bg-success/10 rounded-lg transition-colors" title="Reactivate">
                            <Power className="h-4 w-4" />
                          </button>
                        ) : (
                          <button onClick={() => { if(confirm('Suspend tenant?')) suspendMutation.mutate(tenant.id) }} className="p-1.5 text-warning hover:bg-warning/10 rounded-lg transition-colors" title="Suspend">
                            <PowerOff className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Tenant Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title="Add New Tenant">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="form-label">Company/Farm Name</label>
            <input type="text" className="form-input" {...register('name')} />
            {errors.name && <p className="form-error">{errors.name.message}</p>}
          </div>

          <div>
            <label className="form-label">Admin Email</label>
            <input type="email" className="form-input" {...register('email')} />
            {errors.email && <p className="form-error">{errors.email.message}</p>}
          </div>

          <div>
            <label className="form-label">Subscription Plan</label>
            <select className="form-input" {...register('plan')}>
              <option value="basic">Basic (Core Features)</option>
              <option value="standard">Standard (Farm + Feed + Sales)</option>
              <option value="premium">Premium (All Features)</option>
              <option value="custom">Custom (Manual Configuration)</option>
            </select>
            {errors.plan && <p className="form-error">{errors.plan.message}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Tenant'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Manage Modules Modal */}
      <Modal isOpen={isModulesModalOpen} onClose={closeModulesModal} title={`Module Access: ${selectedTenant?.name}`}>
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Enable or disable specific modules for this tenant. This takes effect immediately.
          </p>
          
          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto p-2">
            {ALL_MODULES.map(moduleKey => {
              const tenantModule = selectedTenant?.modules.find(m => m.module_key === moduleKey)
              const isEnabled = tenantModule?.is_enabled ?? false

              return (
                <div key={moduleKey} className="flex items-center justify-between p-3 border border-[var(--border-subtle)] rounded-xl bg-[var(--surface-strong)]">
                  <span className="text-sm font-medium text-[var(--text-strong)]">{moduleKey.replace(/_/g, ' ')}</span>
                  <button 
                    onClick={() => {
                      if(selectedTenant) {
                        toggleModuleMutation.mutate({ tenantId: selectedTenant.id, moduleKey, isEnabled: !isEnabled })
                        // Optimistically update local state for snappier UI
                        setSelectedTenant(prev => {
                          if(!prev) return prev
                          const mods = [...prev.modules]
                          const idx = mods.findIndex(m => m.module_key === moduleKey)
                          if(idx >= 0) mods[idx].is_enabled = !isEnabled
                          else mods.push({ id: 0, module_key: moduleKey, is_enabled: !isEnabled })
                          return { ...prev, modules: mods }
                        })
                      }
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isEnabled ? 'bg-[#1E7A3A]' : 'bg-neutral-300 dark:bg-neutral-600'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              )
            })}
          </div>
          <div className="flex justify-end pt-4">
            <button type="button" onClick={closeModulesModal} className="btn-primary">Done</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
