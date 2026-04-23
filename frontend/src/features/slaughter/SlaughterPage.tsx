import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Boxes, PackagePlus, Scissors, Scale, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'

type SlaughterSection = 'records' | 'outputs'

interface BatchOption {
  id: number
  batch_number: string
  breed: string
}

interface StockItem {
  id: number
  name: string
  unit_of_measure: string
}

interface SlaughterOutput {
  id: number
  stock_item_id: number
  quantity: number
  unit_cost?: number | null
  total_cost?: number | null
}

interface SlaughterRecord {
  id: number
  batch_id: number
  slaughter_date: string
  live_birds_count: number
  total_live_weight: number
  waste_weight: number
  condemned_birds_count: number
  notes?: string | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  total_dressed_weight?: number | null
  yield_percentage?: number | null
  outputs: SlaughterOutput[]
}

const recordSchema = z.object({
  batch_id: z.coerce.number().int().positive('Batch is required'),
  slaughter_date: z.string().min(1, 'Slaughter date is required'),
  live_birds_count: z.coerce.number().int().positive('Bird count must be greater than zero'),
  total_live_weight: z.coerce.number().positive('Live weight must be greater than zero'),
  waste_weight: z.coerce.number().min(0, 'Waste must be zero or more'),
  condemned_birds_count: z.coerce.number().int().min(0, 'Condemned birds must be zero or more'),
  notes: z.string().optional(),
})

const completionSchema = z.object({
  record_id: z.coerce.number().int().positive('Record is required'),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']),
  total_dressed_weight: z.coerce.number().optional(),
  waste_weight: z.coerce.number().min(0, 'Waste must be zero or more'),
  condemned_birds_count: z.coerce.number().int().min(0, 'Condemned birds must be zero or more'),
  notes: z.string().optional(),
})

