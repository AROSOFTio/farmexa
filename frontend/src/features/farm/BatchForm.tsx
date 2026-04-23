import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/services/api'
import { clsx } from 'clsx'

const batchSchema = z.object({
  batch_number: z.string().min(1, 'Batch number is required'),
  house_id: z.coerce.number().min(1, 'Please select a house'),
  breed: z.string().min(1, 'Breed is required'),
  source: z.string().optional(),
  arrival_date: z.string().min(1, 'Arrival date is required'),
  initial_quantity: z.coerce.number().min(1, 'Quantity must be greater than 0'),
})

type BatchFormValues = z.infer<typeof batchSchema>

export function BatchForm({ onSuccess }: { onSuccess?: () => void }) {
  const queryClient = useQueryClient()

  const { data: houses } = useQuery({
    queryKey: ['farm-houses'],
    queryFn: () => api.get('/farm/houses').then(r => r.data),
  })

  const { register, handleSubmit, formState: { errors } } = useForm<BatchFormValues>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      arrival_date: new Date().toISOString().split('T')[0],
      source: '',
    }
  })

  const createBatch = useMutation({
    mutationFn: (data: BatchFormValues) => {
      // Backend expects active_quantity to match initial_quantity on creation
      return api.post('/farm/batches', {
        ...data,
        active_quantity: data.initial_quantity,
        status: 'active'
      })
    },
    onSuccess: () => {
      toast.success('Batch created successfully')
      queryClient.invalidateQueries({ queryKey: ['farm-batches'] })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create batch')
    }
  })

  const onSubmit = (data: BatchFormValues) => {
    createBatch.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Batch Number</label>
          <input
            {...register('batch_number')}
            className={clsx('form-input', errors.batch_number && 'border-red-500 focus:ring-red-500/20')}
            placeholder="Batch number"
          />
          {errors.batch_number && <p className="form-error">{errors.batch_number.message}</p>}
        </div>

        <div>
          <label className="form-label">Poultry House</label>
          <select
            {...register('house_id')}
            className={clsx('form-input', errors.house_id && 'border-red-500 focus:ring-red-500/20')}
          >
            <option value="">Select a house...</option>
            {houses?.map((h: any) => (
              <option key={h.id} value={h.id}>{h.name} (Cap: {h.capacity.toLocaleString()})</option>
            ))}
          </select>
          {errors.house_id && <p className="form-error">{errors.house_id.message}</p>}
        </div>

        <div>
          <label className="form-label">Breed</label>
          <input
            {...register('breed')}
            className={clsx('form-input', errors.breed && 'border-red-500 focus:ring-red-500/20')}
            placeholder="Breed"
          />
          {errors.breed && <p className="form-error">{errors.breed.message}</p>}
        </div>

        <div>
          <label className="form-label">Initial Quantity (Birds)</label>
          <input
            type="number"
            {...register('initial_quantity')}
            className={clsx('form-input', errors.initial_quantity && 'border-red-500 focus:ring-red-500/20')}
            placeholder="0"
          />
          {errors.initial_quantity && <p className="form-error">{errors.initial_quantity.message}</p>}
        </div>

        <div>
          <label className="form-label">Arrival Date</label>
          <input
            type="date"
            {...register('arrival_date')}
            className={clsx('form-input', errors.arrival_date && 'border-red-500 focus:ring-red-500/20')}
          />
          {errors.arrival_date && <p className="form-error">{errors.arrival_date.message}</p>}
        </div>

        <div>
          <label className="form-label">Source (Hatchery/Supplier)</label>
          <input
            {...register('source')}
            className="form-input"
            placeholder="Source"
          />
        </div>
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-neutral-150">
        <button
          type="button"
          onClick={onSuccess}
          className="btn-secondary"
          disabled={createBatch.isPending}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={createBatch.isPending}
        >
          {createBatch.isPending ? 'Saving...' : 'Create Batch'}
        </button>
      </div>
    </form>
  )
}
