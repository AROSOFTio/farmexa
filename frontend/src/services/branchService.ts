import api from '@/services/api'

export interface Branch {
  id: number
  name: string
  code: string
  location?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BranchCreate {
  name: string
  code: string
  location?: string
  is_active?: boolean
}

export interface BranchUpdate {
  name?: string
  code?: string
  location?: string
  is_active?: boolean
}

export const branchService = {
  async getBranches(): Promise<Branch[]> {
    const { data } = await api.get('/settings/branches')
    return data
  },

  async createBranch(payload: BranchCreate): Promise<Branch> {
    const { data } = await api.post('/settings/branches', payload)
    return data
  },

  async updateBranch(id: number, payload: BranchUpdate): Promise<Branch> {
    const { data } = await api.patch(`/settings/branches/${id}`, payload)
    return data
  },
}
