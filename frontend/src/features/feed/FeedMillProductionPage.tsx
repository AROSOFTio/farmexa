import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Factory, FlaskConical, Plus, Wheat } from 'lucide-react'
import { toast } from 'sonner'

import api from '@/services/api'
import { Modal } from '@/components/Modal'

type Section = 'formulations' | 'production'

interface FeedItem {
  id: number
  name: string
  unit: string
  current_stock: number
}

interface Formulation {
  id: number
  name: string
  stage: string
  texture: string
  output_quantity_kg: number
  cost_per_kg: number
  ingredients: Array<{ id: number; feed_item_id: number; percentage: number; feed_item?: FeedItem | null }>
}

interface ProductionBatch {
  id: number
  batch_number: string
  formulation_id: number
  output_item_id: number
  output_quantity_kg: number
  cost_per_kg: number
  notes?: string | null
}

const formulationSchema = z.object({
  name: z.string().min(2),
  stage: z.enum(['Starter', 'Grower', 'Finisher']),
  texture: z.enum(['Mash', 'Pellet']),
  output_quantity_kg: z.coerce.number().positive(),
  ingredients: z.array(z.object({
    feed_item_id: z.coerce.number().int().positive(),
    percentage: z.coerce.number().positive().max(100),
  })).min(1),
}).refine((value) => Math.round(value.ingredients.reduce((sum, item) => sum + item.percentage, 0) * 100) / 100 === 100, {
  message: 'Ingredient percentages must total exactly 100%.',
  path: ['ingredients'],
})

const productionSchema = z.object({
  formulation_id: z.coerce.number().int().positive(),
  output_quantity_kg: z.coerce.number().positive(),
  notes: z.string().optional(),
})

type FormulationValues = z.infer<typeof formulationSchema>
type ProductionValues = z.infer<typeof productionSchema>

