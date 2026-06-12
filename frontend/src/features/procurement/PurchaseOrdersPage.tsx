import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FileDown, PackageCheck, Plus, Send, Trash2, Undo2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import clsx from 'clsx'

import api from '@/services/api'
import { Modal } from '@/components/Modal'
import { UGX } from '@/lib/money'
import {
  procurementService,
  type POItem,
  type POStatus,
  type PurchaseOrder,
  type ReceiveItem,
} from '@/services/procurementService'

interface SupplierOption {
  id: number
  name: string
}

interface BranchOption {
  id: number
  name: string
}

interface StockItemOption {
  id: number
  name: string
  unit_of_measure: string
  unit_price?: number
}

interface ItemRow {
  stock_item_id: number | ''
  description: string
  quantity_ordered: string
  unit_of_measure: string
  unit_price: string
}

const STATUS_BADGE: Record<POStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  partially_received: 'bg-orange-50 text-orange-700 border-orange-200',
  fully_received: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  closed: 'bg-slate-100 text-slate-500 border-slate-200',
}

const STATUS_LABEL: Record<POStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  partially_received: 'Partially Received',
  fully_received: 'Fully Received',
  cancelled: 'Cancelled',
  closed: 'Closed',
}

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

function emptyItemRow(): ItemRow {
  return { stock_item_id: '', description: '', quantity_ordered: '', unit_of_measure: '', unit_price: '' }
}

