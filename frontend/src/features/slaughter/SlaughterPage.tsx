import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Boxes, ClipboardList, PackagePlus, Scissors, ShieldCheck, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'

import api from '@/services/api'
import { Modal } from '@/components/Modal'

type SlaughterSection = 'records' | 'outputs' | 'yield'

interface BatchOption {
  id: number
  batch_number: string
  breed: string
  house_id?: number | null
  house?: { name: string } | null
}

interface StockItem {
  id: number
  name: string
  unit_of_measure: string
}

interface SlaughterOutput {
  id: number
  stock_item_id: number
  output_type: string
  quantity: number
  unit_cost?: number | null
  total_cost?: number | null
}

interface SlaughterRecord {
  id: number
  batch_id: number
  slaughter_date: string
  live_birds_count: number
  mortality_birds_count: number
  condemned_birds_count: number
  total_live_weight: number
  average_live_weight?: number | null
  total_dressed_weight?: number | null
  average_dressed_weight?: number | null
  yield_percentage?: number | null
  loss_percentage?: number | null
  waste_weight: number
  blood_weight: number
  feathers_weight: number
  offal_weight: number
  head_weight: number
  feet_weight: number
  reusable_byproducts_weight: number
  waste_disposal_notes?: string | null
  quality_inspection_status: string
  cold_room_location?: string | null
  approval_status: string
  inventory_posted_at?: string | null
  notes?: string | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  outputs: SlaughterOutput[]
}

const recordSchema = z.object({
  batch_id: z.coerce.number().int().positive('Batch is required'),
  slaughter_date: z.string().min(1, 'Slaughter date is required'),
  live_birds_count: z.coerce.number().int().positive('Bird count must be greater than zero'),
  mortality_birds_count: z.coerce.number().int().min(0),
  condemned_birds_count: z.coerce.number().int().min(0),
  total_live_weight: z.coerce.number().positive('Live weight must be greater than zero'),
  waste_weight: z.coerce.number().min(0),
  blood_weight: z.coerce.number().min(0),
  feathers_weight: z.coerce.number().min(0),
  offal_weight: z.coerce.number().min(0),
  head_weight: z.coerce.number().min(0),
  feet_weight: z.coerce.number().min(0),
  reusable_byproducts_weight: z.coerce.number().min(0),
  waste_disposal_notes: z.string().optional(),
  quality_inspection_status: z.enum(['pending', 'passed', 'failed', 'rework']),
  cold_room_location: z.string().optional(),
  notes: z.string().optional(),
})

const completionSchema = z.object({
  record_id: z.coerce.number().int().positive('Record is required'),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']),
  total_dressed_weight: z.coerce.number().optional(),
  waste_weight: z.coerce.number().min(0),
  mortality_birds_count: z.coerce.number().int().min(0),
  condemned_birds_count: z.coerce.number().int().min(0),
  blood_weight: z.coerce.number().min(0),
  feathers_weight: z.coerce.number().min(0),
  offal_weight: z.coerce.number().min(0),
  head_weight: z.coerce.number().min(0),
  feet_weight: z.coerce.number().min(0),
  reusable_byproducts_weight: z.coerce.number().min(0),
  waste_disposal_notes: z.string().optional(),
  quality_inspection_status: z.enum(['pending', 'passed', 'failed', 'rework']),
  approval_status: z.enum(['pending', 'approved', 'rejected']),
  cold_room_location: z.string().optional(),
  notes: z.string().optional(),
})

const outputSchema = z.object({
  record_id: z.coerce.number().int().positive('Record is required'),
  stock_item_id: z.coerce.number().int().positive('Stock item is required'),
  output_type: z.string().min(1),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  unit_cost: z.coerce.number().optional(),
})

type RecordFormValues = z.infer<typeof recordSchema>
type CompletionFormValues = z.infer<typeof completionSchema>
type OutputFormValues = z.infer<typeof outputSchema>

