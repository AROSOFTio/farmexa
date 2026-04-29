import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AxiosError } from 'axios'
import { Building2, Eye, EyeOff, LogIn } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { BrandMark } from '@/components/BrandMark'
import { Modal } from '@/components/Modal'
import { useAuth } from '@/features/auth/AuthContext'
import { authService } from '@/services/authService'
import { ApiError, VendorRegistrationResponse } from '@/types'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

const vendorRegistrationSchema = z
  .object({
    name: z.string().min(2, 'Farm or company name is required'),
    business_name: z.string().optional(),
    contact_person: z.string().min(2, 'Contact person is required'),
    email: z.string().email('Enter a valid work email'),
    phone: z.string().optional(),
    domain: z.string().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string().min(8, 'Confirm the password'),
  })
  .refine((values) => values.password === values.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

type LoginFormValues = z.infer<typeof loginSchema>
type VendorRegistrationFormValues = z.infer<typeof vendorRegistrationSchema>

function getApiErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<ApiError>
  return axiosError.response?.data?.detail ?? fallback
}

export function LoginPage() {
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [showVendorPassword, setShowVendorPassword] = useState(false)
  const [showVendorConfirmPassword, setShowVendorConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false)
  const [registrationResult, setRegistrationResult] = useState<VendorRegistrationResponse | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const {
    register: registerVendor,
    handleSubmit: handleSubmitVendor,
    reset: resetVendorForm,
    formState: { errors: vendorErrors },
  } = useForm<VendorRegistrationFormValues>({
    resolver: zodResolver(vendorRegistrationSchema),
    defaultValues: {
      business_name: '',
      phone: '',
      domain: '',
    },
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

  const onRegisterVendor = async (values: VendorRegistrationFormValues) => {
    setIsRegistering(true)
    try {
      const result = await authService.registerVendor({
        name: values.name,
        business_name: values.business_name || undefined,
        contact_person: values.contact_person,
        email: values.email,
        phone: values.phone || undefined,
        domain: values.domain || undefined,
        password: values.password,
      })
      setRegistrationResult(result)
      setValue('email', result.admin_email)
      setValue('password', values.password)
      setShowPassword(false)
      setIsVendorModalOpen(false)
      resetVendorForm()
      toast.success('Vendor workspace created. Sign in with the account you just set up.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Vendor registration failed.'))
    } finally {
      setIsRegistering(false)
    }
  }

  const closeVendorModal = () => {
    setIsVendorModalOpen(false)
    setShowVendorPassword(false)
    setShowVendorConfirmPassword(false)
    resetVendorForm()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="w-full max-w-[460px]"
      >
        <div className="mb-7 flex justify-center">
          <BrandMark />
        </div>

        <div className="card p-6 sm:p-8">
          <div className="space-y-1">
            <h1 className="text-[1.65rem] font-semibold text-ink-900">Sign in</h1>
            <p className="text-[13px] text-ink-500">Access your Farmexa workspace with your staff or tenant administrator account.</p>
          </div>

          {registrationResult ? (
            <div className="mt-5 rounded-[14px] border border-[rgba(36,179,90,0.18)] bg-[rgba(36,179,90,0.06)] px-4 py-4 text-[13px] text-[var(--text-default)]">
              <div className="font-semibold text-[var(--text-strong)]">{registrationResult.tenant_name} is ready.</div>
              <div className="mt-1">Sign in with <span className="font-semibold">{registrationResult.admin_email}</span>.</div>
              <div className="mt-2">
                Workspace login host: <span className="font-semibold">{registrationResult.login_host}</span>
              </div>
              {registrationResult.custom_domain ? (
                <div className="mt-2">
                  Requested domain <span className="font-semibold">{registrationResult.custom_domain}</span> is currently{' '}
                  <span className="font-semibold">{registrationResult.custom_domain_status?.replace(/_/g, ' ')}</span>.
                  {registrationResult.fallback_domain ? ` Use ${registrationResult.fallback_domain} until DNS and SSL are active.` : ''}
                </div>
              ) : null}
              <div className="mt-3">
                <a href={registrationResult.login_url} className="btn-secondary inline-flex">
                  Open workspace login
                </a>
              </div>
            </div>
          ) : null}

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
          </form>

          <div className="mt-6 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-4">
            <div className="text-[14px] font-semibold text-[var(--text-strong)]">New vendor workspace</div>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              Register your poultry business, create the tenant administrator account, and start with a clean workspace.
            </p>
            <button type="button" onClick={() => setIsVendorModalOpen(true)} className="btn-secondary mt-4 w-full">
              <Building2 className="h-4.5 w-4.5 text-[var(--brand-primary)]" />
              Register as vendor
            </button>
          </div>
        </div>
      </motion.div>

      <Modal
        isOpen={isVendorModalOpen}
        onClose={closeVendorModal}
        title="Register vendor workspace"
        description="Create a new Farmexa tenant and set the first tenant administrator password."
      >
        <form onSubmit={handleSubmitVendor(onRegisterVendor)} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="form-label">Farm / company name</label>
            <input className="form-input" {...registerVendor('name')} />
            {vendorErrors.name ? <p className="form-error">{vendorErrors.name.message}</p> : null}
          </div>

          <div>
            <label className="form-label">Business name</label>
            <input className="form-input" {...registerVendor('business_name')} />
          </div>

          <div>
            <label className="form-label">Contact person</label>
            <input className="form-input" {...registerVendor('contact_person')} />
            {vendorErrors.contact_person ? <p className="form-error">{vendorErrors.contact_person.message}</p> : null}
          </div>

          <div>
            <label className="form-label">Work email</label>
            <input type="email" className="form-input" autoComplete="email" {...registerVendor('email')} />
            {vendorErrors.email ? <p className="form-error">{vendorErrors.email.message}</p> : null}
          </div>

          <div>
            <label className="form-label">Phone</label>
            <input className="form-input" {...registerVendor('phone')} />
          </div>

          <div className="md:col-span-2">
            <label className="form-label">Preferred domain or subdomain</label>
            <input className="form-input" placeholder="farm.example.com" {...registerVendor('domain')} />
            <p className="form-hint">
              Leave this blank if you want Farmexa to assign an immediate workspace host. Custom domains stay pending until DNS and SSL are activated.
            </p>
          </div>

          <div>
            <label className="form-label">Password</label>
            <div className="relative">
              <input
                type={showVendorPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="form-input pr-12"
                {...registerVendor('password')}
              />
              <button
                type="button"
                onClick={() => setShowVendorPassword((current) => !current)}
                className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-2xl text-ink-400 transition-colors hover:bg-neutral-100 hover:text-ink-700"
                aria-label={showVendorPassword ? 'Hide password' : 'Show password'}
              >
                {showVendorPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
            {vendorErrors.password ? <p className="form-error">{vendorErrors.password.message}</p> : null}
          </div>

          <div>
            <label className="form-label">Confirm password</label>
            <div className="relative">
              <input
                type={showVendorConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="form-input pr-12"
                {...registerVendor('confirm_password')}
              />
              <button
                type="button"
                onClick={() => setShowVendorConfirmPassword((current) => !current)}
                className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-2xl text-ink-400 transition-colors hover:bg-neutral-100 hover:text-ink-700"
                aria-label={showVendorConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showVendorConfirmPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
            {vendorErrors.confirm_password ? <p className="form-error">{vendorErrors.confirm_password.message}</p> : null}
          </div>

          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={closeVendorModal}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isRegistering}>
              {isRegistering ? 'Creating workspace...' : 'Create vendor workspace'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
