import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Globe2, Headphones, Landmark, MessageSquare, PackageCheck, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import api from '@/services/api'
import { useAuth } from '@/features/auth/AuthContext'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'

interface Invoice {
  id: number
  invoice_number: string
  amount: string | number
  currency: string
  status: string
  due_date: string | null
  payment_reference?: string | null
  payment_url?: string | null
  paid_at?: string | null
}

interface DomainMessage {
  id: number
  sender_role: string
  message: string
  email_sent_at: string | null
  created_at: string
}

interface DomainRequest {
  id: number
  host: string
  status: string
  price_amount: string | number
  currency: string
  billing_period: string
  dns_record_type: string | null
  dns_record_name: string | null
  dns_record_value: string | null
  wants_primary: boolean
  admin_notes: string | null
  last_error: string | null
  created_at: string
  paid_at: string | null
  activated_at: string | null
  invoice: Invoice | null
  messages: DomainMessage[]
}

interface UpgradeOverview {
  tenant_name: string
  current_plan: string
  billing_cycle: string
  enabled_modules: string[]
  custom_domain_price: string | number
  custom_domain_currency: string
  custom_domain_allowed_tlds: string[]
  platform_domain: string
  requests: Array<{
    id: number
    status: string
    total_amount: string | number
    currency: string
    created_at?: string
    invoice?: Invoice | null
  }>
  domain_requests: DomainRequest[]
}

function useOverview() {
  return useQuery({
    queryKey: ['subscription-overview'],
    queryFn: () => api.get<UpgradeOverview>('/subscriptions/modules').then((response) => response.data),
  })
}

