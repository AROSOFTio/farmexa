import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, DollarSign, PauseCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import api from '@/services/api'
import { getErrorMessage } from '@/lib/errors'

interface Affiliate {
  id: number
  full_name: string
  email: string
  phone?: string | null
  country?: string | null
  organization?: string | null
  status: string
  referral_code: string
  created_at: string
}

interface Rule {
  id: number
  plan_code: string
  commission_percent: string
  is_active: boolean
  recurring: boolean
}

interface Commission {
  id: number
  affiliate_id: number
  tenant_id: number
  plan_code: string
  commission_amount: string
  currency: string
  status: string
}

export function AffiliatesPage() {
  const qc = useQueryClient()
  const affiliates = useQuery({ queryKey: ['admin-affiliates'], queryFn: async () => (await api.get<Affiliate[]>('/affiliates/admin/affiliates')).data })
  const overview = useQuery({ queryKey: ['admin-affiliate-overview'], queryFn: async () => (await api.get('/affiliates/admin/overview')).data })
  const rules = useQuery({ queryKey: ['admin-affiliate-rules'], queryFn: async () => (await api.get<Rule[]>('/affiliates/admin/rules')).data })
  const commissions = useQuery({ queryKey: ['admin-affiliate-commissions'], queryFn: async () => (await api.get<Commission[]>('/affiliates/admin/commissions')).data })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.post(`/affiliates/admin/affiliates/${id}/status`, { status, send_email: true }),
    onSuccess: () => {
      toast.success('Affiliate status updated.')
      qc.invalidateQueries({ queryKey: ['admin-affiliates'] })
      qc.invalidateQueries({ queryKey: ['admin-affiliate-overview'] })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not update affiliate.')),
  })

  const updateRule = useMutation({
    mutationFn: ({ planCode, percent }: { planCode: string; percent: number }) => api.put(`/affiliates/admin/rules/${planCode}`, { commission_percent: percent, is_active: true, recurring: false }),
    onSuccess: () => {
      toast.success('Commission rate updated.')
      qc.invalidateQueries({ queryKey: ['admin-affiliate-rules'] })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not update commission rate.')),
  })

  const markPaid = useMutation({
    mutationFn: (id: number) => api.post(`/affiliates/admin/commissions/${id}/paid`, {}),
    onSuccess: () => {
      toast.success('Commission marked paid.')
      qc.invalidateQueries({ queryKey: ['admin-affiliate-commissions'] })
      qc.invalidateQueries({ queryKey: ['admin-affiliate-overview'] })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not mark commission paid.')),
  })

  return (
    <div className="space-y-6">
      <div className="section-header">
        <div>
          <div className="page-eyebrow">Developer Admin</div>
          <h1 className="page-title">Affiliate Marketing</h1>
          <p className="page-subtitle">Approve affiliates, manage 20% default tier commissions, and track referral payouts.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Total affiliates', overview.data?.total_affiliates ?? 0],
          ['Pending approval', overview.data?.pending_affiliates ?? 0],
          ['Converted referrals', overview.data?.converted_referrals ?? 0],
          ['Pending commission', overview.data ? `${overview.data.pending_commission_amount}` : '0'],
        ].map(([label, value]) => (
          <div key={label} className="metric-card">
            <div className="metric-label">{label}</div>
            <div className="metric-value">{value}</div>
          </div>
        ))}
      </div>

      <section className="card p-5">
        <h2 className="text-lg font-black">Commission rates by plan</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(rules.data ?? []).map((rule) => (
            <form
              key={rule.plan_code}
              className="rounded-[8px] border border-neutral-200 p-4"
              onSubmit={(event) => {
                event.preventDefault()
                const form = new FormData(event.currentTarget)
                updateRule.mutate({ planCode: rule.plan_code, percent: Number(form.get('percent')) })
              }}
            >
              <div className="font-black uppercase">{rule.plan_code}</div>
              <label className="form-label mt-3">Commission percent</label>
              <input className="form-input" name="percent" type="number" min={0} max={100} step="0.01" defaultValue={String(rule.commission_percent)} />
              <p className="mt-2 text-xs text-ink-500">First successful subscription payment only. Default is 20%.</p>
              <button className="btn-primary mt-3 h-9 px-4 text-xs">Save rate</button>
            </form>
          ))}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-neutral-200 p-5">
          <h2 className="text-lg font-black">Affiliate applications</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th className="pl-6">Affiliate</th>
              <th>Code</th>
              <th>Status</th>
              <th className="pr-6">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(affiliates.data ?? []).map((affiliate) => (
              <tr key={affiliate.id}>
                <td className="pl-6">
                  <div className="font-bold">{affiliate.full_name}</div>
                  <div className="text-xs text-ink-500">{affiliate.email} · {affiliate.country || 'No country'}</div>
                </td>
                <td>{affiliate.referral_code}</td>
                <td className="capitalize">{affiliate.status}</td>
                <td className="pr-6">
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary h-8 px-3 text-xs" onClick={() => statusMutation.mutate({ id: affiliate.id, status: 'approved' })}><CheckCircle2 className="h-3 w-3" />Approve</button>
                    <button className="btn-secondary h-8 px-3 text-xs" onClick={() => statusMutation.mutate({ id: affiliate.id, status: 'rejected' })}><XCircle className="h-3 w-3" />Reject</button>
                    <button className="btn-secondary h-8 px-3 text-xs" onClick={() => statusMutation.mutate({ id: affiliate.id, status: 'suspended' })}><PauseCircle className="h-3 w-3" />Suspend</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-neutral-200 p-5">
          <h2 className="text-lg font-black">Commission ledger</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th className="pl-6">Tenant</th>
              <th>Plan</th>
              <th>Amount</th>
              <th>Status</th>
              <th className="pr-6">Action</th>
            </tr>
          </thead>
          <tbody>
            {(commissions.data ?? []).map((commission) => (
              <tr key={commission.id}>
                <td className="pl-6">Tenant #{commission.tenant_id}</td>
                <td>{commission.plan_code}</td>
                <td>{commission.currency} {commission.commission_amount}</td>
                <td className="capitalize">{commission.status}</td>
                <td className="pr-6">
                  {commission.status !== 'paid' ? (
                    <button className="btn-primary h-8 px-3 text-xs" onClick={() => markPaid.mutate(commission.id)}><DollarSign className="h-3 w-3" />Mark paid</button>
                  ) : 'Paid'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
