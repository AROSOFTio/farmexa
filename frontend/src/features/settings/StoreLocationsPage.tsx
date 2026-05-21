import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PencilLine, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import api from '@/services/api'

const locationTypeOptions = [
  { value: 'main_store', label: 'Main Store' },
  { value: 'feed_store', label: 'Feed Store' },
  { value: 'medicine_store', label: 'Medicine Store' },
  { value: 'poultry_house', label: 'Poultry House' },
  { value: 'slaughter_area', label: 'Slaughter Area' },
  { value: 'cold_room', label: 'Cold Room' },
  { value: 'sales_store', label: 'Sales Store' },
  { value: 'other', label: 'Other' },
]

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  type: z.enum(['main_store', 'feed_store', 'medicine_store', 'poultry_house', 'slaughter_area', 'cold_room', 'sales_store', 'other']),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
})

type FormValues = z.infer<typeof schema>

interface StoreLocation {
  id: number
  name: string
  code: string
  type: string
  description: string | null
  is_active: boolean
  created_at: string
}

function emptyValues(): FormValues {
  return {
    name: '',
    code: '',
    type: 'other',
    description: '',
    is_active: true,
  }
}

export function StoreLocationsPage() {
  const qc = useQueryClient()
  const [editingItem, setEditingItem] = useState<StoreLocation | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(),
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['store-locations'],
    queryFn: () => api.get<StoreLocation[]>('/inventory/store-locations').then((response) => response.data),
  })

  const createLocation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post('/inventory/store-locations', values),
    onSuccess: () => {
      toast.success('Store location saved.')
      qc.invalidateQueries({ queryKey: ['store-locations'] })
      form.reset(emptyValues())
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to save store location.')
    },
  })

  const updateLocation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: FormValues }) =>
      api.put(`/inventory/store-locations/${id}`, values),
    onSuccess: () => {
      toast.success('Store location updated.')
      qc.invalidateQueries({ queryKey: ['store-locations'] })
      setEditingItem(null)
      form.reset(emptyValues())
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to update store location.')
    },
  })

  const deleteLocation = useMutation({
    mutationFn: (id: number) =>
      api.delete(`/inventory/store-locations/${id}`),
    onSuccess: () => {
      toast.success('Store location deleted.')
      qc.invalidateQueries({ queryKey: ['store-locations'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to delete store location.')
    },
  })

  const onSubmit = (values: FormValues) => {
    if (editingItem) {
      updateLocation.mutate({ id: editingItem.id, values })
      return
    }
    createLocation.mutate(values)
  }

  const startEdit = (item: StoreLocation) => {
    setEditingItem(item)
    form.reset({
      name: item.name,
      code: item.code,
      type: item.type as any,
      description: item.description ?? '',
      is_active: item.is_active,
    })
  }

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this store location?')) {
      deleteLocation.mutate(id)
    }
  }

  const isSaving = createLocation.isPending || updateLocation.isPending

  return (
    <div className="space-y-5">
      <div className="section-header">
        <div>
          <h1 className="section-title">Store Locations</h1>
          <p className="section-subtitle">Manage physical storage locations for inventory items. These are used in GRN and GIV workflows.</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="rounded-3xl border border-neutral-150 bg-white">
          <div className="border-b border-neutral-150 px-5 py-4">
            <h3 className="text-lg font-semibold text-ink-900">Store Locations</h3>
            <p className="mt-1 text-sm text-ink-500">Physical storage locations for inventory management</p>
          </div>
          <div className="divide-y divide-neutral-100">
            {locations.length === 0 ? (
              <div className="px-5 py-10 text-sm text-ink-500">No store locations yet. Add your first storage location.</div>
            ) : (
              locations.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <div className="font-medium text-ink-900">{item.name}</div>
                    <div className="mt-1 text-xs text-ink-500">
                      Code: {item.code} | Type: {locationTypeOptions.find(opt => opt.value === item.type)?.label || item.type} | {item.is_active ? 'Active' : 'Inactive'}
                    </div>
                    {item.description ? <div className="mt-1 text-sm text-ink-500">{item.description}</div> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" className="btn-secondary btn-sm" onClick={() => startEdit(item)}>
                      <PencilLine className="h-4 w-4" />
                      Edit
                    </button>
                    <button type="button" className="btn-secondary btn-sm text-red-600 hover:text-red-700" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="rounded-3xl border border-neutral-150 bg-neutral-50 p-5 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-ink-900">{editingItem ? 'Edit store location' : 'Add store location'}</h3>
            <p className="mt-1 text-sm text-ink-500">
              {editingItem ? 'Update the storage location details.' : 'Create a new physical storage location for inventory.'}
            </p>
          </div>

          <div>
            <label className="form-label">Name</label>
            <input className="form-input" {...form.register('name')} />
            {form.formState.errors.name ? <p className="form-error">{form.formState.errors.name.message}</p> : null}
          </div>

          <div>
            <label className="form-label">Code</label>
            <input className="form-input" {...form.register('code')} />
            {form.formState.errors.code ? <p className="form-error">{form.formState.errors.code.message}</p> : null}
          </div>

          <div>
            <label className="form-label">Type</label>
            <select className="form-input" {...form.register('type')}>
              {locationTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {form.formState.errors.type ? <p className="form-error">{form.formState.errors.type.message}</p> : null}
          </div>

          <div>
            <label className="form-label">Description</label>
            <textarea className="form-input min-h-[100px]" {...form.register('description')} />
          </div>

          <label className="flex items-center gap-3 rounded-[10px] border border-neutral-150 bg-white px-4 py-3 text-sm font-medium text-ink-700">
            <input type="checkbox" {...form.register('is_active')} />
            Keep this location active
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
              {isSaving ? 'Saving...' : editingItem ? 'Update location' : 'Add location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
