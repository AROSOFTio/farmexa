export type SlaughterSection = 'planning' | 'records' | 'cuts' | 'byproducts' | 'outputs' | 'yield'

export interface BatchOption {
  id: number
  batch_number: string
  breed: string
  house_id?: number | null
  house?: { name: string } | null
}

export interface StockItem {
  id: number
  name: string
  sku?: string | null
  unit_of_measure: string
}

export interface SlaughterOutput {
  id: number
  stock_item_id: number
  output_type: string
  quantity: number
  unit_cost?: number | null
  total_cost?: number | null
}

export interface SlaughterRecord {
  id: number
  batch_id: number
  slaughter_date: string
  live_birds_count: number
  mortality_birds_count: number
  condemned_birds_count: number
  total_live_weight: number
  average_live_weight?: number | null
  total_dressed_weight?: number | null
  average_dressed_weight?: number | null
  yield_percentage?: number | null
  loss_percentage?: number | null
  waste_weight: number
  blood_weight: number
  feathers_weight: number
  offal_weight: number
  head_weight: number
  feet_weight: number
  reusable_byproducts_weight: number
  waste_disposal_notes?: string | null
  quality_inspection_status: string
  cold_room_location?: string | null
  approval_status: string
  direct_labour_cost?: number | null
  overhead_cost?: number | null
  chick_cost_override?: number | null
  total_production_cost?: number | null
  cost_per_kg?: number | null
  production_journal_id?: number | null
  inventory_posted_at?: string | null
  notes?: string | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  outputs: SlaughterOutput[]
}

export const productionOutputCatalog = [
  { value: 'dressed_chicken', label: 'Dressed chicken (whole chicken)', stockName: 'Dressed chicken', stockSku: 'PRD-DRESSED-CHICKEN' },
  { value: 'chicken_breast', label: 'Chicken breast', stockName: 'Chicken breast', stockSku: 'PRD-CHICKEN-BREAST' },
  { value: 'chicken_thighs', label: 'Chicken thighs', stockName: 'Chicken thighs', stockSku: 'PRD-CHICKEN-THIGHS' },
  { value: 'chicken_wings', label: 'Chicken wings', stockName: 'Chicken wings', stockSku: 'PRD-CHICKEN-WINGS' },
  { value: 'chicken_drumsticks', label: 'Chicken drumsticks', stockName: 'Chicken drumsticks', stockSku: 'PRD-CHICKEN-DRUMSTICKS' },
  { value: 'gizzards', label: 'Gizzards', stockName: 'Gizzards', stockSku: 'PRD-GIZZARDS' },
  { value: 'liver', label: 'Liver', stockName: 'Liver', stockSku: 'PRD-LIVER' },
  { value: 'neck_backs', label: 'Neck/backs', stockName: 'Neck/backs', stockSku: 'PRD-NECK-BACKS' },
  { value: 'poultry_manure', label: 'Poultry manure', stockName: 'Poultry manure', stockSku: 'PRD-POULTRY-MANURE' },
  { value: 'feet', label: 'Feet', stockName: 'Feet', stockSku: 'PRD-FEET' },
  { value: 'head', label: 'Head', stockName: 'Head', stockSku: 'PRD-HEAD' },
] as const

export const saleableOutputTypes = new Set<string>([
  'dressed_chicken',
  'chicken_breast',
  'chicken_thighs',
  'chicken_wings',
  'chicken_drumsticks',
  'gizzards',
  'liver',
  'neck_backs',
])

export const byproductOutputTypes = new Set<string>(['poultry_manure', 'feet', 'head'])
export const productionOutputStockNames = new Set<string>(productionOutputCatalog.map((entry) => entry.stockName.toLowerCase()))
export const productionOutputStockSkus = new Set<string>(productionOutputCatalog.map((entry) => entry.stockSku.toLowerCase()))
