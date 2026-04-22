import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, BadgeDollarSign, Boxes, ClipboardPlus, PackagePlus, ShoppingBasket, Truck, Wheat } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'

type FeedSection = 'stock' | 'purchases' | 'consumption' | 'suppliers'

interface Supplier {
  id: number
  name: string
  contact_person?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
}

interface FeedCategory {
  id: number
  name: string
  description?: string | null
}

interface FeedItem {
  id: number
  name: string
  category_id: number
  unit: string
  current_stock: number
  reorder_threshold: number
  category?: FeedCategory | null
}

interface FeedPurchaseItem {
  id: number
  purchase_id: number
  feed_item_id: number
  quantity: number
  unit_price: number
  total_price: number
}

interface FeedPurchase {
  id: number
  supplier_id: number
  purchase_date: string
  invoice_number?: string | null
  total_amount: number
  notes?: string | null
  supplier?: Supplier | null
  items: FeedPurchaseItem[]
}

interface FeedConsumption {
  id: number
  batch_id: number
  feed_item_id: number
  record_date: string
  quantity: number
  notes?: string | null
}

interface BatchOption {
  id: number
  batch_number: string
  breed: string
}

const sectionCopy: Record<FeedSection, { title: string; description: string; icon: React.ElementType }> = {
  stock: {
    title: 'Feed Stock',
    description: 'Maintain feed SKUs, categories, stock balances, and reorder thresholds.',
    icon: Boxes,
  },
  purchases: {
    title: 'Feed Purchases',
    description: 'Capture supplier purchases and increase stock with real cost values.',
    icon: ShoppingBasket,
  },
  consumption: {
    title: 'Feed Consumption',
    description: 'Post daily consumption against batches and deduct feed from available stock.',
    icon: Wheat,
  },
  suppliers: {
    title: 'Suppliers',
    description: 'Track approved vendors, contacts, and purchase sourcing records.',
    icon: Truck,
  },
}

const supplierSchema = z.object({
  name: z.string().min(2, 'Supplier name is required'),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
})

const categorySchema = z.object({
  name: z.string().min(2, 'Category name is required'),
  description: z.string().optional(),
})

const itemSchema = z.object({
  name: z.string().min(2, 'Feed item name is required'),
  category_id: z.coerce.number().int().positive('Category is required'),
  unit: z.string().min(1, 'Unit is required'),
  reorder_threshold: z.coerce.number().min(0, 'Reorder threshold must be zero or more'),
})

