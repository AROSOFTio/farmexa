import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeftRight, Boxes, PackagePlus, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'

import api from '@/services/api'
import { Modal } from '@/components/Modal'

type InventorySection = 'items' | 'movements' | 'medicine'

interface StockItem {
  id: number
  name: string
  sku?: string | null
  category: string
  unit_of_measure: string
  reorder_level: number
  unit_price: number
  average_cost: number
  current_quantity: number
  description?: string | null
  is_active: boolean
  created_at: string
}

interface StockMovement {
  id: number
  item_id: number
  movement_type: 'in' | 'out' | 'adjustment'
  quantity: number
  previous_quantity: number
  new_quantity: number
  reference_type?: string | null
  reference_id?: number | null
  unit_cost?: number | null
  notes?: string | null
  created_at: string
}

const itemSchema = z.object({
  name: z.string().min(2, 'Item name is required'),
  sku: z.string().optional(),
  category: z.enum(['raw_material', 'packaging', 'medicine', 'finished_product', 'other']),
  unit_of_measure: z.string().min(1, 'Unit of measure is required'),
  reorder_level: z.coerce.number().min(0, 'Reorder level must be zero or more'),
  unit_price: z.coerce.number().min(0, 'Unit price must be zero or more'),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  initial_quantity: z.coerce.number().min(0, 'Initial quantity must be zero or more'),
  initial_unit_cost: z.coerce.number().min(0, 'Initial unit cost must be zero or more'),
})

const movementSchema = z.object({
  item_id: z.coerce.number().int().positive('Stock item is required'),
  movement_type: z.enum(['in', 'out', 'adjustment']),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  reference_type: z.string().optional(),
  reference_id: z.coerce.number().optional(),
  unit_cost: z.coerce.number().optional(),
  notes: z.string().optional(),
})

type ItemFormValues = z.infer<typeof itemSchema>
type MovementFormValues = z.infer<typeof movementSchema>

const sectionCopy: Record<
  InventorySection,
  { title: string; description: string; actionLabel: string; actionDescription: string }
