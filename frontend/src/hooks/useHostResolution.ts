import { useQuery } from '@tanstack/react-query'
import { getHostResolution, HostResolutionResponse } from '@/services/hostResolutionService'

export function useHostResolution() {
  const query = useQuery<HostResolutionResponse>({
    queryKey: ['host-resolution', window.location.hostname],
    queryFn: getHostResolution,
    staleTime: 5 * 60_000,
  })

  return {
    hostResolution: query.data,
    isLoading: query.isLoading,
    error: query.error,
  }
}
