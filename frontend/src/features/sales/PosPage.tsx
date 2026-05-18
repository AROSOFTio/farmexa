import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Download, ExternalLink, FileText, Printer, ReceiptText, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'

import api from '@/services/api'
import { Modal } from '@/components/Modal'
import { getErrorMessage } from '@/lib/errors'

interface Customer { id: number; name: string; customer_type: string }
interface StockItem { id: number; name: string; unit_of_measure: string; unit_price: number; current_quantity: number; is_active: boolean }
interface PosCheckoutResponse { receipt_number: string; invoice: { id: number; invoice_number: string; total_amount: number; paid_amount: number } }

const schema = z.object({
  customer_id: z.coerce.number().optional(),
  customer_name: z.string().optional(),
  payment_method: z.enum(['cash', 'mobile_money', 'bank_transfer', 'cheque']),
  payment_reference: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    product_id: z.coerce.number().int().positive(),
    quantity: z.coerce.number().positive(),
    unit_price: z.coerce.number().min(0),
  })).min(1),
})

type FormValues = z.infer<typeof schema>

export function PosPage() {
  const qc = useQueryClient()
  const [receipt, setReceipt] = useState<PosCheckoutResponse | null>(null)
  const [paperSize, setPaperSize] = useState(() => localStorage.getItem('farmexa_pos_receipt_size') || '80mm')
  const { data: customers = [] } = useQuery({ queryKey: ['sales-customers'], queryFn: () => api.get<Customer[]>('/sales/customers').then((response) => response.data) })
  const { data: products = [] } = useQuery({ queryKey: ['inventory-items'], queryFn: () => api.get<StockItem[]>('/inventory/items').then((response) => response.data) })
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { customer_id: 0, customer_name: 'Walk-in Customer', payment_method: 'cash', payment_reference: '', notes: '', items: [{ product_id: 0, quantity: 1, unit_price: 0 }] },
  })
  const fields = useFieldArray({ control: form.control, name: 'items' })
  const lines = form.watch('items')
  const total = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unit_price) || 0), 0), [lines])

  const checkout = useMutation({
    mutationFn: (values: FormValues) => api.post('/sales/pos/checkout', {
      ...values,
      customer_id: values.customer_id || null,
      customer_name: values.customer_name || 'Walk-in Customer',
      payment_reference: values.payment_reference || null,
      notes: values.notes || null,
    }),
    onSuccess: (response) => {
      setReceipt(response.data)
      toast.success(`Receipt ${response.data.receipt_number} posted.`)
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      qc.invalidateQueries({ queryKey: ['sales-invoices'] })
      form.reset({ customer_id: 0, customer_name: 'Walk-in Customer', payment_method: 'cash', payment_reference: '', notes: '', items: [{ product_id: 0, quantity: 1, unit_price: 0 }] })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'POS checkout failed.')),
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
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-ink-900">Cart</h2><button className="btn-secondary btn-sm" type="button" onClick={() => fields.append({ product_id: 0, quantity: 1, unit_price: 0 })}>Add item</button></div>
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
                      {products.filter((item) => item.is_active && item.current_quantity > 0).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.current_quantity.toLocaleString()} {item.unit_of_measure}</option>)}
                    </select>
                    <input className="form-input" type="number" min={0} step="0.01" {...form.register(`items.${index}.quantity`)} />
                    <input className="form-input" type="number" min={0} step="0.01" {...form.register(`items.${index}.unit_price`)} />
                  </div>
                  <div className="mt-2 text-xs text-ink-500">{product ? `Available: ${product.current_quantity.toLocaleString()} ${product.unit_of_measure}` : 'Select product to view stock.'}</div>
                </div>
              )
            })}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div><label className="form-label">Payment method</label><select className="form-input" {...form.register('payment_method')}><option value="cash">Cash</option><option value="mobile_money">Mobile money</option><option value="bank_transfer">Bank</option><option value="cheque">Cheque</option></select></div>
            <div><label className="form-label">Payment reference</label><input className="form-input" {...form.register('payment_reference')} /></div>
          </div>
          <div className="mt-6"><label className="form-label">Notes</label><textarea className="form-input min-h-[90px]" {...form.register('notes')} /></div>
          <button className="btn-primary mt-6 w-full" disabled={checkout.isPending} type="submit"><ReceiptText className="h-4 w-4" /> {checkout.isPending ? 'Posting sale...' : 'Complete sale'}</button>
        </form>
        <aside className="card h-fit p-6">
          <ShoppingCart className="h-8 w-8 text-brand-700" />
          <div className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-brand-700">Cart total</div>
          <div className="mt-2 text-3xl font-bold text-ink-950">UGX {total.toLocaleString()}</div>
          <div className="mt-6 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-3 text-[12.5px] leading-5 text-ink-500">
            Receipt printing is generated as a clean PDF document after checkout.
          </div>
        </aside>
      </div>
      <Modal
        isOpen={Boolean(receipt)}
        onClose={() => setReceipt(null)}
        title="Sale completed"
        description="Use a generated PDF receipt for viewing, downloading, or thermal printing."
      >
        {receipt ? (
          <div className="space-y-5">
            <div className="rounded-[10px] border border-[rgba(var(--brand-primary-rgb),0.2)] bg-[rgba(var(--brand-primary-rgb),0.06)] p-4">
              <div className="text-[13px] font-semibold text-ink-900">{receipt.receipt_number}</div>
              <div className="mt-1 text-[12.5px] text-ink-500">Invoice {receipt.invoice.invoice_number} | Total UGX {receipt.invoice.total_amount.toLocaleString()}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <button type="button" className="btn-secondary" onClick={() => openReceiptDocument('a4', 'view')}><ExternalLink className="h-4 w-4" /> View A4</button>
              <button type="button" className="btn-secondary" onClick={() => openReceiptDocument('a4', 'download')}><Download className="h-4 w-4" /> Download PDF</button>
              <button type="button" className="btn-secondary" onClick={() => openReceiptDocument(paperSize, 'view')}><Printer className="h-4 w-4" /> Print thermal</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <label className="form-label">Thermal receipt size</label>
                <select className="form-input" value={paperSize} onChange={(event) => { setPaperSize(event.target.value); localStorage.setItem('farmexa_pos_receipt_size', event.target.value) }}>
                  <option value="58mm">58mm thermal paper</option>
                  <option value="80mm">80mm thermal paper</option>
                </select>
              </div>
              <button type="button" className="btn-primary" onClick={() => setReceipt(null)}><FileText className="h-4 w-4" /> New sale</button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
