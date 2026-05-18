import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AxiosError } from 'axios'
import { ArrowLeft, Building2, CheckCircle2, ShieldCheck, UserPlus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { BrandMark } from '@/components/BrandMark'
import { authService } from '@/services/authService'
import { ApiError, VendorRegistrationResponse } from '@/types'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'

const registrationSchema = z.object({
  name: z.string().min(2, 'Tenant or farm name is required'),
  business_name: z.string().optional(),
  contact_person: z.string().optional(),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().optional(),
  address: z.string().optional(),
  country: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string().min(8, 'Confirm your password'),
}).refine((values) => values.password === values.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

type RegistrationFormValues = z.infer<typeof registrationSchema>

function getApiErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<ApiError>
  return axiosError.response?.data?.detail ?? fallback
}

export function VendorRegistrationPage() {
  const navigate = useNavigate()
  const { settings } = usePlatformSettings()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registration, setRegistration] = useState<VendorRegistrationResponse | null>(null)
  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      name: '',
      business_name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      country: 'Uganda',
      password: '',
      confirm_password: '',
    },
  })

  const onSubmit = async (values: RegistrationFormValues) => {
    setIsSubmitting(true)
    try {
      const response = await authService.registerVendor(values)
      setRegistration(response)
      toast.success('Workspace registered.')
      navigate('/registration-success', { state: response, replace: true })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Registration failed.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-[1180px] overflow-hidden rounded-[18px] border border-[#eadcc1] bg-white shadow-[0_28px_80px_-48px_rgba(15,23,42,.45)] lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="relative bg-[#030910] p-8 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(212,164,44,.24),transparent_32%)]" />
          <div className="relative">
            <BrandMark light showTagline />
            <div className="mt-12">
              <div className="auth-eyebrow border-[#d4a42c]/30 bg-[#d4a42c]/10 text-[#f3cf78]">14-day free trial</div>
              <h1 className="mt-5 text-4xl font-black leading-tight text-white">Create a clean Farmexa workspace.</h1>
              <p className="mt-4 text-[14px] leading-7 text-white/68">
                Your farm gets tenant isolation, a workspace URL, trial lifecycle automation, and operational modules ready for real records.
              </p>
            </div>
            <div className="mt-8 space-y-3">
              {[
                'Automatic farm workspace',
                `Automatic subdomain on ${settings.tenant_domain_suffix}`,
                'Welcome email and trial expiry tracking',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-[10px] border border-white/10 bg-white/[.06] px-3 py-3 text-[13px] font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-[#d4a42c]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="px-5 py-7 sm:px-8">
          <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <div className="page-eyebrow">Tenant onboarding</div>
              <h1 className="mt-2 text-[2rem] font-black leading-tight text-ink-900">Start your 14-day free trial</h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-6 text-ink-500">
                Register the farm and primary admin. Farmexa automatically creates the tenant, database, DNS, and login URL.
              </p>
            </div>
            <Link to="/login" className="btn-secondary shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Sign in
            </Link>
          </div>

          {registration ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-[18px] border border-emerald-100 bg-emerald-50 px-5 py-4">
                <div className="text-sm font-semibold text-emerald-900">{registration.tenant_name} is ready.</div>
                <div className="mt-2 text-sm text-emerald-800">Admin email: {registration.admin_email}</div>
                <div className="mt-1 text-sm text-emerald-800">Login URL: {registration.login_url}</div>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
                Primary domain: {registration.primary_domain} ({registration.primary_domain_status})
                {registration.fallback_domain ? ` | Fallback: ${registration.fallback_domain}` : ''}
              </div>
            </div>
          ) : null}

          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
            <section className="form-section">
              <div className="mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[var(--brand-primary)]" />
                <div className="form-section-title mb-0">Farm identity</div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="form-label">Farm name</label>
                  <input className="form-input" {...form.register('name')} />
                  {form.formState.errors.name ? <p className="form-error">{form.formState.errors.name.message}</p> : null}
                </div>
                <div>
                  <label className="form-label">Business name</label>
                  <input className="form-input" {...form.register('business_name')} />
                </div>
                <div>
                  <label className="form-label">Country</label>
                  <input className="form-input" {...form.register('country')} />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Address</label>
                  <input className="form-input" {...form.register('address')} />
                </div>
              </div>
            </section>

            <section className="form-section">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--brand-primary)]" />
                <div className="form-section-title mb-0">Administrator access</div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Contact person</label>
                  <input className="form-input" {...form.register('contact_person')} />
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input className="form-input" {...form.register('phone')} />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" {...form.register('email')} />
                  {form.formState.errors.email ? <p className="form-error">{form.formState.errors.email.message}</p> : null}
                </div>
                <div>
                  <label className="form-label">Admin password</label>
                  <input className="form-input" type="password" {...form.register('password')} />
                  {form.formState.errors.password ? <p className="form-error">{form.formState.errors.password.message}</p> : null}
                </div>
                <div>
                  <label className="form-label">Confirm password</label>
                  <input className="form-input" type="password" {...form.register('confirm_password')} />
                  {form.formState.errors.confirm_password ? <p className="form-error">{form.formState.errors.confirm_password.message}</p> : null}
                </div>
              </div>
            </section>

            <div>
              <button type="submit" disabled={isSubmitting} className="btn-primary btn-lg w-full">
                <UserPlus className="h-4.5 w-4.5" />
                {isSubmitting ? 'Creating workspace...' : 'Create Farmexa Workspace'}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  )
}
