import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, Headphones, Landmark, PackageCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import api from '@/services/api'
import { useAuth } from '@/features/auth/AuthContext'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'

interface UpgradeOverview {
  tenant_name: string
  current_plan: string
  billing_cycle: string
  enabled_modules: string[]
  requests: Array<{
    id: number
    status: string
    total_amount: number
    currency: string
    created_at?: string
    invoice?: {
      invoice_number: string
      amount: number
      currency: string
      status: string
      due_date: string
      payment_reference?: string | null
    } | null
  }>
}

function useOverview() {
  return useQuery({
    queryKey: ['subscription-overview'],
    queryFn: () => api.get<UpgradeOverview>('/subscriptions/modules').then((response) => response.data),
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
          <p className="section-subtitle">Manage your Farmexa plan, active modules, and upgrade requests.</p>
        </div>
        <Link to="/subscription/upgrade" className="btn-primary">
          <PackageCheck className="h-4 w-4" />
          Upgrade modules
        </Link>
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
  const invoices = useMemo(() => (data?.requests ?? []).map((request) => request.invoice).filter(Boolean), [data])

  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Billing</h1>
          <p className="section-subtitle">Review subscription invoices and payment references.</p>
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-neutral-150 px-6 py-5">
          <h2 className="text-lg font-bold text-ink-900">Subscription invoices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Invoice</th>
                <th>Status</th>
                <th>Due date</th>
                <th className="pr-6">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td className="pl-6 py-12 text-sm text-ink-500" colSpan={4}>No subscription invoices yet.</td></tr>
              ) : invoices.map((invoice: any) => (
                <tr key={invoice.invoice_number}>
                  <td className="pl-6">
                    <div className="font-bold text-ink-900">{invoice.invoice_number}</div>
                    <div className="text-xs text-ink-500">{invoice.payment_reference || 'No payment reference'}</div>
                  </td>
                  <td><span className="badge badge-brand">{invoice.status}</span></td>
                  <td>{invoice.due_date}</td>
                  <td className="pr-6 font-bold">{invoice.currency} {Number(invoice.amount).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
          <p className="mt-2 text-sm text-ink-500">Subscription and payment support is handled by the Farmexa team.</p>
        </div>
      </div>
    </div>
  )
}
