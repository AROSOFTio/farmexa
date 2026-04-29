import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Boxes, CalendarDays, ClipboardList, PackagePlus, Scissors, ShieldCheck, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'

import api from '@/services/api'
import { Modal } from '@/components/Modal'

type SlaughterSection = 'planning' | 'records' | 'cuts' | 'byproducts' | 'outputs' | 'yield'

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

const saleableOutputTypes = new Set<string>([
  'dressed_chicken',
  'chicken_breast',
  'chicken_thighs',
  'chicken_wings',
  'chicken_drumsticks',
  'gizzards',
  'liver',
  'neck_backs',
])

const byproductOutputTypes = new Set<string>(['poultry_manure', 'feet', 'head'])
const productionOutputStockNames = new Set<string>(productionOutputCatalog.map((entry) => entry.stockName.toLowerCase()))

const sectionCopy: Record<
  SlaughterSection,
  { title: string; description: string; actionLabel?: string; actionDescription?: string }
> = {
  planning: {
    title: 'Slaughter Planning',
    description: 'Schedule and prepare one processing run at a time before final yield approval.',
    actionLabel: 'Plan slaughter run',
    actionDescription: 'Capture the date, batch, live birds, and pre-processing checks in a clean planning dialog.',
  },
  records: {
    title: 'Slaughter Records',
    description: 'Capture one slaughter run at a time, then finalize yield and approval in a separate step.',
    actionLabel: 'Enter slaughter record',
    actionDescription: 'Record live birds, weight, waste classes, inspection details, and storage notes in one modal.',
  },
  cuts: {
    title: 'Cut Parts',
    description: 'Track saleable poultry cuts such as dressed chicken, breast, thighs, wings, drumsticks, liver, and gizzards.',
    actionLabel: 'Post cut part output',
    actionDescription: 'Push approved cut-part quantities into inventory for later sales fulfillment.',
  },
  byproducts: {
    title: 'Byproducts',
    description: 'Track manure and reusable byproducts separately so disposal and reusable stock stay visible.',
    actionLabel: 'Post byproduct output',
    actionDescription: 'Record manure, head, and feet quantities from an approved run.',
  },
  outputs: {
    title: 'Product Outputs',
    description: 'Post approved finished products and reusable byproducts into inventory from completed runs.',
    actionLabel: 'Post product output',
    actionDescription: 'Select one approved run and transfer finished products into stock for sales and reporting.',
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

function outputLabel(outputType: string) {
  return productionOutputCatalog.find((entry) => entry.value === outputType)?.label ?? outputType.replace(/_/g, ' ')
}

function statusBadge(status: string) {
  if (status === 'completed' || status === 'approved' || status === 'passed') return 'badge badge-success'
  if (status === 'cancelled' || status === 'failed' || status === 'rejected') return 'badge badge-danger'
  if (status === 'in_progress' || status === 'rework') return 'badge badge-brand'
  return 'badge badge-neutral'
}

function isSaleableOutput(outputType: string) {
  return saleableOutputTypes.has(outputType)
}

function isByproductOutput(outputType: string) {
  return byproductOutputTypes.has(outputType)
}

function emptyRecordFormValues(): RecordFormValues {
  return {
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
  }
}

function emptyCompletionValues(): CompletionFormValues {
  return {
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
  }
}

function emptyOutputValues(defaultOutputType = 'dressed_chicken'): OutputFormValues {
  return {
    record_id: 0,
    stock_item_id: 0,
    output_type: defaultOutputType,
    quantity: 0,
    unit_cost: undefined,
  }
}

export function SlaughterPage({ section }: { section: SlaughterSection }) {
  const qc = useQueryClient()
  const copy = sectionCopy[section]
  const [selectedRecord, setSelectedRecord] = useState<SlaughterRecord | null>(null)
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false)
  const [isOutputModalOpen, setIsOutputModalOpen] = useState(false)

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
    defaultValues: emptyRecordFormValues(),
  })

  const completionForm = useForm<CompletionFormValues>({
    resolver: zodResolver(completionSchema),
    defaultValues: emptyCompletionValues(),
  })

  const outputForm = useForm<OutputFormValues>({
    resolver: zodResolver(outputSchema),
    defaultValues: emptyOutputValues(),
  })

  const createRecord = useMutation({
    mutationFn: (values: RecordFormValues) => api.post('/slaughter/records', values),
    onSuccess: () => {
      toast.success(section === 'planning' ? 'Slaughter plan saved.' : 'Slaughter record created.')
      qc.invalidateQueries({ queryKey: ['slaughter-records'] })
      recordForm.reset(emptyRecordFormValues())
      setIsRecordModalOpen(false)
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
      completionForm.reset(emptyCompletionValues())
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
      outputForm.reset(emptyOutputValues(outputCatalogForSection[0]?.value ?? 'dressed_chicken'))
      setIsOutputModalOpen(false)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to post slaughter output.')
    },
  })

  const approvedRecords = useMemo(
    () => records.filter((record) => record.status === 'completed' && record.approval_status === 'approved'),
    [records]
  )

  const completedRecords = useMemo(
    () => records.filter((record) => record.status === 'completed'),
    [records]
  )

  const planningRecords = useMemo(
    () => records.filter((record) => record.status === 'scheduled' || record.status === 'in_progress'),
    [records]
  )

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

  const outputCatalogForSection = useMemo(() => {
    if (section === 'cuts') {
      return productionOutputCatalog.filter((entry) => isSaleableOutput(entry.value))
    }
    if (section === 'byproducts') {
      return productionOutputCatalog.filter((entry) => isByproductOutput(entry.value))
    }
    return productionOutputCatalog
  }, [section])

  const visibleOutputs = useMemo(() => {
    if (section === 'cuts') return allOutputs.filter((output) => isSaleableOutput(output.output_type))
    if (section === 'byproducts') return allOutputs.filter((output) => isByproductOutput(output.output_type))
    return allOutputs
  }, [allOutputs, section])

  const averageYield =
    completedRecords.filter((record) => record.yield_percentage != null).length > 0
      ? `${(
          completedRecords
            .filter((record) => record.yield_percentage != null)
            .reduce((sum, record) => sum + Number(record.yield_percentage || 0), 0) /
          completedRecords.filter((record) => record.yield_percentage != null).length
        ).toFixed(1)}%`
      : 'No data'

  const outputInventoryItems = useMemo(() => {
    const matched = stockItems.filter((item) => productionOutputStockNames.has(item.name.trim().toLowerCase()))
    return matched.length > 0 ? matched : stockItems
  }, [stockItems])

  const selectedOutputType = outputForm.watch('output_type')

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

  useEffect(() => {
    if (!isOutputModalOpen) return
    const allowedTypes = new Set<string>(outputCatalogForSection.map((entry) => entry.value))
    const currentType = outputForm.getValues('output_type')
    if (!allowedTypes.has(currentType)) {
      outputForm.setValue('output_type', outputCatalogForSection[0]?.value ?? 'dressed_chicken')
    }
  }, [isOutputModalOpen, outputCatalogForSection, outputForm])

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
  const recordRows = section === 'planning' ? planningRecords : records
  const isOutputSection = section === 'outputs' || section === 'cuts' || section === 'byproducts'

  const openRecordModal = () => {
    recordForm.reset(emptyRecordFormValues())
    setIsRecordModalOpen(true)
  }

  const openOutputModal = () => {
    outputForm.reset(
      emptyOutputValues(outputCatalogForSection[0]?.value ?? 'dressed_chicken')
    )
    if (approvedRecords[0]) {
      outputForm.setValue('record_id', approvedRecords[0].id, { shouldValidate: true })
    }
    setIsOutputModalOpen(true)
  }

  const openFinalizeModal = (record: SlaughterRecord) => {
    setSelectedRecord(record)
    completionForm.reset({
      record_id: record.id,
      status: record.status,
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
  }

  const recordModalTitle = section === 'planning' ? 'Plan slaughter run' : 'Enter slaughter record'
  const outputModalTitle =
    section === 'cuts' ? 'Post cut part output' : section === 'byproducts' ? 'Post byproduct output' : 'Post product output'

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{copy.title}</h1>
          <p className="mt-1 max-w-3xl text-sm font-medium text-neutral-500">{copy.description}</p>
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

      {(section === 'planning' || section === 'records') && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">{copy.actionLabel}</h2>
                <p className="mt-1 text-sm text-neutral-500">{copy.actionDescription}</p>
              </div>
              <button type="button" className="btn-primary" onClick={openRecordModal}>
                <CalendarDays className="h-4 w-4" />
                {copy.actionLabel}
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-neutral-100 px-6 py-5">
              <h2 className="text-lg font-bold text-neutral-900">
                {section === 'planning' ? 'Scheduled and active runs' : 'Processing runs'}
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                {section === 'planning'
                  ? 'Monitor scheduled and in-progress batches before they reach yield approval.'
                  : 'Finalize yield, approval, and cold-room posting one record at a time.'}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-6">Date</th>
                    <th>Batch / House</th>
                    <th>Status</th>
                    <th>Live birds</th>
                    <th>Yield</th>
                    <th>Approval</th>
                    <th>Outputs</th>
                    <th className="pr-6">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recordRows.length === 0 ? (
                    <tr>
                      <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={8}>
                        {section === 'planning' ? 'No scheduled slaughter runs yet.' : 'No slaughter records.'}
                      </td>
                    </tr>
                  ) : (
                    recordRows.map((record) => {
                      const batch = batches.find((entry) => entry.id === record.batch_id)
                      return (
                        <tr key={record.id}>
                          <td className="pl-6">{formatDate(record.slaughter_date)}</td>
                          <td>
                            <div className="font-semibold text-neutral-900">{batch?.batch_number || `Batch #${record.batch_id}`}</div>
                            <div className="mt-1 text-xs text-neutral-500">{batch?.house?.name || 'No house assigned'}</div>
                          </td>
                          <td><span className={statusBadge(record.status)}>{record.status.replace(/_/g, ' ')}</span></td>
                          <td>
                            <div>{record.live_birds_count.toLocaleString()} birds</div>
                            <div className="mt-1 text-xs text-neutral-500">{record.total_live_weight.toLocaleString()} kg live</div>
                          </td>
                          <td>{record.yield_percentage != null ? `${record.yield_percentage.toFixed(1)}%` : 'Pending'}</td>
                          <td><span className={statusBadge(record.approval_status)}>{record.approval_status}</span></td>
                          <td>{record.outputs?.length?.toLocaleString() ?? 0}</td>
                          <td className="pr-6">
                            <button type="button" className="btn-secondary btn-sm" onClick={() => openFinalizeModal(record)}>
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

      {isOutputSection && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">{copy.actionLabel}</h2>
                <p className="mt-1 text-sm text-neutral-500">{copy.actionDescription}</p>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={openOutputModal}
                disabled={approvedRecords.length === 0}
              >
                <PackagePlus className="h-4 w-4" />
                {copy.actionLabel}
              </button>
            </div>
            {approvedRecords.length === 0 ? (
              <div className="mt-4 rounded-[16px] border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                Approve at least one completed slaughter run before posting inventory outputs.
              </div>
            ) : null}
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-neutral-100 px-6 py-5">
              <h2 className="text-lg font-bold text-neutral-900">
                {section === 'cuts' ? 'Cut-part ledger' : section === 'byproducts' ? 'Byproduct ledger' : 'Output ledger'}
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                {section === 'cuts'
                  ? 'Saleable cut parts and processed poultry products already moved into stock.'
                  : section === 'byproducts'
                    ? 'Manure and reusable byproducts captured from approved runs.'
                    : 'Finished product, cut-part, and byproduct lines transferred into inventory.'}
              </p>
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
                  {visibleOutputs.length === 0 ? (
                    <tr>
                      <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={6}>
                        {section === 'cuts'
                          ? 'No cut parts posted yet.'
                          : section === 'byproducts'
                            ? 'No byproducts posted yet.'
                            : 'No slaughter outputs posted yet.'}
                      </td>
                    </tr>
                  ) : (
                    visibleOutputs.map((output) => (
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
              <p className="mt-1 text-sm text-neutral-500">
                Completed runs with dressing performance, quality inspection, approval, and storage posting status.
              </p>
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
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title={recordModalTitle}
        description={copy.actionDescription}
      >
        <form className="space-y-5" onSubmit={recordForm.handleSubmit((values) => createRecord.mutate(values))}>
          <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Run identification</div>
            <div className="grid gap-4 md:grid-cols-2">
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
                {selectedBatch ? (
                  <p className="form-hint">House: {selectedBatch.house?.name ?? `House #${selectedBatch.house_id ?? '-'}`}</p>
                ) : null}
              </div>
              <div>
                <label className="form-label">Slaughter date</label>
                <input className="form-input" type="date" {...recordForm.register('slaughter_date')} />
              </div>
            </div>
          </div>

          <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Live bird intake</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">Live birds count</label>
                <input className="form-input" type="number" min={0} {...recordForm.register('live_birds_count')} />
              </div>
              <div>
                <label className="form-label">Total live weight (kg)</label>
                <input className="form-input" type="number" min={0} step="0.01" {...recordForm.register('total_live_weight')} />
              </div>
              <div>
                <label className="form-label">Mortality before process</label>
                <input className="form-input" type="number" min={0} {...recordForm.register('mortality_birds_count')} />
              </div>
              <div>
                <label className="form-label">Condemned birds</label>
                <input className="form-input" type="number" min={0} {...recordForm.register('condemned_birds_count')} />
              </div>
            </div>
          </div>

          <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Waste and byproduct classes</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className="form-label">Waste weight (kg)</label><input className="form-input" type="number" min={0} step="0.01" {...recordForm.register('waste_weight')} /></div>
              <div><label className="form-label">Blood (kg)</label><input className="form-input" type="number" min={0} step="0.01" {...recordForm.register('blood_weight')} /></div>
              <div><label className="form-label">Feathers (kg)</label><input className="form-input" type="number" min={0} step="0.01" {...recordForm.register('feathers_weight')} /></div>
              <div><label className="form-label">Offal (kg)</label><input className="form-input" type="number" min={0} step="0.01" {...recordForm.register('offal_weight')} /></div>
              <div><label className="form-label">Head (kg)</label><input className="form-input" type="number" min={0} step="0.01" {...recordForm.register('head_weight')} /></div>
              <div><label className="form-label">Feet (kg)</label><input className="form-input" type="number" min={0} step="0.01" {...recordForm.register('feet_weight')} /></div>
              <div className="md:col-span-2"><label className="form-label">Reusable byproducts (kg)</label><input className="form-input" type="number" min={0} step="0.01" {...recordForm.register('reusable_byproducts_weight')} /></div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="form-label">Quality inspection status</label>
              <select className="form-input" {...recordForm.register('quality_inspection_status')}>
                <option value="pending">Pending</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="rework">Rework</option>
              </select>
            </div>
            <div>
              <label className="form-label">Cold-room / storage location</label>
              <input className="form-input" {...recordForm.register('cold_room_location')} />
            </div>
          </div>

          <div>
            <label className="form-label">Waste disposal record</label>
            <textarea className="form-input min-h-[88px]" {...recordForm.register('waste_disposal_notes')} />
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input min-h-[88px]" {...recordForm.register('notes')} />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setIsRecordModalOpen(false)}>Close</button>
            <button className="btn-primary" disabled={createRecord.isPending} type="submit">
              <CalendarDays className="h-4 w-4" />
              {createRecord.isPending ? 'Saving...' : recordModalTitle}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isOutputModalOpen}
        onClose={() => setIsOutputModalOpen(false)}
        title={outputModalTitle}
        description={copy.actionDescription}
      >
        <form className="space-y-4" onSubmit={outputForm.handleSubmit((values) => createOutput.mutate(values))}>
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
              {outputCatalogForSection.map((item) => (
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
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setIsOutputModalOpen(false)}>Close</button>
            <button className="btn-primary" disabled={createOutput.isPending} type="submit">
              <PackagePlus className="h-4 w-4" />
              {createOutput.isPending ? 'Saving...' : outputModalTitle}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!selectedRecord}
        onClose={() => {
          setSelectedRecord(null)
          completionForm.reset(emptyCompletionValues())
        }}
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
