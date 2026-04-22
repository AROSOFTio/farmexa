import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { ReactNode } from 'react'

interface ProtectedRouteProps {
  children: ReactNode
  permission?: string
  role?: string
}

export function ProtectedRoute({ children, permission, role }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasPermission, hasRole } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-neutral-500">Loading…</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-neutral-800 mb-2">Access Denied</h2>
          <p className="text-sm text-neutral-500">
            You don&apos;t have permission to view this page.
          </p>
        </div>
      </div>
    )
  }

  if (role && !hasRole(role)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-neutral-800 mb-2">Access Denied</h2>
          <p className="text-sm text-neutral-500">Your role does not have access to this area.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
