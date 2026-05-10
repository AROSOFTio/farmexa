import { Link } from 'react-router-dom'
import { CreditCard, Headphones, UserCircle } from 'lucide-react'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'

export function SubscriptionExpiredPage() {
  const { settings } = usePlatformSettings()

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center px-4 py-10 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-[var(--brand-primary)]">
        <CreditCard className="h-10 w-10" />
      </div>
      <h1 className="text-[2.2rem] font-bold text-[var(--text-strong)]">Your 14-day free trial has ended.</h1>
      <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-[var(--text-muted)]">
        Your operational modules are temporarily disabled. Upgrade your subscription to reactivate your farm data and continue using {settings.system_name}.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/subscription/upgrade" className="btn-primary btn-lg">
          <CreditCard className="h-4 w-4" />
          Upgrade Now
        </Link>
        <Link to="/support" className="btn-secondary btn-lg">
          <Headphones className="h-4 w-4" />
          Contact Support
        </Link>
        <Link to="/settings/profile" className="btn-secondary btn-lg">
          <UserCircle className="h-4 w-4" />
          View Profile
        </Link>
      </div>
    </div>
  )
}
