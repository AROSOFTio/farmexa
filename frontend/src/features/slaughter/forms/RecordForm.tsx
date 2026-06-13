import { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarDays } from 'lucide-react'
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

/** A labelled section with a thin divider — replaces the heavy gray fieldset boxes. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">{title}</h3>
      {children}
    </section>
  )
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

export function RecordForm({ batches, section, onSubmit, isLoading, onCancel }: RecordFormProps) {
  const form = useForm<RecordFormValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: emptyRecordFormValues(),
  })
  const { register, formState, watch } = form
  const errors = formState.errors
  const selectedBatch = batches.find((batch) => batch.id === watch('batch_id'))

  return (
    <form className="divide-y divide-neutral-100" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="space-y-7 pb-6">
        <Section title="Run identification">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Batch" error={errors.batch_id?.message} hint={selectedBatch ? `House: ${selectedBatch.house?.name ?? `House #${selectedBatch.house_id ?? '-'}`}` : undefined}>
              <select className="form-input" {...register('batch_id')}>
                <option value={0}>Choose batch</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_number} - {batch.breed}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Slaughter date" error={errors.slaughter_date?.message}>
              <input className="form-input" type="date" {...register('slaughter_date')} />
            </Field>
          </div>
        </Section>

        <Section title="Live bird intake">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Live birds count" error={errors.live_birds_count?.message}>
              <input className="form-input" type="number" min={0} {...register('live_birds_count')} />
            </Field>
            <Field label="Total live weight (kg)" error={errors.total_live_weight?.message}>
              <input className="form-input" type="number" min={0} step="0.01" {...register('total_live_weight')} />
            </Field>
            <Field label="Mortality before process">
              <input className="form-input" type="number" min={0} {...register('mortality_birds_count')} />
            </Field>
            <Field label="Condemned birds">
              <input className="form-input" type="number" min={0} {...register('condemned_birds_count')} />
            </Field>
          </div>
        </Section>

        <Section title="Waste & byproduct classes">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Waste (kg)"><input className="form-input" type="number" min={0} step="0.01" {...register('waste_weight')} /></Field>
            <Field label="Blood (kg)"><input className="form-input" type="number" min={0} step="0.01" {...register('blood_weight')} /></Field>
            <Field label="Feathers (kg)"><input className="form-input" type="number" min={0} step="0.01" {...register('feathers_weight')} /></Field>
            <Field label="Offal (kg)"><input className="form-input" type="number" min={0} step="0.01" {...register('offal_weight')} /></Field>
            <Field label="Head (kg)"><input className="form-input" type="number" min={0} step="0.01" {...register('head_weight')} /></Field>
            <Field label="Feet (kg)"><input className="form-input" type="number" min={0} step="0.01" {...register('feet_weight')} /></Field>
            <Field label="Reusable byproducts (kg)"><input className="form-input" type="number" min={0} step="0.01" {...register('reusable_byproducts_weight')} /></Field>
          </div>
        </Section>

        <Section title="Production costs">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Direct labour (UGX)" hint="Slaughter floor wages">
              <input className="form-input" type="number" min={0} step="100" placeholder="0" {...register('direct_labour_cost')} />
            </Field>
            <Field label="Overhead (UGX)" hint="Utilities, packaging">
              <input className="form-input" type="number" min={0} step="100" placeholder="0" {...register('overhead_cost')} />
            </Field>
            <Field label="Chick cost / bird (UGX)" hint="Blank = batch default">
              <input className="form-input" type="number" min={0} step="100" placeholder="Auto" {...register('chick_cost_override')} />
            </Field>
          </div>
        </Section>

        <Section title="Inspection & storage">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Quality inspection status">
              <select className="form-input" {...register('quality_inspection_status')}>
                <option value="pending">Pending</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="rework">Rework</option>
              </select>
            </Field>
            <Field label="Cold-room / storage location">
              <input className="form-input" {...register('cold_room_location')} />
            </Field>
            <Field label="Waste disposal record">
              <textarea className="form-input min-h-[80px]" {...register('waste_disposal_notes')} />
            </Field>
            <Field label="Notes">
              <textarea className="form-input min-h-[80px]" {...register('notes')} />
            </Field>
          </div>
        </Section>
      </div>

      <div className="flex justify-end gap-3 pt-5">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary" disabled={isLoading} type="submit">
          <CalendarDays className="h-4 w-4" />
          {isLoading ? 'Saving...' : section === 'planning' ? 'Plan slaughter run' : 'Save record'}
        </button>
      </div>
    </form>
  )
}
