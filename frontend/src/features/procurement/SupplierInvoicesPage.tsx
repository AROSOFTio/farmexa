import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, CheckCircle2, Plus, ReceiptText } from 'lucide-react'
import { toast } from 'sonner'
import clsx from 'clsx'

import api from '@/services/api'
import { Modal } from '@/components/Modal'
import { UGX } from '@/lib/money'
import {
  procurementService,
  type SupplierInvoice,
  type SupplierInvoiceStatus,
  type SupplierPaymentMethod,
} from '@/services/procurementService'

interface SupplierOption {
  id: number
  name: string
}

const STATUS_BADGE: Record<SupplierInvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-green-50 text-green-700 border-green-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
}

const PAYMENT_METHODS: { value: SupplierPaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'cheque', label: 'Cheque' },
]

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

export function SupplierInvoicesPage() {
  const qc = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<SupplierInvoiceStatus | ''>('')
  const [supplierFilter, setSupplierFilter] = useState<number | ''>('')

  // New invoice modal
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [supplierId, setSupplierId] = useState<number | ''>('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(todayValue())
  const [dueDate, setDueDate] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [invoiceNotes, setInvoiceNotes] = useState('')

  // Payment modal
  const [payInvoice, setPayInvoice] = useState<SupplierInvoice | null>(null)
  const [paymentDate, setPaymentDate] = useState(todayValue())
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<SupplierPaymentMethod>('cash')
  const [paymentReference, setPaymentReference] = useState('')

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['supplier-invoices', statusFilter, supplierFilter],
    queryFn: () =>
      procurementService.listSupplierInvoices({
        status: statusFilter || undefined,
        supplier_id: supplierFilter || undefined,
        limit: 200,
      }),
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ['procurement-suppliers'],
    queryFn: () => api.get<SupplierOption[]>('/feed/suppliers').then(r => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['supplier-invoices'] })

  const createMutation = useMutation({
    mutationFn: procurementService.createSupplierInvoice,
    onSuccess: (invoice) => {
      toast.success(`Invoice ${invoice.invoice_number} recorded`)
      invalidate()
      closeCreateModal()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to record invoice'),
  })

  const approveMutation = useMutation({
    mutationFn: procurementService.approveSupplierInvoice,
    onSuccess: (invoice) => {
      toast.success(`Invoice ${invoice.invoice_number} approved`)
      invalidate()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to approve invoice'),
  })

  const payMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof procurementService.paySupplierInvoice>[1] }) =>
      procurementService.paySupplierInvoice(id, data),
    onSuccess: () => {
      toast.success('Payment recorded and journal posted')
      invalidate()
      closePayModal()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to record payment'),
  })

  const closeCreateModal = () => {
    setIsCreateOpen(false)
    setSupplierId('')
    setInvoiceNumber('')
    setInvoiceDate(todayValue())
    setDueDate('')
    setTotalAmount('')
    setInvoiceNotes('')
  }

  const closePayModal = () => {
    setPayInvoice(null)
    setPaymentDate(todayValue())
    setPaymentAmount('')
    setPaymentMethod('cash')
    setPaymentReference('')
  }

  const handleCreate = () => {
    if (!supplierId || !invoiceNumber.trim() || !(Number(totalAmount) > 0)) {
      toast.error('Supplier, invoice number, and a positive total are required')
      return
    }
    createMutation.mutate({
      supplier_id: supplierId,
      invoice_number: invoiceNumber.trim(),
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      subtotal: Number(totalAmount),
      total_amount: Number(totalAmount),
      notes: invoiceNotes || null,
    })
  }

  const openPayModal = (invoice: SupplierInvoice) => {
    setPayInvoice(invoice)
    const balance = Number(invoice.total_amount) - Number(invoice.amount_paid)
    setPaymentAmount(balance > 0 ? String(balance) : '')
  }

  const handlePay = () => {
    if (!payInvoice) return
    if (!(Number(paymentAmount) > 0)) {
      toast.error('Enter a positive payment amount')
      return
    }
    payMutation.mutate({
      id: payInvoice.id,
      data: {
        payment_date: paymentDate,
        amount: Number(paymentAmount),
        payment_method: paymentMethod,
        reference: paymentReference || null,
      },
    })
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Supplier Invoices</h1>
          <p className="section-subtitle">
            Track accounts payable: record supplier bills, approve them, and settle outstanding balances.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Invoice
        </button>
      </div>

      {/* Filter bar */}
      <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-end">
        <div className="w-full md:w-52">
          <label className="form-label">Status</label>
          <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value as SupplierInvoiceStatus | '')}>
            <option value="">All statuses</option>
            {(Object.keys(STATUS_BADGE) as SupplierInvoiceStatus[]).map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="w-full md:w-60">
          <label className="form-label">Supplier</label>
          <select className="form-input" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value ? Number(e.target.value) : '')}>
            <option value="">All suppliers</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Invoice table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Invoice No</th>
                <th>Supplier</th>
                <th>Invoice Date</th>
                <th>Due Date</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th className="pr-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="py-12 pl-6 text-sm text-neutral-500">Loading invoices...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={9} className="py-12 pl-6 text-sm text-neutral-500">No supplier invoices yet.</td></tr>
              ) : (
                invoices.map(invoice => {
                  const balance = Number(invoice.total_amount) - Number(invoice.amount_paid)
                  const isOverdue = invoice.status === 'overdue'
                  return (
                    <tr key={invoice.id} className={clsx(isOverdue && 'bg-amber-50/60')}>
                      <td className="pl-6 font-semibold text-neutral-900">
                        <span className="inline-flex items-center gap-1.5">
                          <ReceiptText className="h-3.5 w-3.5 text-neutral-400" />
                          {invoice.invoice_number}
                        </span>
                      </td>
                      <td>{invoice.supplier?.name ?? `Supplier #${invoice.supplier_id}`}</td>
                      <td>{invoice.invoice_date}</td>
                      <td className={clsx(isOverdue && 'font-semibold text-red-600')}>{invoice.due_date ?? '—'}</td>
                      <td>{UGX(invoice.total_amount)}</td>
                      <td>{UGX(invoice.amount_paid)}</td>
                      <td className={clsx('font-semibold', balance > 0 ? 'text-neutral-900' : 'text-green-600')}>
                        {UGX(balance)}
                      </td>
                      <td>
                        <span className={clsx('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', STATUS_BADGE[invoice.status])}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="pr-6">
                        <div className="flex flex-wrap items-center gap-2">
                          {invoice.status === 'draft' && (
                            <button
                              type="button"
                              className="btn-secondary btn-sm text-green-700"
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate(invoice.id)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                            </button>
                          )}
                          {(invoice.status === 'approved' || invoice.status === 'partial' || invoice.status === 'overdue') && (
                            <button
                              type="button"
                              className="btn-secondary btn-sm text-blue-700"
                              onClick={() => openPayModal(invoice)}
                            >
                              <Banknote className="h-3.5 w-3.5" /> Record Payment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New invoice modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={closeCreateModal}
        title="New Supplier Invoice"
        description="Record a supplier bill into accounts payable. Approval posts the AP journal."
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="form-label">Supplier</label>
              <select className="form-input" value={supplierId} onChange={e => setSupplierId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Choose supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Invoice number</label>
              <input className="form-input" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Supplier's invoice no." />
            </div>
            <div>
              <label className="form-label">Invoice date</label>
              <input className="form-input" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Due date</label>
              <input className="form-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Total amount (UGX)</label>
              <input className="form-input" type="number" min={0} step="0.01" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Notes</label>
              <input className="form-input" value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={closeCreateModal}>Cancel</button>
            <button type="button" className="btn-primary" disabled={createMutation.isPending} onClick={handleCreate}>
              {createMutation.isPending ? 'Saving...' : 'Record Invoice'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Payment modal */}
      <Modal
        isOpen={!!payInvoice}
        onClose={closePayModal}
        title={payInvoice ? `Record Payment — ${payInvoice.invoice_number}` : 'Record Payment'}
        description="Settles the supplier balance and posts the payment journal automatically."
      >
        {payInvoice && (
          <div className="space-y-4">
            <div className="rounded-[14px] border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Balance outstanding</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900">
                {UGX(Number(payInvoice.total_amount) - Number(payInvoice.amount_paid))}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Total {UGX(payInvoice.total_amount)} · Paid {UGX(payInvoice.amount_paid)}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">Payment date</label>
                <input className="form-input" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Amount (UGX)</label>
                <input className="form-input" type="number" min={0} step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Method</label>
                <select className="form-input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as SupplierPaymentMethod)}>
                  {PAYMENT_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Reference</label>
                <input className="form-input" value={paymentReference} onChange={e => setPaymentReference(e.target.value)} placeholder="Txn ref / cheque no." />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={closePayModal}>Cancel</button>
              <button type="button" className="btn-primary" disabled={payMutation.isPending} onClick={handlePay}>
                <Banknote className="h-4 w-4" />
                {payMutation.isPending ? 'Posting...' : 'Record Payment'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
