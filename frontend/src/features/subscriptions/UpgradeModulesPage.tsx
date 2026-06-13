import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CreditCard, Layers3, Sparkles, Wallet } from 'lucide-react'
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
  is_addon: boolean
  coming_soon: boolean
  monthly_price: string | null
  currency: string
}

interface AddonPackage {
  key: string
  name: string
  description: string | null
  modules: string[]
  price: string | null
  currency: string
  available: boolean
  coming_soon: boolean
  is_enabled: boolean
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
  packages: AddonPackage[]
  requests: UpgradeRequest[]
}

function formatMoney(value: string | number | null | undefined, currency = 'USD') {
  const amount = Number(value ?? 0)
  if (currency === 'USD') return `$${amount.toLocaleString()}`
  return `${currency} ${amount.toLocaleString()}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function UpgradeModulesPage() {
  const queryClient = useQueryClient()
  const { enabledModules, refetchMe, user } = useAuth()
  const [selectedPackages, setSelectedPackages] = useState<string[]>([])
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

  const packages = data?.packages ?? []
  const selectablePackages = useMemo(
    () => packages.filter((pkg) => pkg.available && !pkg.is_enabled),
    [packages]
  )

  const selectionTotal = useMemo(
    () =>
      selectablePackages
        .filter((pkg) => selectedPackages.includes(pkg.key))
        .reduce((sum, pkg) => sum + Number(pkg.price ?? 0), 0),
    [selectablePackages, selectedPackages]
  )

  const currency = packages[0]?.currency ?? 'USD'

  const createRequest = useMutation({
    mutationFn: () => {
      const moduleKeys = selectablePackages
        .filter((pkg) => selectedPackages.includes(pkg.key))
        .flatMap((pkg) => pkg.modules)
      return api.post('/subscriptions/modules/requests', {
        module_keys: moduleKeys,
        notes: notes || null,
      })
    },
    onSuccess: async () => {
      toast.success('Add-on request created. Payment is required before it is activated.')
      setSelectedPackages([])
      setNotes('')
      await queryClient.invalidateQueries({ queryKey: ['subscription-module-overview'] })
      await refetchMe()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to create add-on request.')
    },
  })

  const checkout = useMutation({
    mutationFn: (invoiceId: number) =>
      api.post(`/subscriptions/payments/invoices/${invoiceId}/checkout`).then((response) => response.data as { redirect_url: string }),
    onSuccess: (data) => {
      window.location.assign(data.redirect_url)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Could not start Pesapal checkout.')
    },
  })

  const pendingRequest = useMemo(
    () => (data?.requests ?? []).find((request) => ['pending_payment', 'paid'].includes(request.status)),
    [data?.requests]
  )

  const roleName = user?.role?.name ?? ''
  const isTenantAdmin = !['developer_admin', 'super_manager'].includes(roleName)
  const canRequest = selectedPackages.length > 0 && !pendingRequest && isTenantAdmin

  const togglePackage = (key: string) =>
    setSelectedPackages((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    )

  return (
    <div className="animate-fade-in space-y-6">
      <section className="section-header">
        <div>
          <h1 className="section-title">Add-ons</h1>
          <p className="section-subtitle">
            Browse add-ons available on top of your plan. Pick what you need, generate an invoice, and it activates after payment.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="metric-card">
          <div className="metric-label">Current Plan</div>
          <div className="metric-value capitalize">{data?.current_plan ?? '...'}</div>
          <div className="metric-note">Your base subscription plan.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Enabled Modules</div>
          <div className="metric-value">{data?.enabled_modules.length ?? 0}</div>
          <div className="metric-note">Modules already active in your workspace.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Selected Total</div>
          <div className="metric-value">{formatMoney(selectionTotal, currency)}</div>
          <div className="metric-note">Monthly amount for the add-ons selected below.</div>
        </div>
      </section>

      {pendingRequest ? (
        <div className="card px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--text-strong)]">Add-on request awaiting completion</div>
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
            {pendingRequest.invoice?.status === 'pending' ? (
              <button type="button" className="btn-primary" disabled={checkout.isPending} onClick={() => checkout.mutate(pendingRequest.invoice!.id)}>
                <CreditCard className="h-4 w-4" />
                Pay with Pesapal
              </button>
            ) : null}
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
                  <h2 className="text-[1rem] font-semibold text-[var(--text-strong)]">Available add-ons</h2>
                  <p className="mt-1 text-[13px] text-[var(--text-muted)]">Add-ons stay locked until payment is confirmed.</p>
                </div>
              </div>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              {isLoading ? (
                <div className="text-[13px] text-[var(--text-muted)]">Loading add-ons...</div>
              ) : packages.length ? (
                packages.map((pkg) => {
                  const active = selectedPackages.includes(pkg.key)
                  const locked = pkg.coming_soon || pkg.is_enabled || !pkg.available
                  return (
                    <button
                      key={pkg.key}
                      type="button"
                      disabled={locked}
                      onClick={() => !locked && togglePackage(pkg.key)}
                      className={`rounded-[16px] border px-3.5 py-3 text-left transition-colors ${
                        active
                          ? 'border-brand-200 bg-brand-50'
                          : 'border-[var(--border-subtle)] bg-[var(--surface-card)]'
                      } ${locked ? 'cursor-not-allowed opacity-70' : 'hover:bg-[var(--surface-soft)]'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {pkg.coming_soon ? <Sparkles className="h-4 w-4 text-amber-500" /> : null}
                          <div className="text-[13px] font-semibold text-[var(--text-strong)]">{pkg.name}</div>
                        </div>
                        {pkg.coming_soon ? (
                          <span className="badge badge-neutral uppercase">Coming soon</span>
                        ) : pkg.is_enabled ? (
                          <span className="badge badge-brand uppercase">Active</span>
                        ) : active ? (
                          <CheckCircle2 className="h-4 w-4 text-[var(--brand-primary)]" />
                        ) : null}
                      </div>
                      <p className="mt-2 text-[12px] leading-5 text-[var(--text-muted)]">{pkg.description}</p>
                      <div className="mt-3 text-[13px] font-semibold text-[var(--text-strong)]">
                        {pkg.coming_soon
                          ? 'Coming soon'
                          : `${formatMoney(pkg.price, pkg.currency)} / month`}
                      </div>
                    </button>
                  )
                })
              ) : (
                <div className="text-[13px] text-[var(--text-muted)]">No add-ons are available right now.</div>
              )}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)] px-5 py-4">
              <h2 className="text-[1rem] font-semibold text-[var(--text-strong)]">Add-on history</h2>
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
                      <td colSpan={5} className="py-10 text-center text-[var(--text-muted)]">No add-on requests yet.</td>
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
              <h2 className="text-[1rem] font-semibold text-[var(--text-strong)]">Selected add-ons</h2>
              <p className="mt-1 text-[13px] text-[var(--text-muted)]">Create a pending request before payment.</p>
            </div>
          </div>

          {!isTenantAdmin ? (
            <div className="mt-4 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3 text-[13px] text-[var(--text-muted)]">
              Platform administrator accounts use the developer admin workspace instead of tenant self-upgrade.
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {selectedPackages.length ? selectedPackages.map((pkgKey) => {
              const pkg = selectablePackages.find((item) => item.key === pkgKey)
              if (!pkg) return null
              return (
                <div key={pkgKey} className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                  <div className="text-sm font-semibold text-[var(--text-strong)]">{pkg.name}</div>
                  <div className="mt-1 text-[12px] text-[var(--text-muted)]">{formatMoney(pkg.price, pkg.currency)} / month</div>
                </div>
              )
            }) : (
              <div className="rounded-[14px] border border-dashed border-[var(--border-subtle)] px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
                Select one or more add-ons to see the summary.
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
              <span>{formatMoney(selectionTotal, currency)} / month</span>
            </div>
            <div className="mt-2 text-[12px] text-[var(--text-muted)]">
              Add-ons are activated only after a successful payment callback.
            </div>
          </div>

          <button
            type="button"
            className="btn-primary mt-5 w-full"
            disabled={!canRequest || createRequest.isPending}
            onClick={() => createRequest.mutate()}
          >
            <CreditCard className="h-4 w-4" />
            {createRequest.isPending ? 'Submitting...' : 'Request Add-ons'}
          </button>
        </aside>
      </section>
    </div>
  )
}