const productionOutputCatalog = [
  { value: 'dressed_chicken', label: 'Dressed chicken (whole chicken)', stockName: 'Dressed chicken' },
  { value: 'chicken_breast', label: 'Chicken breast', stockName: 'Chicken breast' },
  { value: 'chicken_thighs', label: 'Chicken thighs', stockName: 'Chicken thighs' },
  { value: 'chicken_wings', label: 'Chicken wings', stockName: 'Chicken wings' },
  { value: 'chicken_drumsticks', label: 'Chicken drumsticks', stockName: 'Chicken drumsticks' },
  { value: 'gizzards', label: 'Gizzards', stockName: 'Gizzards' },
  { value: 'liver', label: 'Liver', stockName: 'Liver' },
  { value: 'neck_backs', label: 'Neck/backs', stockName: 'Neck/backs' },
  { value: 'poultry_manure', label: 'Poultry manure', stockName: 'Poultry manure' },
  { value: 'feet', label: 'Feet', stockName: 'Feet' },
  { value: 'head', label: 'Head', stockName: 'Head' },
] as const

const productionOutputStockNames = new Set(productionOutputCatalog.map((entry) => entry.stockName.toLowerCase()))

function outputLabel(outputType: string) {
  return productionOutputCatalog.find((entry) => entry.value === outputType)?.label ?? outputType.replace(/_/g, ' ')
}

