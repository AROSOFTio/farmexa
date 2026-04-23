import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CreditCard, FileText, Landmark, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'

type InvoiceSection = 'invoices' | 'payments'

interface Payment {
  id: number
  amount: number
  payment_method: 'cash' | 'bank_transfer' | 'mobile_money' | 'cheque'
  payment_date: string
  reference?: string | null
  created_at: string
}

interface Invoice {
  id: number
  invoice_number: string
  order_id?: number | null
  customer_id: number
  status: 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'cancelled'
  issue_date: string
  due_date: string
  total_amount: number
  paid_amount: number
  created_at: string
  customer?: {
    name: string
  } | null
  payments: Payment[]
}

const paymentSchema = z.object({
  invoice_id: z.coerce.number().int().positive('Invoice is required'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  payment_method: z.enum(['cash', 'bank_transfer', 'mobile_money', 'cheque']),
  payment_date: z.string().min(1, 'Payment date is required'),
  reference: z.string().optional(),
})

type PaymentFormValues = z.infer<typeof paymentSchema>

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function InvoicesPage({ section }: { section: InvoiceSection }) {
  const qc = useQueryClient()
  const { data: invoices = [] } = useQuery({
    queryKey: ['sales-invoices'],
    queryFn: () => api.get<Invoice[]>('/sales/invoices').then((response) => response.data),
  })

  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { invoice_id: 0, amount: 0, payment_method: 'cash', payment_date: todayValue(), reference: '' },
  })

  const payments = useMemo(
    () =>
      invoices.flatMap((invoice) =>
        (invoice.payments || []).map((payment) => ({
          ...payment,
          invoice_number: invoice.invoice_number,
          invoice_status: invoice.status,
        }))
      ),
    [invoices]
  )

  const outstandingTotal = useMemo(
    () => invoices.reduce((sum, invoice) => sum + Math.max(invoice.total_amount - invoice.paid_amount, 0), 0),
    [invoices]
  )

  const paymentMutation = useMutation({
    mutationFn: (values: PaymentFormValues) =>
      api.post(`/sales/invoices/${values.invoice_id}/payments`, {
        amount: values.amount,
        payment_method: values.payment_method,
        payment_date: values.payment_date,
        reference: values.reference || null,
      }),
    onSuccess: () => {
      toast.success('Payment posted.')
      qc.invalidateQueries({ queryKey: ['sales-invoices'] })
      paymentForm.reset({ invoice_id: 0, amount: 0, payment_method: 'cash', payment_date: todayValue(), reference: '' })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to post payment.')
    },
  })

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            {section === 'invoices' ? 'Invoices' : 'Payments'}
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-medium text-neutral-500">
            {section === 'invoices'
              ? 'Track issued invoices, outstanding amounts, and settlement progress.'
              : 'Record invoice payments and monitor cash collection against receivables.'}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
          {section === 'invoices' ? <FileText className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
          Billing
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-neutral-500">
            <FileText className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em]">Invoices</span>
          </div>
          <p className="text-xl font-bold text-neutral-900">{invoices.length.toLocaleString()}</p>
          <p className="mt-1 text-sm text-neutral-500">Current invoices returned by the backend ledger.</p>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-neutral-500">
            <Landmark className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em]">Outstanding</span>
          </div>
          <p className="text-xl font-bold text-neutral-900">UGX {outstandingTotal.toLocaleString()}</p>
          <p className="mt-1 text-sm text-neutral-500">Open receivables not yet settled by payments.</p>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-neutral-500">
            <Receipt className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em]">Payments</span>
          </div>
          <p className="text-xl font-bold text-neutral-900">{payments.length.toLocaleString()}</p>
          <p className="mt-1 text-sm text-neutral-500">Recorded settlement transactions across all invoices.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="card p-6">
          <h2 className="text-lg font-bold text-neutral-900">Post payment</h2>
          <p className="mt-1 text-sm text-neutral-500">Apply a real payment directly to an existing invoice.</p>
          <form className="mt-5 space-y-4" onSubmit={paymentForm.handleSubmit((values) => paymentMutation.mutate(values))}>
            <div>
              <label className="form-label">Invoice</label>
              <select className="form-input" {...paymentForm.register('invoice_id')}>
                <option value={0}>Choose invoice</option>
                {invoices
                  .filter((invoice) => Math.max(invoice.total_amount - invoice.paid_amount, 0) > 0)
                  .map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} - UGX {(invoice.total_amount - invoice.paid_amount).toLocaleString()} outstanding
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">Amount</label>
                <input className="form-input" type="number" min={0} step="0.01" {...paymentForm.register('amount')} />
              </div>
              <div>
                <label className="form-label">Payment date</label>
                <input className="form-input" type="date" {...paymentForm.register('payment_date')} />
              </div>
            </div>
            <div>
              <label className="form-label">Method</label>
              <select className="form-input" {...paymentForm.register('payment_method')}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="mobile_money">Mobile money</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="form-label">Reference</label>
              <input className="form-input" {...paymentForm.register('reference')} />
            </div>
            <button className="btn-primary w-full" disabled={paymentMutation.isPending} type="submit">
              <CreditCard className="h-4 w-4" />
              {paymentMutation.isPending ? 'Saving...' : 'Post payment'}
            </button>
          </form>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-neutral-100 px-6 py-5">
            <h2 className="text-lg font-bold text-neutral-900">
              {section === 'invoices' ? 'Invoice ledger' : 'Payment history'}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {section === 'invoices'
                ? 'Current invoice status, issue dates, and settlement progress.'
                : 'Flattened payment history across invoice records.'}
            </p>
          </div>
          <div className="overflow-x-auto">
            {section === 'invoices' ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-6">Invoice</th>
                    <th>Status</th>
                    <th>Issue / Due</th>
                    <th>Paid</th>
                    <th className="pr-6">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr>
                      <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={5}>
                        No invoices available yet.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="pl-6">
                          <div className="font-semibold text-neutral-900">{invoice.invoice_number}</div>
                          <div className="text-xs text-neutral-500">{invoice.customer?.name || `Customer #${invoice.customer_id}`}</div>
                        </td>
                        <td>
                          <span className={invoice.status === 'paid' ? 'badge badge-success' : invoice.status === 'partial' ? 'badge badge-warning' : 'badge badge-brand'}>
                            {invoice.status}
                          </span>
                        </td>
                        <td>{formatDate(invoice.issue_date)} / {formatDate(invoice.due_date)}</td>
                        <td>UGX {invoice.paid_amount.toLocaleString()}</td>
                        <td className="pr-6 font-semibold text-neutral-900">
                          UGX {Math.max(invoice.total_amount - invoice.paid_amount, 0).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-6">Payment date</th>
                    <th>Invoice</th>
                    <th>Method</th>
                    <th className="pr-6">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={4}>
                        No payments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="pl-6">{formatDate(payment.payment_date)}</td>
                        <td>{payment.invoice_number}</td>
                        <td>{payment.payment_method.replace('_', ' ')}</td>
                        <td className="pr-6 font-semibold text-neutral-900">UGX {payment.amount.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
