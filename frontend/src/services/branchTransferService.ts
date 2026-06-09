import api from './api'
import { Branch } from './branchService'
import { StockItem } from '@/types'

export type TransferStatus = 'pending' | 'in_transit' | 'completed' | 'rejected' | 'cancelled'

export interface BranchTransferItem {
  id: number
  stock_item_id: number
  quantity_shipped: number
  quantity_received?: number | null
  notes?: string | null
}

export interface BranchTransfer {
  id: number
  tenant_id: number
  transfer_number: string
  from_branch_id: number
  to_branch_id: number
  status: TransferStatus
  
  initiated_by_id?: number | null
  dispatched_by_id?: number | null
  received_by_id?: number | null
  
  transfer_date: string
  dispatch_date?: string | null
  receive_date?: string | null
  
  notes?: string | null
  vehicle_registration?: string | null
  driver_name?: string | null
  
  items: BranchTransferItem[]
}

export interface BranchTransferItemCreate {
  stock_item_id: number
  quantity_shipped: number
  notes?: string
}

export interface BranchTransferCreate {
  to_branch_id: number
  notes?: string
  vehicle_registration?: string
  driver_name?: string
  items: BranchTransferItemCreate[]
}

export interface BranchTransferStatusUpdate {
  status: TransferStatus
  received_items?: { item_id: number; quantity_received: number }[]
}

export const branchTransferService = {
  async list(params?: { skip?: number; limit?: number }): Promise<BranchTransfer[]> {
    const { data } = await api.get<BranchTransfer[]>('/inventory/branch-transfers', { params })
    return data
  },

  async get(id: number): Promise<BranchTransfer> {
    const { data } = await api.get<BranchTransfer>(`/inventory/branch-transfers/${id}`)
    return data
  },

  async create(payload: BranchTransferCreate): Promise<BranchTransfer> {
    const { data } = await api.post<BranchTransfer>('/inventory/branch-transfers', payload)
    return data
  },

  async updateStatus(id: number, payload: BranchTransferStatusUpdate): Promise<BranchTransfer> {
    const { data } = await api.patch<BranchTransfer>(`/inventory/branch-transfers/${id}/status`, payload)
    return data
  },
}
