import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="text-7xl font-bold text-neutral-100 mb-4">404</div>
      <h2 className="text-xl font-semibold text-neutral-800 mb-2">Page not found</h2>
      <p className="text-sm text-neutral-500 mb-6 max-w-xs">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link to="/dashboard" className="btn-primary">
        <Home className="w-4 h-4" />
        Go to Dashboard
      </Link>
    </div>
  )
}
