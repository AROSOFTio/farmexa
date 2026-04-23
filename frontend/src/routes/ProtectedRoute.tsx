import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { LockKeyhole, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
  permission?: string
  role?: string
}

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="card max-w-lg p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger-light text-danger">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-ink-900">Access restricted</h2>
        <p className="mt-2 text-sm text-ink-500">{message}</p>
      </div>
    </div>
  )
}

export function ProtectedRoute({ children, permission, role }: ProtectedRouteProps) {
  const { hasPermission, hasRole, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-card">
            <LockKeyhole className="h-6 w-6 text-brand-600 animate-pulse-soft" />
          </div>
          <span className="text-sm font-medium text-ink-500">Loading...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (permission && !hasPermission(permission)) {
    return <AccessDenied message="Your account does not have the permission required to open this area." />
  }

  if (role && !hasRole(role)) {
    return <AccessDenied message="Your role cannot open this area." />
  }

  return <>{children}</>
}
