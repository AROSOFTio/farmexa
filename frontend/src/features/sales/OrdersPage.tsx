import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'

interface Customer {
  id: number
  name: string
  customer_type: 'retail' | 'wholesale'
}

interface StockItem {
  id: number
  name: string
  unit_of_measure: string
  unit_price: number
  current_quantity: number
  is_active: boolean
}

interface Order {
  id: number
  customer_id: number
  status: 'pending' | 'completed' | 'cancelled'
  total_amount: number
  created_at: string
  customer?: Customer | null
  items: Array<{
    id: number
    product_id: number
    quantity: number
    unit_price: number
    subtotal: number
  }>
}

const orderLineSchema = z.object({
  product_id: z.coerce.number().int().positive('Select a product'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  unit_price: z.coerce.number().min(0, 'Unit price must be zero or more'),
})

const orderSchema = z.object({
  customer_id: z.coerce.number().int().positive('Select a customer'),
  notes: z.string().optional(),
  items: z.array(orderLineSchema).min(1, 'Add at least one order line'),
})

type OrderFormValues = z.infer<typeof orderSchema>

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function OrdersPage() {
  const queryClient = useQueryClient()

  const { data: customers = [] } = useQuery({
    queryKey: ['sales-customers'],
    queryFn: () => api.get<Customer[]>('/sales/customers').then((response) => response.data),
  })

  const { data: products = [] } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => api.get<StockItem[]>('/inventory/items').then((response) => response.data),
  })

  const { data: orders = [] } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: () => api.get<Order[]>('/sales/orders').then((response) => response.data),
  })

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customer_id: 0,
      notes: '',
      items: [{ product_id: 0, quantity: 1, unit_price: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  const watchedItems = form.watch('items')
  const orderTotal = useMemo(
    () =>
      watchedItems.reduce((sum, item) => {
        const quantity = Number(item.quantity) || 0
        const unitPrice = Number(item.unit_price) || 0
        return sum + quantity * unitPrice
      }, 0),
    [watchedItems]
  )

  const mutation = useMutation({
    mutationFn: (values: OrderFormValues) =>
      api.post('/sales/orders', {
        customer_id: values.customer_id,
        status: 'pending',
        notes: values.notes || null,
        items: values.items,
      }),
    onSuccess: () => {
      toast.success('Order created. An invoice has been issued automatically.')
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['sales-customers'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      form.reset({
        customer_id: 0,
        notes: '',
        items: [{ product_id: 0, quantity: 1, unit_price: 0 }],
      })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to create order.')
    },
  })

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="section-title">Sales orders</h1>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[480px_minmax(0,1fr)]">
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-ink-900">Create order</h2>
          <p className="mt-1 text-sm text-ink-500">Create an order from available stock.</p>

          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="mt-6 space-y-5">
            <div>
              <label className="form-label">Customer</label>
              <select className="form-input" {...form.register('customer_id')}>
                <option value={0}>Choose customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} ({customer.customer_type})
                  </option>
                ))}
              </select>
              {form.formState.errors.customer_id ? (
                <p className="form-error">{form.formState.errors.customer_id.message}</p>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="form-label mb-0">Order lines</label>
                <button
                  type="button"
                  onClick={() => append({ product_id: 0, quantity: 1, unit_price: 0 })}
                  className="btn-secondary btn-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add line
                </button>
              </div>

              {fields.map((field, index) => {
                const selectedProductId = form.watch(`items.${index}.product_id`)
                const selectedProduct = products.find((product) => product.id === selectedProductId)
                const lineError = form.formState.errors.items?.[index]
                return (
                  <div key={field.id} className="rounded-3xl border border-neutral-150 bg-neutral-50 p-4">
                    <div className="grid gap-4">
                      <div>
                        <label className="form-label">Inventory item</label>
                        <select
                          className="form-input"
                          {...form.register(`items.${index}.product_id`)}
                          onChange={(event) => {
                            const productId = Number(event.target.value)
                            const product = products.find((entry) => entry.id === productId)
                            form.setValue(`items.${index}.product_id`, productId, { shouldValidate: true })
                            form.setValue(`items.${index}.unit_price`, product?.unit_price ?? 0, { shouldValidate: true })
                          }}
                        >
                          <option value={0}>Choose item</option>
                          {products
                            .filter((product) => product.is_active)
                            .map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name} ({product.current_quantity.toLocaleString()} {product.unit_of_measure} in stock)
                              </option>
                            ))}
                        </select>
                        {lineError?.product_id ? (
                          <p className="form-error">{lineError.product_id.message}</p>
                        ) : null}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="form-label">Quantity</label>
                          <input className="form-input" type="number" min={0} step="0.01" {...form.register(`items.${index}.quantity`)} />
                          {lineError?.quantity ? (
                            <p className="form-error">{lineError.quantity.message}</p>
                          ) : null}
                        </div>
                        <div>
                          <label className="form-label">Unit price</label>
                          <input className="form-input" type="number" min={0} step="0.01" {...form.register(`items.${index}.unit_price`)} />
                          {lineError?.unit_price ? (
                            <p className="form-error">{lineError.unit_price.message}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm text-ink-500">
                        <span>
                          {selectedProduct
                            ? `Available stock: ${selectedProduct.current_quantity.toLocaleString()} ${selectedProduct.unit_of_measure}`
                            : 'Select an item'}
                        </span>
                        {fields.length > 1 ? (
                          <button type="button" onClick={() => remove(index)} className="btn-ghost btn-sm">
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div>
              <label className="form-label">Notes</label>
              <textarea className="form-input min-h-[120px]" {...form.register('notes')} />
            </div>

            <div className="rounded-3xl border border-brand-100 bg-brand-50/70 px-4 py-4">
              <div className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-brand-700">Order total</div>
              <div className="mt-2 text-2xl font-semibold text-ink-900">UGX {orderTotal.toLocaleString()}</div>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={mutation.isPending}>
              <ShoppingCart className="h-4.5 w-4.5" />
              {mutation.isPending ? 'Saving...' : 'Create order'}
            </button>
          </form>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-neutral-150 px-6 py-5">
            <h2 className="text-xl font-semibold text-ink-900">Order ledger</h2>
            <p className="mt-1 text-sm text-ink-500">Recorded orders.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-6">Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th className="pr-6">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td className="pl-6 py-16 text-sm text-ink-500" colSpan={5}>
                      No orders.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id}>
                      <td className="pl-6">
                        <div className="font-semibold text-ink-900">Order #{String(order.id).padStart(5, '0')}</div>
                        <div className="text-xs text-ink-500">{formatDate(order.created_at)}</div>
                      </td>
                      <td>{order.customer?.name ?? customers.find((customer) => customer.id === order.customer_id)?.name ?? `Customer #${order.customer_id}`}</td>
                      <td>
                        <span className={order.status === 'completed' ? 'badge badge-success' : order.status === 'cancelled' ? 'badge badge-danger' : 'badge badge-brand'}>
                          {order.status}
                        </span>
                      </td>
                      <td>{order.items.length.toLocaleString()} line(s)</td>
                      <td className="pr-6 font-semibold text-ink-900">UGX {order.total_amount.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
