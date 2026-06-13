import { z } from 'zod'

export const recordSchema = z.object({
  batch_id: z.coerce.number().int().positive('Batch is required'),
  slaughter_date: z.string().min(1, 'Slaughter date is required'),
  live_birds_count: z.coerce.number().int().positive('Bird count must be greater than zero'),
  mortality_birds_count: z.coerce.number().int().min(0),
  condemned_birds_count: z.coerce.number().int().min(0),
  total_live_weight: z.coerce.number().min(0, 'Live weight cannot be negative'),
  waste_weight: z.coerce.number().min(0),
  blood_weight: z.coerce.number().min(0),
  feathers_weight: z.coerce.number().min(0),
  offal_weight: z.coerce.number().min(0),
  head_weight: z.coerce.number().min(0),
  feet_weight: z.coerce.number().min(0),
  reusable_byproducts_weight: z.coerce.number().min(0),
  waste_disposal_notes: z.string().optional(),
  quality_inspection_status: z.enum(['pending', 'passed', 'failed', 'rework']),
  cold_room_location: z.string().optional(),
  notes: z.string().optional(),
  direct_labour_cost: z.coerce.number().min(0),
  overhead_cost: z.coerce.number().min(0),
  chick_cost_override: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(0).optional()
  ),
})

export const completionSchema = z.object({
  record_id: z.coerce.number().int().positive('Record is required'),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']),
  total_dressed_weight: z.coerce.number().optional(),
  waste_weight: z.coerce.number().min(0),
  mortality_birds_count: z.coerce.number().int().min(0),
  condemned_birds_count: z.coerce.number().int().min(0),
  blood_weight: z.coerce.number().min(0),
  feathers_weight: z.coerce.number().min(0),
  offal_weight: z.coerce.number().min(0),
  head_weight: z.coerce.number().min(0),
  feet_weight: z.coerce.number().min(0),
  reusable_byproducts_weight: z.coerce.number().min(0),
  waste_disposal_notes: z.string().optional(),
  quality_inspection_status: z.enum(['pending', 'passed', 'failed', 'rework']),
  approval_status: z.enum(['pending', 'approved', 'rejected']),
  cold_room_location: z.string().optional(),
  notes: z.string().optional(),
  direct_labour_cost: z.coerce.number().min(0),
  overhead_cost: z.coerce.number().min(0),
  chick_cost_override: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(0).optional()
  ),
})

export const outputSchema = z.object({
  record_id: z.coerce.number().int().positive('Record is required'),
  stock_item_id: z.coerce.number().int().positive('Stock item is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  unit_cost: z.coerce.number().optional(),
})

export type RecordFormValues = z.infer<typeof recordSchema>
export type CompletionFormValues = z.infer<typeof completionSchema>
export type OutputFormValues = z.infer<typeof outputSchema>
