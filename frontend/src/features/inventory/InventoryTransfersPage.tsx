import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeftRight, CheckCircle2, ClipboardList, Send } from 'lucide-react'
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

interface StockTransfer {
  id: number
  reference_number: string
  transfer_type: 'giv' | 'grn'
  item_id: number
  quantity: number
  unit: string
  from_location: string
  to_location: string
  status: 'draft' | 'issued' | 'received' | 'cancelled'
  created_at: string
}

const locations = ['Feed Mill Store', 'Farm Store', 'House 1', 'House 2', 'House 3', 'House 4', 'House 5', 'Slaughter', 'Blast Room', 'Cold Room', 'Sales Store']

const transferSchema = z.object({
  item_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1),
  from_location: z.string().min(1),
  to_location: z.string().min(1),
  notes: z.string().optional(),
  status: z.enum(['draft', 'issued']),
})

type TransferValues = z.infer<typeof transferSchema>

export function InventoryTransfersPage({ view }: { view: View }) {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => api.get<StockItem[]>('/inventory/items').then((response) => response.data),
  })
  const { data: transfers = [] } = useQuery({
    queryKey: ['stock-transfers'],
    queryFn: () => api.get<StockTransfer[]>('/inventory/transfers').then((response) => response.data),
  })
  const visibleTransfers = useMemo(() => {
    if (view === 'grn') return transfers.filter((item) => ['issued', 'received'].includes(item.status))
    if (view === 'giv') return transfers.filter((item) => item.transfer_type === 'giv')
    return transfers
  }, [transfers, view])
  const lowStock = useMemo(() => items.filter((item) => item.current_quantity <= item.reorder_level), [items])

  const form = useForm<TransferValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      item_id: 0,
      quantity: 0,
      unit: 'kg',
      from_location: 'Feed Mill Store',
      to_location: 'Farm Store',
      notes: '',
      status: 'draft',
    },
  })

  const createTransfer = useMutation({
    mutationFn: (values: TransferValues) => api.post('/inventory/transfers', { ...values, transfer_type: 'giv', notes: values.notes || null }),
    onSuccess: () => {
      toast.success('Transfer saved.')
      qc.invalidateQueries({ queryKey: ['stock-transfers'] })
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      setModalOpen(false)
      form.reset()
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail ?? 'Failed to save transfer.'),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'issued' | 'received' | 'cancelled' }) => api.patch(`/inventory/transfers/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Transfer status updated.')
      qc.invalidateQueries({ queryKey: ['stock-transfers'] })
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail ?? 'Failed to update transfer.'),
  })

  if (view === 'low-stock') {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="section-header"><div><h1 className="section-title">Low Stock Alerts</h1><p className="section-subtitle">Items at or below reorder level.</p></div></div>
        <div className="card overflow-hidden"><table className="data-table"><thead><tr><th className="pl-6">Item</th><th>Available</th><th className="pr-6">Reorder level</th></tr></thead><tbody>{lowStock.length === 0 ? <tr><td className="pl-6 py-12 text-sm text-ink-500" colSpan={3}>No low stock alerts.</td></tr> : lowStock.map((item) => <tr key={item.id}><td className="pl-6 font-bold">{item.name}</td><td>{item.current_quantity.toLocaleString()} {item.unit_of_measure}</td><td className="pr-6">{item.reorder_level.toLocaleString()} {item.unit_of_measure}</td></tr>)}</tbody></table></div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">{view === 'grn' ? 'GRN Receiving' : view === 'giv' ? 'GIV Issuing' : 'GRN / GIV Transfers'}</h1>
          <p className="section-subtitle">Create GIVs, issue stock from the source, and receive GRNs at destination.</p>
        </div>
        <button className="btn-primary" onClick={() => setModalOpen(true)}><ArrowLeftRight className="h-4 w-4" /> Create GIV</button>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="metric-card"><div className="metric-label">Draft</div><div className="metric-value">{transfers.filter((item) => item.status === 'draft').length}</div></div>
        <div className="metric-card"><div className="metric-label">Issued</div><div className="metric-value">{transfers.filter((item) => item.status === 'issued').length}</div></div>
        <div className="metric-card"><div className="metric-label">Received</div><div className="metric-value">{transfers.filter((item) => item.status === 'received').length}</div></div>
        <div className="metric-card"><div className="metric-label">Low Stock</div><div className="metric-value">{lowStock.length}</div></div>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th className="pl-6">Reference</th><th>Item</th><th>Route</th><th>Qty</th><th>Status</th><th className="pr-6">Action</th></tr></thead>
            <tbody>
              {visibleTransfers.length === 0 ? <tr><td className="pl-6 py-12 text-sm text-ink-500" colSpan={6}>No transfers recorded.</td></tr> : visibleTransfers.map((transfer) => (
                <tr key={transfer.id}>
                  <td className="pl-6 font-bold text-ink-900">{transfer.reference_number}</td>
                  <td>{items.find((item) => item.id === transfer.item_id)?.name ?? `Item #${transfer.item_id}`}</td>
                  <td>{transfer.from_location} to {transfer.to_location}</td>
                  <td>{transfer.quantity.toLocaleString()} {transfer.unit}</td>
                  <td><span className="badge badge-brand">{transfer.status}</span></td>
                  <td className="pr-6">
                    <div className="flex flex-wrap gap-2">
                      {transfer.status === 'draft' ? <button className="btn-secondary btn-sm" onClick={() => updateStatus.mutate({ id: transfer.id, status: 'issued' })}><Send className="h-4 w-4" /> Issue</button> : null}
                      {transfer.status === 'issued' ? <button className="btn-secondary btn-sm" onClick={() => updateStatus.mutate({ id: transfer.id, status: 'received' })}><CheckCircle2 className="h-4 w-4" /> Receive GRN</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create Goods Issued Voucher" description="A draft can be issued later, or posted immediately.">
        <form className="space-y-4" onSubmit={form.handleSubmit((values) => createTransfer.mutate(values))}>
          <div><label className="form-label">Item</label><select className="form-input" {...form.register('item_id')}><option value={0}>Choose item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.current_quantity.toLocaleString()} {item.unit_of_measure})</option>)}</select></div>
          <div className="grid gap-4 md:grid-cols-2"><div><label className="form-label">Quantity</label><input className="form-input" type="number" min={1} step="0.01" {...form.register('quantity')} /></div><div><label className="form-label">Unit</label><input className="form-input" {...form.register('unit')} /></div></div>
          <div className="grid gap-4 md:grid-cols-2"><div><label className="form-label">From</label><select className="form-input" {...form.register('from_location')}>{locations.map((location) => <option key={location}>{location}</option>)}</select></div><div><label className="form-label">To</label><select className="form-input" {...form.register('to_location')}>{locations.map((location) => <option key={location}>{location}</option>)}</select></div></div>
          <div><label className="form-label">Status</label><select className="form-input" {...form.register('status')}><option value="draft">Draft</option><option value="issued">Issue now</option></select></div>
          <div><label className="form-label">Notes</label><textarea className="form-input min-h-[100px]" {...form.register('notes')} /></div>
          <button className="btn-primary w-full" disabled={createTransfer.isPending} type="submit"><ClipboardList className="h-4 w-4" /> Save transfer</button>
        </form>
      </Modal>
    </div>
  )
}
