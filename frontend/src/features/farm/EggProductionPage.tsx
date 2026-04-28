import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Egg as EggIcon, Search, AlertCircle, Edit, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthContext'
import api from '@/services/api'
import { Modal } from '@/components/Modal'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

interface EggProductionLog {
  id: number
  batch_id: number
  record_date: string
  good_eggs: number
  cracked_eggs: number
  damaged_eggs: number
  total_eggs: number
  total_trays: number
  production_rate: number | null
  notes: string | null
}

interface EggProductionSummary {
  total_good: number
  total_cracked: number
  total_damaged: number
  total_eggs: number
  total_trays: number
  avg_production_rate: number | null
  records_count: number
}

interface Batch {
  id: number
  batch_number: string
  status: string
}

const eggSchema = z.object({
  batch_id: z.coerce.number().min(1, 'Batch is required'),
  record_date: z.string().min(1, 'Date is required'),
  good_eggs: z.coerce.number().min(0, 'Must be 0 or more'),
  cracked_eggs: z.coerce.number().min(0, 'Must be 0 or more'),
  damaged_eggs: z.coerce.number().min(0, 'Must be 0 or more'),
  notes: z.string().optional(),
})

type EggFormValues = z.infer<typeof eggSchema>

export function EggProductionPage() {
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedLog, setSelectedLog] = useState<EggProductionLog | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const { data: logs, isLoading: loadingLogs } = useQuery<EggProductionLog[]>({
    queryKey: ['egg_production'],
    queryFn: async () => {
      const res = await api.get('/eggs')
      return res.data
    },
  })

  const { data: summary } = useQuery<EggProductionSummary>({
    queryKey: ['egg_production_summary'],
    queryFn: async () => {
      const res = await api.get('/eggs/summary')
      return res.data
    },
  })

  const { data: batches } = useQuery<Batch[]>({
    queryKey: ['active_batches'],
    queryFn: async () => {
      const res = await api.get('/farm/batches')
      return res.data.filter((b: Batch) => b.status === 'active')
    },
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<EggFormValues>({
    resolver: zodResolver(eggSchema),
    defaultValues: {
      record_date: new Date().toISOString().split('T')[0],
      good_eggs: 0,
      cracked_eggs: 0,
      damaged_eggs: 0,
    }
  })

  const createMutation = useMutation({
    mutationFn: (data: EggFormValues) => api.post('/eggs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['egg_production'] })
      queryClient.invalidateQueries({ queryKey: ['egg_production_summary'] })
      toast.success('Record added')
      closeModal()
    },
    onError: () => toast.error('Failed to add record')
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: number, values: EggFormValues }) => api.put(`/eggs/${data.id}`, data.values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['egg_production'] })
      queryClient.invalidateQueries({ queryKey: ['egg_production_summary'] })
      toast.success('Record updated')
      closeModal()
    },
    onError: () => toast.error('Failed to update record')
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/eggs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['egg_production'] })
      queryClient.invalidateQueries({ queryKey: ['egg_production_summary'] })
      toast.success('Record deleted')
    },
    onError: () => toast.error('Failed to delete record')
  })

  const openModal = (log?: EggProductionLog) => {
    if (log) {
      setSelectedLog(log)
      setValue('batch_id', log.batch_id)
      setValue('record_date', log.record_date)
      setValue('good_eggs', log.good_eggs)
      setValue('cracked_eggs', log.cracked_eggs)
      setValue('damaged_eggs', log.damaged_eggs)
      setValue('notes', log.notes || '')
    } else {
      setSelectedLog(null)
      reset()
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedLog(null)
    reset()
  }

  const onSubmit = (data: EggFormValues) => {
    if (selectedLog) {
      updateMutation.mutate({ id: selectedLog.id, values: data })
    } else {
      createMutation.mutate(data)
    }
  }

  const filteredLogs = logs?.filter(log => 
    log.record_date.includes(searchTerm) || 
    (log.notes && log.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Egg Production</h1>
          <p className="section-subtitle">Track daily egg collection, quality, and production rates.</p>
        </div>
        {hasPermission('farm:write') && (
          <button onClick={() => openModal()} className="btn-primary">
            <Plus className="h-4 w-4" /> Add Record
          </button>
        )}
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="kpi-card">
            <div className="mb-2 flex items-center gap-3 text-blue-600">
              <EggIcon className="h-5 w-5" />
              <h3 className="font-semibold text-sm uppercase tracking-wider">Total Eggs</h3>
            </div>
            <p className="text-3xl font-bold">{summary.total_eggs.toLocaleString()}</p>
          </div>
          <div className="kpi-card">
            <div className="mb-2 flex items-center gap-3 text-blue-600">
              <EggIcon className="h-5 w-5" />
              <h3 className="font-semibold text-sm uppercase tracking-wider">Good Eggs</h3>
            </div>
            <p className="text-3xl font-bold">{summary.total_good.toLocaleString()}</p>
          </div>
          <div className="kpi-card">
            <div className="flex items-center gap-3 text-warning mb-2">
              <AlertCircle className="h-5 w-5" />
              <h3 className="font-semibold text-sm uppercase tracking-wider">Cracked/Damaged</h3>
            </div>
            <p className="text-3xl font-bold">{(summary.total_cracked + summary.total_damaged).toLocaleString()}</p>
          </div>
          <div className="kpi-card">
            <div className="flex items-center gap-3 text-info mb-2">
              <EggIcon className="h-5 w-5" />
              <h3 className="font-semibold text-sm uppercase tracking-wider">Avg Production Rate</h3>
            </div>
            <p className="text-3xl font-bold">{summary.avg_production_rate ? `${summary.avg_production_rate.toFixed(1)}%` : 'N/A'}</p>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] p-4 flex justify-between items-center bg-[var(--surface-soft)]">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by date or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-9 py-2"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Batch</th>
                <th>Good</th>
                <th>Cracked</th>
                <th>Damaged</th>
                <th>Total</th>
                <th>Trays</th>
                <th>Rate</th>
                {hasPermission('farm:write') && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loadingLogs ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-[var(--text-muted)]">Loading records...</td>
                </tr>
              ) : filteredLogs?.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-[var(--text-muted)]">No egg production records found.</td>
                </tr>
              ) : (
                filteredLogs?.map((log) => (
                  <tr key={log.id}>
                    <td className="font-medium">{log.record_date}</td>
                    <td>{batches?.find(b => b.id === log.batch_id)?.batch_number || log.batch_id}</td>
                    <td className="text-[#16A34A]">{log.good_eggs}</td>
                    <td className="text-warning">{log.cracked_eggs}</td>
                    <td className="text-danger">{log.damaged_eggs}</td>
                    <td className="font-semibold">{log.total_eggs}</td>
                    <td>{log.total_trays}</td>
                    <td>{log.production_rate ? `${log.production_rate}%` : '-'}</td>
                    {hasPermission('farm:write') && (
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openModal(log)} className="p-1.5 text-info hover:bg-info/10 rounded-lg transition-colors">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this record?')) {
                                deleteMutation.mutate(log.id)
                              }
                            }} 
                            className="p-1.5 text-danger hover:bg-danger/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={selectedLog ? 'Edit Egg Record' : 'Add Egg Record'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="form-label">Batch</label>
            <select className="form-input" {...register('batch_id')} disabled={!!selectedLog}>
              <option value="">Select an active batch...</option>
              {batches?.map(b => (
                <option key={b.id} value={b.id}>{b.batch_number}</option>
              ))}
            </select>
            {errors.batch_id && <p className="form-error">{errors.batch_id.message}</p>}
          </div>

          <div>
            <label className="form-label">Record Date</label>
            <input type="date" className="form-input" {...register('record_date')} />
            {errors.record_date && <p className="form-error">{errors.record_date.message}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="form-label">Good Eggs</label>
              <input type="number" className="form-input" {...register('good_eggs')} />
              {errors.good_eggs && <p className="form-error">{errors.good_eggs.message}</p>}
            </div>
            <div>
              <label className="form-label">Cracked</label>
              <input type="number" className="form-input" {...register('cracked_eggs')} />
              {errors.cracked_eggs && <p className="form-error">{errors.cracked_eggs.message}</p>}
            </div>
            <div>
              <label className="form-label">Damaged</label>
              <input type="number" className="form-input" {...register('damaged_eggs')} />
              {errors.damaged_eggs && <p className="form-error">{errors.damaged_eggs.message}</p>}
            </div>
          </div>

          <div>
            <label className="form-label">Notes (Optional)</label>
            <textarea className="form-input" rows={3} {...register('notes')}></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Record'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
