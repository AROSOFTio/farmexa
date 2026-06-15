import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PackagePlus } from 'lucide-react'
import { outputSchema, OutputFormValues } from '../schemas'
import { SlaughterRecord, SlaughterSection } from '../types'
import { emptyOutputValues } from '../hooks'
import { formatDate } from '../utils'

interface OutputCatalogEntry {
  value: string
  label: string
  stockName: string
}

interface OutputFormProps {
  approvedRecords: SlaughterRecord[]
  outputCatalog: readonly OutputCatalogEntry[]
  section: SlaughterSection
  onSubmit: (values: OutputFormValues) => void
  isLoading?: boolean
  onCancel: () => void
}

export function OutputForm({ approvedRecords, outputCatalog, section, onSubmit, isLoading, onCancel }: OutputFormProps) {
  const form = useForm<OutputFormValues>({
    resolver: zodResolver(outputSchema),
    defaultValues: {
      ...emptyOutputValues(),
      record_id: approvedRecords[0]?.id ?? 0,
      output_type: outputCatalog[0]?.value ?? '',
    },
  })

  const getModalTitle = () => {
    if (section === 'cuts') return 'Post cut part output'
    if (section === 'byproducts') return 'Post byproduct output'
    return 'Post product output'
  }

  const handleSubmit = (values: OutputFormValues) => {
    const entry = outputCatalog.find((item) => item.value === values.output_type)
    onSubmit({ ...values, product_name: entry?.stockName ?? values.output_type.replace(/_/g, ' ') })
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
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
        <label className="form-label">Product</label>
        <select className="form-input" {...form.register('output_type')}>
          <option value="">Choose product</option>
          {outputCatalog.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </select>
        {form.formState.errors.output_type ? <p className="form-error">{form.formState.errors.output_type.message}</p> : null}
        <p className="form-hint">
          The finished good is created in inventory automatically and becomes available in POS once stock is posted — no manual product setup needed.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="form-label">Quantity (kg)</label>
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
