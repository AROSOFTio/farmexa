import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, ArrowLeft, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { BrandMark } from '@/components/BrandMark'
import { ThemeToggle } from '@/components/ThemeControls'
import { RegistrationWizardModal } from '@/features/auth/RegistrationWizardModal'
import { useAuth } from '@/features/auth/AuthContext'
import { useHostResolution } from '@/hooks/useHostResolution'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'
import { currentPlatformHost } from '@/lib/platform'
import { SEO } from '@/components/SEO'
import { getErrorMessage } from '@/lib/errors'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const { login } = useAuth()
  const { settings } = usePlatformSettings()
  const { hostResolution } = useHostResolution()
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false)

  const isPlatformHost = hostResolution?.is_platform_host ?? false
  const showRegisterAction = isPlatformHost
  const currentHost = hostResolution?.is_platform_host
    ? currentPlatformHost(hostResolution.hostname) ?? hostResolution.hostname
    : currentPlatformHost() ?? settings.platform_domain

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true)
    try {
      await login(values)
      toast.success('Signed in.')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Login failed.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <SEO title="Sign in to Farmexa" description="Sign in to your Farmexa workspace." canonicalPath="/login" robots="noindex,nofollow" />

      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--app-bg)] px-5 py-12">
        {/* ── Subtle animated aurora background ─────────────────────────── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-32 left-1/4 h-[32rem] w-[32rem] rounded-full bg-blue-400/20 blur-[120px]"
            animate={{ x: [0, 40, 0], y: [0, 30, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-40 right-1/4 h-[30rem] w-[30rem] rounded-full bg-indigo-400/15 blur-[120px]"
            animate={{ x: [0, -36, 0], y: [0, -28, 0], scale: [1, 1.12, 1] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-1/3 right-10 h-[22rem] w-[22rem] rounded-full bg-cyan-300/10 blur-[110px]"
            animate={{ x: [0, 24, 0], y: [0, 20, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        {/* ── Top utility bar ───────────────────────────────────────────── */}
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <Link to="/" className="theme-icon-button" aria-label="Back to home" title="Back to home">
            <ArrowLeft className="h-[15px] w-[15px]" />
          </Link>
          <ThemeToggle />
        </div>

        {/* ── Centered login column ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-[400px]"
        >
          {/* Brand */}
          <div className="mb-7 flex flex-col items-center text-center">
            <BrandMark />
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)]/70 px-3.5 py-1.5 backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-primary)] opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)]" />
              </span>
              <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                Modern Poultry ERP
              </span>
            </div>
          </div>

          {/* Card */}
          <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-card)]/80 p-7 shadow-[0_24px_70px_-24px_rgba(15,23,42,0.28)] backdrop-blur-xl sm:p-8">
            <div className="mb-6 text-center">
              <h1 className="text-[1.6rem] font-bold leading-tight text-[var(--text-strong)]">
                Welcome back
              </h1>
              <p className="mt-1.5 text-[13.5px] text-[var(--text-muted)]">
                Sign in to your {settings.system_name} workspace
              </p>
            </div>

            {isPlatformHost ? (
              <div className="mb-5 flex items-start gap-3 rounded-[12px] border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>
                  <strong>Platform administrator access only.</strong> Tenant users: sign in at your
                  workspace domain (e.g. <em>yourfarm.arosoftlabs.com</em>).
                </span>
              </div>
            ) : null}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="email" className="form-label">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="form-input"
                  placeholder="you@yourfarm.com"
                  {...register('email')}
                />
                {errors.email ? <p className="form-error">{errors.email.message}</p> : null}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="password" className="form-label mb-0">
                    Password
                  </label>
                  <a
                    href={`https://${currentHost}/forgot-password`}
                    className="text-[12px] font-semibold text-[var(--brand-primary)] hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="form-input pr-12"
                    placeholder="••••••••"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((c) => !c)}
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[8px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--text-strong)]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password ? <p className="form-error">{errors.password.message}</p> : null}
              </div>

              <div className="pt-1 space-y-3">
                <button type="submit" disabled={isSubmitting} className="btn-primary btn-lg w-full">
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      Sign in
                    </>
                  )}
                </button>

                {showRegisterAction ? (
                  <button
                    type="button"
                    onClick={() => setIsRegistrationOpen(true)}
                    className="btn-secondary btn-lg w-full"
                  >
                    <UserPlus className="h-4 w-4" />
                    Start 14-Day Free Trial
                  </button>
                ) : null}
              </div>
            </form>
          </div>

          {/* Below-card links */}
          <div className="mt-6 flex items-center justify-center gap-4 text-[12px] text-[var(--text-muted)]">
            <a href={`https://${currentHost}`} className="transition-colors hover:text-[var(--text-strong)]">
              ← Back to home
            </a>
            <span className="opacity-30">·</span>
            <a href={`https://${currentHost}/support`} className="transition-colors hover:text-[var(--text-strong)]">
              Need help?
            </a>
          </div>

          <p className="mt-6 text-center text-[11px] text-[var(--text-muted)]/70">
            © {new Date().getFullYear()} Arosoft Labs — Farmexa Poultry ERP
          </p>
        </motion.div>
      </div>

      <RegistrationWizardModal isOpen={isRegistrationOpen} onClose={() => setIsRegistrationOpen(false)} />
    </>
  )
}
