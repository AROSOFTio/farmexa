import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ShieldCheck } from 'lucide-react'
import { completionSchema, CompletionFormValues } from '../schemas'
import { SlaughterRecord } from '../types'
import { emptyCompletionValues, useCompleteRecord } from '../hooks'
import { formatUGX } from '../utils'

interface CompletionFormProps {
  record: SlaughterRecord
  onSubmit: (values: CompletionFormValues) => void
  onCancel: () => void
  isLoading?: boolean
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

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      {record.total_production_cost ? (
        <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Production cost analysis</h4>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <p className="text-xs text-neutral-500">Total production cost</p>
              <p className="text-sm font-semibold text-neutral-900">{formatUGX(record.total_production_cost)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Cost per kg</p>
              <p className="text-sm font-semibold text-neutral-900">{formatUGX(record.cost_per_kg)}/kg</p>
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
          {record.production_journal_id ? (
            <p className="mt-2 text-xs text-neutral-500">Journal Entry #{record.production_journal_id} posted ✓</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="form-label">Workflow status</label>
          <select className="form-input" {...form.register('status')}>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="form-label">Dressed weight (kg)</label>
          <input className="form-input" type="number" min={0} step="0.01" {...form.register('total_dressed_weight')} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="form-label">Quality inspection</label>
          <select className="form-input" {...form.register('quality_inspection_status')}>
            <option value="pending">Pending</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="rework">Rework</option>
          </select>
        </div>
        <div>
          <label className="form-label">Approval status</label>
          <select className="form-input" {...form.register('approval_status')}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="form-label">Mortality birds</label>
          <input className="form-input" type="number" min={0} {...form.register('mortality_birds_count')} />
        </div>
        <div>
          <label className="form-label">Condemned birds</label>
          <input className="form-input" type="number" min={0} {...form.register('condemned_birds_count')} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="form-label">Waste weight</label>
          <input className="form-input" type="number" min={0} step="0.01" {...form.register('waste_weight')} />
        </div>
        <div>
          <label className="form-label">Reusable byproducts</label>
          <input className="form-input" type="number" min={0} step="0.01" {...form.register('reusable_byproducts_weight')} />
        </div>
      </div>

      <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Loss category weights</div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="form-label">Blood</label>
            <input className="form-input" type="number" min={0} step="0.01" {...form.register('blood_weight')} />
          </div>
          <div>
            <label className="form-label">Feathers</label>
            <input className="form-input" type="number" min={0} step="0.01" {...form.register('feathers_weight')} />
          </div>
          <div>
            <label className="form-label">Offal</label>
            <input className="form-input" type="number" min={0} step="0.01" {...form.register('offal_weight')} />
          </div>
          <div>
            <label className="form-label">Head</label>
            <input className="form-input" type="number" min={0} step="0.01" {...form.register('head_weight')} />
          </div>
          <div>
            <label className="form-label">Feet</label>
            <input className="form-input" type="number" min={0} step="0.01" {...form.register('feet_weight')} />
          </div>
          <div>
            <label className="form-label">Cold-room location</label>
            <input className="form-input" {...form.register('cold_room_location')} />
          </div>
        </div>
      </div>

      <div>
        <label className="form-label">Waste disposal record</label>
        <textarea className="form-input min-h-[88px]" {...form.register('waste_disposal_notes')} />
      </div>

      <div>
        <label className="form-label">Notes</label>
        <textarea className="form-input min-h-[88px]" {...form.register('notes')} />
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Close
        </button>
        <button className="btn-primary" disabled={isLoading} type="submit">
          <ShieldCheck className="h-4 w-4" />
          {isLoading ? 'Saving...' : 'Save Finalization'}
        </button>
      </div>
    </form>
  )
}