const sectionCopy: Record<SlaughterSection, { title: string; description: string }> = {
  records: {
    title: 'Slaughter Records',
    description: 'Capture one slaughter run at a time, then finalize yield and approval in a separate step.',
  },
  outputs: {
    title: 'Product Outputs',
    description: 'Post approved finished products and reusable byproducts into inventory.',
  },
  yield: {
    title: 'Yield Analysis',
    description: 'Review approved slaughter performance, loss drivers, waste totals, and storage posting history.',
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

function statusBadge(status: string) {
  if (status === 'completed' || status === 'approved' || status === 'passed') return 'badge badge-success'
  if (status === 'cancelled' || status === 'failed' || status === 'rejected') return 'badge badge-danger'
  if (status === 'in_progress' || status === 'rework') return 'badge badge-brand'
  return 'badge badge-neutral'
}

export function SlaughterPage({ section }: { section: SlaughterSection }) {
  const qc = useQueryClient()
  const copy = sectionCopy[section]
  const [selectedRecord, setSelectedRecord] = useState<SlaughterRecord | null>(null)

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
      mortality_birds_count: 0,
      condemned_birds_count: 0,
      total_live_weight: 0,
      waste_weight: 0,
      blood_weight: 0,
      feathers_weight: 0,
      offal_weight: 0,
      head_weight: 0,
      feet_weight: 0,
      reusable_byproducts_weight: 0,
      waste_disposal_notes: '',
      quality_inspection_status: 'pending',
      cold_room_location: '',
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
      mortality_birds_count: 0,
      condemned_birds_count: 0,
      blood_weight: 0,
      feathers_weight: 0,
      offal_weight: 0,
      head_weight: 0,
      feet_weight: 0,
      reusable_byproducts_weight: 0,
      waste_disposal_notes: '',
      quality_inspection_status: 'pending',
      approval_status: 'pending',
      cold_room_location: '',
      notes: '',
    },
  })

  const outputForm = useForm<OutputFormValues>({
    resolver: zodResolver(outputSchema),
    defaultValues: {
      record_id: 0,
      stock_item_id: 0,
      output_type: 'dressed_chicken',
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
        mortality_birds_count: 0,
        condemned_birds_count: 0,
        total_live_weight: 0,
        waste_weight: 0,
        blood_weight: 0,
        feathers_weight: 0,
        offal_weight: 0,
        head_weight: 0,
        feet_weight: 0,
        reusable_byproducts_weight: 0,
        waste_disposal_notes: '',
        quality_inspection_status: 'pending',
        cold_room_location: '',
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
        mortality_birds_count: values.mortality_birds_count,
        condemned_birds_count: values.condemned_birds_count,
        blood_weight: values.blood_weight,
        feathers_weight: values.feathers_weight,
        offal_weight: values.offal_weight,
        head_weight: values.head_weight,
        feet_weight: values.feet_weight,
        reusable_byproducts_weight: values.reusable_byproducts_weight,
        waste_disposal_notes: values.waste_disposal_notes || null,
        quality_inspection_status: values.quality_inspection_status,
        approval_status: values.approval_status,
        cold_room_location: values.cold_room_location || null,
        notes: values.notes || null,
      }),
    onSuccess: () => {
      toast.success('Slaughter yield finalized.')
      qc.invalidateQueries({ queryKey: ['slaughter-records'] })
      setSelectedRecord(null)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to update slaughter record.')
    },
  })

  const createOutput = useMutation({
    mutationFn: (values: OutputFormValues) =>
      api.post(`/slaughter/records/${values.record_id}/outputs`, {
        stock_item_id: values.stock_item_id,
        output_type: values.output_type,
        quantity: values.quantity,
        unit_cost: values.unit_cost ?? null,
      }),
    onSuccess: () => {
      toast.success('Slaughter output posted to inventory.')
      qc.invalidateQueries({ queryKey: ['slaughter-records'] })
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      qc.invalidateQueries({ queryKey: ['inventory-movements'] })
      outputForm.reset({
        record_id: 0,
        stock_item_id: 0,
        output_type: 'dressed_chicken',
        quantity: 0,
        unit_cost: undefined,
      })
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
    records.filter((record) => record.yield_percentage != null).length > 0
      ? `${(
          records
            .filter((record) => record.yield_percentage != null)
            .reduce((sum, record) => sum + Number(record.yield_percentage || 0), 0) /
          records.filter((record) => record.yield_percentage != null).length
        ).toFixed(1)}%`
      : 'No data'

  const approvedRecords = useMemo(
    () => records.filter((record) => record.status === 'completed' && record.approval_status === 'approved'),
    [records]
  )
  const selectedOutputType = outputForm.watch('output_type')

  const outputInventoryItems = useMemo(() => {
    const matched = stockItems.filter((item) => productionOutputStockNames.has(item.name.trim().toLowerCase()))
    return matched.length > 0 ? matched : stockItems
  }, [stockItems])

  useEffect(() => {
    const preferredStockName = productionOutputCatalog.find((entry) => entry.value === selectedOutputType)?.stockName
    if (!preferredStockName) return

    const matchingItem = outputInventoryItems.find(
      (item) => item.name.trim().toLowerCase() === preferredStockName.toLowerCase()
    )
    if (matchingItem && outputForm.getValues('stock_item_id') !== matchingItem.id) {
      outputForm.setValue('stock_item_id', matchingItem.id, { shouldValidate: true })
    }
  }, [outputForm, outputInventoryItems, selectedOutputType])

  const completedRecords = useMemo(
    () => records.filter((record) => record.status === 'completed'),
    [records]
  )

  const yieldSummary = useMemo(
    () =>
      completedRecords.reduce(
        (summary, record) => ({
          liveBirds: summary.liveBirds + record.live_birds_count,
          dressedWeight: summary.dressedWeight + Number(record.total_dressed_weight || 0),
          wasteWeight: summary.wasteWeight + Number(record.waste_weight || 0),
          condemnedBirds: summary.condemnedBirds + Number(record.condemned_birds_count || 0),
          bloodWeight: summary.bloodWeight + Number(record.blood_weight || 0),
          feathersWeight: summary.feathersWeight + Number(record.feathers_weight || 0),
          offalWeight: summary.offalWeight + Number(record.offal_weight || 0),
          headWeight: summary.headWeight + Number(record.head_weight || 0),
          feetWeight: summary.feetWeight + Number(record.feet_weight || 0),
          reusableByproductsWeight: summary.reusableByproductsWeight + Number(record.reusable_byproducts_weight || 0),
        }),
        {
          liveBirds: 0,
          dressedWeight: 0,
          wasteWeight: 0,
          condemnedBirds: 0,
          bloodWeight: 0,
          feathersWeight: 0,
          offalWeight: 0,
          headWeight: 0,
          feetWeight: 0,
          reusableByproductsWeight: 0,
        }
      ),
    [completedRecords]
  )

  const selectedBatch = batches.find((batch) => batch.id === recordForm.watch('batch_id'))

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{copy.title}</h1>
          <p className="mt-1 max-w-2xl text-sm font-medium text-neutral-500">{copy.description}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
          <Scissors className="h-3.5 w-3.5" />
          Processing Workflow
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-neutral-500">
            <ClipboardList className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em]">Records</span>
          </div>
          <p className="text-xl font-bold text-neutral-900">{records.length.toLocaleString()}</p>
          <p className="mt-1 text-sm text-neutral-500">Slaughter runs captured in the processing ledger.</p>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-neutral-500">
            <TrendingUp className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em]">Average yield</span>
          </div>
          <p className="text-xl font-bold text-neutral-900">{averageYield}</p>
          <p className="mt-1 text-sm text-neutral-500">Computed from completed dressed weight approvals.</p>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-neutral-500">
            <Boxes className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em]">Outputs</span>
          </div>
          <p className="text-xl font-bold text-neutral-900">{allOutputs.length.toLocaleString()}</p>
          <p className="mt-1 text-sm text-neutral-500">Approved output lines already transferred into inventory.</p>
        </div>
      </div>

      {section === 'records' && (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="card p-6">
            <h2 className="text-lg font-bold text-neutral-900">New slaughter record</h2>
            <p className="mt-1 text-sm text-neutral-500">Capture live bird counts, live weights, waste categories, and initial inspection details.</p>
            <form className="mt-5 space-y-4" onSubmit={recordForm.handleSubmit((values) => createRecord.mutate(values))}>
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
                {selectedBatch ? <p className="form-hint">House: {selectedBatch.house?.name ?? `House #${selectedBatch.house_id ?? '-'}`}</p> : null}
              </div>
              <div>
                <label className="form-label">Slaughter date</label>
                <input className="form-input" type="date" {...recordForm.register('slaughter_date')} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Live birds count</label>
                  <input className="form-input" type="number" min={0} {...recordForm.register('live_birds_count')} />
                </div>
                <div>
                  <label className="form-label">Mortality before process</label>
                  <input className="form-input" type="number" min={0} {...recordForm.register('mortality_birds_count')} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Condemned birds</label>
                  <input className="form-input" type="number" min={0} {...recordForm.register('condemned_birds_count')} />
                </div>
                <div>
                  <label className="form-label">Total live weight (kg)</label>
                  <input className="form-input" type="number" min={0} step="0.01" {...recordForm.register('total_live_weight')} />
                </div>
              </div>
              <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Byproduct and waste categories</div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div><label className="form-label">Blood weight</label><input className="form-input" type="number" min={0} step="0.01" {...recordForm.register('blood_weight')} /></div>
                  <div><label className="form-label">Feathers weight</label><input className="form-input" type="number" min={0} step="0.01" {...recordForm.register('feathers_weight')} /></div>
                  <div><label className="form-label">Offal weight</label><input className="form-input" type="number" min={0} step="0.01" {...recordForm.register('offal_weight')} /></div>
                  <div><label className="form-label">Head weight</label><input className="form-input" type="number" min={0} step="0.01" {...recordForm.register('head_weight')} /></div>
                  <div><label className="form-label">Feet weight</label><input className="form-input" type="number" min={0} step="0.01" {...recordForm.register('feet_weight')} /></div>
                  <div><label className="form-label">Reusable byproducts</label><input className="form-input" type="number" min={0} step="0.01" {...recordForm.register('reusable_byproducts_weight')} /></div>
                  <div><label className="form-label">Waste weight</label><input className="form-input" type="number" min={0} step="0.01" {...recordForm.register('waste_weight')} /></div>
                  <div>
                    <label className="form-label">Quality inspection</label>
                    <select className="form-input" {...recordForm.register('quality_inspection_status')}>
                      <option value="pending">Pending</option>
                      <option value="passed">Passed</option>
                      <option value="failed">Failed</option>
                      <option value="rework">Rework</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <label className="form-label">Cold-room / storage location</label>
                <input className="form-input" {...recordForm.register('cold_room_location')} />
              </div>
              <div>
                <label className="form-label">Waste disposal record</label>
                <textarea className="form-input min-h-[88px]" {...recordForm.register('waste_disposal_notes')} />
              </div>
              <div>
                <label className="form-label">Processing notes</label>
                <textarea className="form-input min-h-[88px]" {...recordForm.register('notes')} />
              </div>
              <button className="btn-primary w-full" disabled={createRecord.isPending} type="submit">
                <Scissors className="h-4 w-4" />
                {createRecord.isPending ? 'Saving...' : 'Create record'}
              </button>
            </form>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-neutral-100 px-6 py-5">
              <h2 className="text-lg font-bold text-neutral-900">Processing runs</h2>
              <p className="mt-1 text-sm text-neutral-500">Finalize yield, approval, and cold-room posting one record at a time.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-6">Date</th>
                    <th>Batch / House</th>
                    <th>Status</th>
                    <th>Yield</th>
                    <th>Approval</th>
                    <th className="pr-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={6}>
                        No slaughter records.
                      </td>
                    </tr>
                  ) : (
                    records.map((record) => {
                      const batch = batches.find((entry) => entry.id === record.batch_id)
                      return (
                        <tr key={record.id}>
                          <td className="pl-6">{formatDate(record.slaughter_date)}</td>
                          <td>
                            <div className="font-semibold text-neutral-900">{batch?.batch_number || `Batch #${record.batch_id}`}</div>
                            <div className="mt-1 text-xs text-neutral-500">{batch?.house?.name ?? 'House not loaded'}</div>
                          </td>
                          <td><span className={statusBadge(record.status)}>{record.status}</span></td>
                          <td>
                            <div>{record.yield_percentage != null ? `${record.yield_percentage.toFixed(1)}%` : 'Pending'}</div>
                            <div className="mt-1 text-xs text-neutral-500">Loss {record.loss_percentage != null ? `${record.loss_percentage.toFixed(1)}%` : '-'}</div>
                          </td>
                          <td>
                            <span className={statusBadge(record.approval_status)}>{record.approval_status}</span>
                            <div className="mt-1 text-xs text-neutral-500">{record.quality_inspection_status}</div>
                          </td>
                          <td className="pr-6 text-right">
                            <button
                              type="button"
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              onClick={() => {
                                setSelectedRecord(record)
                                completionForm.reset({
                                  record_id: record.id,
                                  status: record.status === 'cancelled' ? 'cancelled' : 'completed',
                                  total_dressed_weight: record.total_dressed_weight ?? undefined,
                                  waste_weight: record.waste_weight,
                                  mortality_birds_count: record.mortality_birds_count,
                                  condemned_birds_count: record.condemned_birds_count,
                                  blood_weight: record.blood_weight,
                                  feathers_weight: record.feathers_weight,
                                  offal_weight: record.offal_weight,
                                  head_weight: record.head_weight,
                                  feet_weight: record.feet_weight,
                                  reusable_byproducts_weight: record.reusable_byproducts_weight,
                                  waste_disposal_notes: record.waste_disposal_notes ?? '',
                                  quality_inspection_status: record.quality_inspection_status as CompletionFormValues['quality_inspection_status'],
                                  approval_status: record.approval_status as CompletionFormValues['approval_status'],
                                  cold_room_location: record.cold_room_location ?? '',
                                  notes: record.notes ?? '',
                                })
                              }}
                            >
                              Finalize Yield
                            </button>
                          </td>
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

      {section === 'outputs' && (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="card p-6">
            <h2 className="text-lg font-bold text-neutral-900">Post product output</h2>
            <p className="mt-1 text-sm text-neutral-500">Only approved slaughter runs can post finished products or reusable byproducts.</p>
            <form className="mt-5 space-y-4" onSubmit={outputForm.handleSubmit((values) => createOutput.mutate(values))}>
              <div>
                <label className="form-label">Approved slaughter record</label>
                <select className="form-input" {...outputForm.register('record_id')}>
                  <option value={0}>Choose record</option>
                  {approvedRecords.map((record) => (
                    <option key={record.id} value={record.id}>
                      Record #{record.id} - {formatDate(record.slaughter_date)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Produced item</label>
                <select className="form-input" {...outputForm.register('output_type')}>
                  {productionOutputCatalog.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Inventory item</label>
                <select className="form-input" {...outputForm.register('stock_item_id')}>
                  <option value={0}>Choose stock item</option>
                  {outputInventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Quantity</label>
                  <input className="form-input" type="number" min={0} step="0.01" {...outputForm.register('quantity')} />
                </div>
                <div>
                  <label className="form-label">Unit cost</label>
                  <input className="form-input" type="number" min={0} step="0.01" {...outputForm.register('unit_cost')} />
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
              <p className="mt-1 text-sm text-neutral-500">Finished product, byproduct, and waste output lines transferred into inventory.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-6">Date</th>
                    <th>Record</th>
                    <th>Type</th>
                    <th>Stock item</th>
                    <th>Quantity</th>
                    <th className="pr-6">Total cost</th>
                  </tr>
                </thead>
                <tbody>
                  {allOutputs.length === 0 ? (
                    <tr>
                      <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={6}>
                        No slaughter outputs posted yet.
                      </td>
                    </tr>
                  ) : (
                    allOutputs.map((output) => (
                      <tr key={`${output.record_id}-${output.id}`}>
                        <td className="pl-6">{formatDate(output.slaughter_date)}</td>
                        <td>Record #{output.record_id}</td>
                        <td>{outputLabel(output.output_type)}</td>
                        <td>{stockItems.find((item) => item.id === output.stock_item_id)?.name || `Item #${output.stock_item_id}`}</td>
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

      {section === 'yield' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
          <div className="card overflow-hidden">
            <div className="border-b border-neutral-100 px-6 py-5">
              <h2 className="text-lg font-bold text-neutral-900">Yield and loss report</h2>
              <p className="mt-1 text-sm text-neutral-500">Completed runs with dressing performance, quality inspection, approval, and storage posting status.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-6">Run</th>
                    <th>Live</th>
                    <th>Dressed</th>
                    <th>Yield</th>
                    <th>Loss</th>
                    <th>Quality</th>
                    <th className="pr-6">Storage / Inventory</th>
                  </tr>
                </thead>
                <tbody>
                  {completedRecords.length === 0 ? (
                    <tr>
                      <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={7}>
                        No completed slaughter records to analyze yet.
                      </td>
                    </tr>
                  ) : (
                    completedRecords.map((record) => {
                      const batch = batches.find((entry) => entry.id === record.batch_id)
                      return (
                        <tr key={`yield-${record.id}`}>
                          <td className="pl-6">
                            <div className="font-semibold text-neutral-900">Record #{record.id}</div>
                            <div className="mt-1 text-xs text-neutral-500">
                              {batch?.batch_number || `Batch #${record.batch_id}`} | {formatDate(record.slaughter_date)}
                            </div>
                          </td>
                          <td>
                            <div>{record.live_birds_count.toLocaleString()} birds</div>
                            <div className="mt-1 text-xs text-neutral-500">{record.total_live_weight.toLocaleString()} kg live</div>
                          </td>
                          <td>
                            <div>{Number(record.total_dressed_weight || 0).toLocaleString()} kg</div>
                            <div className="mt-1 text-xs text-neutral-500">
                              Avg {record.average_dressed_weight != null ? record.average_dressed_weight.toFixed(3) : '-'} kg/bird
                            </div>
                          </td>
                          <td>{record.yield_percentage != null ? `${record.yield_percentage.toFixed(1)}%` : 'Pending'}</td>
                          <td>
                            <div>{record.loss_percentage != null ? `${record.loss_percentage.toFixed(1)}%` : '-'}</div>
                            <div className="mt-1 text-xs text-neutral-500">
                              Condemned {record.condemned_birds_count} | Mortality {record.mortality_birds_count}
                            </div>
                          </td>
                          <td>
                            <span className={statusBadge(record.quality_inspection_status)}>{record.quality_inspection_status}</span>
                            <div className="mt-1 text-xs text-neutral-500">{record.approval_status}</div>
                          </td>
                          <td className="pr-6">
                            <div>{record.cold_room_location || 'No cold-room assigned'}</div>
                            <div className="mt-1 text-xs text-neutral-500">
                              {record.inventory_posted_at ? `Posted ${formatDate(record.inventory_posted_at)}` : 'Inventory not posted'}
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

          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="text-lg font-bold text-neutral-900">Processing totals</h2>
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <span className="text-sm text-neutral-600">Completed runs</span>
                  <span className="text-sm font-semibold text-neutral-900">{completedRecords.length}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <span className="text-sm text-neutral-600">Live birds processed</span>
                  <span className="text-sm font-semibold text-neutral-900">{yieldSummary.liveBirds.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <span className="text-sm text-neutral-600">Total dressed weight</span>
                  <span className="text-sm font-semibold text-neutral-900">{yieldSummary.dressedWeight.toLocaleString()} kg</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <span className="text-sm text-neutral-600">Waste recorded</span>
                  <span className="text-sm font-semibold text-neutral-900">{yieldSummary.wasteWeight.toLocaleString()} kg</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <span className="text-sm text-neutral-600">Condemned birds</span>
                  <span className="text-sm font-semibold text-neutral-900">{yieldSummary.condemnedBirds.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h2 className="text-lg font-bold text-neutral-900">Waste and byproduct breakdown</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">Blood: <span className="font-semibold text-neutral-900">{yieldSummary.bloodWeight.toLocaleString()} kg</span></div>
                <div className="rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">Feathers: <span className="font-semibold text-neutral-900">{yieldSummary.feathersWeight.toLocaleString()} kg</span></div>
                <div className="rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">Offal: <span className="font-semibold text-neutral-900">{yieldSummary.offalWeight.toLocaleString()} kg</span></div>
                <div className="rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">Head: <span className="font-semibold text-neutral-900">{yieldSummary.headWeight.toLocaleString()} kg</span></div>
                <div className="rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">Feet: <span className="font-semibold text-neutral-900">{yieldSummary.feetWeight.toLocaleString()} kg</span></div>
                <div className="rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">Reusable byproducts: <span className="font-semibold text-neutral-900">{yieldSummary.reusableByproductsWeight.toLocaleString()} kg</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title={selectedRecord ? `Finalize Yield - Record #${selectedRecord.id}` : 'Finalize Yield'}
        description="Update dressed weight, inspection result, approval status, storage location, and loss categories for one record."
      >
        <form className="space-y-4" onSubmit={completionForm.handleSubmit((values) => completeRecord.mutate(values))}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="form-label">Workflow status</label>
              <select className="form-input" {...completionForm.register('status')}>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="form-label">Dressed weight (kg)</label>
              <input className="form-input" type="number" min={0} step="0.01" {...completionForm.register('total_dressed_weight')} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="form-label">Quality inspection</label>
              <select className="form-input" {...completionForm.register('quality_inspection_status')}>
                <option value="pending">Pending</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="rework">Rework</option>
              </select>
            </div>
            <div>
              <label className="form-label">Approval status</label>
              <select className="form-input" {...completionForm.register('approval_status')}>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="form-label">Mortality birds</label><input className="form-input" type="number" min={0} {...completionForm.register('mortality_birds_count')} /></div>
            <div><label className="form-label">Condemned birds</label><input className="form-input" type="number" min={0} {...completionForm.register('condemned_birds_count')} /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="form-label">Waste weight</label><input className="form-input" type="number" min={0} step="0.01" {...completionForm.register('waste_weight')} /></div>
            <div><label className="form-label">Reusable byproducts</label><input className="form-input" type="number" min={0} step="0.01" {...completionForm.register('reusable_byproducts_weight')} /></div>
          </div>
          <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Loss category weights</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className="form-label">Blood</label><input className="form-input" type="number" min={0} step="0.01" {...completionForm.register('blood_weight')} /></div>
              <div><label className="form-label">Feathers</label><input className="form-input" type="number" min={0} step="0.01" {...completionForm.register('feathers_weight')} /></div>
              <div><label className="form-label">Offal</label><input className="form-input" type="number" min={0} step="0.01" {...completionForm.register('offal_weight')} /></div>
              <div><label className="form-label">Head</label><input className="form-input" type="number" min={0} step="0.01" {...completionForm.register('head_weight')} /></div>
              <div><label className="form-label">Feet</label><input className="form-input" type="number" min={0} step="0.01" {...completionForm.register('feet_weight')} /></div>
              <div><label className="form-label">Cold-room location</label><input className="form-input" {...completionForm.register('cold_room_location')} /></div>
            </div>
          </div>
          <div>
            <label className="form-label">Waste disposal record</label>
            <textarea className="form-input min-h-[88px]" {...completionForm.register('waste_disposal_notes')} />
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input min-h-[88px]" {...completionForm.register('notes')} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setSelectedRecord(null)}>Close</button>
            <button className="btn-primary" disabled={completeRecord.isPending} type="submit">
              <ShieldCheck className="h-4 w-4" />
              {completeRecord.isPending ? 'Saving...' : 'Save Finalization'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
