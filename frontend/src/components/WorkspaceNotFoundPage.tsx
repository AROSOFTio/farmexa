import { AlertCircle, Home, Mail } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'

export function WorkspaceNotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4 py-10">
      <section className="auth-panel w-full max-w-[520px] p-6 text-center sm:p-8">
        <div className="flex justify-center">
          <BrandMark />
        </div>
        <div className="mx-auto mt-8 flex h-14 w-14 items-center justify-center rounded-[10px] bg-[rgba(var(--brand-primary-rgb),0.1)] text-[var(--brand-primary)]">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 className="mt-6 text-[1.65rem] font-bold text-ink-900">Workspace not found</h1>
        <p className="mx-auto mt-3 max-w-md text-[14px] leading-6 text-ink-500">
          This Farmexa workspace does not exist, is not active, or has not been mapped.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <a href="https://myfarm.arosoftlabs.com" className="btn-primary btn-lg">
            <Home className="h-4 w-4" />
            Go to Farmexa Home
          </a>
          <a href="mailto:farmexa@arosoftlabs.com" className="btn-secondary btn-lg">
            <Mail className="h-4 w-4" />
            Contact support
          </a>
        </div>
      </section>
    </main>
  )
}
