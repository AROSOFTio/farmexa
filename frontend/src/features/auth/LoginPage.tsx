import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, LogIn, Leaf, ShieldCheck, Sparkles, Sprout } from 'lucide-react'
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
    <div className="min-h-screen flex bg-neutral-50 selection:bg-brand-100 selection:text-brand-900">
      {/* ── Left Panel: Brand Experience ────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden flex-col justify-between p-16 sidebar">
        {/* Deep Forest Gradient Base is already in the .sidebar class in index.css */}
        
        {/* Sophisticated light overlays */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-500/10 blur-[120px]" />
          <div className="absolute bottom-[-5%] left-[-5%] w-[400px] h-[400px] rounded-full bg-brand-200/10 blur-[100px]" />
        </div>

        {/* Logo Section */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl ring-1 ring-white/10"
            style={{ background: 'linear-gradient(135deg, #166534 0%, #124227 100%)' }}>
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-white font-black text-2xl tracking-tighter leading-none">PERP</div>
            <div className="text-brand-200 text-xs font-bold uppercase tracking-widest mt-1 opacity-80">Poultry Enterprise</div>
          </div>
        </div>

        {/* Hero Section */}
        <div className="relative z-10 max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8">
              <Sparkles className="w-3.5 h-3.5 text-brand-200" />
              <span className="text-[10px] font-bold text-brand-100 uppercase tracking-[0.2em]">Operations Intelligence</span>
            </div>
            
            <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight mb-8">
              Modern farm management <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-200 to-white">redefined.</span>
            </h1>
            
            <p className="text-brand-100/60 text-lg leading-relaxed font-medium mb-10">
              A premium, all-in-one ecosystem for serious poultry operations. 
              Track flocks, manage feed, and scale your business with data-driven precision.
            </p>

            <div className="grid grid-cols-2 gap-8">
              <div className="flex flex-col gap-2">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-1">
                  <Sprout className="w-5 h-5 text-brand-300" />
                </div>
                <h4 className="text-white font-bold text-sm">Real-time Tracking</h4>
                <p className="text-brand-100/40 text-xs leading-relaxed">Monitor every batch with high-fidelity analytics.</p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-1">
                  <ShieldCheck className="w-5 h-5 text-brand-200" />
                </div>
                <h4 className="text-white font-bold text-sm">Secure Auditing</h4>
                <p className="text-brand-100/40 text-xs leading-relaxed">Full financial visibility and movement logs.</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Footer Tagline */}
        <div className="relative z-10 flex items-center justify-between text-brand-100/30 text-xs font-bold tracking-widest uppercase">
          <span>© {new Date().getFullYear()} Farmexa Corp</span>
          <span className="w-8 h-px bg-white/10 mx-4" />
          <span>v1.0.0 — Enterprise Edition</span>
        </div>
      </div>

      {/* ── Right Panel: Login Interface ────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-neutral-50 relative overflow-hidden">
        {/* Subtle decorative elements for the white side */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-[80px] -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-200/10 rounded-full blur-[80px] -ml-32 -mb-32" />

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="w-full max-w-md relative z-10"
        >
          {/* Mobile Logo Visibility */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-xl text-neutral-900 tracking-tighter">PERP</span>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-black text-neutral-900 tracking-tight">Welcome back</h2>
            <p className="text-sm font-medium text-neutral-400 mt-2">
              Sign in to your dashboard to manage your farm
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="form-label font-bold text-xs uppercase tracking-wider text-neutral-500">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                className="form-input py-3 rounded-xl border-neutral-200 focus:ring-brand-500/20"
                {...register('email')}
              />
              {errors.email && (
                <p className="form-error font-bold">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="form-label font-bold text-xs uppercase tracking-wider text-neutral-500">
                  Password
                </label>
                <a href="#" className="text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors">Forgot password?</a>
              </div>
              <div className="relative group">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="form-input py-3 pr-12 rounded-xl border-neutral-200 focus:ring-brand-500/20"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
              {errors.password && (
                <p className="form-error font-bold">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-4 rounded-xl font-bold text-base shadow-glow group overflow-hidden relative"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin" />
                    Authenticating…
                  </>
                ) : (
                  <>
                    Sign In
                    <LogIn className="w-4.5 h-4.5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
            </button>
          </form>

          <div className="mt-12 flex flex-col items-center gap-6">
            <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-300 uppercase tracking-[0.2em]">
              <div className="w-8 h-px bg-neutral-200" />
              Trusted by 100+ Commercial Farms
              <div className="w-8 h-px bg-neutral-200" />
            </div>
            
            <p className="text-center text-xs font-medium text-neutral-400">
              Need assistance? Contact your <span className="text-neutral-900 font-bold">System Administrator</span>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
