import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeftRight, CheckCircle2, ClipboardList, Send, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import api from '@/services/api'
import { Modal } from '@/components/Modal'

type View = 'transfers' | 'grn' | 'giv' | 'low-stock'

interface StockItem {
  id: number
  name: string
  unit_of_measure: string
  current_quantity: number
  reorder_level: number
}

interface StoreLocation {
  id: number
  name: string
  code: string
  type: string
  is_active: boolean
}

interface GIV {
  id: number
  giv_number: string
  item_id: number
  quantity: number
  unit: string
  from_store_location_id: number
  destination: string | null
  purpose: string | null
  notes: string | null
  status: 'draft' | 'approved' | 'issued' | 'cancelled'
  issued_by_id: number
  approved_by_id: number | null
  issued_at: string | null
  created_at: string
  from_store_location?: StoreLocation
  item?: StockItem
}

interface GRN {
  id: number
  grn_number: string
  item_id: number
  quantity: number
  unit: string
  received_into_store_location_id: number
  source_type: string
  supplier_reference: string | null
  unit_cost: number | null
  notes: string | null
  status: 'draft' | 'approved' | 'received' | 'cancelled'
  received_by_id: number
  approved_by_id: number | null
  received_at: string | null
  created_at: string
  received_into_store_location?: StoreLocation
  item?: StockItem
}

const givSchema = z.object({
  item_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1),
  from_store_location_id: z.coerce.number().int().positive(),
  destination: z.string().optional(),
  purpose: z.string().optional(),
  notes: z.string().optional(),
})

const grnSchema = z.object({
  item_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1),
  received_into_store_location_id: z.coerce.number().int().positive(),
  source_type: z.string().min(1).default('supplier'),
  supplier_reference: z.string().optional(),
  unit_cost: z.coerce.number().nonnegative().optional(),
  notes: z.string().optional(),
})

type GIVValues = z.infer<typeof givSchema>
type GRNValues = z.infer<typeof grnSchema>

