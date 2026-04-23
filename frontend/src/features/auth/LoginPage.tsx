import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AxiosError } from 'axios'
import { Bird, ChartColumn, Eye, EyeOff, LogIn, Warehouse } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/features/auth/AuthContext'
import { APP_DESCRIPTION, APP_TAGLINE, APP_NAME } from '@/lib/branding'
import { ApiError } from '@/types'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormValues = z.infer<typeof loginSchema>

const capabilities = [
  {
    icon: Bird,
    title: 'Farm lifecycle control',
    description: 'Manage houses, batches, mortality, vaccination, and growth from one operational workspace.',
  },
  {
    icon: Warehouse,
    title: 'Stock and feed visibility',
    description: 'Track purchases, consumption, low stock exposure, and finished inventory movement in real time.',
  },
  {
    icon: ChartColumn,
    title: 'Commercial and finance clarity',
    description: 'Run orders, invoices, payments, and profit reporting with role-based access and accountability.',
  },
]

export function LoginPage() {
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      toast.success('Welcome back to Farmexa.')
    } catch (error) {
      const axiosError = error as AxiosError<ApiError>
      toast.error(axiosError.response?.data?.detail ?? 'Login failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-shell-gradient">
      <div className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden border-r border-neutral-200 bg-sidebar-gradient px-8 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-14 xl:py-12">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-[-8rem] top-[-9rem] h-72 w-72 rounded-full bg-brand-500/18 blur-3xl" />
            <div className="absolute bottom-[-10rem] right-[-4rem] h-80 w-80 rounded-full bg-brand-400/10 blur-3xl" />
            <div className="absolute bottom-16 left-10 h-56 w-56 rounded-full border border-white/8" />
            <div className="absolute bottom-6 left-24 h-72 w-72 rounded-full border border-white/6" />
          </div>

          <div className="relative z-10">
            <BrandMark light showTagline />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 max-w-2xl"
          >
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.24em] text-brand-100">
              Premium Poultry Operations Workspace
            </div>
            <h1 className="mt-8 max-w-3xl text-balance font-display text-5xl font-semibold leading-[1.06] text-white xl:text-6xl">
              Poultry operations aligned from the farm floor to the finance desk.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/70">
              {APP_DESCRIPTION}
            </p>

            <div className="mt-10 grid gap-4">
              {capabilities.map((capability) => {
                const Icon = capability.icon
                return (
                  <div
                    key={capability.title}
                    className="rounded-3xl border border-white/10 bg-white/6 px-5 py-4 backdrop-blur-sm"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/16 text-brand-100">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white">{capability.title}</h2>
                        <p className="mt-1 text-sm leading-6 text-white/70">{capability.description}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>

          <div className="relative z-10 flex items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs font-medium uppercase tracking-[0.24em] text-white/45">
            <span>{APP_NAME}</span>
            <span>{APP_TAGLINE}</span>
          </div>
        </section>

        <section className="relative flex items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute right-[-6rem] top-[-4rem] h-56 w-56 rounded-full bg-brand-100 blur-3xl" />
            <div className="absolute bottom-[-7rem] left-[-6rem] h-64 w-64 rounded-full bg-brand-50 blur-3xl" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42 }}
            className="relative z-10 w-full max-w-lg"
          >
            <div className="mb-8 lg:hidden">
              <BrandMark showTagline />
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-neutral-150 bg-neutral-50 px-6 py-6 sm:px-8">
                <div className="text-[0.7rem] font-bold uppercase tracking-[0.26em] text-brand-700">
                  Secure Sign In
                </div>
                <h2 className="mt-3 text-3xl font-semibold text-ink-900">Welcome back</h2>
                <p className="mt-2 text-sm leading-6 text-ink-500">
                  Sign in to continue managing farm, stock, sales, and finance workflows in Farmexa ERP.
                </p>
              </div>

              <div className="px-6 py-6 sm:px-8 sm:py-7">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div>
                    <label htmlFor="email" className="form-label">
                      Work email
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@farmexa.com"
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
                        placeholder="Enter your password"
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
                        <div className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <LogIn className="h-4.5 w-4.5" />
                        Sign in to Farmexa
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50/70 px-4 py-3 text-sm text-brand-800">
                  Password assistance and account access are managed by your Farmexa system administrator.
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  )
}
