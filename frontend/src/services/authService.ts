import api from '@/services/api'
import { LoginRequest, MeResponse, TenantRegistrationRequest, TenantRegistrationResponse, TokenPair } from '@/types'

export const authService = {
  async login(payload: LoginRequest): Promise<TokenPair> {
    const { data } = await api.post<TokenPair>('/auth/login', payload)
    return data
  },

  async refresh(refreshToken: string): Promise<TokenPair> {
    const { data } = await api.post<TokenPair>('/auth/refresh', {
      refresh_token: refreshToken,
    })
    return data
  },

  async logout(refreshToken: string): Promise<void> {
    await api.post('/auth/logout', { refresh_token: refreshToken })
  },

  async getMe(): Promise<MeResponse> {
    const { data } = await api.get<MeResponse>('/auth/me')
    return data
  },

  async registerTenant(payload: TenantRegistrationRequest): Promise<TenantRegistrationResponse> {
    const { data } = await api.post<TenantRegistrationResponse>('/auth/register-tenant', payload)
    return data
  },

  async registerVendor(payload: TenantRegistrationRequest): Promise<TenantRegistrationResponse> {
    return this.registerTenant(payload)
  },
}
