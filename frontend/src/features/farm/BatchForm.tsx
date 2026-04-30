import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/services/api'
import { clsx } from 'clsx'
import { Modal } from '@/components/Modal'
import { useAuth } from '@/features/auth/AuthContext'
import { FarmReferenceManager, type FarmReferenceManagerType } from '@/features/farm/FarmReferenceManager'

const batchSchema = z.object({
  batch_number: z.string().min(1, 'Batch number is required'),
  house_id: z.coerce.number().min(1, 'Please select a house'),
  section_id: z.coerce.number().optional().nullable(),
  breed: z.string().min(1, 'Breed is required'),
  source: z.string().optional(),
  arrival_date: z.string().min(1, 'Arrival date is required'),
  initial_quantity: z.coerce.number().min(1, 'Quantity must be greater than 0'),
})

type BatchFormValues = z.infer<typeof batchSchema>

interface ReferenceItem {
  id: number
  reference_type: 'batch_breed' | 'batch_source' | 'mortality_cause' | 'vaccine'
  name: string
  is_active: boolean
}

const batchReferenceTypes: FarmReferenceManagerType[] = [
  {
    type: 'batch_breed',
    label: 'Breeds',
    description: 'Managers define the poultry breeds users can select on batch entry.',
  },
  {
    type: 'batch_source',
    label: 'Sources',
    description: 'Managers define hatcheries and suppliers instead of users typing them each time.',
  },
]

export function BatchForm({ onSuccess }: { onSuccess?: () => void }) {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false)
  const canManageFarm = hasPermission('farm:write')

  const { data: houses } = useQuery({
    queryKey: ['farm-houses'],
    queryFn: () => api.get<any[]>('/farm/houses').then(r => r.data),
  })

  const { data: referenceItems = [] } = useQuery({
    queryKey: ['farm-reference-items'],
    queryFn: () => api.get<ReferenceItem[]>('/farm/reference-items?active_only=true').then((response) => response.data),
  })

  const breedOptions = useMemo(
    () => referenceItems.filter((item) => item.reference_type === 'batch_breed' && item.is_active),
    [referenceItems]
  )

  const sourceOptions = useMemo(
    () => referenceItems.filter((item) => item.reference_type === 'batch_source' && item.is_active),
    [referenceItems]
  )

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<BatchFormValues>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      arrival_date: new Date().toISOString().split('T')[0],
      source: '',
      section_id: null,
    }
  })

  const selectedHouseId = watch('house_id')
  const selectedSectionId = watch('section_id')
  const initialQuantity = watch('initial_quantity')

  const selectedHouse = useMemo(() => houses?.find((h: any) => h.id === selectedHouseId), [houses, selectedHouseId])
  const selectedSection = useMemo(() => selectedHouse?.sections?.find((s: any) => s.id === selectedSectionId), [selectedHouse, selectedSectionId])

  const availableCapacity = selectedSection ? selectedSection.available_capacity : (selectedHouse?.available_capacity ?? 0)
  const isCapacityExceeded = (initialQuantity || 0) > availableCapacity

  const createBatch = useMutation({
    mutationFn: (data: BatchFormValues) => {
      return api.post('/farm/batches', {
        ...data,
        active_quantity: data.initial_quantity,
        status: 'active'
      })
    },
    onSuccess: () => {
      toast.success('Batch created successfully')
      queryClient.invalidateQueries({ queryKey: ['farm-batches'] })
      queryClient.invalidateQueries({ queryKey: ['farm-houses'] })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create batch')
    }
  })

  const onSubmit = (data: BatchFormValues) => {
    if (isCapacityExceeded) {
      toast.error('Cannot create batch: initial quantity exceeds available capacity.')
      return
    }
    createBatch.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="form-section">
        <div className="form-section-title">Batch Identity</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              onChange={(e) => {
                setValue('house_id', parseInt(e.target.value))
                setValue('section_id', null)
              }}
            >
              <option value="">Select a house...</option>
              {houses?.map((h: any) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
            {errors.house_id && <p className="form-error">{errors.house_id.message}</p>}
          </div>

          {selectedHouse?.sections?.length > 0 && (
            <div className="sm:col-span-2">
              <label className="form-label">Section (Optional)</label>
              <select
                {...register('section_id')}
                className={clsx('form-input', errors.section_id && 'border-red-500 focus:ring-red-500/20')}
              >
                <option value="">None (Use entire house)</option>
                {selectedHouse.sections.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.section_type})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {selectedHouse && (
          <div className="mt-4 p-4 rounded-[1rem] bg-amber-50/50 border border-amber-100/50">
            <div className="grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <span className="text-amber-900/60 font-medium uppercase tracking-wider text-[10px]">Capacity</span>
                <div className="font-semibold text-amber-900 mt-0.5">{(selectedSection ? selectedSection.capacity : selectedHouse.capacity).toLocaleString()} birds</div>
              </div>
              <div>
                <span className="text-amber-900/60 font-medium uppercase tracking-wider text-[10px]">Occupied</span>
                <div className="font-semibold text-amber-900 mt-0.5">{(selectedSection ? selectedSection.occupied_capacity : selectedHouse.occupied_capacity).toLocaleString()} birds</div>
              </div>
              <div>
                <span className="text-amber-900/60 font-medium uppercase tracking-wider text-[10px]">Available</span>
                <div className="font-semibold text-amber-900 mt-0.5">{availableCapacity.toLocaleString()} birds</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="form-section">
        <div className="form-section-title">Flock Details</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="form-label">Breed</label>
            <select
              {...register('breed')}
              className={clsx('form-input', errors.breed && 'border-red-500 focus:ring-red-500/20')}
            >
              <option value="">Select breed...</option>
              {breedOptions.map((item) => (
                <option key={item.id} value={item.name}>{item.name}</option>
              ))}
            </select>
            {errors.breed && <p className="form-error">{errors.breed.message}</p>}
          </div>

          <div>
            <label className="form-label">Source (Hatchery/Supplier)</label>
            <select {...register('source')} className="form-input">
              <option value="">Select source...</option>
              {sourceOptions.map((item) => (
                <option key={item.id} value={item.name}>{item.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">Arrival and Quantity</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="form-label">Initial Quantity (Birds)</label>
            <input
              type="number"
              {...register('initial_quantity')}
              className={clsx('form-input', errors.initial_quantity && 'border-red-500 focus:ring-red-500/20')}
              placeholder="0"
            />
            {errors.initial_quantity && <p className="form-error">{errors.initial_quantity.message}</p>}
            {isCapacityExceeded && (
              <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100">
                Warning: Quantity ({initialQuantity}) exceeds available capacity ({availableCapacity}).
              </p>
            )}
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
        </div>
      </div>

      {canManageFarm && (
        <div className="inline-note">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-ink-900">Manage batch dropdowns</div>
              <div className="mt-1 text-sm text-ink-500">Add breeds and hatchery sources here so operators only select from the list.</div>
            </div>
            <button type="button" className="btn-secondary whitespace-nowrap" onClick={() => setIsReferenceModalOpen(true)}>
              Manage lists
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-[var(--border-subtle)] pt-5">
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
          disabled={createBatch.isPending || isCapacityExceeded}
        >
          {createBatch.isPending ? 'Saving...' : 'Create Batch'}
        </button>
      </div>

      <Modal
        isOpen={isReferenceModalOpen}
        onClose={() => setIsReferenceModalOpen(false)}
        title="Batch setup lists"
      >
        <FarmReferenceManager types={batchReferenceTypes} />
      </Modal>
    </form>
  )
}
