import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Printer, ReceiptText, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'

import api from '@/services/api'

interface Customer { id: number; name: string; customer_type: string }
interface StockItem { id: number; name: string; unit_of_measure: string; unit_price: number; current_quantity: number; is_active: boolean }

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
      toast.success(`Receipt ${response.data.receipt_number} posted.`)
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      qc.invalidateQueries({ queryKey: ['sales-invoices'] })
      form.reset()
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail ?? 'POS checkout failed.'),
  })

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
          <div className="mt-2 text-4xl font-black text-ink-950">UGX {total.toLocaleString()}</div>
          <button className="btn-secondary mt-6 w-full" type="button" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print screen</button>
        </aside>
      </div>
    </div>
  )
}
