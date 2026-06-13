import { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ShieldCheck } from 'lucide-react'
import { completionSchema, CompletionFormValues } from '../schemas'
import { SlaughterRecord } from '../types'
import { formatUGX } from '../utils'

interface CompletionFormProps {
  record: SlaughterRecord
  onSubmit: (values: CompletionFormValues) => void
  onCancel: () => void
  isLoading?: boolean
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

export function CompletionForm({ record, onSubmit, onCancel, isLoading }: CompletionFormProps) {
  const form = useForm<CompletionFormValues>({
    resolver: zodResolver(completionSchema),
    defaultValues: {
      record_id: record.id,
      status: record.status as CompletionFormValues['status'],
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
    },
  })
  const { register } = form

  return (
    <form className="divide-y divide-neutral-100" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="space-y-7 pb-6">
        {record.total_production_cost ? (
          <div className="grid grid-cols-2 gap-4 rounded-[12px] bg-brand-50 px-4 py-3 md:grid-cols-4">
            <div>
              <p className="text-xs text-neutral-500">Total cost</p>
              <p className="text-sm font-semibold text-neutral-900">{formatUGX(record.total_production_cost)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Cost / kg</p>
              <p className="text-sm font-semibold text-neutral-900">{formatUGX(record.cost_per_kg)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Direct labour</p>
              <p className="text-sm font-medium text-neutral-700">{formatUGX(record.direct_labour_cost)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Overhead</p>
              <p className="text-sm font-medium text-neutral-700">{formatUGX(record.overhead_cost)}</p>
            </div>
          </div>
        ) : null}

        <Section title="Outcome">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Workflow status">
              <select className="form-input" {...register('status')}>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
            <Field label="Dressed weight (kg)">
              <input className="form-input" type="number" min={0} step="0.01" {...register('total_dressed_weight')} />
            </Field>
            <Field label="Quality inspection">
              <select className="form-input" {...register('quality_inspection_status')}>
                <option value="pending">Pending</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="rework">Rework</option>
              </select>
            </Field>
            <Field label="Approval status">
              <select className="form-input" {...register('approval_status')}>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Bird losses">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Mortality birds"><input className="form-input" type="number" min={0} {...register('mortality_birds_count')} /></Field>
            <Field label="Condemned birds"><input className="form-input" type="number" min={0} {...register('condemned_birds_count')} /></Field>
          </div>
        </Section>

        <Section title="Weight breakdown">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Waste"><input className="form-input" type="number" min={0} step="0.01" {...register('waste_weight')} /></Field>
            <Field label="Reusable byproducts"><input className="form-input" type="number" min={0} step="0.01" {...register('reusable_byproducts_weight')} /></Field>
            <Field label="Blood"><input className="form-input" type="number" min={0} step="0.01" {...register('blood_weight')} /></Field>
            <Field label="Feathers"><input className="form-input" type="number" min={0} step="0.01" {...register('feathers_weight')} /></Field>
            <Field label="Offal"><input className="form-input" type="number" min={0} step="0.01" {...register('offal_weight')} /></Field>
            <Field label="Head"><input className="form-input" type="number" min={0} step="0.01" {...register('head_weight')} /></Field>
            <Field label="Feet"><input className="form-input" type="number" min={0} step="0.01" {...register('feet_weight')} /></Field>
            <Field label="Cold-room location"><input className="form-input" {...register('cold_room_location')} /></Field>
          </div>
        </Section>

        <Section title="Notes">
          <div className="grid gap-4 md:grid-cols-2">
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
          <ShieldCheck className="h-4 w-4" />
          {isLoading ? 'Saving...' : 'Save finalization'}
        </button>
      </div>
    </form>
  )
}
