import { Link } from 'react-router-dom'
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
  const { tenant } = useAuth()
  const trialExpired = tenant?.is_profile_only || ['expired', 'cancelled', 'suspended'].includes(tenant?.subscription_status ?? '')

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-amber-50 text-amber-500">
        <ShieldX className="h-12 w-12" />
      </div>
      <h1 className="mb-3 text-3xl font-bold text-slate-900">{trialExpired ? 'Module Locked' : 'Module Unavailable'}</h1>
      <p className="mb-8 max-w-md text-slate-500">
        {trialExpired
          ? 'This module is locked because your free trial has ended. Upgrade to continue.'
          : `This module is not available on your current subscription. Access to ${moduleName} has been blocked for this tenant.`}
      </p>
      {trialExpired ? <Link to="/subscription/upgrade" className="btn-primary">Upgrade to continue</Link> : null}
    </div>
  )
}
