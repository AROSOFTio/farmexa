import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/services/api'
import { SlaughterRecord, BatchOption, StockItem } from './types'
import { RecordFormValues, CompletionFormValues, OutputFormValues } from './schemas'
import { todayValue, inferOutputType } from './utils'

export function useSlaughterRecords() {
  return useQuery({
    queryKey: ['slaughter-records'],
    queryFn: () => api.get<SlaughterRecord[]>('/slaughter/records').then((response) => response.data),
  })
}

export function useBatches() {
  return useQuery({
    queryKey: ['slaughter-batches'],
    queryFn: () => api.get<BatchOption[]>('/farm/batches').then((response) => response.data),
  })
}

export function useStockItems() {
  return useQuery({
    queryKey: ['slaughter-stock-items'],
    queryFn: () => api.get<StockItem[]>('/inventory/items').then((response) => response.data),
  })
}

export function useCreateRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: RecordFormValues) => api.post('/slaughter/records', values),
    onSuccess: () => {
      toast.success('Slaughter record saved.')
      qc.invalidateQueries({ queryKey: ['slaughter-records'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to create slaughter record.')
    },
  })
}

export function useCompleteRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: CompletionFormValues) =>
      api.patch(`/slaughter/records/${values.record_id}`, {
        status: values.status,
        total_dressed_weight: values.total_dressed_weight ?? null,
        waste_weight: values.waste_weight,
        mortality_birds_count: values.mortality_birds_count,
        condemned_birds_count: values.condemned_birds_count,
        blood_weight: values.blood_weight,
        feathers_weight: values.feathers_weight,
        offal_weight: values.offal_weight,
        head_weight: values.head_weight,
        feet_weight: values.feet_weight,
        reusable_byproducts_weight: values.reusable_byproducts_weight,
        waste_disposal_notes: values.waste_disposal_notes || null,
        quality_inspection_status: values.quality_inspection_status,
        approval_status: values.approval_status,
        cold_room_location: values.cold_room_location || null,
        notes: values.notes || null,
        direct_labour_cost: values.direct_labour_cost,
        overhead_cost: values.overhead_cost,
        chick_cost_override: values.chick_cost_override ?? null,
      }),
    onSuccess: () => {
      toast.success('Slaughter yield finalized.')
      qc.invalidateQueries({ queryKey: ['slaughter-records'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to update slaughter record.')
    },
  })
}

/**
 * Plan-level workflow transitions: approve a scheduled plan to start processing,
 * or cancel it. Uses the same PATCH endpoint with just a status change.
 */
export function useUpdateRecordStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ recordId, status }: { recordId: number; status: 'in_progress' | 'cancelled' }) =>
      api.patch(`/slaughter/records/${recordId}`, { status }),
    onSuccess: (_data, variables) => {
      toast.success(variables.status === 'in_progress' ? 'Plan approved — processing started.' : 'Plan cancelled.')
      qc.invalidateQueries({ queryKey: ['slaughter-records'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to update plan.')
    },
  })
}

export function useCreateOutput(outputInventoryItems: StockItem[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: OutputFormValues) => {
      const selectedItem = outputInventoryItems.find((item) => item.id === values.stock_item_id)
      const outputType = inferOutputType(selectedItem)
      if (!outputType) {
        throw new Error('Selected item is not configured as a slaughter output. Ask an inventory or slaughter manager to register the correct item code.')
      }
      return api.post(`/slaughter/records/${values.record_id}/outputs`, {
        stock_item_id: values.stock_item_id,
        output_type: outputType,
        quantity: values.quantity,
        unit_cost: values.unit_cost ?? null,
      })
    },
    onSuccess: () => {
      toast.success('Slaughter output posted to inventory.')
      qc.invalidateQueries({ queryKey: ['slaughter-records'] })
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      qc.invalidateQueries({ queryKey: ['inventory-movements'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? error?.message ?? 'Failed to post slaughter output.')
    },
  })
}

export function emptyRecordFormValues(): RecordFormValues {
  return {
    batch_id: 0,
    slaughter_date: todayValue(),
    live_birds_count: 0,
    mortality_birds_count: 0,
    condemned_birds_count: 0,
    total_live_weight: 0,
    waste_weight: 0,
    blood_weight: 0,
    feathers_weight: 0,
    offal_weight: 0,
    head_weight: 0,
    feet_weight: 0,
    reusable_byproducts_weight: 0,
    waste_disposal_notes: '',
    quality_inspection_status: 'pending',
    cold_room_location: '',
    notes: '',
    direct_labour_cost: 0,
    overhead_cost: 0,
    chick_cost_override: undefined,
  }
}

export function emptyCompletionValues(): CompletionFormValues {
  return {
    record_id: 0,
    status: 'completed',
    total_dressed_weight: undefined,
    waste_weight: 0,
    mortality_birds_count: 0,
    condemned_birds_count: 0,
    blood_weight: 0,
    feathers_weight: 0,
    offal_weight: 0,
    head_weight: 0,
    feet_weight: 0,
    reusable_byproducts_weight: 0,
    waste_disposal_notes: '',
    quality_inspection_status: 'pending',
    approval_status: 'pending',
    cold_room_location: '',
    notes: '',
    direct_labour_cost: 0,
    overhead_cost: 0,
    chick_cost_override: undefined,
  }
}

export function emptyOutputValues(): OutputFormValues {
  return {
    record_id: 0,
    stock_item_id: 0,
    quantity: 0,
    unit_cost: undefined,
  }
}
