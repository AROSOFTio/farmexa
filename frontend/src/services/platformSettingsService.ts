import api from '@/services/api'

export interface PublicSystemSettings {
  system_name: string
  system_logo_url?: string | null
  system_favicon_url?: string | null
  primary_color: string
  secondary_color: string
  platform_domain: string
  tenant_domain_suffix: string
  sender_email: string
  sender_name: string
  support_email: string
  company_name: string
  footer_text: string
}

export const defaultPlatformSettings: PublicSystemSettings = {
  system_name: 'Farmexa',
  system_logo_url: '/brand/farmexa-logo-full.png',
  system_favicon_url: '/favicon.svg',
  primary_color: '#d6a62e',
  secondary_color: '#0b1018',
  platform_domain: 'farmexa.arosoft.io',
  tenant_domain_suffix: 'arosoft.io',
  sender_email: 'farmexa@arosoft.io',
  sender_name: 'Farmexa',
  support_email: 'farmexa@arosoft.io',
  company_name: 'AROSOFT',
  footer_text: 'Powered by AROSOFT',
}

export async function getPublicSystemSettings() {
  const { data } = await api.get<PublicSystemSettings>('/settings/public')
  return data
}