function formatMoney(value: string | number | null | undefined, currency = 'UGX') {
  return `${currency} ${Number(value ?? 0).toLocaleString()}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusLabel(value: string) {
  return value.replace(/_/g, ' ')
}

function statusClass(value: string) {
  if (['active', 'successful', 'dns_verified'].includes(value)) return 'badge badge-success'
  if (['failed', 'rejected', 'cancelled'].includes(value)) return 'badge badge-danger'
  return 'badge badge-brand'
}

function useCheckout() {
  return useMutation({
    mutationFn: (invoiceId: number) =>
      api.post(`/subscriptions/payments/invoices/${invoiceId}/checkout`).then((response) => response.data as { redirect_url: string }),
    onSuccess: (data) => {
      window.location.assign(data.redirect_url)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Could not start Pesapal checkout.')
    },
  })
}

export function SubscriptionPage() {
  const { tenant, enabledModules } = useAuth()
  const { data } = useOverview()
  const modules = data?.enabled_modules ?? enabledModules ?? []

  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Subscription</h1>
          <p className="section-subtitle">Manage your Farmexa plan, active modules, upgrades, and custom domain add-ons.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/account/domains" className="btn-secondary">
            <Globe2 className="h-4 w-4" />
            Custom domains
          </Link>
          <Link to="/subscription/upgrade" className="btn-primary">
            <PackageCheck className="h-4 w-4" />
            Upgrade modules
          </Link>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="metric-card">
          <div className="metric-label">Current plan</div>
          <div className="metric-value capitalize">{data?.current_plan ?? tenant?.plan ?? 'Trial'}</div>
          <div className="metric-note">{data?.billing_cycle ?? 'monthly'} billing cycle.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Status</div>
          <div className="metric-value capitalize">{tenant?.subscription_status ?? 'trial'}</div>
          <div className="metric-note">Workspace access state.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Enabled modules</div>
          <div className="metric-value">{modules.length}</div>
          <div className="metric-note">Operational areas available to your team.</div>
        </div>
      </div>
      <div className="card p-6">
        <h2 className="text-xl font-bold text-ink-900">Active modules</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {modules.map((module) => <span key={module} className="badge badge-brand">{module.split('_').join(' ')}</span>)}
        </div>
      </div>
    </div>
  )
}

export function BillingPage() {
  const { data } = useOverview()
  const checkout = useCheckout()
  const invoices = useMemo(() => {
    const moduleInvoices = (data?.requests ?? []).map((request) => request.invoice).filter(Boolean) as Invoice[]
    const domainInvoices = (data?.domain_requests ?? []).map((request) => request.invoice).filter(Boolean) as Invoice[]
    return [...moduleInvoices, ...domainInvoices].sort((a, b) => String(b.invoice_number).localeCompare(String(a.invoice_number)))
  }, [data])

  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Billing</h1>
          <p className="section-subtitle">Review invoices and pay securely through Pesapal.</p>
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-neutral-150 px-6 py-5">
          <h2 className="text-lg font-bold text-ink-900">Invoices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Invoice</th>
                <th>Status</th>
                <th>Due date</th>
                <th>Amount</th>
                <th className="pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td className="pl-6 py-12 text-sm text-ink-500" colSpan={5}>No invoices yet.</td></tr>
              ) : invoices.map((invoice) => (
                <tr key={invoice.invoice_number}>
                  <td className="pl-6">
                    <div className="font-bold text-ink-900">{invoice.invoice_number}</div>
                    <div className="text-xs text-ink-500">{invoice.payment_reference || 'Pesapal reference assigned at checkout'}</div>
                  </td>
                  <td><span className={statusClass(invoice.status)}>{statusLabel(invoice.status)}</span></td>
                  <td>{formatDate(invoice.due_date)}</td>
                  <td className="font-bold">{formatMoney(invoice.amount, invoice.currency)}</td>
                  <td className="pr-6 text-right">
                    {invoice.status === 'pending' ? (
                      <button type="button" className="btn-primary btn-sm" disabled={checkout.isPending} onClick={() => checkout.mutate(invoice.id)}>
                        <CreditCard className="h-4 w-4" />
                        Pay now
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function DomainsPage() {
  const queryClient = useQueryClient()
  const { data } = useOverview()
  const checkout = useCheckout()
  const [host, setHost] = useState('')
  const [messageByRequest, setMessageByRequest] = useState<Record<number, string>>({})

  const createRequest = useMutation({
    mutationFn: () => api.post('/subscriptions/domains/requests', { host, is_primary: true }),
    onSuccess: async () => {
      toast.success('Custom domain request created. Complete payment to continue DNS setup.')
      setHost('')
      await queryClient.invalidateQueries({ queryKey: ['subscription-overview'] })
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail ?? 'Could not create custom domain request.'),
  })

  const sendMessage = useMutation({
    mutationFn: ({ requestId, message }: { requestId: number; message: string }) =>
      api.post(`/subscriptions/domains/requests/${requestId}/messages`, { message }),
    onSuccess: async (_, variables) => {
      toast.success('Message sent.')
      setMessageByRequest((current) => ({ ...current, [variables.requestId]: '' }))
      await queryClient.invalidateQueries({ queryKey: ['subscription-overview'] })
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail ?? 'Could not send message.'),
  })

  const domainRequests = data?.domain_requests ?? []

  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Custom Domains</h1>
          <p className="section-subtitle">Connect your own .com, .org, or .co domain for {formatMoney(data?.custom_domain_price, data?.custom_domain_currency)} per year.</p>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {domainRequests.length ? domainRequests.map((request) => (
            <div key={request.id} className="card overflow-hidden">
              <div className="border-b border-[var(--border-subtle)] px-5 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[var(--text-strong)]">{request.host}</h2>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <span className={statusClass(request.status)}>{statusLabel(request.status)}</span>
                      {request.invoice ? <span className={statusClass(request.invoice.status)}>invoice {statusLabel(request.invoice.status)}</span> : null}
                    </div>
                  </div>
                  {request.invoice?.status === 'pending' ? (
                    <button type="button" className="btn-primary btn-sm" disabled={checkout.isPending} onClick={() => checkout.mutate(request.invoice!.id)}>
                      <CreditCard className="h-4 w-4" />
                      Pay {formatMoney(request.invoice.amount, request.invoice.currency)}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-3">
                <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                  <div className="text-xs font-bold uppercase text-[var(--text-muted)]">DNS type</div>
                  <div className="mt-1 font-semibold text-[var(--text-strong)]">{request.dns_record_type ?? '-'}</div>
                </div>
                <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                  <div className="text-xs font-bold uppercase text-[var(--text-muted)]">Name</div>
                  <div className="mt-1 break-all font-semibold text-[var(--text-strong)]">{request.dns_record_name ?? '-'}</div>
                </div>
                <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                  <div className="text-xs font-bold uppercase text-[var(--text-muted)]">Value</div>
                  <div className="mt-1 break-all font-semibold text-[var(--text-strong)]">{request.dns_record_value ?? data?.platform_domain ?? '-'}</div>
                </div>
              </div>

              {request.last_error ? (
                <div className="mx-5 mb-5 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{request.last_error}</div>
              ) : null}

              <div className="border-t border-[var(--border-subtle)] p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--text-strong)]">
                  <MessageSquare className="h-4 w-4" />
                  Request messages
                </div>
                <div className="space-y-2">
                  {request.messages.length ? request.messages.map((message) => (
                    <div key={message.id} className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                      <div className="text-xs font-bold uppercase text-[var(--text-muted)]">{message.sender_role} | {formatDate(message.created_at)}</div>
                      <div className="mt-1 text-sm text-[var(--text-strong)]">{message.message}</div>
                    </div>
                  )) : <div className="text-sm text-[var(--text-muted)]">No messages yet.</div>}
                </div>
                <div className="mt-4 flex gap-2">
                  <input
                    className="form-input"
                    value={messageByRequest[request.id] ?? ''}
                    onChange={(event) => setMessageByRequest((current) => ({ ...current, [request.id]: event.target.value }))}
                    placeholder="Reply to Farmexa support"
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={sendMessage.isPending || !(messageByRequest[request.id] ?? '').trim()}
                    onClick={() => sendMessage.mutate({ requestId: request.id, message: messageByRequest[request.id] ?? '' })}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )) : (
            <div className="card px-5 py-10 text-sm text-[var(--text-muted)]">No custom domain requests yet.</div>
          )}
        </div>

        <aside className="card p-5">
          <Globe2 className="h-6 w-6 text-[var(--brand-primary)]" />
          <h2 className="mt-3 text-lg font-bold text-[var(--text-strong)]">Request a domain</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Enter a domain you already own. After Pesapal payment, create the DNS record shown here and Farmexa will verify it before activation.</p>
          <div className="mt-5">
            <label className="form-label">Domain</label>
            <input className="form-input" value={host} onChange={(event) => setHost(event.target.value)} placeholder="yourfarm.com" />
          </div>
          <button type="button" className="btn-primary mt-5 w-full" disabled={createRequest.isPending || !host.trim()} onClick={() => createRequest.mutate()}>
            <CreditCard className="h-4 w-4" />
            Request and invoice
          </button>
        </aside>
      </section>
    </div>
  )
}

export function SupportPage() {
  const { settings } = usePlatformSettings()
  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Support</h1>
          <p className="section-subtitle">Get help with your workspace, billing, domain, or operations modules.</p>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card p-6">
          <Headphones className="h-8 w-8 text-brand-700" />
          <h2 className="mt-4 text-xl font-bold text-ink-900">Email support</h2>
          <p className="mt-2 text-sm text-ink-500">{settings.support_email}</p>
        </div>
        <div className="card p-6">
          <Landmark className="h-8 w-8 text-brand-700" />
          <h2 className="mt-4 text-xl font-bold text-ink-900">Workspace</h2>
          <p className="mt-2 text-sm text-ink-500">Include your farm name and workspace URL when contacting support.</p>
        </div>
        <div className="card p-6">
          <CreditCard className="h-8 w-8 text-brand-700" />
          <h2 className="mt-4 text-xl font-bold text-ink-900">Billing</h2>
          <p className="mt-2 text-sm text-ink-500">Payments are processed through live Pesapal checkout.</p>
        </div>
      </div>
    </div>
  )
}
