import { useEffect, useMemo, useState, type ElementType } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Activity, ClipboardList, HeartPulse, Pill, Scale, Skull, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'

import api from '@/services/api'
import { Modal } from '@/components/Modal'
import { useAuth } from '@/features/auth/AuthContext'
import { FarmReferenceManager, type FarmReferenceManagerType } from '@/features/farm/FarmReferenceManager'

type FarmOperationMode = 'mortality' | 'vaccination' | 'growth'

interface BatchOption {
  id: number
  batch_number: string
  breed: string
  arrival_date: string
  active_quantity: number
  initial_quantity: number
  status: string
  house?: { name: string } | null
}

interface MortalityLog {
  id: number
  batch_id: number
  record_date: string
  quantity: number
  cause?: string | null
  notes?: string | null
}

interface VaccinationLog {
  id: number
  batch_id: number
  vaccine_name: string
  scheduled_date: string
  administered_date?: string | null
  status: string
  notes?: string | null
}

interface GrowthLog {
  id: number
  batch_id: number
  record_date: string
  avg_weight_grams: number
  notes?: string | null
}

interface ReferenceItem {
  id: number
  reference_type: 'batch_breed' | 'batch_source' | 'mortality_cause' | 'vaccine'
  name: string
  is_active: boolean
}

const mortalitySchema = z.object({
  record_date: z.string().min(1, 'Record date is required'),
  quantity: z.coerce.number().int().positive('Quantity must be greater than zero'),
  cause: z.string().optional(),
  notes: z.string().optional(),
})

const vaccinationSchema = z.object({
  vaccine_name: z.string().min(2, 'Vaccine name is required'),
  scheduled_date: z.string().min(1, 'Scheduled date is required'),
  administered_date: z.string().optional(),
  status: z.enum(['pending', 'completed', 'cancelled']).default('pending'),
  notes: z.string().optional(),
})

const growthSchema = z.object({
  record_date: z.string().min(1, 'Record date is required'),
  avg_weight_grams: z.coerce.number().positive('Average weight must be greater than zero'),
  notes: z.string().optional(),
})

type MortalityFormValues = z.infer<typeof mortalitySchema>
type VaccinationFormValues = z.infer<typeof vaccinationSchema>
type GrowthFormValues = z.infer<typeof growthSchema>

const modeCopy: Record<
  FarmOperationMode,
  { title: string; description: string; path: string; icon: ElementType; actionLabel: string }
