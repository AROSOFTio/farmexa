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

export function RecordForm({ batches, section, onSubmit, isLoading, onCancel }: RecordFormProps) {
  const form = useForm<RecordFormValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: emptyRecordFormValues(),
  })

  const selectedBatch = batches.find((batch) => batch.id === form.watch('batch_id'))

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Run identification</div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="form-label">Batch</label>
            <select className="form-input" {...form.register('batch_id')}>
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
            {form.formState.errors.batch_id ? <p className="form-error">{form.formState.errors.batch_id.message}</p> : null}
          </div>
          <div>
            <label className="form-label">Slaughter date</label>
            <input className="form-input" type="date" {...form.register('slaughter_date')} />
            {form.formState.errors.slaughter_date ? <p className="form-error">{form.formState.errors.slaughter_date.message}</p> : null}
          </div>
        </div>
      </div>

      <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Live bird intake</div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="form-label">Live birds count</label>
            <input className="form-input" type="number" min={0} {...form.register('live_birds_count')} />
            {form.formState.errors.live_birds_count ? <p className="form-error">{form.formState.errors.live_birds_count.message}</p> : null}
          </div>
          <div>
            <label className="form-label">Total live weight (kg)</label>
            <input className="form-input" type="number" min={0} step="0.01" {...form.register('total_live_weight')} />
            {form.formState.errors.total_live_weight ? <p className="form-error">{form.formState.errors.total_live_weight.message}</p> : null}
          </div>
          <div>
            <label className="form-label">Mortality before process</label>
            <input className="form-input" type="number" min={0} {...form.register('mortality_birds_count')} />
          </div>
          <div>
            <label className="form-label">Condemned birds</label>
            <input className="form-input" type="number" min={0} {...form.register('condemned_birds_count')} />
          </div>
        </div>
      </div>

      <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Waste and byproduct classes</div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="form-label">Waste weight (kg)</label>
            <input className="form-input" type="number" min={0} step="0.01" {...form.register('waste_weight')} />
          </div>
          <div>
            <label className="form-label">Blood (kg)</label>
            <input className="form-input" type="number" min={0} step="0.01" {...form.register('blood_weight')} />
          </div>
          <div>
            <label className="form-label">Feathers (kg)</label>
            <input className="form-input" type="number" min={0} step="0.01" {...form.register('feathers_weight')} />
          </div>
          <div>
            <label className="form-label">Offal (kg)</label>
            <input className="form-input" type="number" min={0} step="0.01" {...form.register('offal_weight')} />
          </div>
          <div>
            <label className="form-label">Head (kg)</label>
            <input className="form-input" type="number" min={0} step="0.01" {...form.register('head_weight')} />
          </div>
          <div>
            <label className="form-label">Feet (kg)</label>
            <input className="form-input" type="number" min={0} step="0.01" {...form.register('feet_weight')} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Reusable byproducts (kg)</label>
            <input className="form-input" type="number" min={0} step="0.01" {...form.register('reusable_byproducts_weight')} />
          </div>
        </div>
      </div>

      <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Production costs</div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="form-label">Direct labour cost (UGX)</label>
            <input className="form-input" type="number" min={0} step="100" placeholder="0" {...form.register('direct_labour_cost')} />
            <p className="form-hint">Wages for slaughter floor workers</p>
          </div>
          <div>
            <label className="form-label">Processing overhead (UGX)</label>
            <input className="form-input" type="number" min={0} step="100" placeholder="0" {...form.register('overhead_cost')} />
            <p className="form-hint">Utilities, packaging, consumables</p>
          </div>
          <div>
            <label className="form-label">Chick cost per bird (UGX)</label>
            <input className="form-input" type="number" min={0} step="100" placeholder="Auto from batch" {...form.register('chick_cost_override')} />
            <p className="form-hint">Leave blank to use batch chick cost</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="form-label">Quality inspection status</label>
          <select className="form-input" {...form.register('quality_inspection_status')}>
            <option value="pending">Pending</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="rework">Rework</option>
          </select>
        </div>
        <div>
          <label className="form-label">Cold-room / storage location</label>
          <input className="form-input" {...form.register('cold_room_location')} />
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
          <CalendarDays className="h-4 w-4" />
          {isLoading ? 'Saving...' : section === 'planning' ? 'Plan slaughter run' : 'Enter slaughter record'}
        </button>
      </div>
    </form>
  )
}