> = {
  items: {
    title: 'Inventory Items',
    description: 'Maintain stock-controlled products, packaging, and reusable inventory from a single register.',
    actionLabel: 'Add inventory item',
    actionDescription: 'Register a stock-controlled item with opening quantity, cost, and reorder level.',
  },
  medicine: {
    title: 'Medicine Stock',
    description: 'Vaccines, drugs, and treatment supplies with clean reorder visibility.',
    actionLabel: 'Add medicine item',
    actionDescription: 'Create a medicine or vaccine record with opening quantity and stock cost.',
  },
  movements: {
    title: 'Stock Movements',
    description: 'Track inbound, outbound, and adjustment activity against live inventory balances.',
    actionLabel: 'Post movement',
    actionDescription: 'Record stock in, stock out, or an adjustment against an existing item.',
  },
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function emptyItemValues(isMedicineView: boolean): ItemFormValues {
  return {
    name: '',
    sku: '',
    category: isMedicineView ? 'medicine' : 'finished_product',
    unit_of_measure: 'kg',
    reorder_level: 0,
    unit_price: 0,
    description: '',
    is_active: true,
    initial_quantity: 0,
    initial_unit_cost: 0,
  }
}

function emptyMovementValues(): MovementFormValues {
  return {
    item_id: 0,
    movement_type: 'in',
    quantity: 0,
    reference_type: '',
    reference_id: undefined,
    unit_cost: undefined,
    notes: '',
  }
}

export function InventoryPage({ section }: { section: InventorySection }) {
  const qc = useQueryClient()
  const copy = sectionCopy[section]
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<StockItem | null>(null)
  const isMedicineView = section === 'medicine'
  const itemsEndpoint = isMedicineView ? '/inventory/medicine/items' : '/inventory/items'
  const movementsEndpoint = isMedicineView ? '/inventory/medicine/movements' : '/inventory/movements'

  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items', section],
    queryFn: () => api.get<StockItem[]>(itemsEndpoint).then((response) => response.data),
  })

  const { data: movements = [] } = useQuery({
    queryKey: ['inventory-movements', section],
    queryFn: () => api.get<StockMovement[]>(movementsEndpoint).then((response) => response.data),
    enabled: section === 'movements' || section === 'medicine',
  })

  const itemForm = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: emptyItemValues(isMedicineView),
  })

  const movementForm = useForm<MovementFormValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: emptyMovementValues(),
  })

  const createItem = useMutation({
    mutationFn: (values: ItemFormValues) =>
      api.post(itemsEndpoint, {
        ...values,
        category: isMedicineView ? 'medicine' : values.category,
      }),
    onSuccess: () => {
      toast.success(isMedicineView ? 'Medicine item created.' : 'Inventory item created.')
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      qc.invalidateQueries({ queryKey: ['inventory-items', section] })
      itemForm.reset(emptyItemValues(isMedicineView))
      setIsItemModalOpen(false)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? (isMedicineView ? 'Failed to create medicine item.' : 'Failed to create inventory item.'))
    },
  })

  const updateItem = useMutation({
    mutationFn: (values: ItemFormValues) => {
      if (!editingItem) {
        throw new Error('No item selected')
      }
      return api.put(`${itemsEndpoint}/${editingItem.id}`, {
        name: values.name,
        sku: values.sku || null,
        category: isMedicineView ? 'medicine' : values.category,
        unit_of_measure: values.unit_of_measure,
        reorder_level: values.reorder_level,
        unit_price: values.unit_price,
        description: values.description || null,
        is_active: values.is_active,
      })
    },
    onSuccess: () => {
      toast.success('Inventory item updated.')
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      qc.invalidateQueries({ queryKey: ['inventory-items', section] })
      setEditingItem(null)
      itemForm.reset(emptyItemValues(isMedicineView))
      setIsItemModalOpen(false)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to update inventory item.')
    },
  })

  const createMovement = useMutation({
    mutationFn: (values: MovementFormValues) =>
      api.post('/inventory/movements', {
        ...values,
        reference_id: values.reference_id || null,
        unit_cost: values.unit_cost ?? null,
        reference_type: values.reference_type || null,
        notes: values.notes || null,
      }),
    onSuccess: () => {
      toast.success('Stock movement recorded.')
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      qc.invalidateQueries({ queryKey: ['inventory-movements'] })
      qc.invalidateQueries({ queryKey: ['inventory-items', section] })
      qc.invalidateQueries({ queryKey: ['inventory-movements', section] })
      movementForm.reset(emptyMovementValues())
      setIsMovementModalOpen(false)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to record stock movement.')
    },
  })

  const visibleItems = useMemo(
    () => (isMedicineView ? items.filter((item) => item.category === 'medicine') : items),
    [isMedicineView, items]
  )

  const visibleMovements = useMemo(
    () =>
      isMedicineView
        ? movements.filter((movement) => items.find((item) => item.id === movement.item_id)?.category === 'medicine')
        : movements,
    [isMedicineView, items, movements]
  )

  const lowStockCount = useMemo(
    () => visibleItems.filter((item) => item.current_quantity <= item.reorder_level).length,
    [visibleItems]
  )

  const openItemModal = () => {
    setEditingItem(null)
    itemForm.reset(emptyItemValues(isMedicineView))
    setIsItemModalOpen(true)
  }

  const openEditItemModal = (item: StockItem) => {
    setEditingItem(item)
    itemForm.reset({
      name: item.name,
      sku: item.sku ?? '',
      category: item.category as ItemFormValues['category'],
      unit_of_measure: item.unit_of_measure,
      reorder_level: item.reorder_level,
      unit_price: item.unit_price,
      description: item.description ?? '',
      is_active: item.is_active,
      initial_quantity: item.current_quantity,
      initial_unit_cost: item.average_cost,
    })
    setIsItemModalOpen(true)
  }

  const openMovementModal = () => {
    movementForm.reset(emptyMovementValues())
    setIsMovementModalOpen(true)
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{copy.title}</h1>
          <p className="mt-1 max-w-3xl text-sm font-medium text-neutral-500">{copy.description}</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={section === 'movements' ? openMovementModal : openItemModal}
        >
          {section === 'movements' ? <ArrowLeftRight className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />}
          {copy.actionLabel}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-neutral-500">
            <Boxes className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em]">Tracked items</span>
          </div>
          <p className="text-xl font-bold text-neutral-900">{visibleItems.length.toLocaleString()}</p>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-neutral-500">
            <TrendingDown className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em]">Low stock items</span>
          </div>
          <p className="text-xl font-bold text-neutral-900">{lowStockCount.toLocaleString()}</p>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-neutral-500">
            <ArrowLeftRight className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em]">Recent movements</span>
          </div>
          <p className="text-xl font-bold text-neutral-900">{visibleMovements.length.toLocaleString()}</p>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">{copy.actionLabel}</h2>
            <p className="mt-1 text-sm text-neutral-500">{copy.actionDescription}</p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={section === 'movements' ? openMovementModal : openItemModal}
          >
            {section === 'movements' ? <ArrowLeftRight className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />}
            {copy.actionLabel}
          </button>
        </div>
      </div>

      {section !== 'movements' && (
        <div className="card overflow-hidden">
          <div className="border-b border-neutral-100 px-6 py-5">
            <h2 className="text-lg font-bold text-neutral-900">{isMedicineView ? 'Medicine register' : 'Item register'}</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {isMedicineView ? 'Available medicines and treatment supplies.' : 'Current inventory balances and unit costs.'}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-6">Item</th>
                  <th>Category</th>
                  <th>Quantity</th>
                  <th>Average cost</th>
                  <th className="pr-6">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.length === 0 ? (
                  <tr>
                    <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={5}>
                      {isMedicineView ? 'No medicine stock items.' : 'No inventory items.'}
                    </td>
                  </tr>
                ) : (
                  visibleItems.map((item) => {
                    const lowStock = item.current_quantity <= item.reorder_level
                    return (
                      <tr key={item.id}>
                        <td className="pl-6">
                          <div className="font-semibold text-neutral-900">{item.name}</div>
                          <div className="text-xs text-neutral-500">{item.sku || 'No SKU'} | {item.unit_of_measure}</div>
                        </td>
                        <td>{item.category.replace('_', ' ')}</td>
                        <td>{item.current_quantity.toLocaleString()} {item.unit_of_measure}</td>
                        <td>UGX {item.average_cost.toLocaleString()}</td>
                        <td className="pr-6">
                          <div className="flex items-center justify-between gap-3">
                            <span className={lowStock ? 'badge badge-warning' : 'badge badge-brand'}>
                              {lowStock ? 'Low stock' : item.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <button type="button" className="btn-ghost btn-sm" onClick={() => openEditItemModal(item)}>
                              Edit
                            </button>
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
      )}

      {section === 'movements' && (
        <div className="card overflow-hidden">
          <div className="border-b border-neutral-100 px-6 py-5">
            <h2 className="text-lg font-bold text-neutral-900">Movement log</h2>
            <p className="mt-1 text-sm text-neutral-500">Recorded stock changes.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-6">Date</th>
                  <th>Item</th>
                  <th>Movement</th>
                  <th>Balance</th>
                  <th className="pr-6">Reference</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={5}>
                      No stock movements.
                    </td>
                  </tr>
                ) : (
                  movements.map((movement) => {
                    const item = items.find((stockItem) => stockItem.id === movement.item_id)
                    const isInbound = movement.movement_type === 'in'
                    return (
                      <tr key={movement.id}>
                        <td className="pl-6">{formatDate(movement.created_at)}</td>
                        <td>{item?.name || `Item #${movement.item_id}`}</td>
                        <td>
                          <span className={isInbound ? 'badge badge-success' : movement.movement_type === 'out' ? 'badge badge-warning' : 'badge badge-brand'}>
                            {movement.movement_type}
                          </span>
                          <div className="mt-1 text-xs text-neutral-500">
                            {movement.quantity.toLocaleString()} {item?.unit_of_measure || ''}
                          </div>
                        </td>
                        <td>{movement.previous_quantity.toLocaleString()} to {movement.new_quantity.toLocaleString()}</td>
                        <td className="pr-6">{movement.reference_type ? `${movement.reference_type}${movement.reference_id ? ` #${movement.reference_id}` : ''}` : 'Manual'}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title={copy.actionLabel}
        description={copy.actionDescription}
      >
        <form className="space-y-4" onSubmit={itemForm.handleSubmit((values) => {
          if (editingItem) {
            updateItem.mutate(values)
            return
          }
          createItem.mutate(values)
        })}>
          <div>
            <label className="form-label">Item name</label>
            <input className="form-input" {...itemForm.register('name')} />
          </div>
          <div>
            <label className="form-label">SKU</label>
            <input className="form-input" {...itemForm.register('sku')} />
          </div>
          {isMedicineView ? (
            <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              Category is locked to <span className="font-semibold text-neutral-900">Medicine</span> for this workflow.
            </div>
          ) : (
            <div>
              <label className="form-label">Category</label>
              <select className="form-input" {...itemForm.register('category')}>
                <option value="raw_material">Raw material</option>
                <option value="packaging">Packaging</option>
                <option value="medicine">Medicine</option>
                <option value="finished_product">Finished product</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="form-label">Unit</label>
              <input className="form-input" {...itemForm.register('unit_of_measure')} />
            </div>
            <div>
              <label className="form-label">Reorder level</label>
              <input className="form-input" type="number" min={0} step="0.01" {...itemForm.register('reorder_level')} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="form-label">Unit price</label>
              <input className="form-input" type="number" min={0} step="0.01" {...itemForm.register('unit_price')} />
            </div>
            <div>
              <label className="form-label">Initial unit cost</label>
              <input className="form-input" type="number" min={0} step="0.01" {...itemForm.register('initial_unit_cost')} />
            </div>
          </div>
          <div>
            <label className="form-label">Initial quantity</label>
            <input className="form-input" type="number" min={0} step="0.01" {...itemForm.register('initial_quantity')} disabled={!!editingItem} />
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea className="form-input min-h-[120px]" {...itemForm.register('description')} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setIsItemModalOpen(false)}>Close</button>
            <button className="btn-primary" disabled={createItem.isPending || updateItem.isPending} type="submit">
              <PackagePlus className="h-4 w-4" />
              {createItem.isPending || updateItem.isPending ? 'Saving...' : editingItem ? 'Save item' : copy.actionLabel}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        title="Post movement"
        description={sectionCopy.movements.actionDescription}
      >
        <form className="space-y-4" onSubmit={movementForm.handleSubmit((values) => createMovement.mutate(values))}>
          <div>
            <label className="form-label">Stock item</label>
            <select className="form-input" {...movementForm.register('item_id')}>
              <option value={0}>Choose item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="form-label">Movement type</label>
              <select className="form-input" {...movementForm.register('movement_type')}>
                <option value="in">Stock in</option>
                <option value="out">Stock out</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>
            <div>
              <label className="form-label">Quantity</label>
              <input className="form-input" type="number" min={0} step="0.01" {...movementForm.register('quantity')} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="form-label">Reference type</label>
              <input className="form-input" {...movementForm.register('reference_type')} />
            </div>
            <div>
              <label className="form-label">Reference ID</label>
              <input className="form-input" type="number" min={0} {...movementForm.register('reference_id')} />
            </div>
          </div>
          <div>
            <label className="form-label">Unit cost</label>
            <input className="form-input" type="number" min={0} step="0.01" {...movementForm.register('unit_cost')} />
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input min-h-[120px]" {...movementForm.register('notes')} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setIsMovementModalOpen(false)}>Close</button>
            <button className="btn-primary" disabled={createMovement.isPending} type="submit">
              <ArrowLeftRight className="h-4 w-4" />
              {createMovement.isPending ? 'Saving...' : 'Post movement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
