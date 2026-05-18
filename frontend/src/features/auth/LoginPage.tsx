import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AxiosError } from 'axios'
import { BarChart3, CheckCircle2, Eye, EyeOff, LockKeyhole, LogIn, ShieldCheck, UserPlus } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/features/auth/AuthContext'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'
import { isPlatformRegistrationHost } from '@/lib/platform'
import { ApiError } from '@/types'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormValues = z.infer<typeof loginSchema>

function getApiErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<ApiError>
  if (!axiosError.response) {
    return 'Farmexa server is unreachable. Check backend and reverse proxy status.'
  }
  if (axiosError.response.status === 401) {
    return axiosError.response.data?.detail ?? 'Invalid email or password.'
  }
  if (axiosError.response.status === 403) {
    return axiosError.response.data?.detail ?? 'This account cannot sign in from this domain.'
  }
  if (axiosError.response.status >= 500) {
    return 'Farmexa server is not ready. Check backend logs and database migrations.'
  }
  return axiosError.response?.data?.detail ?? fallback
}

export function LoginPage() {
  const { login } = useAuth()
  const { settings } = usePlatformSettings()
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showRegisterAction = isPlatformRegistrationHost()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true)
    try {
      await login(values)
      toast.success('Signed in.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Login failed.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-page min-h-screen px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-[1120px] overflow-hidden rounded-[18px] border border-[#eadcc1] bg-white shadow-[0_28px_80px_-48px_rgba(15,23,42,.45)] lg:grid-cols-[1.05fr_.95fr]"
      >
        <section className="relative hidden bg-[#030910] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(212,164,44,.24),transparent_34%),linear-gradient(135deg,rgba(255,255,255,.08),transparent_42%)]" />
          <div className="relative">
            <BrandMark light showTagline />
            <div className="mt-16 max-w-lg">
              <div className="inline-flex rounded-full border border-[#d4a42c]/30 bg-[#d4a42c]/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#f3cf78]">
                Secure ERP workspace
              </div>
              <h1 className="mt-5 text-5xl font-black leading-[1.02] tracking-tight text-white">
                Control poultry operations from one disciplined system.
              </h1>
              <p className="mt-5 text-[15px] leading-7 text-white/68">
                Feed mill, houses, stock, slaughter, POS, finance, compliance, and reports stay connected inside your tenant workspace.
              </p>
            </div>
          </div>
          <div className="relative grid grid-cols-3 gap-3">
            {[
              { label: 'Tenant isolated', icon: ShieldCheck },
              { label: 'Role secured', icon: LockKeyhole },
              { label: 'Live reports', icon: BarChart3 },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-[12px] border border-white/10 bg-white/[.06] p-4">
                  <Icon className="h-5 w-5 text-[#d4a42c]" />
                  <div className="mt-3 text-[12px] font-bold text-white">{item.label}</div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="flex items-center px-5 py-8 sm:px-10">
          <div className="mx-auto w-full max-w-[430px]">
            <div className="mb-8 lg:hidden">
              <BrandMark />
            </div>
            <div className="space-y-3">
              <div className="auth-eyebrow">Workspace access</div>
              <h1 className="text-[2.1rem] font-black leading-tight text-ink-900">Sign in to {settings.system_name}</h1>
              <p className="text-[14px] leading-6 text-ink-500">Use your farm workspace account. Platform admins should sign in from the platform domain.</p>
            </div>

            <div className="mt-6 grid gap-3 rounded-[12px] border border-[#eadcc1] bg-[#fffaf0] p-4 text-[12px] font-semibold text-ink-700">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#b88a1d]" /> Tenant data is isolated by workspace.</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#b88a1d]" /> Refresh sessions are protected by server validation.</div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-5">
              <div>
                <label htmlFor="email" className="form-label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="form-input"
                  {...register('email')}
                />
                {errors.email ? <p className="form-error">{errors.email.message}</p> : null}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="password" className="form-label mb-0">
                    Password
                  </label>
                  <Link to="/forgot-password" className="text-[12px] font-bold text-[var(--brand-primary)]">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="form-input pr-12"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[8px] text-ink-400 transition-colors hover:bg-neutral-100 hover:text-ink-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
                {errors.password ? <p className="form-error">{errors.password.message}</p> : null}
              </div>

              <button type="submit" disabled={isSubmitting} className="btn-primary btn-lg w-full">
                {isSubmitting ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4.5 w-4.5" />
                    Sign in
                  </>
                )}
              </button>

              {showRegisterAction ? (
                <Link to="/register" className="btn-secondary btn-lg w-full">
                  <UserPlus className="h-4.5 w-4.5" />
                  Start Free Trial
                </Link>
              ) : null}
            </form>
          </div>
        </section>
      </motion.div>
    </div>
  )
}
