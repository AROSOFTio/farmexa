import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AxiosError } from 'axios'
import { ArrowLeft, Building2, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { BrandMark } from '@/components/BrandMark'
import { authService } from '@/services/authService'
import { ApiError, VendorRegistrationResponse } from '@/types'

const registrationSchema = z.object({
  name: z.string().min(2, 'Tenant or farm name is required'),
  business_name: z.string().optional(),
  contact_person: z.string().optional(),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().optional(),
  address: z.string().optional(),
  country: z.string().optional(),
  domain: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type RegistrationFormValues = z.infer<typeof registrationSchema>

function getApiErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<ApiError>
  return axiosError.response?.data?.detail ?? fallback
}

export function VendorRegistrationPage() {
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
      domain: '',
      password: '',
    },
  })

  const onSubmit = async (values: RegistrationFormValues) => {
    setIsSubmitting(true)
    try {
      const response = await authService.registerVendor(values)
      setRegistration(response)
      toast.success('Workspace registered.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Registration failed.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4 py-10">
      <div className="w-full max-w-[760px]">
        <div className="mb-7 flex justify-center">
          <BrandMark />
        </div>

        <div className="card p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-[1.8rem] font-semibold text-ink-900">Register vendor workspace</h1>
              <p className="text-[14px] text-ink-500">
                New tenants can only register from the main Farmexa domain. Their staff will sign in on the assigned workspace domain after setup.
              </p>
            </div>
            <Link to="/login" className="btn-secondary">
              <ArrowLeft className="h-4 w-4" />
              Back
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

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="form-label">Tenant / Farm Name</label>
              <input className="form-input" {...form.register('name')} />
              {form.formState.errors.name ? <p className="form-error">{form.formState.errors.name.message}</p> : null}
            </div>
            <div>
              <label className="form-label">Business Name</label>
              <input className="form-input" {...form.register('business_name')} />
            </div>
            <div>
              <label className="form-label">Contact Person</label>
              <input className="form-input" {...form.register('contact_person')} />
            </div>
            <div>
              <label className="form-label">Admin Email</label>
              <input className="form-input" type="email" {...form.register('email')} />
              {form.formState.errors.email ? <p className="form-error">{form.formState.errors.email.message}</p> : null}
            </div>
            <div>
              <label className="form-label">Phone</label>
              <input className="form-input" {...form.register('phone')} />
            </div>
            <div>
              <label className="form-label">Address</label>
              <input className="form-input" {...form.register('address')} />
            </div>
            <div>
              <label className="form-label">Country</label>
              <input className="form-input" {...form.register('country')} />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Preferred domain</label>
              <input className="form-input" placeholder="farm.example.com" {...form.register('domain')} />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Admin password</label>
              <input className="form-input" type="password" {...form.register('password')} />
              {form.formState.errors.password ? <p className="form-error">{form.formState.errors.password.message}</p> : null}
            </div>
            <div className="md:col-span-2 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <Building2 className="h-4 w-4" />
                Domain handling
              </div>
              <p className="mt-2 leading-6">
                Custom domains remain pending until DNS and SSL are activated. Farmexa fallback access stays available on the platform subdomain.
              </p>
            </div>
            <div className="md:col-span-2">
              <button type="submit" disabled={isSubmitting} className="btn-primary btn-lg w-full">
                <UserPlus className="h-4.5 w-4.5" />
                {isSubmitting ? 'Registering...' : 'Register workspace'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
