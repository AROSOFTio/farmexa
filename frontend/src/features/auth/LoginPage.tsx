import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { BrandMark } from '@/components/BrandMark'
import { ThemeToggle } from '@/components/ThemeControls'
import { RegistrationWizardModal } from '@/features/auth/RegistrationWizardModal'
import { useAuth } from '@/features/auth/AuthContext'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'
import { getErrorMessage } from '@/lib/errors'
import { isPlatformRegistrationHost } from '@/lib/platform'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const { login } = useAuth()
  const { settings } = usePlatformSettings()
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false)
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
      toast.error(getErrorMessage(error, 'Login failed.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8"
      style={{
        backgroundImage:
          'linear-gradient(135deg, rgba(11,16,24,0.72), rgba(11,16,24,0.34)), url(/images/auth/farmexa-login-background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <Link to="/" className="theme-icon-button" aria-label="Back to home" title="Back to home">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <ThemeToggle />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="auth-panel relative z-10 w-full max-w-[430px] overflow-hidden p-5 shadow-[0_30px_90px_-50px_rgba(0,0,0,.58)] sm:p-8"
      >
        <div className="mx-auto mb-6 flex justify-center">
          <BrandMark />
        </div>
        <div className="text-center">
          <div className="auth-eyebrow">Secure workspace access</div>
          <h1 className="mt-3 text-[1.65rem] font-bold leading-tight text-ink-900">Sign in to {settings.system_name}</h1>
          <p className="mt-2 text-[13.5px] leading-6 text-ink-500">Use your farm workspace account to continue.</p>
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
                <button type="button" onClick={() => setIsRegistrationOpen(true)} className="btn-secondary btn-lg w-full">
                  <UserPlus className="h-4.5 w-4.5" />
                  Start Free Trial
                </button>
              ) : null}
              <Link to="/" className="btn-ghost w-full">
                Back to home
              </Link>
            </form>
      </motion.div>
      <RegistrationWizardModal isOpen={isRegistrationOpen} onClose={() => setIsRegistrationOpen(false)} />
    </div>
  )
}
