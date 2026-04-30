import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AxiosError } from 'axios'
import { Eye, EyeOff, Globe2, LogIn, ShieldCheck, UserPlus } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/features/auth/AuthContext'
import { isPlatformRegistrationHost } from '@/lib/platform'
import { ApiError } from '@/types'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormValues = z.infer<typeof loginSchema>

function getApiErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<ApiError>
  return axiosError.response?.data?.detail ?? fallback
}

export function LoginPage() {
  const { login } = useAuth()
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
    <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="w-full max-w-[560px]"
      >
        <div className="mb-7 flex justify-center">
          <BrandMark />
        </div>

        <div className="card p-6 sm:p-8">
          <div className="space-y-2">
            <h1 className="text-[1.8rem] font-semibold text-ink-900">Sign in</h1>
            <p className="text-[14px] text-ink-500">
              Access your Farmexa workspace with your staff or tenant administrator account.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5">
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
              <label htmlFor="password" className="form-label">
                Password
              </label>
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
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-2xl text-ink-400 transition-colors hover:bg-neutral-100 hover:text-ink-700"
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
              <Link to="/register-vendor" className="btn-secondary btn-lg w-full">
                <UserPlus className="h-4.5 w-4.5" />
                Register new tenant
              </Link>
            ) : null}
          </form>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-4">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text-strong)]">
                <Globe2 className="h-4.5 w-4.5 text-[var(--brand-primary)]" />
                Tenant workspaces
              </div>
              <p className="mt-2 text-[13px] leading-6 text-[var(--text-muted)]">
                Tenant staff and tenant administrators must sign in from their mapped workspace domain.
              </p>
            </div>
            <div className="rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-4">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text-strong)]">
                <ShieldCheck className="h-4.5 w-4.5 text-[var(--brand-primary)]" />
                Platform admins
              </div>
              <p className="mt-2 text-[13px] leading-6 text-[var(--text-muted)]">
                Developer admins and super managers should continue using the main Farmexa sign-in domain. New tenant registration is only available on `farmexa.arosoft.io`.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