export function PurchaseOrdersPage() {
  const qc = useQueryClient()

  // Filters
  const [statusFilter, setStatusFilter] = useState<POStatus | ''>('')
  const [supplierFilter, setSupplierFilter] = useState<number | ''>('')
  const [branchFilter, setBranchFilter] = useState<number | ''>('')

  // New PO modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [supplierId, setSupplierId] = useState<number | ''>('')
  const [orderDate, setOrderDate] = useState(todayValue())
  const [expectedDate, setExpectedDate] = useState('')
  const [branchId, setBranchId] = useState<number | ''>('')
  const [taxAmount, setTaxAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [itemRows, setItemRows] = useState<ItemRow[]>([emptyItemRow()])

  // Receive modal state
  const [receivePo, setReceivePo] = useState<PurchaseOrder | null>(null)
  const [receiveQuantities, setReceiveQuantities] = useState<Record<number, string>>({})

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['purchase-orders', statusFilter, supplierFilter, branchFilter],
    queryFn: () =>
      procurementService.listPurchaseOrders({
        status: statusFilter || undefined,
        supplier_id: supplierFilter || undefined,
        branch_id: branchFilter || undefined,
        limit: 200,
      }),
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ['procurement-suppliers'],
    queryFn: () => api.get<SupplierOption[]>('/feed/suppliers').then(r => r.data),
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['procurement-branches'],
    queryFn: () => api.get<BranchOption[]>('/settings/branches').then(r => r.data),
  })

  const { data: stockItems = [] } = useQuery({
    queryKey: ['procurement-stock-items'],
    queryFn: () => api.get<StockItemOption[]>('/inventory/items').then(r => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['purchase-orders'] })

  const createMutation = useMutation({
    mutationFn: procurementService.createPurchaseOrder,
    onSuccess: (po) => {
      toast.success(`Purchase order ${po.po_number} created`)
      invalidate()
      closeCreateModal()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to create purchase order'),
  })

  const workflowMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'submit' | 'approve' | 'reject' | 'cancel' }) => {
      if (action === 'submit') return procurementService.submitPurchaseOrder(id)
      if (action === 'approve') return procurementService.approvePurchaseOrder(id)
      if (action === 'reject') return procurementService.rejectPurchaseOrder(id)
      return procurementService.cancelPurchaseOrder(id)
    },
    onSuccess: (po) => {
      toast.success(`${po.po_number} is now ${STATUS_LABEL[po.status]}`)
      invalidate()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Workflow action failed'),
  })

  const receiveMutation = useMutation({
    mutationFn: ({ id, items }: { id: number; items: ReceiveItem[] }) =>
      procurementService.receiveGoods(id, items),
    onSuccess: (po) => {
      toast.success(`Goods receipt recorded for ${po.po_number}`)
      invalidate()
      qc.invalidateQueries({ queryKey: ['procurement-stock-items'] })
      setReceivePo(null)
      setReceiveQuantities({})
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to record goods receipt'),
  })

  const closeCreateModal = () => {
    setIsCreateOpen(false)
    setSupplierId('')
    setOrderDate(todayValue())
    setExpectedDate('')
    setBranchId('')
    setTaxAmount('')
    setNotes('')
    setItemRows([emptyItemRow()])
  }

  const updateItemRow = (index: number, patch: Partial<ItemRow>) => {
    setItemRows(rows => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const handleStockItemSelect = (index: number, value: string) => {
    const id = value ? Number(value) : ''
    const stock = stockItems.find(s => s.id === id)
    updateItemRow(index, {
      stock_item_id: id,
      description: stock ? stock.name : itemRows[index].description,
      unit_of_measure: stock ? stock.unit_of_measure : itemRows[index].unit_of_measure,
    })
  }

  const liveTotals = useMemo(() => {
    const subtotal = itemRows.reduce(
      (sum, row) => sum + (Number(row.quantity_ordered) || 0) * (Number(row.unit_price) || 0),
      0
    )
    const tax = Number(taxAmount) || 0
    return { subtotal, tax, total: subtotal + tax }
  }, [itemRows, taxAmount])

  const handleCreate = () => {
    if (!supplierId) {
      toast.error('Select a supplier')
      return
    }
    const items: POItem[] = itemRows
      .filter(row => row.description.trim() && Number(row.quantity_ordered) > 0)
      .map(row => ({
        stock_item_id: row.stock_item_id || null,
        description: row.description.trim(),
        quantity_ordered: Number(row.quantity_ordered),
        unit_of_measure: row.unit_of_measure || null,
        unit_price: Number(row.unit_price) || 0,
      }))
    if (items.length === 0) {
      toast.error('Add at least one item with a description and quantity')
      return
    }
    createMutation.mutate({
      supplier_id: supplierId,
      branch_id: branchId || null,
      delivery_branch_id: branchId || null,
      order_date: orderDate,
      expected_delivery_date: expectedDate || null,
      tax_amount: Number(taxAmount) || 0,
      notes: notes || null,
      items,
    })
  }

  const openReceiveModal = (po: PurchaseOrder) => {
    setReceivePo(po)
    const initial: Record<number, string> = {}
    po.items.forEach(item => {
      if (item.id != null) initial[item.id] = ''
    })
    setReceiveQuantities(initial)
  }

  const handleReceive = () => {
    if (!receivePo) return
    const items: ReceiveItem[] = Object.entries(receiveQuantities)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([itemId, qty]) => ({
        item_id: Number(itemId),
        qty_received: Number(qty),
        branch_id: receivePo.delivery_branch_id ?? receivePo.branch_id ?? null,
      }))
    if (items.length === 0) {
      toast.error('Enter a received quantity for at least one item')
      return
    }
    receiveMutation.mutate({ id: receivePo.id, items })
  }

  const downloadPdf = async (po: PurchaseOrder) => {
    try {
      await procurementService.downloadPurchaseOrderPdf(po.id, po.po_number)
    } catch {
      toast.error('Failed to download PO PDF')
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Purchase Orders</h1>
          <p className="section-subtitle">
            Raise, approve, and receive supplier purchase orders with automatic inventory and journal posting.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Purchase Order
        </button>
      </div>

      {/* Filter bar */}
      <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-end">
        <div className="w-full md:w-52">
          <label className="form-label">Status</label>
          <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value as POStatus | '')}>
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABEL) as POStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
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
        <div className="w-full md:w-52">
          <label className="form-label">Branch</label>
          <select className="form-input" value={branchFilter} onChange={e => setBranchFilter(e.target.value ? Number(e.target.value) : '')}>
            <option value="">All branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* PO table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">PO Number</th>
                <th>Supplier</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th className="pr-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="py-12 pl-6 text-sm text-neutral-500">Loading purchase orders...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="py-12 pl-6 text-sm text-neutral-500">No purchase orders yet.</td></tr>
              ) : (
                orders.map(po => (
                  <tr key={po.id}>
                    <td className="pl-6 font-semibold text-neutral-900">{po.po_number}</td>
                    <td>{po.supplier?.name ?? `Supplier #${po.supplier_id}`}</td>
                    <td>{po.order_date}</td>
                    <td>{po.items.length}</td>
                    <td className="font-semibold text-neutral-900">{UGX(po.total_amount)}</td>
                    <td>
                      <span className={clsx('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', STATUS_BADGE[po.status])}>
                        {STATUS_LABEL[po.status]}
                      </span>
                    </td>
                    <td className="pr-6">
                      <div className="flex flex-wrap items-center gap-2">
                        {po.status === 'draft' && (
                          <>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              disabled={workflowMutation.isPending}
                              onClick={() => workflowMutation.mutate({ id: po.id, action: 'submit' })}
                            >
                              <Send className="h-3.5 w-3.5" /> Submit
                            </button>
                            <button
                              type="button"
                              className="btn-secondary btn-sm text-red-600"
                              disabled={workflowMutation.isPending}
                              onClick={() => workflowMutation.mutate({ id: po.id, action: 'cancel' })}
                            >
                              <XCircle className="h-3.5 w-3.5" /> Cancel
                            </button>
                          </>
                        )}
                        {po.status === 'submitted' && (
                          <>
                            <button
                              type="button"
                              className="btn-secondary btn-sm text-green-700"
                              disabled={workflowMutation.isPending}
                              onClick={() => workflowMutation.mutate({ id: po.id, action: 'approve' })}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              disabled={workflowMutation.isPending}
                              onClick={() => workflowMutation.mutate({ id: po.id, action: 'reject' })}
                            >
                              <Undo2 className="h-3.5 w-3.5" /> Reject
                            </button>
                          </>
                        )}
                        {(po.status === 'approved' || po.status === 'partially_received') && (
                          <button
                            type="button"
                            className="btn-secondary btn-sm text-blue-700"
                            onClick={() => openReceiveModal(po)}
                          >
                            <PackageCheck className="h-3.5 w-3.5" /> Record Receipt
                          </button>
                        )}
                        <button type="button" className="btn-secondary btn-sm" onClick={() => downloadPdf(po)}>
                          <FileDown className="h-3.5 w-3.5" /> PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New PO modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={closeCreateModal}
        title="New Purchase Order"
        description="Select a supplier, add line items, and save as a draft for approval."
      >
        <div className="space-y-5">
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
              <label className="form-label">Delivery branch</label>
              <select className="form-input" value={branchId} onChange={e => setBranchId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">No branch</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Order date</label>
              <input className="form-input" type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Expected delivery</label>
              <input className="form-input" type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
            </div>
          </div>

          {/* Items grid */}
          <div className="rounded-[14px] border border-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Items</span>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setItemRows(rows => [...rows, emptyItemRow()])}>
                <Plus className="h-3.5 w-3.5" /> Add item
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <th className="px-3 py-2">Stock item</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 w-24">Qty</th>
                    <th className="px-3 py-2 w-24">UOM</th>
                    <th className="px-3 py-2 w-32">Unit price</th>
                    <th className="px-3 py-2 w-32 text-right">Total</th>
                    <th className="px-2 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {itemRows.map((row, index) => (
                    <tr key={index} className="border-b border-neutral-100">
                      <td className="px-3 py-2">
                        <select
                          className="form-input py-1.5 text-xs"
                          value={row.stock_item_id}
                          onChange={e => handleStockItemSelect(index, e.target.value)}
                        >
                          <option value="">Free text</option>
                          {stockItems.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="form-input py-1.5 text-xs"
                          placeholder="Item description"
                          value={row.description}
                          onChange={e => updateItemRow(index, { description: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="form-input py-1.5 text-xs"
                          type="number" min={0} step="0.01"
                          value={row.quantity_ordered}
                          onChange={e => updateItemRow(index, { quantity_ordered: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="form-input py-1.5 text-xs"
                          placeholder="kg, bags..."
                          value={row.unit_of_measure}
                          onChange={e => updateItemRow(index, { unit_of_measure: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="form-input py-1.5 text-xs"
                          type="number" min={0} step="0.01"
                          value={row.unit_price}
                          onChange={e => updateItemRow(index, { unit_price: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-neutral-800">
                        {UGX((Number(row.quantity_ordered) || 0) * (Number(row.unit_price) || 0))}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="rounded p-1 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          disabled={itemRows.length === 1}
                          onClick={() => setItemRows(rows => rows.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="form-label">Tax amount (UGX)</label>
              <input className="form-input" type="number" min={0} step="0.01" value={taxAmount} onChange={e => setTaxAmount(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Notes</label>
              <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>

          {/* Live totals */}
          <div className="flex flex-col items-end gap-1 rounded-[14px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
            <div className="flex w-56 justify-between"><span className="text-neutral-500">Subtotal</span><span className="font-medium">{UGX(liveTotals.subtotal)}</span></div>
            <div className="flex w-56 justify-between"><span className="text-neutral-500">Tax</span><span className="font-medium">{UGX(liveTotals.tax)}</span></div>
            <div className="flex w-56 justify-between border-t border-neutral-200 pt-1 text-base font-semibold text-neutral-900">
              <span>Grand Total</span><span>{UGX(liveTotals.total)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={closeCreateModal}>Cancel</button>
            <button type="button" className="btn-primary" disabled={createMutation.isPending} onClick={handleCreate}>
              {createMutation.isPending ? 'Saving...' : 'Create Purchase Order'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Receive goods modal */}
      <Modal
        isOpen={!!receivePo}
        onClose={() => { setReceivePo(null); setReceiveQuantities({}) }}
        title={receivePo ? `Record Receipt — ${receivePo.po_number}` : 'Record Receipt'}
        description="Enter the quantities received. Stock and the GRN journal are posted automatically."
      >
        {receivePo && (
          <div className="space-y-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="px-2 py-2">Item</th>
                  <th className="px-2 py-2 text-right">Ordered</th>
                  <th className="px-2 py-2 text-right">Already received</th>
                  <th className="px-2 py-2 w-32">Receive now</th>
                </tr>
              </thead>
              <tbody>
                {receivePo.items.map(item => {
                  const outstanding = Number(item.quantity_ordered) - Number(item.quantity_received ?? 0)
                  return (
                    <tr key={item.id} className="border-b border-neutral-100">
                      <td className="px-2 py-2">
                        <div className="font-medium text-neutral-900">{item.description}</div>
                        <div className="text-xs text-neutral-500">{item.unit_of_measure || ''}</div>
                      </td>
                      <td className="px-2 py-2 text-right">{Number(item.quantity_ordered).toLocaleString()}</td>
                      <td className="px-2 py-2 text-right">{Number(item.quantity_received ?? 0).toLocaleString()}</td>
                      <td className="px-2 py-2">
                        <input
                          className="form-input py-1.5 text-xs"
                          type="number" min={0} max={outstanding} step="0.01"
                          placeholder={`Max ${outstanding}`}
                          value={item.id != null ? receiveQuantities[item.id] ?? '' : ''}
                          disabled={outstanding <= 0}
                          onChange={e => {
                            if (item.id != null) {
                              setReceiveQuantities(prev => ({ ...prev, [item.id as number]: e.target.value }))
                            }
                          }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => { setReceivePo(null); setReceiveQuantities({}) }}>Cancel</button>
              <button type="button" className="btn-primary" disabled={receiveMutation.isPending} onClick={handleReceive}>
                <PackageCheck className="h-4 w-4" />
                {receiveMutation.isPending ? 'Posting...' : 'Post Goods Receipt'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
