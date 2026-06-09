import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Truck, CheckCircle2, ClipboardList, Send, XCircle, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import api from '@/services/api'
import { Modal } from '@/components/Modal'
import { branchTransferService, BranchTransfer, BranchTransferCreate, BranchTransferStatusUpdate } from '@/services/branchTransferService'
import { branchService, Branch } from '@/services/branchService'
import { StockItem } from '@/types'
import { useAuth } from '@/features/auth/AuthContext'

const branchTransferSchema = z.object({
  to_branch_id: z.coerce.number().int().positive('Destination branch is required'),
  notes: z.string().optional(),
  vehicle_registration: z.string().optional(),
  driver_name: z.string().optional(),
  items: z.array(z.object({
    stock_item_id: z.coerce.number().int().positive('Item is required'),
    quantity_shipped: z.coerce.number().positive('Quantity must be greater than zero'),
    notes: z.string().optional()
  })).min(1, 'At least one item is required')
})

type BranchTransferValues = z.infer<typeof branchTransferSchema>

export function BranchTransfersPage() {
  const qc = useQueryClient()
  const { activeBranch } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['branch-transfers'],
    queryFn: () => branchTransferService.list(),
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['settings-branches'],
    queryFn: branchService.getBranches,
  })

  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => api.get<StockItem[]>('/inventory/items').then((response) => response.data),
  })

  const form = useForm<BranchTransferValues>({
    resolver: zodResolver(branchTransferSchema),
    defaultValues: {
      to_branch_id: 0,
      notes: '',
      vehicle_registration: '',
      driver_name: '',
      items: [{ stock_item_id: 0, quantity_shipped: 1, notes: '' }]
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items'
  })

  const createTransfer = useMutation({
    mutationFn: (values: BranchTransferValues) => branchTransferService.create(values),
    onSuccess: () => {
      toast.success('Branch transfer created.')
      qc.invalidateQueries({ queryKey: ['branch-transfers'] })
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      setModalOpen(false)
      form.reset()
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail ?? 'Failed to create branch transfer.'),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: BranchTransferStatusUpdate }) => branchTransferService.updateStatus(id, payload),
    onSuccess: () => {
      toast.success('Transfer status updated.')
      qc.invalidateQueries({ queryKey: ['branch-transfers'] })
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail ?? 'Failed to update transfer status.'),
  })

  const handleReceive = (transfer: BranchTransfer) => {
    // For simplicity, receive exact shipped quantity
    const received_items = transfer.items.map(item => ({
      item_id: item.stock_item_id,
      quantity_received: item.quantity_shipped
    }))
    
    if (confirm(`Receive all items from transfer ${transfer.transfer_number}?`)) {
      updateStatus.mutate({ 
        id: transfer.id, 
        payload: { status: 'completed', received_items } 
      })
    }
  }

  const getBranchName = (id: number) => branches.find(b => b.id === id)?.name || `Branch #${id}`

  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Inter-Branch Transfers</h1>
          <p className="section-subtitle">Dispatch and receive stock between physical farm locations.</p>
        </div>
        <button className="btn-primary" onClick={() => setModalOpen(true)}>
          <Truck className="h-4 w-4" /> New Transfer
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="metric-card"><div className="metric-label">Pending</div><div className="metric-value">{transfers.filter((item) => item.status === 'pending').length}</div></div>
        <div className="metric-card"><div className="metric-label">In Transit</div><div className="metric-value">{transfers.filter((item) => item.status === 'in_transit').length}</div></div>
        <div className="metric-card"><div className="metric-label">Completed</div><div className="metric-value">{transfers.filter((item) => item.status === 'completed').length}</div></div>
        <div className="metric-card"><div className="metric-label">Total</div><div className="metric-value">{transfers.length}</div></div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Transfer #</th>
                <th>From</th>
                <th>To</th>
                <th>Items</th>
                <th>Status</th>
                <th className="pr-6">Action</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 ? (
                <tr><td className="pl-6 py-12 text-sm text-ink-500 text-center" colSpan={6}>No branch transfers recorded.</td></tr>
              ) : transfers.map((transfer) => (
                <tr key={transfer.id}>
                  <td className="pl-6 font-bold text-ink-900">{transfer.transfer_number}</td>
                  <td>{getBranchName(transfer.from_branch_id)}</td>
                  <td>{getBranchName(transfer.to_branch_id)}</td>
                  <td>{transfer.items.length} items</td>
                  <td>
                    <span className={`badge ${
                      transfer.status === 'completed' ? 'badge-emerald' : 
                      transfer.status === 'in_transit' ? 'badge-amber' : 
                      transfer.status === 'cancelled' ? 'badge-red' : 
                      'badge-brand'
                    }`}>
                      {transfer.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="pr-6">
                    <div className="flex flex-wrap gap-2">
                      {transfer.status === 'pending' && transfer.from_branch_id === activeBranch?.id ? (
                        <button className="btn-secondary btn-sm" onClick={() => updateStatus.mutate({ id: transfer.id, payload: { status: 'in_transit' } })}>
                          <Send className="h-4 w-4" /> Dispatch
                        </button>
                      ) : null}
                      {transfer.status === 'pending' && transfer.from_branch_id === activeBranch?.id ? (
                        <button className="btn-secondary btn-sm text-red-600 hover:text-red-700" onClick={() => updateStatus.mutate({ id: transfer.id, payload: { status: 'cancelled' } })}>
                          <XCircle className="h-4 w-4" /> Cancel
                        </button>
                      ) : null}
                      {transfer.status === 'in_transit' && transfer.to_branch_id === activeBranch?.id ? (
                        <button className="btn-secondary btn-sm" onClick={() => handleReceive(transfer)}>
                          <CheckCircle2 className="h-4 w-4" /> Receive Items
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create Inter-Branch Transfer" description="Dispatch stock items from your current branch to a destination branch.">
        <form className="space-y-6" onSubmit={form.handleSubmit((values) => createTransfer.mutate(values))}>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-neutral-800">Transfer Details</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="form-label">Destination Branch</label>
                <select className="form-input" {...form.register('to_branch_id')}>
                  <option value={0}>Select destination branch...</option>
                  {branches.filter(b => b.is_active && b.id !== activeBranch?.id).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                {form.formState.errors.to_branch_id && <p className="form-error">{form.formState.errors.to_branch_id.message}</p>}
              </div>
              
              <div>
                <label className="form-label">Vehicle Reg (Optional)</label>
                <input className="form-input" {...form.register('vehicle_registration')} placeholder="e.g. KCA 123G" />
              </div>
              <div>
                <label className="form-label">Driver Name (Optional)</label>
                <input className="form-input" {...form.register('driver_name')} placeholder="Driver name" />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-800">Items to Transfer</h3>
              <button type="button" onClick={() => append({ stock_item_id: 0, quantity_shipped: 1, notes: '' })} className="btn-secondary btn-sm">
                <Plus className="h-4 w-4" /> Add Item
              </button>
            </div>
            
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-3 rounded-xl border border-neutral-200 p-3">
                  <div className="flex-1 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <select className="form-input" {...form.register(`items.${index}.stock_item_id` as const)}>
                          <option value={0}>Select item...</option>
                          {items.map(i => (
                            <option key={i.id} value={i.id}>{i.name} ({i.current_quantity} {i.unit_of_measure} avail)</option>
                          ))}
                        </select>
                        {form.formState.errors.items?.[index]?.stock_item_id && <p className="form-error mt-1">{form.formState.errors.items[index]?.stock_item_id?.message}</p>}
                      </div>
                      <div>
                        <input className="form-input" type="number" step="0.01" min={0.01} placeholder="Qty" {...form.register(`items.${index}.quantity_shipped` as const)} />
                        {form.formState.errors.items?.[index]?.quantity_shipped && <p className="form-error mt-1">{form.formState.errors.items[index]?.quantity_shipped?.message}</p>}
                      </div>
                    </div>
                  </div>
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(index)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">Transfer Notes</label>
            <textarea className="form-input min-h-[80px]" {...form.register('notes')} placeholder="Add any additional notes about this transfer..." />
          </div>

          <button className="btn-primary w-full" disabled={createTransfer.isPending} type="submit">
            <ClipboardList className="h-4 w-4" /> Create Transfer
          </button>
        </form>
      </Modal>
    </div>
  )
}
