import { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarDays, Info } from 'lucide-react'
import { recordSchema, RecordFormValues } from '../schemas'
import { BatchOption, SlaughterSection } from '../types'
import { emptyRecordFormValues } from '../hooks'

interface RecordFormProps {
  batches: BatchOption[]
  section: SlaughterSection
  onSubmit: (values: RecordFormValues) => void
  isLoading?: boolean
  onCancel: () => void
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      {children}
      {hint && !error ? <p className="form-hint">{hint}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  )
}

/**
 * Slaughter PLAN form — only the run setup.
 * Yield, waste, costs and inspection are captured later, after the birds are
 * actually processed (the "Record actual yield" step), not at planning time.
 */
export function RecordForm({ batches, section, onSubmit, isLoading, onCancel }: RecordFormProps) {
  const form = useForm<RecordFormValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: emptyRecordFormValues(),
  })
  const { register, formState, watch } = form
  const errors = formState.errors
  const liveBirds = Number(watch('live_birds_count')) || 0
  const liveWeight = Number(watch('total_live_weight')) || 0
  const avgWeight = liveBirds > 0 ? (liveWeight / liveBirds).toFixed(3) : null
  const selectedBatch = batches.find((batch) => batch.id === Number(watch('batch_id')))

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="flex items-start gap-3 rounded-[12px] border border-brand-100 bg-brand-50 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <p className="text-[13px] leading-relaxed text-brand-800">
          Set up the run here. Once saved, a supervisor reviews and approves it to start. Actual dressed
          weight, waste, costs and inspection are recorded after processing — not now.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Batch to process" error={errors.batch_id?.message} hint={selectedBatch ? `${selectedBatch.breed} · House: ${selectedBatch.house?.name ?? `#${selectedBatch.house_id ?? '-'}`}` : 'Select the flock being slaughtered'}>
          <select className="form-input" {...register('batch_id')}>
            <option value={0}>Choose batch</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.batch_number} - {batch.breed}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Planned slaughter date" error={errors.slaughter_date?.message}>
          <input className="form-input" type="date" {...register('slaughter_date')} />
        </Field>

        <Field label="Live birds to process" error={errors.live_birds_count?.message} hint="Number of birds taken from the batch">
          <input className="form-input" type="number" min={1} placeholder="0" {...register('live_birds_count')} />
        </Field>

        <Field label="Total live weight at weigh-in (kg)" error={errors.total_live_weight?.message} hint={avgWeight ? `Average ${avgWeight} kg/bird` : 'Weighbridge reading before slaughter'}>
          <input className="form-input" type="number" min={0} step="0.01" placeholder="0.00" {...register('total_live_weight')} />
        </Field>
      </div>

      <Field label="Planning notes (optional)" hint="Crew, line, transport or any pre-processing reminder">
        <textarea className="form-input min-h-[80px]" placeholder="e.g. Morning shift, line 2, collect by 6am" {...register('notes')} />
      </Field>

      <div className="flex justify-end gap-3 border-t border-neutral-100 pt-5">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary" disabled={isLoading} type="submit">
          <CalendarDays className="h-4 w-4" />
          {isLoading ? 'Saving...' : 'Save plan'}
        </button>
      </div>
    </form>
  )
}
