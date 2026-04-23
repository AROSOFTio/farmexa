import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/services/api'
import { clsx } from 'clsx'

const houseSchema = z.object({
  name: z.string().min(1, 'House name is required').max(100),
  capacity: z.coerce.number().min(1, 'Capacity must be greater than 0'),
})

type HouseFormValues = z.infer<typeof houseSchema>

export function HouseForm({ onSuccess }: { onSuccess?: () => void }) {
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<HouseFormValues>({
    resolver: zodResolver(houseSchema),
  })

  const createHouse = useMutation({
    mutationFn: (data: HouseFormValues) => {
      return api.post('/farm/houses', { ...data, status: 'active' })
    },
    onSuccess: () => {
      toast.success('Poultry house created successfully')
      queryClient.invalidateQueries({ queryKey: ['farm-houses'] })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create poultry house')
    }
  })

  const onSubmit = (data: HouseFormValues) => {
    createHouse.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="form-label">House Name</label>
        <input
          {...register('name')}
          className={clsx('form-input', errors.name && 'border-red-500 focus:ring-red-500/20')}
          placeholder="e.g. Broiler House A"
        />
        {errors.name && <p className="form-error">{errors.name.message}</p>}
      </div>

      <div>
        <label className="form-label">Maximum Capacity (Birds)</label>
        <input
          type="number"
          {...register('capacity')}
          className={clsx('form-input', errors.capacity && 'border-red-500 focus:ring-red-500/20')}
          placeholder="e.g. 5000"
        />
        {errors.capacity && <p className="form-error">{errors.capacity.message}</p>}
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onSuccess}
          className="btn-secondary"
          disabled={createHouse.isPending}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={createHouse.isPending}
        >
          {createHouse.isPending ? 'Saving...' : 'Create House'}
        </button>
      </div>
    </form>
  )
}
