import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CreditCard, Layers3, Wallet } from 'lucide-react'
import { toast } from 'sonner'

import api from '@/services/api'
import { useAuth } from '@/features/auth/AuthContext'

interface CatalogItem {
  key: string
  name: string
  category: string
  description: string | null
  is_core: boolean
  is_enabled: boolean
  monthly_price: string | null
  currency: string
}

interface UpgradeRequestItem {
  id: number
  module_key: string
  price: string
  currency: string
}

interface UpgradeInvoice {
  id: number
  invoice_number: string
  amount: string
  currency: string
  status: string
  due_date: string | null
  payment_reference: string | null
  payment_url: string | null
  paid_at: string | null
}

interface UpgradeRequest {
  id: number
  status: string
  billing_cycle: string
  total_amount: string
  currency: string
  notes: string | null
  paid_at: string | null
  activated_at: string | null
  created_at: string
  items: UpgradeRequestItem[]
  invoice: UpgradeInvoice | null
}

interface UpgradeOverview {
  tenant_id: number
  tenant_name: string
  current_plan: string
  billing_cycle: string
  enabled_modules: string[]
  catalog: CatalogItem[]
  requests: UpgradeRequest[]
}

function formatMoney(value: string | null | undefined, currency = 'UGX') {
  if (!value) return `${currency} 0`
  return `${currency} ${Number(value).toLocaleString()}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function UpgradeModulesPage() {
  const queryClient = useQueryClient()
  const { enabledModules, refetchMe, user } = useAuth()
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  const { data, isLoading } = useQuery<UpgradeOverview>({
    queryKey: ['subscription-module-overview'],
    queryFn: () => api.get('/subscriptions/modules').then((response) => response.data),
  })

  useEffect(() => {
    if (!data) return
    const backendEnabled = [...data.enabled_modules].sort().join(',')
    const sessionEnabled = [...enabledModules].sort().join(',')
    if (backendEnabled !== sessionEnabled) {
      refetchMe().catch(() => undefined)
    }
  }, [data, enabledModules, refetchMe])

  const optionalModules = useMemo(
    () => (data?.catalog ?? []).filter((module) => !module.is_core && !module.is_enabled),
    [data?.catalog]
  )

  const selectionTotal = useMemo(
    () =>
      optionalModules
        .filter((module) => selectedModules.includes(module.key))
        .reduce((sum, module) => sum + Number(module.monthly_price ?? 0), 0),
    [optionalModules, selectedModules]
  )

  const createRequest = useMutation({
    mutationFn: () =>
      api.post('/subscriptions/modules/requests', {
        module_keys: selectedModules,
        notes: notes || null,
      }),
    onSuccess: async () => {
      toast.success('Upgrade request created. Payment is required before modules are activated.')
      setSelectedModules([])
      setNotes('')
      await queryClient.invalidateQueries({ queryKey: ['subscription-module-overview'] })
      await refetchMe()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to create module upgrade request.')
    },
  })

  const pendingRequest = useMemo(
    () => (data?.requests ?? []).find((request) => ['pending_payment', 'paid'].includes(request.status)),
    [data?.requests]
  )

  const canRequest = selectedModules.length > 0 && !pendingRequest
  const roleName = user?.role?.name ?? ''
  const isTenantAdmin = !['developer_admin', 'super_manager'].includes(roleName)

  return (
    <div className="animate-fade-in space-y-6">
      <section className="section-header">
        <div>
          <h1 className="section-title">Upgrade Modules</h1>
          <p className="section-subtitle">
            Select paid add-on modules, generate a pending invoice, then wait for payment activation.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="kpi-card px-5 py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Current Plan</div>
          <div className="mt-2 text-[1.7rem] font-semibold text-[var(--text-strong)] capitalize">{data?.current_plan ?? '...'}</div>
        </div>
        <div className="kpi-card px-5 py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Enabled Modules</div>
          <div className="mt-2 text-[1.7rem] font-semibold text-[var(--text-strong)]">{data?.enabled_modules.length ?? 0}</div>
        </div>
        <div className="kpi-card px-5 py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Selected Total</div>
          <div className="mt-2 text-[1.7rem] font-semibold text-[var(--text-strong)]">{formatMoney(String(selectionTotal), data?.catalog[0]?.currency ?? 'UGX')}</div>
        </div>
      </section>

      {pendingRequest ? (
        <div className="card px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--text-strong)]">Upgrade request awaiting completion</div>
              <div className="mt-1 text-[13px] text-[var(--text-muted)]">
                Invoice {pendingRequest.invoice?.invoice_number ?? 'Pending'} | status {pendingRequest.status.replace(/_/g, ' ')}
              </div>
            </div>
            <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3 text-[13px] text-[var(--text-default)]">
              {formatMoney(pendingRequest.invoice?.amount, pendingRequest.invoice?.currency)}
              <div className="mt-1 text-[12px] text-[var(--text-muted)]">
                Payment ref: {pendingRequest.invoice?.payment_reference ?? 'Will be assigned by the payment gateway'}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)] px-5 py-4">
              <div className="flex items-center gap-3">
                <Layers3 className="h-4 w-4 text-[var(--brand-primary)]" />
                <div>
                  <h2 className="text-[1rem] font-semibold text-[var(--text-strong)]">Available add-on modules</h2>
                  <p className="mt-1 text-[13px] text-[var(--text-muted)]">Modules stay locked until payment is confirmed.</p>
                </div>
              </div>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              {isLoading ? (
                <div className="text-[13px] text-[var(--text-muted)]">Loading module catalog...</div>
              ) : optionalModules.length ? (
                optionalModules.map((module) => {
                  const active = selectedModules.includes(module.key)
                  return (
                    <button
                      key={module.key}
                      type="button"
                      onClick={() =>
                        setSelectedModules((current) =>
                          current.includes(module.key)
                            ? current.filter((item) => item !== module.key)
                            : [...current, module.key]
                        )
                      }
                      className={`rounded-[18px] border px-4 py-4 text-left transition-colors ${
                        active
                          ? 'border-[var(--brand-primary)] bg-[rgba(52,168,83,0.08)]'
                          : 'border-[var(--border-subtle)] bg-[var(--surface-card)] hover:bg-[var(--surface-soft)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--text-strong)]">{module.name}</div>
                          <div className="mt-1 text-[12px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{module.category.replace(/_/g, ' ')}</div>
                        </div>
                        {active ? <CheckCircle2 className="h-4 w-4 text-[var(--brand-primary)]" /> : null}
                      </div>
                      <p className="mt-3 text-[13px] text-[var(--text-muted)]">{module.description}</p>
                      <div className="mt-4 text-sm font-semibold text-[var(--text-strong)]">
                        {formatMoney(module.monthly_price, module.currency)} / {data?.billing_cycle ?? 'month'}
                      </div>
                    </button>
                  )
                })
              ) : (
                <div className="text-[13px] text-[var(--text-muted)]">No paid add-on modules are available right now.</div>
              )}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)] px-5 py-4">
              <h2 className="text-[1rem] font-semibold text-[var(--text-strong)]">Upgrade history</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Modules</th>
                    <th>Status</th>
                    <th>Invoice</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.requests ?? []).length ? (
                    data?.requests.map((request) => (
                      <tr key={request.id}>
                        <td>{formatDate(request.created_at)}</td>
                        <td>{request.items.map((item) => item.module_key.replace(/_/g, ' ')).join(', ')}</td>
                        <td><span className="badge badge-brand uppercase">{request.status.replace(/_/g, ' ')}</span></td>
                        <td>{request.invoice?.invoice_number ?? 'Pending'}</td>
                        <td>{formatMoney(request.total_amount, request.currency)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-[var(--text-muted)]">No module upgrade requests yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="card p-5">
          <div className="flex items-center gap-3">
            <Wallet className="h-4 w-4 text-[var(--brand-primary)]" />
            <div>
              <h2 className="text-[1rem] font-semibold text-[var(--text-strong)]">Selected upgrade</h2>
              <p className="mt-1 text-[13px] text-[var(--text-muted)]">Create a pending request before payment.</p>
            </div>
          </div>

          {!isTenantAdmin ? (
            <div className="mt-4 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3 text-[13px] text-[var(--text-muted)]">
              Platform administrator accounts use the developer admin workspace instead of tenant self-upgrade.
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {selectedModules.length ? selectedModules.map((moduleKey) => {
              const module = optionalModules.find((item) => item.key === moduleKey)
              if (!module) return null
              return (
                <div key={moduleKey} className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                  <div className="text-sm font-semibold text-[var(--text-strong)]">{module.name}</div>
                  <div className="mt-1 text-[12px] text-[var(--text-muted)]">{formatMoney(module.monthly_price, module.currency)}</div>
                </div>
              )
            }) : (
              <div className="rounded-[14px] border border-dashed border-[var(--border-subtle)] px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
                Select one or more modules to see the upgrade summary.
              </div>
            )}
          </div>

          <div className="mt-5">
            <label className="form-label">Notes for finance or approval</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="form-input min-h-[110px]"
              placeholder="Optional billing notes"
            />
          </div>

          <div className="mt-5 rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-4">
            <div className="flex items-center justify-between gap-3 text-sm font-semibold text-[var(--text-strong)]">
              <span>Total due</span>
              <span>{formatMoney(String(selectionTotal), data?.catalog[0]?.currency ?? 'UGX')}</span>
            </div>
            <div className="mt-2 text-[12px] text-[var(--text-muted)]">
              The backend will only activate modules after a successful payment callback.
            </div>
          </div>

          <button
            type="button"
            className="btn-primary mt-5 w-full"
            disabled={!canRequest || createRequest.isPending}
            onClick={() => createRequest.mutate()}
          >
            <CreditCard className="h-4 w-4" />
            {createRequest.isPending ? 'Submitting...' : 'Create Upgrade Request'}
          </button>
        </aside>
      </section>
    </div>
  )
}