export function InventoryTransfersPage({ view }: { view: View }) {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)

  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => api.get<StockItem[]>('/inventory/items').then((response) => response.data),
  })

  const { data: storeLocations = [] } = useQuery({
    queryKey: ['store-locations'],
    queryFn: () => api.get<StoreLocation[]>('/inventory/store-locations').then((response) => response.data),
  })

  const { data: givs = [] } = useQuery({
    queryKey: ['giv-documents'],
    queryFn: () => api.get<GIV[]>('/inventory/giv').then((response) => response.data),
    enabled: view === 'giv' || view === 'transfers',
  })

  const { data: grns = [] } = useQuery({
    queryKey: ['grn-documents'],
    queryFn: () => api.get<GRN[]>('/inventory/grn').then((response) => response.data),
    enabled: view === 'grn' || view === 'transfers',
  })

  const lowStock = useMemo(() => items.filter((item) => item.current_quantity <= item.reorder_level), [items])

  const givForm = useForm<GIVValues>({
    resolver: zodResolver(givSchema),
    defaultValues: {
      item_id: 0,
      quantity: 0,
      unit: 'kg',
      from_store_location_id: 0,
      destination: '',
      purpose: '',
      notes: '',
    },
  })

  const grnForm = useForm<GRNValues>({
    resolver: zodResolver(grnSchema),
    defaultValues: {
      item_id: 0,
      quantity: 0,
      unit: 'kg',
      received_into_store_location_id: 0,
      source_type: 'supplier',
      supplier_reference: '',
      unit_cost: 0,
      notes: '',
    },
  })

  const createGIV = useMutation({
    mutationFn: (values: GIVValues) => api.post('/inventory/giv', values),
    onSuccess: () => {
      toast.success('GIV saved.')
      qc.invalidateQueries({ queryKey: ['giv-documents'] })
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      setModalOpen(false)
      givForm.reset()
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail ?? 'Failed to save GIV.'),
  })

  const createGRN = useMutation({
    mutationFn: (values: GRNValues) => api.post('/inventory/grn', values),
    onSuccess: () => {
      toast.success('GRN saved.')
      qc.invalidateQueries({ queryKey: ['grn-documents'] })
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      setModalOpen(false)
      grnForm.reset()
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail ?? 'Failed to save GRN.'),
  })

  const updateGIVStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'issued' | 'cancelled' }) => api.patch(`/inventory/giv/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('GIV status updated.')
      qc.invalidateQueries({ queryKey: ['giv-documents'] })
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail ?? 'Failed to update GIV status.'),
  })

  const updateGRNStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'received' | 'cancelled' }) => api.patch(`/inventory/grn/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('GRN status updated.')
      qc.invalidateQueries({ queryKey: ['grn-documents'] })
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail ?? 'Failed to update GRN status.'),
  })

  if (view === 'low-stock') {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="section-header"><div><h1 className="section-title">Low Stock Alerts</h1><p className="section-subtitle">Items at or below reorder level.</p></div></div>
        <div className="card overflow-hidden"><table className="data-table"><thead><tr><th className="pl-6">Item</th><th>Available</th><th className="pr-6">Reorder level</th></tr></thead><tbody>{lowStock.length === 0 ? <tr><td className="pl-6 py-12 text-sm text-ink-500" colSpan={3}>No low stock alerts.</td></tr> : lowStock.map((item) => <tr key={item.id}><td className="pl-6 font-bold">{item.name}</td><td>{item.current_quantity.toLocaleString()} {item.unit_of_measure}</td><td className="pr-6">{item.reorder_level.toLocaleString()} {item.unit_of_measure}</td></tr>)}</tbody></table></div>
      </div>
    )
  }

  const isGIVView = view === 'giv' || view === 'transfers'
  const documents = isGIVView ? givs : grns

  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">{view === 'grn' ? 'Goods Received Notes (GRN)' : view === 'giv' ? 'Goods Issue Vouchers (GIV)' : 'GRN / GIV Documents'}</h1>
          <p className="section-subtitle">{view === 'grn' ? 'Receive goods into store locations from suppliers or other sources.' : view === 'giv' ? 'Issue goods from store locations to operations or destinations.' : 'Manage goods receipts and issues.'}</p>
        </div>
        <button className="btn-primary" onClick={() => setModalOpen(true)}><ArrowLeftRight className="h-4 w-4" /> {view === 'grn' ? 'Create GRN' : 'Create GIV'}</button>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="metric-card"><div className="metric-label">Draft</div><div className="metric-value">{documents.filter((item) => item.status === 'draft').length}</div></div>
        <div className="metric-card"><div className="metric-label">Approved</div><div className="metric-value">{documents.filter((item) => item.status === 'approved').length}</div></div>
        <div className="metric-card"><div className="metric-label">{view === 'grn' ? 'Received' : 'Issued'}</div><div className="metric-value">{documents.filter((item) => item.status === (view === 'grn' ? 'received' : 'issued')).length}</div></div>
        <div className="metric-card"><div className="metric-label">Low Stock</div><div className="metric-value">{lowStock.length}</div></div>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th className="pl-6">Reference</th><th>Item</th><th>{view === 'grn' ? 'To Location' : 'From Location'}</th><th>Qty</th><th>Status</th><th className="pr-6">Action</th></tr></thead>
            <tbody>
              {documents.length === 0 ? <tr><td className="pl-6 py-12 text-sm text-ink-500" colSpan={6}>No documents recorded.</td></tr> : documents.map((doc: any) => (
                <tr key={doc.id}>
                  <td className="pl-6 font-bold text-ink-900">{doc.giv_number || doc.grn_number}</td>
                  <td>{items.find((item) => item.id === doc.item_id)?.name ?? `Item #${doc.item_id}`}</td>
                  <td>{view === 'grn' ? (doc.received_into_store_location?.name || `Location #${doc.received_into_store_location_id}`) : (doc.from_store_location?.name || `Location #${doc.from_store_location_id}`)}</td>
                  <td>{doc.quantity.toLocaleString()} {doc.unit}</td>
                  <td><span className="badge badge-brand">{doc.status}</span></td>
                  <td className="pr-6">
                    <div className="flex flex-wrap gap-2">
                      {doc.status === 'draft' ? (
                        <button className="btn-secondary btn-sm" onClick={() => isGIVView ? updateGIVStatus.mutate({ id: doc.id, status: 'approved' }) : updateGRNStatus.mutate({ id: doc.id, status: 'approved' })}>
                          <CheckCircle2 className="h-4 w-4" /> Approve
                        </button>
                      ) : null}
                      {doc.status === 'approved' ? (
                        <button className="btn-secondary btn-sm" onClick={() => isGIVView ? updateGIVStatus.mutate({ id: doc.id, status: 'issued' }) : updateGRNStatus.mutate({ id: doc.id, status: 'received' })}>
                          <Send className="h-4 w-4" /> {view === 'grn' ? 'Receive' : 'Issue'}
                        </button>
                      ) : null}
                      {doc.status === 'draft' || doc.status === 'approved' ? (
                        <button className="btn-secondary btn-sm text-red-600 hover:text-red-700" onClick={() => isGIVView ? updateGIVStatus.mutate({ id: doc.id, status: 'cancelled' }) : updateGRNStatus.mutate({ id: doc.id, status: 'cancelled' })}>
                          <XCircle className="h-4 w-4" /> Cancel
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={view === 'grn' ? 'Create Goods Received Note' : 'Create Goods Issue Voucher'} description={view === 'grn' ? 'Receive goods into a store location from a supplier or other source.' : 'Issue goods from a store location to a destination.'}>
        {view === 'grn' ? (
          <form className="space-y-4" onSubmit={grnForm.handleSubmit((values) => createGRN.mutate(values))}>
            <div><label className="form-label">Item</label><select className="form-input" {...grnForm.register('item_id')}><option value={0}>Choose item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.current_quantity.toLocaleString()} {item.unit_of_measure})</option>)}</select></div>
            <div className="grid gap-4 md:grid-cols-2"><div><label className="form-label">Quantity</label><input className="form-input" type="number" min={1} step="0.01" {...grnForm.register('quantity')} /></div><div><label className="form-label">Unit</label><input className="form-input" {...grnForm.register('unit')} /></div></div>
            <div><label className="form-label">Receive Into</label><select className="form-input" {...grnForm.register('received_into_store_location_id')}><option value={0}>Choose location</option>{storeLocations.filter((loc) => loc.is_active).map((loc) => <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>)}</select></div>
            <div><label className="form-label">Source Type</label><select className="form-input" {...grnForm.register('source_type')}><option value="supplier">Supplier</option><option value="internal_transfer">Internal Transfer</option><option value="return">Return</option><option value="other">Other</option></select></div>
            <div><label className="form-label">Supplier Reference</label><input className="form-input" {...grnForm.register('supplier_reference')} /></div>
            <div><label className="form-label">Unit Cost</label><input className="form-input" type="number" min={0} step="0.01" {...grnForm.register('unit_cost')} /></div>
            <div><label className="form-label">Notes</label><textarea className="form-input min-h-[100px]" {...grnForm.register('notes')} /></div>
            <button className="btn-primary w-full" disabled={createGRN.isPending} type="submit"><ClipboardList className="h-4 w-4" /> Save GRN</button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={givForm.handleSubmit((values) => createGIV.mutate(values))}>
            <div><label className="form-label">Item</label><select className="form-input" {...givForm.register('item_id')}><option value={0}>Choose item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.current_quantity.toLocaleString()} {item.unit_of_measure})</option>)}</select></div>
            <div className="grid gap-4 md:grid-cols-2"><div><label className="form-label">Quantity</label><input className="form-input" type="number" min={1} step="0.01" {...givForm.register('quantity')} /></div><div><label className="form-label">Unit</label><input className="form-input" {...givForm.register('unit')} /></div></div>
            <div><label className="form-label">From Store Location</label><select className="form-input" {...givForm.register('from_store_location_id')}><option value={0}>Choose location</option>{storeLocations.filter((loc) => loc.is_active).map((loc) => <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>)}</select></div>
            <div><label className="form-label">Destination</label><input className="form-input" {...givForm.register('destination')} /></div>
            <div><label className="form-label">Purpose</label><input className="form-input" {...givForm.register('purpose')} /></div>
            <div><label className="form-label">Notes</label><textarea className="form-input min-h-[100px]" {...givForm.register('notes')} /></div>
            <button className="btn-primary w-full" disabled={createGIV.isPending} type="submit"><ClipboardList className="h-4 w-4" /> Save GIV</button>
          </form>
        )}
      </Modal>
    </div>
  )
}
