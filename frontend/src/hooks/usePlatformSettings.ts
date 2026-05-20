import { useQuery } from '@tanstack/react-query'
import { defaultPlatformSettings, getPublicSystemSettings } from '@/services/platformSettingsService'

export function usePlatformSettings() {
  const query = useQuery({
    queryKey: ['public-system-settings'],
    queryFn: getPublicSystemSettings,
    staleTime: 5 * 60_000,
  })

  return {
    settings: query.data ?? defaultPlatformSettings,
    isLoading: query.isLoading,
    error: query.error,
    isWorkspaceUnknown: (query.error as { response?: { status?: number } } | null)?.response?.status === 404,
  }
}
