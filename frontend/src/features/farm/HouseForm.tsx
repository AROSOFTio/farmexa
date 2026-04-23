import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import api from '@/services/api'

const houseSchema = z.object({
  name: z.string().trim().min(1, 'House name is required').max(100),
  capacity: z.coerce.number().min(1, 'Capacity must be greater than 0'),
  status: z.enum(['active', 'maintenance', 'inactive']),
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
    reset,
    formState: { errors },
  } = useForm<HouseFormValues>({
    resolver: zodResolver(houseSchema),
    defaultValues: {
      name: initialValues?.name ?? '',
      capacity: initialValues?.capacity ?? 0,
      status: initialValues?.status ?? 'active',
    },
  })

  useEffect(() => {
    reset({
      name: initialValues?.name ?? '',
      capacity: initialValues?.capacity ?? 0,
      status: initialValues?.status ?? 'active',
    })
  }, [initialValues?.capacity, initialValues?.name, initialValues?.status, reset])

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
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-5">
      <div>
        <label className="form-label">House name</label>
        <input
          {...register('name')}
          className={clsx('form-input', errors.name && 'border-red-400 focus:ring-red-100')}
        />
        {errors.name ? <p className="form-error">{errors.name.message}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="form-label">Capacity</label>
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

      <div className="flex justify-end gap-3 border-t border-neutral-150 pt-5">
        <button type="button" onClick={onSuccess} className="btn-secondary" disabled={mutation.isPending}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : isEditing ? 'Save' : 'Create'}
        </button>
      </div>
    </form>
  )
}
