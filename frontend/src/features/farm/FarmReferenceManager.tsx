import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PencilLine, Plus } from 'lucide-react'
import { toast } from 'sonner'

import api from '@/services/api'

type ReferenceType = 'batch_breed' | 'batch_source' | 'mortality_cause' | 'vaccine'

interface ReferenceItem {
  id: number
  reference_type: ReferenceType
  code: string
  name: string
  description?: string | null
  sort_order: number
  is_active: boolean
}

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  sort_order: z.coerce.number().int().min(0),
  is_active: z.boolean().default(true),
})

type FormValues = z.infer<typeof schema>

export interface FarmReferenceManagerType {
  type: ReferenceType
  label: string
  description: string
}

function emptyValues(): FormValues {
  return {
    name: '',
    description: '',
    sort_order: 0,
    is_active: true,
  }
}

export function FarmReferenceManager({ types }: { types: FarmReferenceManagerType[] }) {
  const qc = useQueryClient()
  const [selectedType, setSelectedType] = useState<ReferenceType>(types[0]?.type ?? 'batch_breed')
  const [editingItem, setEditingItem] = useState<ReferenceItem | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(),
  })

  useEffect(() => {
    if (types.length > 0 && !types.some((entry) => entry.type === selectedType)) {
      setSelectedType(types[0].type)
    }
  }, [selectedType, types])

  const { data: items = [] } = useQuery({
    queryKey: ['farm-reference-items'],
    queryFn: () => api.get<ReferenceItem[]>('/farm/reference-items').then((response) => response.data),
  })

  const visibleItems = useMemo(
    () => items.filter((item) => item.reference_type === selectedType),
    [items, selectedType]
  )

  const selectedTypeMeta = types.find((entry) => entry.type === selectedType)

  const createItem = useMutation({
    mutationFn: (values: FormValues) =>
      api.post('/farm/reference-items', {
        reference_type: selectedType,
        name: values.name,
        description: values.description || null,
        sort_order: values.sort_order,
        is_active: values.is_active,
      }),
    onSuccess: () => {
      toast.success('List item saved.')
      qc.invalidateQueries({ queryKey: ['farm-reference-items'] })
      form.reset(emptyValues())
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to save list item.')
    },
  })

  const updateItem = useMutation({
    mutationFn: (values: FormValues) => {
      if (!editingItem) {
        throw new Error('No item selected')
      }
      return api.put(`/farm/reference-items/${editingItem.id}`, {
        name: values.name,
        description: values.description || null,
        sort_order: values.sort_order,
        is_active: values.is_active,
      })
    },
    onSuccess: () => {
      toast.success('List item updated.')
      qc.invalidateQueries({ queryKey: ['farm-reference-items'] })
      setEditingItem(null)
      form.reset(emptyValues())
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to update list item.')
    },
  })

  const onSubmit = (values: FormValues) => {
    if (editingItem) {
      updateItem.mutate(values)
      return
    }
    createItem.mutate(values)
  }

  const startEdit = (item: ReferenceItem) => {
    setEditingItem(item)
    setSelectedType(item.reference_type)
    form.reset({
      name: item.name,
      description: item.description ?? '',
      sort_order: item.sort_order,
      is_active: item.is_active,
    })
  }

  const isSaving = createItem.isPending || updateItem.isPending

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {types.map((entry) => (
          <button
            key={entry.type}
            type="button"
            onClick={() => {
              setSelectedType(entry.type)
              setEditingItem(null)
              form.reset(emptyValues())
            }}
            className={
              entry.type === selectedType
                ? 'rounded-2xl border border-brand-300 bg-brand-50 px-4 py-3 text-left'
                : 'rounded-2xl border border-neutral-150 bg-white px-4 py-3 text-left'
            }
          >
            <div className="text-sm font-semibold text-ink-900">{entry.label}</div>
            <div className="mt-1 text-xs text-ink-500">{entry.description}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="rounded-3xl border border-neutral-150 bg-white">
          <div className="border-b border-neutral-150 px-5 py-4">
            <h3 className="text-lg font-semibold text-ink-900">{selectedTypeMeta?.label ?? 'Reference items'}</h3>
            <p className="mt-1 text-sm text-ink-500">{selectedTypeMeta?.description}</p>
          </div>
          <div className="divide-y divide-neutral-100">
            {visibleItems.length === 0 ? (
              <div className="px-5 py-10 text-sm text-ink-500">No entries yet. Add the master list first, then users will pick from a dropdown.</div>
            ) : (
              visibleItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <div className="font-medium text-ink-900">{item.name}</div>
                    <div className="mt-1 text-xs text-ink-500">
                      Code: {item.code} | Order: {item.sort_order} | {item.is_active ? 'Active' : 'Inactive'}
                    </div>
                    {item.description ? <div className="mt-1 text-sm text-ink-500">{item.description}</div> : null}
                  </div>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => startEdit(item)}>
                    <PencilLine className="h-4 w-4" />
                    Edit
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="rounded-3xl border border-neutral-150 bg-neutral-50 p-5 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-ink-900">{editingItem ? 'Edit list item' : 'Add list item'}</h3>
            <p className="mt-1 text-sm text-ink-500">
              {editingItem ? 'Update the dropdown entry used by operators.' : 'Create the values operators will select later.'}
            </p>
          </div>

          <div>
            <label className="form-label">Name</label>
            <input className="form-input" {...form.register('name')} />
            {form.formState.errors.name ? <p className="form-error">{form.formState.errors.name.message}</p> : null}
          </div>

          <div>
            <label className="form-label">Description</label>
            <textarea className="form-input min-h-[100px]" {...form.register('description')} />
          </div>

          <div>
            <label className="form-label">Sort order</label>
            <input type="number" min={0} className="form-input" {...form.register('sort_order')} />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-neutral-150 bg-white px-4 py-3 text-sm font-medium text-ink-700">
            <input type="checkbox" {...form.register('is_active')} />
            Keep this entry active in dropdowns
          </label>

          <div className="flex justify-end gap-3">
            {editingItem ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditingItem(null)
                  form.reset(emptyValues())
                }}
              >
                Cancel edit
              </button>
            ) : null}
            <button type="submit" className="btn-primary" disabled={isSaving}>
              <Plus className="h-4 w-4" />
              {isSaving ? 'Saving...' : editingItem ? 'Update item' : 'Add item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
