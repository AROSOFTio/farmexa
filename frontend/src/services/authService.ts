import api from '@/services/api'
import { LoginRequest, MeResponse, TokenPair, VendorRegistrationRequest, VendorRegistrationResponse } from '@/types'

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

  async registerVendor(payload: VendorRegistrationRequest): Promise<VendorRegistrationResponse> {
    const { data } = await api.post<VendorRegistrationResponse>('/auth/register-vendor', payload)
    return data
  },
}
