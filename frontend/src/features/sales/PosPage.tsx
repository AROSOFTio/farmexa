import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Download, ExternalLink, FileText, Plus, Printer, ReceiptText, Send, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'

import api from '@/services/api'
import { Modal } from '@/components/Modal'
import { useAuth } from '@/features/auth/AuthContext'
import { getErrorMessage } from '@/lib/errors'

interface Customer { id: number; name: string; customer_type: string; email?: string | null; phone?: string | null }
interface StockItem { id: number; name: string; unit_of_measure: string; unit_price: number; current_quantity: number; is_active: boolean }
interface PosCheckoutResponse { receipt_number: string; balance_due: number; email_status?: string | null; invoice: { id: number; invoice_number: string; total_amount: number; paid_amount: number; due_date?: string | null } }

const schema = z.object({
  customer_id: z.coerce.number().optional(),
  customer_name: z.string().optional(),
  customer_email: z.string().email().optional().or(z.literal('')),
  customer_phone: z.string().optional(),
  sale_payment_mode: z.enum(['full', 'partial', 'credit']),
  amount_paid_now: z.coerce.number().min(0).optional(),
  payment_method: z.enum(['cash', 'mobile_money', 'bank_transfer', 'cheque']).optional(),
  payment_reference: z.string().optional(),
  credit_due_date: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    product_id: z.coerce.number().int().positive(),
    quantity: z.coerce.number().positive(),
    unit_price: z.coerce.number().min(0),
  })).min(1),
}).superRefine((value, ctx) => {
  const total = value.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0)
  const paid = value.sale_payment_mode === 'full' && value.amount_paid_now === undefined ? total : Number(value.amount_paid_now || 0)
  const balance = Math.max(total - paid, 0)
  if (value.sale_payment_mode === 'full' && paid !== total) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['amount_paid_now'], message: 'Full payment must match the sale total.' })
  }
  if (value.sale_payment_mode === 'partial' && !(paid > 0 && paid < total)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['amount_paid_now'], message: 'Partial payment must be more than zero and less than the total.' })
  }
  if (paid > total) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['amount_paid_now'], message: 'Amount paid cannot exceed the sale total.' })
  }
  if (paid > 0 && !value.payment_method) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['payment_method'], message: 'Choose a payment method.' })
  }
  if (balance > 0 && !value.credit_due_date) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['credit_due_date'], message: 'Set a due date for the remaining balance.' })
  }
  if (balance > 0 && !value.customer_id && (!value.customer_name || value.customer_name.toLowerCase() === 'walk-in customer')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customer_name'], message: 'Enter a named customer for credit or partial sales.' })
  }
})

type FormValues = z.infer<typeof schema>

