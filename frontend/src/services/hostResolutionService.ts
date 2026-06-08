import api from '@/services/api'

export interface HostResolutionResponse {
  hostname: string
  is_platform_host: boolean
  tenant_exists: boolean
  tenant_slug?: string | null
  tenant_active: boolean
}

export async function getHostResolution() {
  const { data } = await api.get<HostResolutionResponse>('/platform/resolve-host')
  return data
}
