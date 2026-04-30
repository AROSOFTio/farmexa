import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import { Plus, Trash2 } from 'lucide-react'
import api from '@/services/api'

const sectionSchema = z.object({
  id: z.number().optional(),
  name: z.string().trim().min(1, 'Section name is required').max(100),
  section_type: z.string().trim().min(1, 'Section type is required').max(80),
  capacity: z.coerce.number().min(1, 'Capacity must be > 0'),
  status: z.enum(['active', 'maintenance', 'inactive']),
})

const houseSchema = z.object({
  name: z.string().trim().min(1, 'House name is required').max(100),
  capacity: z.coerce.number().min(1, 'Capacity must be greater than 0'),
  status: z.enum(['active', 'maintenance', 'inactive']),
  sections: z.array(sectionSchema).default([]),
})

type HouseFormValues = z.infer<typeof houseSchema>

interface HouseFormProps {
  houseId?: number
  initialValues?: Partial<HouseFormValues>
  onSuccess?: () => void
}

export function HouseForm({ houseId, initialValues, onSuccess }: HouseFormProps) {
  const queryClient = useQueryClient()
  const isEditing = Boolean(houseId)

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<HouseFormValues>({
    resolver: zodResolver(houseSchema),
    defaultValues: {
      name: initialValues?.name ?? '',
      capacity: initialValues?.capacity ?? 0,
      status: initialValues?.status ?? 'active',
      sections: initialValues?.sections ?? [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'sections',
  })

  const houseCapacity = watch('capacity')
  const currentSections = watch('sections')
  const sectionsCapacity = currentSections.reduce((sum, s) => sum + (Number(s.capacity) || 0), 0)

  useEffect(() => {
    reset({
      name: initialValues?.name ?? '',
      capacity: initialValues?.capacity ?? 0,
      status: initialValues?.status ?? 'active',
      sections: initialValues?.sections ?? [],
    })
  }, [initialValues, reset])

  const mutation = useMutation({
    mutationFn: (values: HouseFormValues) =>
      isEditing ? api.put(`/farm/houses/${houseId}`, values) : api.post('/farm/houses', values),
    onSuccess: () => {
      toast.success(isEditing ? 'House updated successfully.' : 'House created successfully.')
      queryClient.invalidateQueries({ queryKey: ['farm-houses'] })
      queryClient.invalidateQueries({ queryKey: ['farm-batches'] })
      onSuccess?.()
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail
      const validation = error?.response?.data?.errors?.[0]?.message
      toast.error(typeof detail === 'string' ? detail : validation ?? `Failed to ${isEditing ? 'save' : 'create'} house.`)
    },
  })

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-6">
      <div className="form-section">
        <div className="form-section-title">House Details</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="form-label">House name</label>
            <input
              {...register('name')}
              className={clsx('form-input', errors.name && 'border-red-400 focus:ring-red-100')}
            />
            {errors.name ? <p className="form-error">{errors.name.message}</p> : null}
          </div>

          <div>
            <label className="form-label">Total Capacity</label>
            <input
              type="number"
              {...register('capacity')}
              className={clsx('form-input', errors.capacity && 'border-red-400 focus:ring-red-100')}
            />
            {errors.capacity ? <p className="form-error">{errors.capacity.message}</p> : null}
          </div>

          <div>
            <label className="form-label">Status</label>
            <select
              {...register('status')}
              className={clsx('form-input', errors.status && 'border-red-400 focus:ring-red-100')}
            >
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="inactive">Inactive</option>
            </select>
            {errors.status ? <p className="form-error">{errors.status.message}</p> : null}
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="flex items-center justify-between mb-4">
          <div className="form-section-title !mb-0">Sections</div>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => append({ name: '', section_type: 'Broilers', capacity: 0, status: 'active' })}
          >
            <Plus className="h-4 w-4" /> Add Section
          </button>
        </div>

        {sectionsCapacity > houseCapacity && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
            Warning: Sections total capacity ({sectionsCapacity}) exceeds house capacity ({houseCapacity}).
          </div>
        )}

        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="relative rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4 pr-12">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="form-label">Section Name</label>
                  <input
                    {...register(`sections.${index}.name`)}
                    className={clsx('form-input', errors.sections?.[index]?.name && 'border-red-400')}
                  />
                </div>
                <div>
                  <label className="form-label">Type</label>
                  <select
                    {...register(`sections.${index}.section_type`)}
                    className={clsx('form-input', errors.sections?.[index]?.section_type && 'border-red-400')}
                  >
                    <option value="Broilers">Broilers</option>
                    <option value="Layers">Layers</option>
                    <option value="Growers">Growers</option>
                    <option value="Breeders">Breeders</option>
                    <option value="Chicks">Chicks</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Capacity</label>
                  <input
                    type="number"
                    {...register(`sections.${index}.capacity`)}
                    className={clsx('form-input', errors.sections?.[index]?.capacity && 'border-red-400')}
                  />
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select
                    {...register(`sections.${index}.status`)}
                    className={clsx('form-input', errors.sections?.[index]?.status && 'border-red-400')}
                  >
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors"
                onClick={() => remove(index)}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}

          {fields.length === 0 && (
            <div className="text-center py-6 text-sm text-slate-500 border border-dashed rounded-[1rem]">
              No sections defined. Click 'Add Section' to divide the house.
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-[var(--border-subtle)] pt-5">
        <button type="button" onClick={onSuccess} className="btn-secondary" disabled={mutation.isPending}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={mutation.isPending || sectionsCapacity > houseCapacity}>
          {mutation.isPending ? 'Saving...' : isEditing ? 'Save' : 'Create'}
        </button>
      </div>
    </form>
  )
}

