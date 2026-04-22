import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, LogIn, Leaf } from 'lucide-react'
import { toast } from 'sonner'
import { AxiosError } from 'axios'
import { useAuth } from '@/features/auth/AuthContext'
import { ApiError } from '@/types'

const loginSchema = z.object({
  email: z.string().includes('@', { message: 'Enter a valid email address' }),
  password: z.string().min(1, 'Password is required'),
})
type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginForm) => {
    setIsSubmitting(true)
    try {
      await login(data)
      toast.success('Welcome back!')
    } catch (err) {
      const axiosErr = err as AxiosError<ApiError>
      const message =
        axiosErr.response?.data?.detail ?? 'Login failed. Please try again.'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left Panel ─────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-neutral-900 relative overflow-hidden flex-col justify-between p-12">
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
        {/* Brand gradient orb */}
        <div className="absolute top-[-20%] right-[-15%] w-[600px] h-[600px] rounded-full bg-brand-600/20 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-brand-400/10 blur-[80px]" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-xl tracking-tight">PERP</div>
            <div className="text-neutral-500 text-xs">Poultry ERP Platform</div>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight text-balance mb-6">
              Manage your poultry operations
              <span className="text-brand-400"> with precision</span>
            </h1>
            <p className="text-neutral-400 text-lg leading-relaxed max-w-md">
              A unified platform covering farm management, feed tracking, slaughter processing,
              sales, inventory, and financial reporting — built for serious poultry businesses.
            </p>
          </motion.div>

          {/* Feature bullets */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-10 flex flex-col gap-3"
          >
            {[
              'Real-time batch and flock monitoring',
              'Integrated feed stock and consumption tracking',
              'End-to-end sales, invoicing, and payments',
              'Executive financial reporting and analytics',
            ].map((feature) => (
              <div key={feature} className="flex items-start gap-3">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-brand-600/30 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-brand-400" />
                </div>
                <span className="text-neutral-300 text-sm">{feature}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Footer tagline */}
        <div className="relative z-10 text-neutral-600 text-xs">
          © {new Date().getFullYear()} PERP. Production-grade Poultry ERP.
        </div>
      </div>

      {/* ── Right Panel ─────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-neutral-50">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-neutral-900">PERP</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-neutral-900">Sign in to your account</h2>
            <p className="text-sm text-neutral-500 mt-1.5">
              Enter your credentials to access the platform
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="form-label">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="form-input"
                {...register('email')}
              />
              {errors.email && (
                <p className="form-error">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="form-input pr-11"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="form-error">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full mt-1"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign in
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-neutral-400">
            Access is managed by your system administrator.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
