import { useEffect, useMemo, useState, type ElementType } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Activity, CalendarDays, ClipboardList, HeartPulse, Pill, Scale, Skull, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'

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

const modeCopy: Record<FarmOperationMode, { title: string; description: string; path: string; icon: ElementType }> = {
  mortality: {
    title: 'Mortality Tracking',
    description: 'Record bird losses with date, cause, and impact on active batch quantity.',
    path: 'mortality',
    icon: Skull,
  },
  vaccination: {
    title: 'Vaccination Log',
    description: 'Schedule and document vaccination activity for each active batch.',
    path: 'vaccinations',
    icon: Pill,
  },
  growth: {
    title: 'Growth Tracking',
    description: 'Capture average bird weight over time and monitor batch development.',
    path: 'growth',
    icon: Scale,
  },
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

export function FarmOperationsPage({ mode }: { mode: FarmOperationMode }) {
  const qc = useQueryClient()
  const [selectedBatchId, setSelectedBatchId] = useState<number | ''>('')
  const copy = modeCopy[mode]
  const ModeIcon = copy.icon

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

  const mortalityForm = useForm<MortalityFormValues>({
    resolver: zodResolver(mortalitySchema),
    defaultValues: { record_date: todayValue(), quantity: 1, cause: '', notes: '' },
  })

  const vaccinationForm = useForm<VaccinationFormValues>({
    resolver: zodResolver(vaccinationSchema),
    defaultValues: { vaccine_name: '', scheduled_date: todayValue(), administered_date: '', status: 'pending', notes: '' },
  })

  const growthForm = useForm<GrowthFormValues>({
    resolver: zodResolver(growthSchema),
    defaultValues: { record_date: todayValue(), avg_weight_grams: 0, notes: '' },
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
      if (mode === 'mortality') mortalityForm.reset({ record_date: todayValue(), quantity: 1, cause: '', notes: '' })
      if (mode === 'vaccination') {
        vaccinationForm.reset({ vaccine_name: '', scheduled_date: todayValue(), administered_date: '', status: 'pending', notes: '' })
      }
      if (mode === 'growth') growthForm.reset({ record_date: todayValue(), avg_weight_grams: 0, notes: '' })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? `Failed to update ${copy.title.toLowerCase()}.`)
    },
  })

  const summary = useMemo(() => {
    if (!selectedBatch) {
      return { primary: '—', secondary: '—', tertiary: '—' }
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
    const avgWeight = latest ? `${latest.avg_weight_grams.toLocaleString()} g` : '—'
    return {
      primary: avgWeight,
      secondary: (logs as GrowthLog[]).length.toLocaleString(),
      tertiary: selectedBatch.active_quantity.toLocaleString(),
    }
  }, [logs, mode, selectedBatch])

  const tableColumnCount = mode === 'mortality' ? 4 : mode === 'vaccination' ? 5 : 3

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{copy.title}</h1>
          <p className="mt-1 max-w-2xl text-base font-medium text-slate-600">{copy.description}</p>
        </div>
        <div className="flex min-w-[280px] flex-col gap-2">
          <label className="form-label mb-0">Select batch</label>
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
      </div>

      {batchesLoading ? (
        <div className="card p-12 text-center text-slate-500 text-lg">Loading batch operations...</div>
      ) : batches.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 p-16 text-center border-2 border-slate-200">
          <ModeIcon className="h-12 w-12 text-brand-600" />
          <div>
            <h2 className="text-xl font-bold text-slate-900">No batches available yet</h2>
            <p className="mt-2 max-w-md text-base text-slate-500">
              Create a poultry batch first so you can record {copy.title.toLowerCase()} against a real operational unit.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="card p-5 border-2 border-slate-200">
              <div className="mb-3 flex items-center gap-2 text-slate-500">
                <ClipboardList className="h-5 w-5 text-brand-600" />
                <span className="text-sm font-bold uppercase tracking-[0.12em]">Batch</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{selectedBatch?.batch_number ?? '—'}</p>
              <p className="mt-1 text-base text-slate-500">
                {selectedBatch?.breed ?? '—'} in {selectedBatch?.house?.name ?? 'Unassigned house'}
              </p>
            </div>
            <div className="card p-5 border-2 border-slate-200">
              <div className="mb-3 flex items-center gap-2 text-slate-500">
                <HeartPulse className="h-5 w-5 text-brand-600" />
                <span className="text-sm font-bold uppercase tracking-[0.12em]">
                  {mode === 'mortality' ? 'Recorded Losses' : mode === 'vaccination' ? 'Completed Doses' : 'Latest Weight'}
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{summary.primary}</p>
              <p className="mt-1 text-base text-slate-500">
                {mode === 'mortality'
                  ? `Mortality rate: ${summary.secondary}`
                  : mode === 'vaccination'
                    ? `${summary.secondary} still pending`
                    : `${summary.secondary} growth entries recorded`}
              </p>
            </div>
            <div className="card p-5 border-2 border-slate-200">
              <div className="mb-3 flex items-center gap-2 text-slate-500">
                <Activity className="h-5 w-5 text-brand-600" />
                <span className="text-sm font-bold uppercase tracking-[0.12em]">
                  {mode === 'vaccination' ? 'Total Vaccine Logs' : 'Active Birds'}
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{summary.tertiary}</p>
              <p className="mt-1 text-base text-slate-500">
                Arrived on {formatDate(selectedBatch?.arrival_date)}
              </p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_420px]">
            <div className="card overflow-hidden">
              <div className="border-b-2 border-slate-200 px-6 py-5 bg-slate-50">
                <h2 className="text-xl font-bold text-slate-900">Operational history</h2>
                <p className="mt-1 text-base text-slate-600">
                  Logged entries for {selectedBatch?.batch_number}. All records are stored against the selected batch.
                </p>
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
                      {mode === 'growth' && <th>Average Weight</th>}
                      <th className="pr-6">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsLoading ? (
                      <tr>
                        <td className="pl-6 py-12 text-base text-slate-500 text-center font-medium" colSpan={tableColumnCount}>
                          Loading records...
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td className="pl-6 py-14 text-base text-slate-500 text-center font-medium" colSpan={tableColumnCount}>
                          No {copy.title.toLowerCase()} entries recorded for this batch yet.
                        </td>
                      </tr>
                    ) : mode === 'mortality' ? (
                      (logs as MortalityLog[]).map((log) => (
                        <tr key={log.id}>
                          <td className="pl-6">{formatDate(log.record_date)}</td>
                          <td>{log.quantity.toLocaleString()} birds</td>
                          <td>{log.cause || '—'}</td>
                          <td className="pr-6">{log.notes || '—'}</td>
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
                          <td className="pr-6">{log.notes || '—'}</td>
                        </tr>
                      ))
                    ) : (
                      (logs as GrowthLog[]).map((log) => (
                        <tr key={log.id}>
                          <td className="pl-6">{formatDate(log.record_date)}</td>
                          <td>{log.avg_weight_grams.toLocaleString()} g</td>
                          <td className="pr-6" colSpan={2}>{log.notes || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card p-6 border-2 border-slate-200 bg-slate-50">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-slate-900">Add new entry</h2>
                <p className="mt-1 text-base text-slate-600">
                  Post a live operational update for {selectedBatch?.batch_number ?? 'the selected batch'}.
                </p>
              </div>

              {mode === 'mortality' && (
                <form className="space-y-4" onSubmit={mortalityForm.handleSubmit((values) => mutation.mutate(values))}>
                  <div>
                    <label className="form-label">Record date</label>
                    <input className="form-input" type="date" {...mortalityForm.register('record_date')} />
                    {mortalityForm.formState.errors.record_date && <p className="form-error">{mortalityForm.formState.errors.record_date.message}</p>}
                  </div>
                  <div>
                    <label className="form-label">Lost birds</label>
                    <input className="form-input" type="number" min={1} {...mortalityForm.register('quantity')} />
                    {mortalityForm.formState.errors.quantity && <p className="form-error">{mortalityForm.formState.errors.quantity.message}</p>}
                  </div>
                  <div>
                    <label className="form-label">Cause</label>
                    <input className="form-input" placeholder="Heat stress, disease, transport..." {...mortalityForm.register('cause')} />
                  </div>
                  <div>
                    <label className="form-label">Notes</label>
                    <textarea className="form-input min-h-[120px]" {...mortalityForm.register('notes')} />
                  </div>
                  <button className="btn-primary w-full" disabled={mutation.isPending} type="submit">
                    <Skull className="h-4 w-4" />
                    {mutation.isPending ? 'Saving...' : 'Record mortality'}
                  </button>
                </form>
              )}

              {mode === 'vaccination' && (
                <form className="space-y-4" onSubmit={vaccinationForm.handleSubmit((values) => mutation.mutate(values))}>
                  <div>
                    <label className="form-label">Vaccine name</label>
                    <input className="form-input" placeholder="Newcastle, Gumboro..." {...vaccinationForm.register('vaccine_name')} />
                    {vaccinationForm.formState.errors.vaccine_name && <p className="form-error">{vaccinationForm.formState.errors.vaccine_name.message}</p>}
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
                  <button className="btn-primary w-full" disabled={mutation.isPending} type="submit">
                    <Pill className="h-4 w-4" />
                    {mutation.isPending ? 'Saving...' : 'Add vaccination log'}
                  </button>
                </form>
              )}

              {mode === 'growth' && (
                <form className="space-y-4" onSubmit={growthForm.handleSubmit((values) => mutation.mutate(values))}>
                  <div>
                    <label className="form-label">Record date</label>
                    <input className="form-input" type="date" {...growthForm.register('record_date')} />
                    {growthForm.formState.errors.record_date && <p className="form-error">{growthForm.formState.errors.record_date.message}</p>}
                  </div>
                  <div>
                    <label className="form-label">Average weight (grams)</label>
                    <input className="form-input" type="number" min={1} step="0.01" {...growthForm.register('avg_weight_grams')} />
                    {growthForm.formState.errors.avg_weight_grams && <p className="form-error">{growthForm.formState.errors.avg_weight_grams.message}</p>}
                  </div>
                  <div>
                    <label className="form-label">Notes</label>
                    <textarea className="form-input min-h-[120px]" {...growthForm.register('notes')} />
                  </div>
                  <button className="btn-primary w-full" disabled={mutation.isPending} type="submit">
                    <TrendingUp className="h-4 w-4" />
                    {mutation.isPending ? 'Saving...' : 'Record growth reading'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