> = {
  mortality: {
    title: 'Mortality',
    description: 'Capture mortality events by batch without crowding the history view.',
    path: 'mortality',
    icon: Skull,
    actionLabel: 'Record mortality',
  },
  vaccination: {
    title: 'Vaccination',
    description: 'Manage vaccination scheduling and administered doses in a single batch context.',
    path: 'vaccinations',
    icon: Pill,
    actionLabel: 'Add vaccination log',
  },
  growth: {
    title: 'Growth',
    description: 'Log growth and weight checks while keeping the batch history clean and readable.',
    path: 'growth',
    icon: Scale,
    actionLabel: 'Record growth reading',
  },
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

function emptyMortalityValues(): MortalityFormValues {
  return { record_date: todayValue(), quantity: 1, cause: '', notes: '' }
}

function emptyVaccinationValues(): VaccinationFormValues {
  return { vaccine_name: '', scheduled_date: todayValue(), administered_date: '', status: 'pending', notes: '' }
}

function emptyGrowthValues(): GrowthFormValues {
  return { record_date: todayValue(), avg_weight_grams: 0, notes: '' }
}

export function FarmOperationsPage({ mode }: { mode: FarmOperationMode }) {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const [selectedBatchId, setSelectedBatchId] = useState<number | ''>('')
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false)
  const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false)
  const copy = modeCopy[mode]
  const ModeIcon = copy.icon
  const canManageFarm = hasPermission('farm:write')

  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ['farm-batches'],
    queryFn: () => api.get<BatchOption[]>('/farm/batches').then((response) => response.data),
  })

  useEffect(() => {
    if (!selectedBatchId && batches.length > 0) {
      setSelectedBatchId(batches[0].id)
    }
  }, [batches, selectedBatchId])

  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId) ?? null

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['farm-operations', mode, selectedBatchId],
    queryFn: async () => {
      if (!selectedBatchId) return []
      const response = await api.get<MortalityLog[] | VaccinationLog[] | GrowthLog[]>(
        `/farm/batches/${selectedBatchId}/${copy.path}`
      )
      return response.data
    },
    enabled: Boolean(selectedBatchId),
  })

  const { data: referenceItems = [] } = useQuery({
    queryKey: ['farm-reference-items'],
    queryFn: () => api.get<ReferenceItem[]>('/farm/reference-items?active_only=true').then((response) => response.data),
  })

  const mortalityCauseOptions = useMemo(
    () => referenceItems.filter((item) => item.reference_type === 'mortality_cause' && item.is_active),
    [referenceItems]
  )

  const vaccineOptions = useMemo(
    () => referenceItems.filter((item) => item.reference_type === 'vaccine' && item.is_active),
    [referenceItems]
  )

  const mortalityForm = useForm<MortalityFormValues>({
    resolver: zodResolver(mortalitySchema),
    defaultValues: emptyMortalityValues(),
  })

  const vaccinationForm = useForm<VaccinationFormValues>({
    resolver: zodResolver(vaccinationSchema),
    defaultValues: emptyVaccinationValues(),
  })

  const growthForm = useForm<GrowthFormValues>({
    resolver: zodResolver(growthSchema),
    defaultValues: emptyGrowthValues(),
  })

  const mutation = useMutation({
    mutationFn: async (payload: MortalityFormValues | VaccinationFormValues | GrowthFormValues) => {
      if (!selectedBatchId) {
        throw new Error('Select a batch first.')
      }
      const endpoint = `/farm/batches/${selectedBatchId}/${copy.path}`
      const response = await api.post(endpoint, payload)
      return response.data
    },
    onSuccess: () => {
      toast.success(`${copy.title} updated.`)
      qc.invalidateQueries({ queryKey: ['farm-batches'] })
      qc.invalidateQueries({ queryKey: ['farm-operations', mode, selectedBatchId] })
      mortalityForm.reset(emptyMortalityValues())
      vaccinationForm.reset(emptyVaccinationValues())
      growthForm.reset(emptyGrowthValues())
      setIsEntryModalOpen(false)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? `Failed to update ${copy.title.toLowerCase()}.`)
    },
  })

  const summary = useMemo(() => {
    if (!selectedBatch) {
      return { primary: '-', secondary: '-', tertiary: '-' }
    }

    if (mode === 'mortality') {
      const totalLoss = (logs as MortalityLog[]).reduce((sum, log) => sum + log.quantity, 0)
      const mortalityRate = selectedBatch.initial_quantity
        ? `${((totalLoss / selectedBatch.initial_quantity) * 100).toFixed(1)}%`
        : '0%'
      return {
        primary: totalLoss.toLocaleString(),
        secondary: mortalityRate,
        tertiary: selectedBatch.active_quantity.toLocaleString(),
      }
    }

    if (mode === 'vaccination') {
      const completed = (logs as VaccinationLog[]).filter((log) => log.status === 'completed').length
      const pending = (logs as VaccinationLog[]).filter((log) => log.status === 'pending').length
      return {
        primary: completed.toLocaleString(),
        secondary: pending.toLocaleString(),
        tertiary: (logs as VaccinationLog[]).length.toLocaleString(),
      }
    }

    const latest = [...(logs as GrowthLog[])].sort((a, b) => b.record_date.localeCompare(a.record_date))[0]
    const avgWeight = latest ? `${latest.avg_weight_grams.toLocaleString()} g` : '-'
    return {
      primary: avgWeight,
      secondary: (logs as GrowthLog[]).length.toLocaleString(),
      tertiary: selectedBatch.active_quantity.toLocaleString(),
    }
  }, [logs, mode, selectedBatch])

  const tableColumnCount = mode === 'mortality' ? 4 : mode === 'vaccination' ? 5 : 3

  const openEntryModal = () => {
    mortalityForm.reset(emptyMortalityValues())
    vaccinationForm.reset(emptyVaccinationValues())
    growthForm.reset(emptyGrowthValues())
    setIsEntryModalOpen(true)
  }

  const referenceTypes: FarmReferenceManagerType[] =
    mode === 'mortality'
      ? [
          {
            type: 'mortality_cause',
            label: 'Mortality causes',
            description: 'Managers define the standard mortality causes used by operators.',
          },
        ]
      : mode === 'vaccination'
        ? [
            {
              type: 'vaccine',
              label: 'Vaccines',
              description: 'Managers define vaccine names so users select them instead of typing.',
            },
          ]
        : []

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">{copy.title}</h1>
          <p className="mt-1 max-w-3xl text-sm font-medium text-ink-500">{copy.description}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-[260px]">
            <label className="form-label mb-2">Select batch</label>
            <select
              className="form-input"
              value={selectedBatchId}
              onChange={(event) => setSelectedBatchId(event.target.value ? Number(event.target.value) : '')}
            >
              <option value="">Choose a batch</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batch_number} - {batch.house?.name ?? 'Unassigned house'}
                </option>
              ))}
            </select>
          </div>
          {canManageFarm ? (
            <button type="button" className="btn-primary" onClick={openEntryModal} disabled={!selectedBatchId}>
              <ModeIcon className="h-4 w-4" />
              {copy.actionLabel}
            </button>
          ) : null}
          {canManageFarm && mode !== 'growth' ? (
            <button type="button" className="btn-secondary" onClick={() => setIsReferenceModalOpen(true)}>
              Manage list
            </button>
          ) : null}
        </div>
      </div>

      {batchesLoading ? (
        <div className="card p-12 text-center text-ink-500 text-lg">Loading...</div>
      ) : batches.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 border border-neutral-150 p-16 text-center">
          <ModeIcon className="h-12 w-12 text-brand-600" />
          <div>
            <h2 className="text-xl font-bold text-ink-900">No batches</h2>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2 text-ink-500">
                <ClipboardList className="h-5 w-5 text-brand-600" />
                <span className="text-sm font-bold uppercase tracking-[0.12em]">Batch</span>
              </div>
              <p className="text-2xl font-bold text-ink-900">{selectedBatch?.batch_number ?? '-'}</p>
              <p className="mt-1 text-base text-ink-500">
                {selectedBatch?.breed ?? '-'} in {selectedBatch?.house?.name ?? 'Unassigned house'}
              </p>
            </div>
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2 text-ink-500">
                <HeartPulse className="h-5 w-5 text-brand-600" />
                <span className="text-sm font-bold uppercase tracking-[0.12em]">
                  {mode === 'mortality' ? 'Recorded losses' : mode === 'vaccination' ? 'Completed doses' : 'Latest weight'}
                </span>
              </div>
              <p className="text-2xl font-bold text-ink-900">{summary.primary}</p>
              <p className="mt-1 text-base text-ink-500">
                {mode === 'mortality'
                  ? `Mortality rate: ${summary.secondary}`
                  : mode === 'vaccination'
                    ? `${summary.secondary} still pending`
                    : `${summary.secondary} growth entries recorded`}
              </p>
            </div>
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2 text-ink-500">
                <Activity className="h-5 w-5 text-brand-600" />
                <span className="text-sm font-bold uppercase tracking-[0.12em]">
                  {mode === 'vaccination' ? 'Total vaccine logs' : 'Active birds'}
                </span>
              </div>
              <p className="text-2xl font-bold text-ink-900">{summary.tertiary}</p>
              <p className="mt-1 text-base text-ink-500">Arrived on {formatDate(selectedBatch?.arrival_date)}</p>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">{copy.actionLabel}</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Capture the selected batch entry from a dedicated dialog instead of pinning the form beside the table.
                </p>
              </div>
              {canManageFarm ? (
                <button type="button" className="btn-secondary" onClick={openEntryModal} disabled={!selectedBatchId}>
                  <ModeIcon className="h-4 w-4" />
                  {copy.actionLabel}
                </button>
              ) : null}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-neutral-150 bg-neutral-50 px-6 py-5">
              <h2 className="text-xl font-bold text-ink-900">History</h2>
              <p className="mt-1 text-base text-ink-500">{selectedBatch?.batch_number}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-6">Date</th>
                    {mode === 'mortality' && <th>Quantity</th>}
                    {mode === 'mortality' && <th>Cause</th>}
                    {mode === 'vaccination' && <th>Vaccine</th>}
                    {mode === 'vaccination' && <th>Status</th>}
                    {mode === 'vaccination' && <th>Administered</th>}
                    {mode === 'growth' && <th>Average weight</th>}
                    <th className="pr-6">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {logsLoading ? (
                    <tr>
                      <td className="pl-6 py-12 text-center text-base font-medium text-ink-500" colSpan={tableColumnCount}>
                        Loading records...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td className="pl-6 py-14 text-center text-base font-medium text-ink-500" colSpan={tableColumnCount}>
                        No records.
                      </td>
                    </tr>
                  ) : mode === 'mortality' ? (
                    (logs as MortalityLog[]).map((log) => (
                      <tr key={log.id}>
                        <td className="pl-6">{formatDate(log.record_date)}</td>
                        <td>{log.quantity.toLocaleString()} birds</td>
                        <td>{log.cause || '-'}</td>
                        <td className="pr-6">{log.notes || '-'}</td>
                      </tr>
                    ))
                  ) : mode === 'vaccination' ? (
                    (logs as VaccinationLog[]).map((log) => (
                      <tr key={log.id}>
                        <td className="pl-6">{formatDate(log.scheduled_date)}</td>
                        <td>{log.vaccine_name}</td>
                        <td>
                          <span className={log.status === 'completed' ? 'badge badge-success' : 'badge badge-warning'}>
                            {log.status}
                          </span>
                        </td>
                        <td>{formatDate(log.administered_date)}</td>
                        <td className="pr-6">{log.notes || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    (logs as GrowthLog[]).map((log) => (
                      <tr key={log.id}>
                        <td className="pl-6">{formatDate(log.record_date)}</td>
                        <td>{log.avg_weight_grams.toLocaleString()} g</td>
                        <td className="pr-6">{log.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        title={copy.actionLabel}
        description={selectedBatch ? `${selectedBatch.batch_number} | ${selectedBatch.house?.name ?? 'Unassigned house'}` : copy.description}
      >
        {mode === 'mortality' && (
          <form className="space-y-4" onSubmit={mortalityForm.handleSubmit((values) => mutation.mutate(values))}>
            <div>
              <label className="form-label">Record date</label>
              <input className="form-input" type="date" {...mortalityForm.register('record_date')} />
            </div>
            <div>
              <label className="form-label">Lost birds</label>
              <input className="form-input" type="number" min={1} {...mortalityForm.register('quantity')} />
            </div>
            <div>
              <label className="form-label">Cause</label>
              <select className="form-input" {...mortalityForm.register('cause')}>
                <option value="">Select cause...</option>
                {mortalityCauseOptions.map((item) => (
                  <option key={item.id} value={item.name}>{item.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Notes</label>
              <textarea className="form-input min-h-[120px]" {...mortalityForm.register('notes')} />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setIsEntryModalOpen(false)}>Close</button>
              <button className="btn-primary" disabled={mutation.isPending} type="submit">
                <Skull className="h-4 w-4" />
                {mutation.isPending ? 'Saving...' : 'Record mortality'}
              </button>
            </div>
          </form>
        )}

        {mode === 'vaccination' && (
          <form className="space-y-4" onSubmit={vaccinationForm.handleSubmit((values) => mutation.mutate(values))}>
            <div>
              <label className="form-label">Vaccine name</label>
              <select className="form-input" {...vaccinationForm.register('vaccine_name')}>
                <option value="">Select vaccine...</option>
                {vaccineOptions.map((item) => (
                  <option key={item.id} value={item.name}>{item.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">Scheduled date</label>
                <input className="form-input" type="date" {...vaccinationForm.register('scheduled_date')} />
              </div>
              <div>
                <label className="form-label">Administered date</label>
                <input className="form-input" type="date" {...vaccinationForm.register('administered_date')} />
              </div>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" {...vaccinationForm.register('status')}>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="form-label">Notes</label>
              <textarea className="form-input min-h-[120px]" {...vaccinationForm.register('notes')} />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setIsEntryModalOpen(false)}>Close</button>
              <button className="btn-primary" disabled={mutation.isPending} type="submit">
                <Pill className="h-4 w-4" />
                {mutation.isPending ? 'Saving...' : 'Add vaccination log'}
              </button>
            </div>
          </form>
        )}

        {mode === 'growth' && (
          <form className="space-y-4" onSubmit={growthForm.handleSubmit((values) => mutation.mutate(values))}>
            <div>
              <label className="form-label">Record date</label>
              <input className="form-input" type="date" {...growthForm.register('record_date')} />
            </div>
            <div>
              <label className="form-label">Average weight (grams)</label>
              <input className="form-input" type="number" min={1} step="0.01" {...growthForm.register('avg_weight_grams')} />
            </div>
            <div>
              <label className="form-label">Notes</label>
              <textarea className="form-input min-h-[120px]" {...growthForm.register('notes')} />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setIsEntryModalOpen(false)}>Close</button>
              <button className="btn-primary" disabled={mutation.isPending} type="submit">
                <TrendingUp className="h-4 w-4" />
                {mutation.isPending ? 'Saving...' : 'Record growth reading'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={isReferenceModalOpen}
        onClose={() => setIsReferenceModalOpen(false)}
        title={mode === 'mortality' ? 'Mortality causes' : 'Vaccines'}
      >
        {referenceTypes.length > 0 ? <FarmReferenceManager types={referenceTypes} /> : null}
      </Modal>
    </div>
  )
}
