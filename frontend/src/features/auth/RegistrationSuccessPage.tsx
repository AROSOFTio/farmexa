import { Link, useLocation } from 'react-router-dom'
import { ExternalLink, LogIn } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'
import { TenantRegistrationResponse } from '@/types'

export function RegistrationSuccessPage() {
  const location = useLocation()
  const { settings } = usePlatformSettings()
  const registration = location.state as TenantRegistrationResponse | null

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4 py-10">
      <div className="w-full max-w-[720px]">
        <div className="mb-7 flex justify-center"><BrandMark /></div>
        <div className="card p-6 sm:p-8">
          <div className="auth-eyebrow">Workspace ready</div>
          <h1 className="mt-3 text-[2rem] font-semibold text-ink-900">Your {settings.system_name} workspace is ready.</h1>
          {registration ? (
            <>
              <p className="mt-3 text-[14px] leading-7 text-ink-600">
                Sign in at {registration.login_url}. Your 14-day free trial expires on {registration.trial_expiry_date ?? 'the trial expiry date'}.
              </p>
              <div className="mt-6 grid gap-3 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4 text-[14px]">
                <div><strong>Farm name:</strong> {registration.tenant_name}</div>
                <div><strong>Workspace URL:</strong> {registration.login_url}</div>
                <div><strong>Admin email:</strong> {registration.admin_email}</div>
                <div><strong>Trial start date:</strong> {registration.trial_start_date ?? 'Today'}</div>
                <div><strong>Trial expiry date:</strong> {registration.trial_expiry_date ?? 'In 14 days'}</div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={registration.login_url} className="btn-primary btn-lg">
                  <ExternalLink className="h-4 w-4" />
                  Open Workspace
                </a>
                <Link to="/login" className="btn-secondary btn-lg">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Link>
              </div>
            </>
          ) : (
            <div className="mt-5">
              <p className="text-[14px] text-ink-600">Registration details are not available in this browser session.</p>
              <Link to="/login" className="btn-primary btn-lg mt-5">Sign In</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
