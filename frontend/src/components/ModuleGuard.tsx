import { useQuery } from '@tanstack/react-query'
import { Outlet } from 'react-router-dom'
import { AlertTriangle, ShieldX } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import api from '@/services/api'

export function ModuleGuard({ moduleKey, children }: { moduleKey: string, children: React.ReactNode }) {
  const { hasRole, user } = useAuth()
  
  // Developer Admin always has access to everything
  const isDevAdmin = hasRole('developer_admin')

  const { data: tenantInfo, isLoading } = useQuery({
    queryKey: ['tenant_info'],
    queryFn: async () => {
      // In a real implementation, we would have an endpoint returning the current user's tenant details
      // For now, we assume the backend handles module protection and we just want to gracefully fail in UI
      // If the user's role is not developer_admin, they are subject to module restrictions.
      return { modules: [] } 
    },
    enabled: !isDevAdmin
  })

  // Since we don't have a direct "am I allowed to see this module" endpoint for the frontend yet,
  // we rely on permissions and backend API failures. If the user navigates to a protected module page, 
  // the backend will return 403 if the tenant doesn't have the module. 
  // For the frontend UI, we'll assume they have access unless a specific "subscription" check fails.
  // A robust implementation would load `tenant_modules` during AuthContext initialization.
  
  // For now, we will just render children and let the API calls within them fail gracefully 
  // or handle the 'ModuleDisabled' state there.
  return <>{children}</>
}

export function ModuleDisabledPage({ moduleName = "this module" }: { moduleName?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-8">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-warning/10 text-warning">
        <ShieldX className="h-12 w-12" />
      </div>
      <h1 className="mb-3 text-3xl font-bold text-[var(--text-strong)]">Module Unavailable</h1>
      <p className="mb-8 max-w-md text-[var(--text-muted)]">
        Access to {moduleName} is not available on your current subscription plan. 
        Please contact your system administrator or upgrade your plan to access these features.
      </p>
    </div>
  )
}