const outputSchema = z.object({
  record_id: z.coerce.number().int().positive('Record is required'),
  stock_item_id: z.coerce.number().int().positive('Stock item is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  unit_cost: z.coerce.number().optional(),
})

type RecordFormValues = z.infer<typeof recordSchema>
type CompletionFormValues = z.infer<typeof completionSchema>
type OutputFormValues = z.infer<typeof outputSchema>

const sectionCopy: Record<SlaughterSection, { title: string; description: string }> = {
  records: {
    title: 'Slaughter Records',
    description: 'Capture slaughter events, then finalize dressed yield once processing completes.',
  },
  outputs: {
    title: 'Product Outputs',
    description: 'Post slaughter outputs into inventory with quantity and cost traceability.',
  },
}

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function SlaughterPage({ section }: { section: SlaughterSection }) {
  const qc = useQueryClient()
  const copy = sectionCopy[section]

  const { data: records = [] } = useQuery({
    queryKey: ['slaughter-records'],
    queryFn: () => api.get<SlaughterRecord[]>('/slaughter/records').then((response) => response.data),
  })

  const { data: batches = [] } = useQuery({
    queryKey: ['slaughter-batches'],
    queryFn: () => api.get<BatchOption[]>('/farm/batches').then((response) => response.data),
  })

  const { data: stockItems = [] } = useQuery({
    queryKey: ['slaughter-stock-items'],
    queryFn: () => api.get<StockItem[]>('/inventory/items').then((response) => response.data),
  })

  const recordForm = useForm<RecordFormValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: {
      batch_id: 0,
      slaughter_date: todayValue(),
      live_birds_count: 0,
      total_live_weight: 0,
      waste_weight: 0,
      condemned_birds_count: 0,
      notes: '',
    },
  })

  const completionForm = useForm<CompletionFormValues>({
    resolver: zodResolver(completionSchema),
    defaultValues: {
      record_id: 0,
      status: 'completed',
      total_dressed_weight: undefined,
      waste_weight: 0,
      condemned_birds_count: 0,
      notes: '',
    },
  })

  const outputForm = useForm<OutputFormValues>({
    resolver: zodResolver(outputSchema),
    defaultValues: {
      record_id: 0,
      stock_item_id: 0,
      quantity: 0,
      unit_cost: undefined,
    },
  })

  const createRecord = useMutation({
    mutationFn: (values: RecordFormValues) => api.post('/slaughter/records', values),
    onSuccess: () => {
      toast.success('Slaughter record created.')
      qc.invalidateQueries({ queryKey: ['slaughter-records'] })
      recordForm.reset({
        batch_id: 0,
        slaughter_date: todayValue(),
        live_birds_count: 0,
        total_live_weight: 0,
        waste_weight: 0,
        condemned_birds_count: 0,
        notes: '',
      })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to create slaughter record.')
    },
  })

  const completeRecord = useMutation({
    mutationFn: (values: CompletionFormValues) =>
      api.patch(`/slaughter/records/${values.record_id}`, {
        status: values.status,
        total_dressed_weight: values.total_dressed_weight ?? null,
        waste_weight: values.waste_weight,
        condemned_birds_count: values.condemned_birds_count,
        notes: values.notes || null,
      }),
    onSuccess: () => {
      toast.success('Slaughter record updated.')
      qc.invalidateQueries({ queryKey: ['slaughter-records'] })
      completionForm.reset({
        record_id: 0,
        status: 'completed',
        total_dressed_weight: undefined,
        waste_weight: 0,
        condemned_birds_count: 0,
        notes: '',
      })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to update slaughter record.')
    },
  })

  const createOutput = useMutation({
    mutationFn: (values: OutputFormValues) =>
      api.post(`/slaughter/records/${values.record_id}/outputs`, {
        stock_item_id: values.stock_item_id,
        quantity: values.quantity,
        unit_cost: values.unit_cost ?? null,
      }),
    onSuccess: () => {
      toast.success('Slaughter output posted to inventory.')
      qc.invalidateQueries({ queryKey: ['slaughter-records'] })
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      qc.invalidateQueries({ queryKey: ['inventory-movements'] })
      outputForm.reset({ record_id: 0, stock_item_id: 0, quantity: 0, unit_cost: undefined })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to post slaughter output.')
    },
  })

  const allOutputs = useMemo(
    () =>
      records.flatMap((record) =>
        (record.outputs || []).map((output) => ({
          ...output,
          record_id: record.id,
          slaughter_date: record.slaughter_date,
        }))
      ),
    [records]
  )

  const averageYield =
    records.filter((record) => record.yield_percentage).length > 0
      ? `${(
          records
            .filter((record) => record.yield_percentage)
            .reduce((sum, record) => sum + (record.yield_percentage || 0), 0) /
          records.filter((record) => record.yield_percentage).length
        ).toFixed(1)}%`
      : 'No data'

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{copy.title}</h1>
          <p className="mt-1 max-w-2xl text-sm font-medium text-neutral-500">{copy.description}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
          <Scissors className="h-3.5 w-3.5" />
          Production Processing
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-neutral-500">
            <Scissors className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em]">Records</span>
          </div>
          <p className="text-xl font-bold text-neutral-900">{records.length.toLocaleString()}</p>
          <p className="mt-1 text-sm text-neutral-500">
            Processing runs currently stored in the slaughter ledger.
          </p>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-neutral-500">
            <Scale className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em]">Average yield</span>
          </div>
          <p className="text-xl font-bold text-neutral-900">{averageYield}</p>
          <p className="mt-1 text-sm text-neutral-500">
            Computed from finalized dressed weight updates.
          </p>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-neutral-500">
            <Boxes className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em]">Outputs</span>
          </div>
          <p className="text-xl font-bold text-neutral-900">{allOutputs.length.toLocaleString()}</p>
          <p className="mt-1 text-sm text-neutral-500">
            Finished product lines already pushed into inventory.
          </p>
        </div>
      </div>

      {section === 'records' && (
        <div className="grid gap-6 xl:grid-cols-[360px_360px_minmax(0,1fr)]">
          <div className="card p-6">
            <h2 className="text-lg font-bold text-neutral-900">New slaughter record</h2>
            <form
              className="mt-5 space-y-4"
              onSubmit={recordForm.handleSubmit((values) => createRecord.mutate(values))}
            >
              <div>
                <label className="form-label">Batch</label>
                <select className="form-input" {...recordForm.register('batch_id')}>
                  <option value={0}>Choose batch</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.batch_number} - {batch.breed}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Slaughter date</label>
                <input className="form-input" type="date" {...recordForm.register('slaughter_date')} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Live birds</label>
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    {...recordForm.register('live_birds_count')}
                  />
                </div>
                <div>
                  <label className="form-label">Condemned birds</label>
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    {...recordForm.register('condemned_birds_count')}
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Total live weight</label>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  step="0.01"
                  {...recordForm.register('total_live_weight')}
                />
              </div>
              <div>
                <label className="form-label">Waste weight</label>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  step="0.01"
                  {...recordForm.register('waste_weight')}
                />
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea className="form-input min-h-[120px]" {...recordForm.register('notes')} />
              </div>
              <button className="btn-primary w-full" disabled={createRecord.isPending} type="submit">
                <Scissors className="h-4 w-4" />
                {createRecord.isPending ? 'Saving...' : 'Create record'}
              </button>
            </form>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-bold text-neutral-900">Finalize yield</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Update dressed weight and close or cancel the processing run.
            </p>
            <form
              className="mt-5 space-y-4"
              onSubmit={completionForm.handleSubmit((values) => completeRecord.mutate(values))}
            >
              <div>
                <label className="form-label">Record</label>
                <select className="form-input" {...completionForm.register('record_id')}>
                  <option value={0}>Choose record</option>
                  {records.map((record) => (
                    <option key={record.id} value={record.id}>
                      Record #{record.id} - {formatDate(record.slaughter_date)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="form-input" {...completionForm.register('status')}>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="form-label">Total dressed weight</label>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  step="0.01"
                  {...completionForm.register('total_dressed_weight')}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Waste weight</label>
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    step="0.01"
                    {...completionForm.register('waste_weight')}
                  />
                </div>
                <div>
                  <label className="form-label">Condemned birds</label>
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    {...completionForm.register('condemned_birds_count')}
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea className="form-input min-h-[120px]" {...completionForm.register('notes')} />
              </div>
              <button className="btn-primary w-full" disabled={completeRecord.isPending} type="submit">
                <ShieldCheck className="h-4 w-4" />
                {completeRecord.isPending ? 'Saving...' : 'Update record'}
              </button>
            </form>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-neutral-100 px-6 py-5">
              <h2 className="text-lg font-bold text-neutral-900">Processing runs</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Live slaughter records with yield and operational loss details.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-6">Date</th>
                    <th>Batch</th>
                    <th>Status</th>
                    <th>Yield</th>
                    <th className="pr-6">Birds</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={5}>
                        No slaughter records.
                      </td>
                    </tr>
                  ) : (
                    records.map((record) => (
                      <tr key={record.id}>
                        <td className="pl-6">{formatDate(record.slaughter_date)}</td>
                        <td>
                          {batches.find((batch) => batch.id === record.batch_id)?.batch_number ||
                            `Batch #${record.batch_id}`}
                        </td>
                        <td>
                          <span
                            className={
                              record.status === 'completed'
                                ? 'badge badge-success'
                                : record.status === 'cancelled'
                                  ? 'badge badge-danger'
                                  : record.status === 'in_progress'
                                    ? 'badge badge-brand'
                                    : 'badge badge-warning'
                            }
                          >
                            {record.status}
                          </span>
                        </td>
                        <td>
                          {record.yield_percentage ? `${record.yield_percentage.toFixed(1)}%` : 'Pending'}
                        </td>
                        <td className="pr-6">{record.live_birds_count.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {section === 'outputs' && (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="card p-6">
            <h2 className="text-lg font-bold text-neutral-900">Add product output</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Create a finished output line and push it into inventory.
            </p>
            <form
              className="mt-5 space-y-4"
              onSubmit={outputForm.handleSubmit((values) => createOutput.mutate(values))}
            >
              <div>
                <label className="form-label">Slaughter record</label>
                <select className="form-input" {...outputForm.register('record_id')}>
                  <option value={0}>Choose record</option>
                  {records.map((record) => (
                    <option key={record.id} value={record.id}>
                      Record #{record.id} - {formatDate(record.slaughter_date)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Inventory item</label>
                <select className="form-input" {...outputForm.register('stock_item_id')}>
                  <option value={0}>Choose stock item</option>
                  {stockItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Quantity</label>
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    step="0.01"
                    {...outputForm.register('quantity')}
                  />
                </div>
                <div>
                  <label className="form-label">Unit cost</label>
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    step="0.01"
                    {...outputForm.register('unit_cost')}
                  />
                </div>
              </div>
              <button className="btn-primary w-full" disabled={createOutput.isPending} type="submit">
                <PackagePlus className="h-4 w-4" />
                {createOutput.isPending ? 'Saving...' : 'Post output'}
              </button>
            </form>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-neutral-100 px-6 py-5">
              <h2 className="text-lg font-bold text-neutral-900">Output ledger</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Finished output lines already transferred into inventory.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-6">Date</th>
                    <th>Record</th>
                    <th>Stock item</th>
                    <th>Quantity</th>
                    <th className="pr-6">Total cost</th>
                  </tr>
                </thead>
                <tbody>
                  {allOutputs.length === 0 ? (
                    <tr>
                      <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={5}>
                        No slaughter outputs posted yet.
                      </td>
                    </tr>
                  ) : (
                    allOutputs.map((output) => (
                      <tr key={`${output.record_id}-${output.id}`}>
                        <td className="pl-6">{formatDate(output.slaughter_date)}</td>
                        <td>Record #{output.record_id}</td>
                        <td>
                          {stockItems.find((item) => item.id === output.stock_item_id)?.name ||
                            `Item #${output.stock_item_id}`}
                        </td>
                        <td>
                          {output.quantity.toLocaleString()}{' '}
                          {stockItems.find((item) => item.id === output.stock_item_id)?.unit_of_measure || ''}
                        </td>
                        <td className="pr-6 font-semibold text-neutral-900">
                          UGX {(output.total_cost || 0).toLocaleString()}
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