export function FeedMillProductionPage({ section }: { section: Section }) {
  const qc = useQueryClient()
  const [formulationModal, setFormulationModal] = useState(false)
  const [productionModal, setProductionModal] = useState(false)

  const { data: items = [] } = useQuery({
    queryKey: ['feed-items'],
    queryFn: () => api.get<FeedItem[]>('/feed/items').then((response) => response.data),
  })
  const { data: formulations = [] } = useQuery({
    queryKey: ['feed-formulations'],
    queryFn: () => api.get<Formulation[]>('/feed/formulations').then((response) => response.data),
  })
  const { data: productions = [] } = useQuery({
    queryKey: ['feed-productions'],
    queryFn: () => api.get<ProductionBatch[]>('/feed/productions').then((response) => response.data),
  })

  const formulationForm = useForm<FormulationValues>({
    resolver: zodResolver(formulationSchema),
    defaultValues: {
      name: '',
      stage: 'Starter',
      texture: 'Mash',
      output_quantity_kg: 1000,
      ingredients: [{ feed_item_id: 0, percentage: 100 }],
    },
  })
  const ingredientFields = useFieldArray({ control: formulationForm.control, name: 'ingredients' })
  const productionForm = useForm<ProductionValues>({
    resolver: zodResolver(productionSchema),
    defaultValues: { formulation_id: 0, output_quantity_kg: 1000, notes: '' },
  })

  const totalPercentage = useMemo(
    () => formulationForm.watch('ingredients').reduce((sum, item) => sum + (Number(item.percentage) || 0), 0),
    [formulationForm.watch('ingredients')]
  )

  const createFormulation = useMutation({
    mutationFn: (values: FormulationValues) => api.post('/feed/formulations', values),
    onSuccess: () => {
      toast.success('Feed formulation saved.')
      qc.invalidateQueries({ queryKey: ['feed-formulations'] })
      setFormulationModal(false)
      formulationForm.reset()
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail ?? 'Failed to save formulation.'),
  })

  const createProduction = useMutation({
    mutationFn: (values: ProductionValues) => api.post('/feed/productions', { ...values, notes: values.notes || null }),
    onSuccess: () => {
      toast.success('Feed production batch posted.')
      qc.invalidateQueries({ queryKey: ['feed-productions'] })
      qc.invalidateQueries({ queryKey: ['feed-items'] })
      setProductionModal(false)
      productionForm.reset()
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail ?? 'Failed to post production batch.'),
  })

  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">{section === 'formulations' ? 'Feed Formulations' : 'Feed Production'}</h1>
          <p className="section-subtitle">
            {section === 'formulations'
              ? 'Create percentage-based formulas. Farmexa enforces a 100% total before saving.'
              : 'Produce finished feed from a formula, deduct raw materials, and add finished feed stock.'}
          </p>
        </div>
        <button className="btn-primary" onClick={() => section === 'formulations' ? setFormulationModal(true) : setProductionModal(true)}>
          {section === 'formulations' ? <FlaskConical className="h-4 w-4" /> : <Factory className="h-4 w-4" />}
          {section === 'formulations' ? 'Create formula' : 'Produce feed batch'}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="metric-card"><div className="metric-label">Formulas</div><div className="metric-value">{formulations.length}</div><div className="metric-note">Validated feed formulas.</div></div>
        <div className="metric-card"><div className="metric-label">Production Batches</div><div className="metric-value">{productions.length}</div><div className="metric-note">Posted production runs.</div></div>
        <div className="metric-card"><div className="metric-label">Feed Items</div><div className="metric-value">{items.length}</div><div className="metric-note">Raw and finished feed records.</div></div>
      </div>

      {section === 'formulations' ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th className="pl-6">Formula</th><th>Stage</th><th>Texture</th><th>Ingredients</th><th className="pr-6">Output</th></tr></thead>
              <tbody>
                {formulations.length === 0 ? <tr><td className="pl-6 py-12 text-sm text-ink-500" colSpan={5}>No formulations saved.</td></tr> : formulations.map((formula) => (
                  <tr key={formula.id}>
                    <td className="pl-6 font-bold text-ink-900">{formula.name}</td>
                    <td>{formula.stage}</td>
                    <td>{formula.texture}</td>
                    <td>{formula.ingredients.map((item) => `${item.feed_item?.name ?? `Item #${item.feed_item_id}`} ${item.percentage}%`).join(', ')}</td>
                    <td className="pr-6">{formula.output_quantity_kg.toLocaleString()} KG</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th className="pl-6">Batch</th><th>Formula</th><th>Output</th><th className="pr-6">Cost/KG</th></tr></thead>
              <tbody>
                {productions.length === 0 ? <tr><td className="pl-6 py-12 text-sm text-ink-500" colSpan={4}>No production batches posted.</td></tr> : productions.map((batch) => (
                  <tr key={batch.id}>
                    <td className="pl-6 font-bold text-ink-900">{batch.batch_number}</td>
                    <td>{formulations.find((formula) => formula.id === batch.formulation_id)?.name ?? `Formula #${batch.formulation_id}`}</td>
                    <td>{batch.output_quantity_kg.toLocaleString()} KG</td>
                    <td className="pr-6">UGX {Number(batch.cost_per_kg).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={formulationModal} onClose={() => setFormulationModal(false)} title="Create feed formula" description="Ingredient percentages must total exactly 100%.">
        <form className="space-y-4" onSubmit={formulationForm.handleSubmit((values) => createFormulation.mutate(values))}>
          <div><label className="form-label">Formula name</label><input className="form-input" {...formulationForm.register('name')} /></div>
          <div className="grid gap-4 md:grid-cols-3">
            <div><label className="form-label">Stage</label><select className="form-input" {...formulationForm.register('stage')}><option>Starter</option><option>Grower</option><option>Finisher</option></select></div>
            <div><label className="form-label">Texture</label><select className="form-input" {...formulationForm.register('texture')}><option>Mash</option><option>Pellet</option></select></div>
            <div><label className="form-label">Output KG</label><input className="form-input" type="number" min={1} step="0.01" {...formulationForm.register('output_quantity_kg')} /></div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-ink-900">Ingredients · {totalPercentage}%</div>
              <button type="button" className="btn-secondary btn-sm" onClick={() => ingredientFields.append({ feed_item_id: 0, percentage: 0 })}><Plus className="h-4 w-4" /> Add</button>
            </div>
            {ingredientFields.fields.map((field, index) => (
              <div className="grid gap-3 md:grid-cols-[1fr_140px]" key={field.id}>
                <select className="form-input" {...formulationForm.register(`ingredients.${index}.feed_item_id`)}>
                  <option value={0}>Choose raw material</option>
                  {items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.current_stock.toLocaleString()} {item.unit})</option>)}
                </select>
                <input className="form-input" type="number" min={0} max={100} step="0.01" {...formulationForm.register(`ingredients.${index}.percentage`)} />
              </div>
            ))}
          </div>
          <button className="btn-primary w-full" disabled={createFormulation.isPending} type="submit"><Wheat className="h-4 w-4" /> Save formula</button>
        </form>
      </Modal>

      <Modal isOpen={productionModal} onClose={() => setProductionModal(false)} title="Produce feed batch" description="Farmexa deducts raw materials and increases finished feed stock.">
        <form className="space-y-4" onSubmit={productionForm.handleSubmit((values) => createProduction.mutate(values))}>
          <div><label className="form-label">Formula</label><select className="form-input" {...productionForm.register('formulation_id')}><option value={0}>Choose formula</option>{formulations.map((formula) => <option key={formula.id} value={formula.id}>{formula.name}</option>)}</select></div>
          <div><label className="form-label">Output KG</label><input className="form-input" type="number" min={1} step="0.01" {...productionForm.register('output_quantity_kg')} /></div>
          <div><label className="form-label">Notes</label><textarea className="form-input min-h-[110px]" {...productionForm.register('notes')} /></div>
          <button className="btn-primary w-full" disabled={createProduction.isPending} type="submit"><Factory className="h-4 w-4" /> Post production</button>
        </form>
      </Modal>
    </div>
  )
}
