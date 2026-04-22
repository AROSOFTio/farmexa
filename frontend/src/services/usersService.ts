import api from '@/services/api'
import { UserListResponse, UserCreateRequest, UserUpdateRequest, User, Role } from '@/types'

export const usersService = {
  async list(params: {
    page?: number
    size?: number
    search?: string
    role_id?: number
    is_active?: boolean
  }): Promise<UserListResponse> {
    const { data } = await api.get<UserListResponse>('/users', { params })
    return data
  },

  async get(id: number): Promise<User> {
    const { data } = await api.get<User>(`/users/${id}`)
    return data
  },

  async create(payload: UserCreateRequest): Promise<User> {
    const { data } = await api.post<User>('/users', payload)
    return data
  },

  async update(id: number, payload: UserUpdateRequest): Promise<User> {
    const { data } = await api.patch<User>(`/users/${id}`, payload)
    return data
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/users/${id}`)
  },

  async getRoles(): Promise<Role[]> {
    const { data } = await api.get<Role[]>('/users/roles')
    return data
  },

  async changePassword(payload: { current_password: string; new_password: string }): Promise<void> {
    await api.post('/users/me/change-password', payload)
  },
}
