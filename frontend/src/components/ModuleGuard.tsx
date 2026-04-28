import { ShieldX } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'

export function ModuleGuard({ moduleKey, children }: { moduleKey: string; children: React.ReactNode }) {
  const { hasModuleAccess } = useAuth()

  if (!hasModuleAccess(moduleKey)) {
    return <ModuleDisabledPage moduleName={moduleKey.replace(/_/g, ' ')} />
  }

  return <>{children}</>
}

export function ModuleDisabledPage({ moduleName = 'this module' }: { moduleName?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-amber-50 text-amber-500">
        <ShieldX className="h-12 w-12" />
      </div>
      <h1 className="mb-3 text-3xl font-bold text-slate-900">Module Unavailable</h1>
      <p className="mb-8 max-w-md text-slate-500">
        This module is not available on your current subscription. Access to {moduleName} has been blocked for this tenant.
      </p>
    </div>
  )
}