const purchaseSchema = z.object({
  supplier_id: z.coerce.number().int().positive('Supplier is required'),
  purchase_date: z.string().min(1, 'Purchase date is required'),
  invoice_number: z.string().optional(),
  feed_item_id: z.coerce.number().int().positive('Feed item is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  unit_price: z.coerce.number().min(0, 'Unit price must be zero or more'),
  notes: z.string().optional(),
})

const consumptionSchema = z.object({
  batch_id: z.coerce.number().int().positive('Batch is required'),
  feed_item_id: z.coerce.number().int().positive('Feed item is required'),
  record_date: z.string().min(1, 'Record date is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  notes: z.string().optional(),
})

type SupplierFormValues = z.infer<typeof supplierSchema>
type CategoryFormValues = z.infer<typeof categorySchema>
type ItemFormValues = z.infer<typeof itemSchema>
type PurchaseFormValues = z.infer<typeof purchaseSchema>
type ConsumptionFormValues = z.infer<typeof consumptionSchema>

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function FeedManagementPage({ section }: { section: FeedSection }) {
  const qc = useQueryClient()
  const copy = sectionCopy[section]
  const SectionIcon = copy.icon

  const { data: suppliers = [] } = useQuery({
    queryKey: ['feed-suppliers'],
    queryFn: () => api.get<Supplier[]>('/feed/suppliers').then((response) => response.data),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['feed-categories'],
    queryFn: () => api.get<FeedCategory[]>('/feed/categories').then((response) => response.data),
  })

  const { data: items = [] } = useQuery({
    queryKey: ['feed-items'],
    queryFn: () => api.get<FeedItem[]>('/feed/items').then((response) => response.data),
  })

  const { data: purchases = [] } = useQuery({
    queryKey: ['feed-purchases'],
    queryFn: () => api.get<FeedPurchase[]>('/feed/purchases').then((response) => response.data),
    enabled: section === 'purchases',
  })

  const { data: consumptions = [] } = useQuery({
    queryKey: ['feed-consumptions'],
    queryFn: () => api.get<FeedConsumption[]>('/feed/consumptions').then((response) => response.data),
    enabled: section === 'consumption',
  })

  const { data: batches = [] } = useQuery({
    queryKey: ['feed-consumption-batches'],
    queryFn: () => api.get<BatchOption[]>('/farm/batches').then((response) => response.data),
    enabled: section === 'consumption',
  })

  const supplierForm = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { name: '', contact_person: '', phone: '', email: '', address: '' },
  })

  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', description: '' },
  })

  const itemForm = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: { name: '', category_id: 0, unit: 'kg', reorder_threshold: 0 },
  })

  const purchaseForm = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: { supplier_id: 0, purchase_date: todayValue(), invoice_number: '', feed_item_id: 0, quantity: 0, unit_price: 0, notes: '' },
  })

  const consumptionForm = useForm<ConsumptionFormValues>({
    resolver: zodResolver(consumptionSchema),
    defaultValues: { batch_id: 0, feed_item_id: 0, record_date: todayValue(), quantity: 0, notes: '' },
  })

  const createSupplier = useMutation({
    mutationFn: (values: SupplierFormValues) => api.post('/feed/suppliers', values),
    onSuccess: () => {
      toast.success('Supplier saved.')
      qc.invalidateQueries({ queryKey: ['feed-suppliers'] })
      supplierForm.reset({ name: '', contact_person: '', phone: '', email: '', address: '' })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to save supplier.')
    },
  })

  const createCategory = useMutation({
    mutationFn: (values: CategoryFormValues) => api.post('/feed/categories', values),
    onSuccess: () => {
      toast.success('Feed category created.')
      qc.invalidateQueries({ queryKey: ['feed-categories'] })
      categoryForm.reset({ name: '', description: '' })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to create category.')
    },
  })

  const createItem = useMutation({
    mutationFn: (values: ItemFormValues) => api.post('/feed/items', values),
    onSuccess: () => {
      toast.success('Feed item created.')
      qc.invalidateQueries({ queryKey: ['feed-items'] })
      itemForm.reset({ name: '', category_id: 0, unit: 'kg', reorder_threshold: 0 })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to create feed item.')
    },
  })

  const createPurchase = useMutation({
    mutationFn: async (values: PurchaseFormValues) => {
      const total = values.quantity * values.unit_price
      return api.post('/feed/purchases', {
        supplier_id: values.supplier_id,
        purchase_date: values.purchase_date,
        invoice_number: values.invoice_number || null,
        total_amount: total,
        notes: values.notes || null,
        items: [
          {
            feed_item_id: values.feed_item_id,
            quantity: values.quantity,
            unit_price: values.unit_price,
            total_price: total,
          },
        ],
      })
    },
    onSuccess: () => {
      toast.success('Purchase recorded.')
      qc.invalidateQueries({ queryKey: ['feed-purchases'] })
      qc.invalidateQueries({ queryKey: ['feed-items'] })
      purchaseForm.reset({ supplier_id: 0, purchase_date: todayValue(), invoice_number: '', feed_item_id: 0, quantity: 0, unit_price: 0, notes: '' })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to record purchase.')
    },
  })

  const createConsumption = useMutation({
    mutationFn: (values: ConsumptionFormValues) => api.post('/feed/consumptions', values),
    onSuccess: () => {
      toast.success('Consumption recorded.')
      qc.invalidateQueries({ queryKey: ['feed-consumptions'] })
      qc.invalidateQueries({ queryKey: ['feed-items'] })
      consumptionForm.reset({ batch_id: 0, feed_item_id: 0, record_date: todayValue(), quantity: 0, notes: '' })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to record consumption.')
    },
  })

  const lowStockCount = useMemo(
    () => items.filter((item) => item.current_stock <= item.reorder_threshold).length,
    [items]
  )

  const purchaseTotal = useMemo(
    () => purchases.reduce((sum, purchase) => sum + purchase.total_amount, 0),
    [purchases]
  )

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{copy.title}</h1>
          <p className="mt-1 max-w-2xl text-sm font-medium text-neutral-500">{copy.description}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
          <SectionIcon className="h-3.5 w-3.5" />
          Feed Operations
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-neutral-500">
            <Boxes className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em]">Feed items</span>
          </div>
          <p className="text-xl font-bold text-neutral-900">{items.length.toLocaleString()}</p>
          <p className="mt-1 text-sm text-neutral-500">Configured stock records in the feed ledger.</p>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-neutral-500">
            <AlertTriangle className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em]">Low stock</span>
          </div>
          <p className="text-xl font-bold text-neutral-900">{lowStockCount.toLocaleString()}</p>
          <p className="mt-1 text-sm text-neutral-500">Items already at or below their reorder threshold.</p>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-neutral-500">
            <BadgeDollarSign className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em]">
              {section === 'purchases' ? 'Purchase spend' : 'Suppliers'}
            </span>
          </div>
          <p className="text-xl font-bold text-neutral-900">
            {section === 'purchases' ? `UGX ${purchaseTotal.toLocaleString()}` : suppliers.length.toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {section === 'purchases' ? 'Value of recorded feed purchases.' : 'Approved supplier records currently stored.'}
          </p>
        </div>
      </div>

      {section === 'suppliers' && (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="card p-6">
            <h2 className="text-lg font-bold text-neutral-900">Add supplier</h2>
            <p className="mt-1 text-sm text-neutral-500">Create a real vendor record for purchasing and traceability.</p>
            <form className="mt-5 space-y-4" onSubmit={supplierForm.handleSubmit((values) => createSupplier.mutate(values))}>
              <div>
                <label className="form-label">Supplier name</label>
                <input className="form-input" {...supplierForm.register('name')} />
                {supplierForm.formState.errors.name && <p className="form-error">{supplierForm.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="form-label">Contact person</label>
                <input className="form-input" {...supplierForm.register('contact_person')} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Phone</label>
                  <input className="form-input" {...supplierForm.register('phone')} />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" {...supplierForm.register('email')} />
                </div>
              </div>
              <div>
                <label className="form-label">Address</label>
                <textarea className="form-input min-h-[120px]" {...supplierForm.register('address')} />
              </div>
              <button className="btn-primary w-full" disabled={createSupplier.isPending} type="submit">
                <Truck className="h-4 w-4" />
                {createSupplier.isPending ? 'Saving...' : 'Save supplier'}
              </button>
            </form>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-neutral-100 px-6 py-5">
              <h2 className="text-lg font-bold text-neutral-900">Supplier directory</h2>
              <p className="mt-1 text-sm text-neutral-500">Live vendors currently available for feed procurement.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-6">Supplier</th>
                    <th>Contact</th>
                    <th>Email</th>
                    <th className="pr-6">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.length === 0 ? (
                    <tr>
                      <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={4}>
                        No suppliers recorded yet.
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((supplier) => (
                      <tr key={supplier.id}>
                        <td className="pl-6">
                          <div className="font-semibold text-neutral-900">{supplier.name}</div>
                          <div className="text-xs text-neutral-500">{supplier.address || 'Address not recorded'}</div>
                        </td>
                        <td>{supplier.contact_person || '—'}</td>
                        <td>{supplier.email || '—'}</td>
                        <td className="pr-6">{supplier.phone || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {section === 'stock' && (
        <div className="grid gap-6 xl:grid-cols-[420px_420px_minmax(0,1fr)]">
          <div className="card p-6">
            <h2 className="text-lg font-bold text-neutral-900">Add category</h2>
            <p className="mt-1 text-sm text-neutral-500">Define a logical group before you create feed items.</p>
            <form className="mt-5 space-y-4" onSubmit={categoryForm.handleSubmit((values) => createCategory.mutate(values))}>
              <div>
                <label className="form-label">Category name</label>
                <input className="form-input" {...categoryForm.register('name')} />
                {categoryForm.formState.errors.name && <p className="form-error">{categoryForm.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="form-label">Description</label>
                <textarea className="form-input min-h-[120px]" {...categoryForm.register('description')} />
              </div>
              <button className="btn-primary w-full" disabled={createCategory.isPending} type="submit">
                <ClipboardPlus className="h-4 w-4" />
                {createCategory.isPending ? 'Saving...' : 'Save category'}
              </button>
            </form>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-bold text-neutral-900">Add feed item</h2>
            <p className="mt-1 text-sm text-neutral-500">Create a stock-managed feed SKU with reorder logic.</p>
            <form className="mt-5 space-y-4" onSubmit={itemForm.handleSubmit((values) => createItem.mutate(values))}>
              <div>
                <label className="form-label">Item name</label>
                <input className="form-input" {...itemForm.register('name')} />
                {itemForm.formState.errors.name && <p className="form-error">{itemForm.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="form-label">Category</label>
                <select className="form-input" {...itemForm.register('category_id')}>
                  <option value={0}>Choose a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
                {itemForm.formState.errors.category_id && <p className="form-error">{itemForm.formState.errors.category_id.message}</p>}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Unit</label>
                  <input className="form-input" {...itemForm.register('unit')} />
                </div>
                <div>
                  <label className="form-label">Reorder threshold</label>
                  <input className="form-input" type="number" min={0} step="0.01" {...itemForm.register('reorder_threshold')} />
                </div>
              </div>
              <button className="btn-primary w-full" disabled={createItem.isPending} type="submit">
                <PackagePlus className="h-4 w-4" />
                {createItem.isPending ? 'Saving...' : 'Save feed item'}
              </button>
            </form>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-neutral-100 px-6 py-5">
              <h2 className="text-lg font-bold text-neutral-900">Stock ledger</h2>
              <p className="mt-1 text-sm text-neutral-500">Live quantities from purchases and consumption postings.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-6">Feed item</th>
                    <th>Category</th>
                    <th>Stock</th>
                    <th className="pr-6">Reorder point</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={4}>
                        No feed stock items configured yet.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const lowStock = item.current_stock <= item.reorder_threshold
                      return (
                        <tr key={item.id}>
                          <td className="pl-6">
                            <div className="font-semibold text-neutral-900">{item.name}</div>
                            <div className="text-xs text-neutral-500">Unit: {item.unit}</div>
                          </td>
                          <td>{item.category?.name || '—'}</td>
                          <td>
                            <span className={lowStock ? 'badge badge-warning' : 'badge badge-brand'}>
                              {item.current_stock.toLocaleString()} {item.unit}
                            </span>
                          </td>
                          <td className="pr-6">{item.reorder_threshold.toLocaleString()} {item.unit}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {section === 'purchases' && (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="card p-6">
            <h2 className="text-lg font-bold text-neutral-900">Record purchase</h2>
            <p className="mt-1 text-sm text-neutral-500">This flow updates stock and keeps a cost trail per purchase.</p>
            <form className="mt-5 space-y-4" onSubmit={purchaseForm.handleSubmit((values) => createPurchase.mutate(values))}>
              <div>
                <label className="form-label">Supplier</label>
                <select className="form-input" {...purchaseForm.register('supplier_id')}>
                  <option value={0}>Choose supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Feed item</label>
                <select className="form-input" {...purchaseForm.register('feed_item_id')}>
                  <option value={0}>Choose item</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Purchase date</label>
                  <input className="form-input" type="date" {...purchaseForm.register('purchase_date')} />
                </div>
                <div>
                  <label className="form-label">Invoice number</label>
                  <input className="form-input" {...purchaseForm.register('invoice_number')} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Quantity</label>
                  <input className="form-input" type="number" min={0} step="0.01" {...purchaseForm.register('quantity')} />
                </div>
                <div>
                  <label className="form-label">Unit price</label>
                  <input className="form-input" type="number" min={0} step="0.01" {...purchaseForm.register('unit_price')} />
                </div>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea className="form-input min-h-[120px]" {...purchaseForm.register('notes')} />
              </div>
              <button className="btn-primary w-full" disabled={createPurchase.isPending} type="submit">
                <ShoppingBasket className="h-4 w-4" />
                {createPurchase.isPending ? 'Saving...' : 'Record purchase'}
              </button>
            </form>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-neutral-100 px-6 py-5">
              <h2 className="text-lg font-bold text-neutral-900">Purchase history</h2>
              <p className="mt-1 text-sm text-neutral-500">Posted purchases with supplier and line-item value.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-6">Date</th>
                    <th>Supplier</th>
                    <th>Items</th>
                    <th className="pr-6">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.length === 0 ? (
                    <tr>
                      <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={4}>
                        No feed purchases recorded yet.
                      </td>
                    </tr>
                  ) : (
                    purchases.map((purchase) => (
                      <tr key={purchase.id}>
                        <td className="pl-6">
                          <div className="font-semibold text-neutral-900">{formatDate(purchase.purchase_date)}</div>
                          <div className="text-xs text-neutral-500">{purchase.invoice_number || 'No invoice reference'}</div>
                        </td>
                        <td>{purchase.supplier?.name || suppliers.find((supplier) => supplier.id === purchase.supplier_id)?.name || '—'}</td>
                        <td>
                          {purchase.items.map((item) => items.find((feedItem) => feedItem.id === item.feed_item_id)?.name || `Item #${item.feed_item_id}`).join(', ')}
                        </td>
                        <td className="pr-6 font-semibold text-neutral-900">UGX {purchase.total_amount.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {section === 'consumption' && (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="card p-6">
            <h2 className="text-lg font-bold text-neutral-900">Record consumption</h2>
            <p className="mt-1 text-sm text-neutral-500">Deduct feed from stock and attach it to a real production batch.</p>
            <form className="mt-5 space-y-4" onSubmit={consumptionForm.handleSubmit((values) => createConsumption.mutate(values))}>
              <div>
                <label className="form-label">Batch</label>
                <select className="form-input" {...consumptionForm.register('batch_id')}>
                  <option value={0}>Choose batch</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>{batch.batch_number} - {batch.breed}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Feed item</label>
                <select className="form-input" {...consumptionForm.register('feed_item_id')}>
                  <option value={0}>Choose item</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Record date</label>
                  <input className="form-input" type="date" {...consumptionForm.register('record_date')} />
                </div>
                <div>
                  <label className="form-label">Quantity</label>
                  <input className="form-input" type="number" min={0} step="0.01" {...consumptionForm.register('quantity')} />
                </div>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea className="form-input min-h-[120px]" {...consumptionForm.register('notes')} />
              </div>
              <button className="btn-primary w-full" disabled={createConsumption.isPending} type="submit">
                <Wheat className="h-4 w-4" />
                {createConsumption.isPending ? 'Saving...' : 'Record consumption'}
              </button>
            </form>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-neutral-100 px-6 py-5">
              <h2 className="text-lg font-bold text-neutral-900">Consumption history</h2>
              <p className="mt-1 text-sm text-neutral-500">Posted usage entries by batch and feed item.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-6">Date</th>
                    <th>Batch</th>
                    <th>Feed item</th>
                    <th className="pr-6">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {consumptions.length === 0 ? (
                    <tr>
                      <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={4}>
                        No feed consumption recorded yet.
                      </td>
                    </tr>
                  ) : (
                    consumptions.map((log) => (
                      <tr key={log.id}>
                        <td className="pl-6">{formatDate(log.record_date)}</td>
                        <td>{batches.find((batch) => batch.id === log.batch_id)?.batch_number || `Batch #${log.batch_id}`}</td>
                        <td>{items.find((item) => item.id === log.feed_item_id)?.name || `Item #${log.feed_item_id}`}</td>
                        <td className="pr-6">
                          {log.quantity.toLocaleString()} {items.find((item) => item.id === log.feed_item_id)?.unit || ''}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
