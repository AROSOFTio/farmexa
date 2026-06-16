import api from '@/services/api'

export interface Branch {
  id: number
  name: string
  branch_code: string
  type: string
  address?: string
  contact_person?: string
  contact_phone?: string
  is_active: boolean
  is_default: boolean
  created_at: string
}

export interface BranchCreate {
  name: string
  branch_code: string
  type?: string
  address?: string
  contact_person?: string
  contact_phone?: string
  is_active?: boolean
}

export interface BranchUpdate {
  name?: string
  branch_code?: string
  type?: string
  address?: string
  contact_person?: string
  contact_phone?: string
  is_active?: boolean
  is_default?: boolean
}

export const branchService = {
  async getBranches(): Promise<Branch[]> {
    const { data } = await api.get('/settings/branches')
    return data
  },

  async createBranch(payload: BranchCreate): Promise<Branch> {
    const { data } = await api.post('/settings/branches', { type: 'farm', ...payload })
    return data
  },

  async updateBranch(id: number, payload: BranchUpdate): Promise<Branch> {
    const { data } = await api.patch(`/settings/branches/${id}`, payload)
    return data
  },

  async deleteBranch(id: number): Promise<void> {
    await api.delete(`/settings/branches/${id}`)
  },
}