export function PosPage() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const [receipt, setReceipt] = useState<PosCheckoutResponse | null>(null)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [missingProductName, setMissingProductName] = useState('')
  const [newProductQuantity, setNewProductQuantity] = useState(0)
  const [newProductPrice, setNewProductPrice] = useState(0)
  const [paperSize, setPaperSize] = useState(() => localStorage.getItem('farmexa_pos_receipt_size') || '80mm')
  const canAddProduct = hasPermission('inventory:write')
  const { data: customers = [] } = useQuery({ queryKey: ['sales-customers'], queryFn: () => api.get<Customer[]>('/sales/customers').then((response) => response.data) })
  const { data: products = [] } = useQuery({ queryKey: ['inventory-items'], queryFn: () => api.get<StockItem[]>('/inventory/items').then((response) => response.data) })
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer_id: 0,
      customer_name: 'Walk-in Customer',
      customer_email: '',
      customer_phone: '',
      sale_payment_mode: 'full',
      amount_paid_now: undefined,
      payment_method: 'cash',
      payment_reference: '',
      credit_due_date: '',
      notes: '',
      items: [{ product_id: 0, quantity: 1, unit_price: 0 }],
    },
  })
  const fields = useFieldArray({ control: form.control, name: 'items' })
  const { errors } = form.formState
  const lines = useWatch({ control: form.control, name: 'items' }) ?? []
  const total = lines.reduce((sum: number, line: any) => sum + (Number(line.quantity) || 0) * (Number(line.unit_price) || 0), 0)
  const paymentMode = useWatch({ control: form.control, name: 'sale_payment_mode' }) ?? 'full'
  const amountPaidNow = useWatch({ control: form.control, name: 'amount_paid_now' })
  const paidNow = paymentMode === 'full' ? total : Number(amountPaidNow || 0)
  const balanceDue = Math.max(total - paidNow, 0)

  const checkout = useMutation({
    mutationFn: (values: FormValues) => api.post('/sales/pos/checkout', {
      ...values,
      customer_id: values.customer_id || null,
      customer_name: values.customer_name || 'Walk-in Customer',
      customer_email: values.customer_email || null,
      customer_phone: values.customer_phone || null,
      amount_paid_now: values.sale_payment_mode === 'full' ? total : values.amount_paid_now ?? 0,
      payment_reference: values.payment_reference || null,
      credit_due_date: values.credit_due_date || null,
      notes: values.notes || null,
    }, { timeout: 60_000 }),
    onSuccess: (response) => {
      setReceipt(response.data)
      toast.success(`Receipt ${response.data.receipt_number} posted.`)
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      qc.invalidateQueries({ queryKey: ['sales-invoices'] })
      form.reset({ customer_id: 0, customer_name: 'Walk-in Customer', customer_email: '', customer_phone: '', sale_payment_mode: 'full', amount_paid_now: undefined, payment_method: 'cash', payment_reference: '', credit_due_date: '', notes: '', items: [{ product_id: 0, quantity: 1, unit_price: 0 }] })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'POS checkout failed.')),
  })

  const addProduct = useMutation({
    mutationFn: () => api.post('/inventory/items', {
      name: missingProductName,
      sku: null,
      category: 'finished_product',
      unit_of_measure: 'kg',
      unit_price: newProductPrice,
      reorder_level: 0,
      initial_quantity: newProductQuantity,
      initial_unit_cost: 0,
      is_active: true,
    }),
    onSuccess: (response) => {
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      const firstEmptyIndex = form.getValues('items').findIndex((item) => !item.product_id)
      if (firstEmptyIndex >= 0) {
        form.setValue(`items.${firstEmptyIndex}.product_id`, response.data.id)
        form.setValue(`items.${firstEmptyIndex}.unit_price`, response.data.unit_price ?? 0)
      }
      toast.success('Product added and selected.')
      setMissingProductName('')
      setNewProductQuantity(0)
      setNewProductPrice(0)
      setIsProductModalOpen(false)
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Unable to add product.')),
  })

  const requestProduct = useMutation({
    mutationFn: () => api.post('/settings/master-data-requests', {
      request_type: 'product',
      suggested_name: missingProductName,
      source_module: 'POS checkout',
      note: 'Requested while preparing a POS sale.',
    }),
    onSuccess: () => {
      toast.success('Request sent to your administrator. You can continue with available items.')
      setMissingProductName('')
      setIsProductModalOpen(false)
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Unable to send request.')),
  })

  const openReceiptDocument = async (paper: string, mode: 'view' | 'download') => {
    if (!receipt) return
    localStorage.setItem('farmexa_pos_receipt_size', paper)
    setPaperSize(paper)
    const path = mode === 'download' ? 'receipt-download.pdf' : 'receipt.pdf'
    const response = await api.get(`/sales/invoices/${receipt.invoice.id}/${path}`, {
      params: { paper },
      responseType: 'blob',
    })
    const blob = new Blob([response.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    if (mode === 'download') {
      const link = document.createElement('a')
      link.href = url
      link.download = `${receipt.invoice.invoice_number}-${paper}-receipt.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">POS / Cashier</h1>
          <p className="section-subtitle">Sell meat and store stock by KG, receive payment, deduct stock, and generate receipts.</p>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <form className="card p-6" onSubmit={form.handleSubmit((values) => checkout.mutate(values))}>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="form-label">Customer</label><select className="form-input" {...form.register('customer_id')}><option value={0}>Walk-in customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></div>
            <div><label className="form-label">Walk-in name</label><input className="form-input" {...form.register('customer_name')} /></div>
          </div>
          {balanceDue > 0 ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">Customer email</label>
                <input className="form-input" type="email" placeholder="customer@example.com" {...form.register('customer_email')} />
                {errors.customer_email ? <p className="form-error">{errors.customer_email.message}</p> : null}
              </div>
              <div>
                <label className="form-label">Customer phone</label>
                <input className="form-input" placeholder="+256..." {...form.register('customer_phone')} />
                {errors.customer_name ? <p className="form-error">{errors.customer_name.message}</p> : null}
              </div>
            </div>
          ) : null}
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-ink-900">Cart</h2>
              <div className="flex gap-2">
                <button className="btn-secondary btn-sm" type="button" onClick={() => setIsProductModalOpen(true)}>
                  {canAddProduct ? <Plus className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  {canAddProduct ? 'Add product' : 'Request product'}
                </button>
                <button className="btn-secondary btn-sm" type="button" onClick={() => fields.append({ product_id: 0, quantity: 1, unit_price: 0 })}>Add item</button>
              </div>
            </div>
            {fields.fields.map((field, index) => {
              const product = products.find((item) => item.id === Number(form.watch(`items.${index}.product_id`)))
              return (
                <div key={field.id} className="rounded-[18px] border border-neutral-150 p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_120px_140px]">
                    <select className="form-input" {...form.register(`items.${index}.product_id`)} onChange={(event) => {
                      const productId = Number(event.target.value)
                      const selected = products.find((item) => item.id === productId)
                      form.setValue(`items.${index}.product_id`, productId)
                      form.setValue(`items.${index}.unit_price`, selected?.unit_price ?? 0)
                    }}>
                      <option value={0}>Choose meat product</option>
                      {products.filter((item) => item.is_active && item.current_quantity > 0).map((item) => <option key={item.id} value={item.id}>{item.name} - {item.current_quantity.toLocaleString()} {item.unit_of_measure}</option>)}
                    </select>
                    <input className="form-input" type="number" min={0} step="0.01" {...form.register(`items.${index}.quantity`)} />
                    <input className="form-input" type="number" min={0} step="0.01" {...form.register(`items.${index}.unit_price`)} />
                  </div>
                  <div className="mt-2 text-xs text-ink-500">{product ? `Available: ${product.current_quantity.toLocaleString()} ${product.unit_of_measure}` : 'Select product to view stock.'}</div>
                </div>
              )
            })}
          </div>
          <div className="mt-6 rounded-[10px] border border-neutral-150 bg-neutral-50 p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="form-label">Payment mode</label>
                <select className="form-input" {...form.register('sale_payment_mode')} onChange={(event) => {
                  const next = event.target.value as FormValues['sale_payment_mode']
                  form.setValue('sale_payment_mode', next)
                  form.setValue('amount_paid_now', next === 'full' ? total : next === 'credit' ? 0 : undefined)
                }}>
                  <option value="full">Full payment</option>
                  <option value="partial">Partial payment</option>
                  <option value="credit">Credit / pay later</option>
                </select>
              </div>
              <div>
                <label className="form-label">Amount paid now</label>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  max={total}
                  step="0.01"
                  disabled={paymentMode === 'full'}
                  {...form.register('amount_paid_now')}
                  value={paymentMode === 'full' ? total : undefined}
                  onChange={paymentMode === 'full' ? undefined : (e) => form.setValue('amount_paid_now', Number(e.target.value))}
                />
                {errors.amount_paid_now ? <p className="form-error">{errors.amount_paid_now.message}</p> : null}
              </div>
              <div>
                <label className="form-label">Balance due</label>
                <div className="form-input flex items-center font-semibold">UGX {balanceDue.toLocaleString()}</div>
              </div>
            </div>
            {balanceDue > 0 ? (
              <div className="mt-4">
                <label className="form-label">Balance due date</label>
                <input className="form-input" type="date" {...form.register('credit_due_date')} />
                {errors.credit_due_date ? <p className="form-error">{errors.credit_due_date.message}</p> : null}
              </div>
            ) : null}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div><label className="form-label">Payment method</label><select className="form-input" {...form.register('payment_method')} disabled={paidNow <= 0}><option value="cash">Cash</option><option value="mobile_money">Mobile money</option><option value="bank_transfer">Bank</option><option value="cheque">Cheque</option></select>{errors.payment_method ? <p className="form-error">{errors.payment_method.message}</p> : null}</div>
            <div><label className="form-label">Payment reference</label><input className="form-input" {...form.register('payment_reference')} disabled={paidNow <= 0} /></div>
          </div>
          <div className="mt-6"><label className="form-label">Notes</label><textarea className="form-input min-h-[90px]" {...form.register('notes')} /></div>
          <button className="btn-primary mt-6 w-full" disabled={checkout.isPending} type="submit"><ReceiptText className="h-4 w-4" /> {checkout.isPending ? 'Posting sale...' : 'Complete sale'}</button>
        </form>
        <aside className="card h-fit p-6">
          <ShoppingCart className="h-8 w-8 text-brand-700" />
          <div className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-brand-700">Cart total</div>
          <div className="mt-2 text-3xl font-bold text-ink-950">UGX {total.toLocaleString()}</div>
          <div className="mt-4 grid gap-2 text-[13px]">
            <div className="flex justify-between"><span>Paid now</span><strong>UGX {paidNow.toLocaleString()}</strong></div>
            <div className="flex justify-between"><span>Balance</span><strong>UGX {balanceDue.toLocaleString()}</strong></div>
          </div>
          <div className="mt-6 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-3 text-[12.5px] leading-5 text-ink-500">
            Receipt printing is generated as a clean PDF document after checkout.
          </div>
        </aside>
      </div>
      <Modal
        isOpen={Boolean(receipt)}
        onClose={() => setReceipt(null)}
        title="✅ Sale completed!"
        description="Choose a receipt format to print or download. You can also skip and start a new sale."
      >
        {receipt ? (
          <div className="space-y-5">
            <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <ReceiptText className="h-5 w-5 text-emerald-700" />
                </div>
                <div>
                  <div className="font-bold text-ink-900">{receipt.receipt_number} — {receipt.invoice.invoice_number}</div>
                  <div className="mt-0.5 text-[12.5px] text-ink-500">Total: <strong>UGX {receipt.invoice.total_amount.toLocaleString()}</strong> &nbsp;·&nbsp; Paid: <strong className="text-emerald-700">UGX {receipt.invoice.paid_amount.toLocaleString()}</strong> {receipt.balance_due > 0 ? <>&nbsp;·&nbsp; Balance: <strong className="text-amber-600">UGX {receipt.balance_due.toLocaleString()}</strong></> : null}</div>
                  {receipt.invoice.due_date && receipt.balance_due > 0 ? <div className="mt-0.5 text-[12px] text-amber-600">Balance due by {receipt.invoice.due_date}</div> : null}
                </div>
              </div>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400">Print Receipt</div>
              <div className="grid gap-2 sm:grid-cols-3">
                <button type="button" className="btn-primary" onClick={() => openReceiptDocument('a4', 'view')}><Printer className="h-4 w-4" /> Print A4</button>
                <button type="button" className="btn-secondary" onClick={() => openReceiptDocument(paperSize, 'view')}><Printer className="h-4 w-4" /> Thermal</button>
                <button type="button" className="btn-secondary" onClick={() => openReceiptDocument('a4', 'download')}><Download className="h-4 w-4" /> Download PDF</button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <label className="form-label">Thermal receipt size</label>
                <select className="form-input" value={paperSize} onChange={(event) => { setPaperSize(event.target.value); localStorage.setItem('farmexa_pos_receipt_size', event.target.value) }}>
                  <option value="58mm">58mm thermal paper</option>
                  <option value="80mm">80mm thermal paper</option>
                </select>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setReceipt(null)}><FileText className="h-4 w-4" /> New sale</button>
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title={canAddProduct ? 'Add new product' : 'Request missing product'}
        description={canAddProduct ? 'Create a saleable stock item without leaving POS.' : 'Send the missing item to an administrator for approval.'}
      >
        <div className="space-y-4">
              <div>
                <label className="form-label">Product name</label>
                <input className="form-input" value={missingProductName} onChange={(event) => setMissingProductName(event.target.value)} placeholder="Example: Dressed chicken" />
              </div>
              {canAddProduct ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="form-label">Available quantity (kg)</label>
                    <input className="form-input" type="number" min={0} step="0.01" value={newProductQuantity} onChange={(event) => setNewProductQuantity(Number(event.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="form-label">Sale price per kg</label>
                    <input className="form-input" type="number" min={0} step="0.01" value={newProductPrice} onChange={(event) => setNewProductPrice(Number(event.target.value) || 0)} />
                  </div>
                </div>
              ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setIsProductModalOpen(false)}>Cancel</button>
            <button
              type="button"
              className="btn-primary"
              disabled={!missingProductName.trim() || addProduct.isPending || requestProduct.isPending}
              onClick={() => (canAddProduct ? addProduct.mutate() : requestProduct.mutate())}
            >
              {canAddProduct ? 'Save product' : 'Send request'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
