import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, BadgeDollarSign, Boxes, ClipboardPlus, PackagePlus, ShoppingBasket, Truck, Wheat } from 'lucide-react'
import { toast } from 'sonner'

import api from '@/services/api'
import { Modal } from '@/components/Modal'
import { useAuth } from '@/features/auth/AuthContext'

type FeedSection = 'stock' | 'purchases' | 'consumption' | 'suppliers'
type FeedModal = 'supplier' | 'category' | 'item' | 'purchase' | 'consumption' | null

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

const sectionCopy: Record<
  FeedSection,
  {
    title: string
    description: string
    actionDescription: string
  }
> = {
  stock: {
    title: 'Feed Stock',
    description: 'Maintain feed categories, feed items, and reorder visibility in one register.',
    actionDescription: 'Create feed categories and stock items from dedicated dialogs instead of pinning forms on the page.',
  },
  purchases: {
    title: 'Feed Purchases',
    description: 'Capture supplier purchases and update stock cleanly from a single purchase dialog.',
    actionDescription: 'Record one feed purchase at a time and push the stock update into the feed ledger.',
  },
  consumption: {
    title: 'Feed Consumption',
    description: 'Track daily consumption by batch without crowding the batch usage history.',
    actionDescription: 'Select a batch, choose the feed item, and record daily usage from a focused modal.',
  },
  suppliers: {
    title: 'Suppliers',
    description: 'Keep the supplier directory and buying contacts tidy and easy to review.',
    actionDescription: 'Add or update supplier contacts without forcing the entry form to live beside the register.',
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
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function emptySupplierValues(): SupplierFormValues {
  return { name: '', contact_person: '', phone: '', email: '', address: '' }
}

function emptyCategoryValues(): CategoryFormValues {
  return { name: '', description: '' }
}

function emptyItemValues(): ItemFormValues {
  return { name: '', category_id: 0, unit: 'kg', reorder_threshold: 0 }
}

function emptyPurchaseValues(): PurchaseFormValues {
  return { supplier_id: 0, purchase_date: todayValue(), invoice_number: '', feed_item_id: 0, quantity: 0, unit_price: 0, notes: '' }
}

function emptyConsumptionValues(): ConsumptionFormValues {
  return { batch_id: 0, feed_item_id: 0, record_date: todayValue(), quantity: 0, notes: '' }
}

export function FeedManagementPage({ section }: { section: FeedSection }) {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const [activeModal, setActiveModal] = useState<FeedModal>(null)
  const copy = sectionCopy[section]
  const canManageFeed = hasPermission('feed:write')

  const blockWriteAction = () => {
    toast.error('You need write access to save changes here.')
  }

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
    defaultValues: emptySupplierValues(),
  })

  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: emptyCategoryValues(),
  })

  const itemForm = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: emptyItemValues(),
  })

  const purchaseForm = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: emptyPurchaseValues(),
  })

  const consumptionForm = useForm<ConsumptionFormValues>({
    resolver: zodResolver(consumptionSchema),
    defaultValues: emptyConsumptionValues(),
  })

  const createSupplier = useMutation({
    mutationFn: (values: SupplierFormValues) => api.post('/feed/suppliers', values),
    onSuccess: () => {
      toast.success('Supplier saved.')
      qc.invalidateQueries({ queryKey: ['feed-suppliers'] })
      supplierForm.reset(emptySupplierValues())
      setActiveModal(null)
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
      categoryForm.reset(emptyCategoryValues())
      setActiveModal(null)
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
      itemForm.reset(emptyItemValues())
      setActiveModal(null)
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
      purchaseForm.reset(emptyPurchaseValues())
      setActiveModal(null)
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
      consumptionForm.reset(emptyConsumptionValues())
      setActiveModal(null)
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

  const openModal = (modal: FeedModal) => {
    if (modal === 'supplier') supplierForm.reset(emptySupplierValues())
    if (modal === 'category') categoryForm.reset(emptyCategoryValues())
    if (modal === 'item') itemForm.reset(emptyItemValues())
    if (modal === 'purchase') purchaseForm.reset(emptyPurchaseValues())
    if (modal === 'consumption') consumptionForm.reset(emptyConsumptionValues())
    setActiveModal(modal)
  }

  const actionButtons = (() => {
    if (section === 'stock') {
      return (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => openModal('category')}>
            <ClipboardPlus className="h-4 w-4" />
            New category
          </button>
          <button type="button" className="btn-primary" onClick={() => openModal('item')}>
            <PackagePlus className="h-4 w-4" />
            New feed item
          </button>
        </div>
      )
    }

    const config = {
      suppliers: { modal: 'supplier' as const, label: 'Add supplier', icon: Truck },
      purchases: { modal: 'purchase' as const, label: 'Record purchase', icon: ShoppingBasket },
      consumption: { modal: 'consumption' as const, label: 'Record consumption', icon: Wheat },
    }[section]

    if (!config) return null
    const Icon = config.icon
    return (
      <button type="button" className="btn-primary" onClick={() => openModal(config.modal)}>
        <Icon className="h-4 w-4" />
        {config.label}
      </button>
    )
  })()

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">{copy.title}</h1>
          <p className="mt-1 max-w-3xl text-base font-medium text-ink-500">{copy.description}</p>
        </div>
        {actionButtons}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-ink-500">
            <Boxes className="h-5 w-5 text-brand-600" />
            <span className="text-sm font-bold uppercase tracking-[0.12em]">Feed items</span>
          </div>
          <p className="text-2xl font-bold text-ink-900">{items.length.toLocaleString()}</p>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-ink-500">
            <AlertTriangle className="h-5 w-5 text-brand-600" />
            <span className="text-sm font-bold uppercase tracking-[0.12em]">Low stock</span>
          </div>
          <p className="text-2xl font-bold text-ink-900">{lowStockCount.toLocaleString()}</p>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-ink-500">
            <BadgeDollarSign className="h-5 w-5 text-brand-600" />
            <span className="text-sm font-bold uppercase tracking-[0.12em]">
              {section === 'purchases' ? 'Purchase spend' : 'Suppliers'}
            </span>
          </div>
          <p className="text-2xl font-bold text-ink-900">
            {section === 'purchases' ? `UGX ${purchaseTotal.toLocaleString()}` : suppliers.length.toLocaleString()}
          </p>
        </div>
      </div>

      {!canManageFeed ? (
        <div className="card px-5 py-4 text-sm text-slate-500">
          You can view feed records, but saving suppliers, purchases, stock items, and consumption requires the `feed:write` permission.
        </div>
      ) : null}

      <div className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">
              {section === 'stock'
                ? 'Feed register actions'
                : section === 'suppliers'
                  ? 'Supplier entry'
                  : section === 'purchases'
                    ? 'Purchase entry'
                    : 'Consumption entry'}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">{copy.actionDescription}</p>
          </div>
          {actionButtons}
        </div>
      </div>

      {section === 'suppliers' && (
        <div className="card overflow-hidden">
          <div className="border-b border-neutral-150 bg-neutral-50 px-6 py-5">
            <h2 className="text-xl font-bold text-ink-900">Supplier directory</h2>
            <p className="mt-1 text-base text-ink-500">Saved suppliers.</p>
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
                    <td className="pl-6 py-14 text-center text-base font-medium text-ink-500" colSpan={4}>
                      No suppliers.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td className="pl-6">
                        <div className="font-bold text-ink-900">{supplier.name}</div>
                        <div className="text-sm text-ink-500">{supplier.address || 'No address'}</div>
                      </td>
                      <td>{supplier.contact_person || '-'}</td>
                      <td>{supplier.email || '-'}</td>
                      <td className="pr-6">{supplier.phone || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === 'stock' && (
        <div className="card overflow-hidden">
          <div className="border-b border-neutral-150 bg-neutral-50 px-6 py-5">
            <h2 className="text-xl font-bold text-ink-900">Stock ledger</h2>
            <p className="mt-1 text-base text-ink-500">Current feed stock and reorder status.</p>
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
                    <td className="pl-6 py-14 text-center text-base font-medium text-ink-500" colSpan={4}>
                      No feed items.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const lowStock = item.current_stock <= item.reorder_threshold
                    return (
                      <tr key={item.id}>
                        <td className="pl-6">
                          <div className="font-bold text-ink-900">{item.name}</div>
                          <div className="text-sm text-ink-500">Unit: {item.unit}</div>
                        </td>
                        <td>{item.category?.name || '-'}</td>
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
      )}

      {section === 'purchases' && (
        <div className="card overflow-hidden">
          <div className="border-b border-neutral-150 bg-neutral-50 px-6 py-5">
            <h2 className="text-xl font-bold text-ink-900">Purchase history</h2>
            <p className="mt-1 text-base text-ink-500">Recorded purchases.</p>
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
                    <td className="pl-6 py-14 text-center text-base font-medium text-ink-500" colSpan={4}>
                      No feed purchases.
                    </td>
                  </tr>
                ) : (
                  purchases.map((purchase) => (
                    <tr key={purchase.id}>
                      <td className="pl-6">
                        <div className="font-bold text-ink-900">{formatDate(purchase.purchase_date)}</div>
                        <div className="text-sm text-ink-500">{purchase.invoice_number || 'No invoice'}</div>
                      </td>
                      <td>{purchase.supplier?.name || suppliers.find((supplier) => supplier.id === purchase.supplier_id)?.name || '-'}</td>
                      <td>
                        {purchase.items.map((item) => items.find((feedItem) => feedItem.id === item.feed_item_id)?.name || `Item #${item.feed_item_id}`).join(', ')}
                      </td>
                      <td className="pr-6 font-bold text-ink-900">UGX {purchase.total_amount.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === 'consumption' && (
        <div className="card overflow-hidden">
          <div className="border-b border-neutral-150 bg-neutral-50 px-6 py-5">
            <h2 className="text-xl font-bold text-ink-900">Consumption history</h2>
            <p className="mt-1 text-base text-ink-500">Recorded usage.</p>
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
                    <td className="pl-6 py-14 text-center text-base font-medium text-ink-500" colSpan={4}>
                      No feed consumption.
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
      )}

      <Modal
        isOpen={activeModal === 'supplier'}
        onClose={() => setActiveModal(null)}
        title="Add supplier"
        description="Create a supplier contact for feed procurement."
      >
        <form className="space-y-4" onSubmit={supplierForm.handleSubmit((values) => (canManageFeed ? createSupplier.mutate(values) : blockWriteAction()))}>
          <div>
            <label className="form-label">Supplier name</label>
            <input className="form-input" {...supplierForm.register('name')} />
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
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
            <button className="btn-primary" disabled={!canManageFeed || createSupplier.isPending} type="submit">
              <Truck className="h-4 w-4" />
              {createSupplier.isPending ? 'Saving...' : 'Save supplier'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={activeModal === 'category'}
        onClose={() => setActiveModal(null)}
        title="New feed category"
        description="Group feed items under clean category labels."
      >
        <form className="space-y-4" onSubmit={categoryForm.handleSubmit((values) => (canManageFeed ? createCategory.mutate(values) : blockWriteAction()))}>
          <div>
            <label className="form-label">Category name</label>
            <input className="form-input" {...categoryForm.register('name')} />
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea className="form-input min-h-[120px]" {...categoryForm.register('description')} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
            <button className="btn-primary" disabled={!canManageFeed || createCategory.isPending} type="submit">
              <ClipboardPlus className="h-4 w-4" />
              {createCategory.isPending ? 'Saving...' : 'Save category'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={activeModal === 'item'}
        onClose={() => setActiveModal(null)}
        title="New feed item"
        description="Create a feed stock item and set its reorder threshold."
      >
        <form className="space-y-4" onSubmit={itemForm.handleSubmit((values) => (canManageFeed ? createItem.mutate(values) : blockWriteAction()))}>
          <div>
            <label className="form-label">Item name</label>
            <input className="form-input" {...itemForm.register('name')} />
          </div>
          <div>
            <label className="form-label">Category</label>
            <select className="form-input" {...itemForm.register('category_id')}>
              <option value={0}>Choose a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
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
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
            <button className="btn-primary" disabled={!canManageFeed || createItem.isPending} type="submit">
              <PackagePlus className="h-4 w-4" />
              {createItem.isPending ? 'Saving...' : 'Save feed item'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={activeModal === 'purchase'}
        onClose={() => setActiveModal(null)}
        title="Record purchase"
        description="Post a supplier purchase and update feed stock."
      >
        <form className="space-y-4" onSubmit={purchaseForm.handleSubmit((values) => (canManageFeed ? createPurchase.mutate(values) : blockWriteAction()))}>
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
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
            <button className="btn-primary" disabled={!canManageFeed || createPurchase.isPending} type="submit">
              <ShoppingBasket className="h-4 w-4" />
              {createPurchase.isPending ? 'Saving...' : 'Record purchase'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={activeModal === 'consumption'}
        onClose={() => setActiveModal(null)}
        title="Record consumption"
        description="Post daily feed usage against a live batch."
      >
        <form className="space-y-4" onSubmit={consumptionForm.handleSubmit((values) => (canManageFeed ? createConsumption.mutate(values) : blockWriteAction()))}>
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
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
            <button className="btn-primary" disabled={!canManageFeed || createConsumption.isPending} type="submit">
              <Wheat className="h-4 w-4" />
              {createConsumption.isPending ? 'Saving...' : 'Record consumption'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
