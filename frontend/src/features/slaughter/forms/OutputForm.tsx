import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PackagePlus } from 'lucide-react'
import { outputSchema, OutputFormValues } from '../schemas'
import { StockItem, SlaughterRecord, SlaughterSection } from '../types'
import { emptyOutputValues } from '../hooks'
import { formatDate } from '../utils'

interface OutputFormProps {
  approvedRecords: SlaughterRecord[]
  stockItems: StockItem[]
  section: SlaughterSection
  onSubmit: (values: OutputFormValues) => void
  isLoading?: boolean
  onCancel: () => void
}

export function OutputForm({ approvedRecords, stockItems, section, onSubmit, isLoading, onCancel }: OutputFormProps) {
  const form = useForm<OutputFormValues>({
    resolver: zodResolver(outputSchema),
    defaultValues: {
      ...emptyOutputValues(),
      record_id: approvedRecords[0]?.id ?? 0,
    },
  })

  const getModalTitle = () => {
    if (section === 'cuts') return 'Post cut part output'
    if (section === 'byproducts') return 'Post byproduct output'
    return 'Post product output'
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div>
        <label className="form-label">Approved slaughter record</label>
        <select className="form-input" {...form.register('record_id')}>
          <option value={0}>Choose record</option>
          {approvedRecords.map((record) => (
            <option key={record.id} value={record.id}>
              Record #{record.id} - {formatDate(record.slaughter_date)}
            </option>
          ))}
        </select>
        {form.formState.errors.record_id ? <p className="form-error">{form.formState.errors.record_id.message}</p> : null}
      </div>

      <div>
        <label className="form-label">Inventory item</label>
        <select className="form-input" {...form.register('stock_item_id')}>
          <option value={0}>Choose stock item</option>
          {stockItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        {form.formState.errors.stock_item_id ? <p className="form-error">{form.formState.errors.stock_item_id.message}</p> : null}
        <p className="form-hint">
          Only coded slaughter items entered by inventory or slaughter managers appear here. Sales and processing users must select from this list instead of typing items manually.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="form-label">Quantity</label>
          <input className="form-input" type="number" min={0} step="0.01" {...form.register('quantity')} />
          {form.formState.errors.quantity ? <p className="form-error">{form.formState.errors.quantity.message}</p> : null}
        </div>
        <div>
          <label className="form-label">Unit cost</label>
          <input className="form-input" type="number" min={0} step="0.01" {...form.register('unit_cost')} />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Close
        </button>
        <button className="btn-primary" disabled={isLoading} type="submit">
          <PackagePlus className="h-4 w-4" />
          {isLoading ? 'Saving...' : getModalTitle()}
        </button>
      </div>
    </form>
  )
}
