import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AxiosError } from 'axios'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Modal } from '@/components/Modal'
import { authService } from '@/services/authService'
import { ApiError, VendorRegistrationResponse } from '@/types'

const registrationSchema = z.object({
  name: z.string().min(2, 'Farm name is required'),
  business_name: z.string().optional(),
  farm_type: z.string().min(2, 'Farm focus is required'),
  country: z.string().min(2, 'Country is required'),
  address: z.string().min(2, 'District or location is required'),
  timezone: z.string().optional(),
  contact_person: z.string().min(2, 'Owner name is required'),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().min(5, 'Phone number is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string().min(8, 'Confirm your password'),
  accepted_terms: z.boolean().refine((value) => value, 'Confirm the trial terms to continue'),
}).refine((values) => values.password === values.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

type RegistrationFormValues = z.infer<typeof registrationSchema>

const steps = [
  {
    title: 'Farm Information',
    fields: ['name', 'farm_type', 'country', 'address', 'timezone'] as const,
  },
  {
    title: 'Owner Information',
    fields: ['contact_person', 'email', 'phone', 'business_name'] as const,
  },
  {
    title: 'Admin Account',
    fields: ['password', 'confirm_password'] as const,
  },
  {
    title: 'Trial Confirmation',
    fields: ['accepted_terms'] as const,
  },
]

function getApiErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<ApiError>
  return axiosError.response?.data?.detail ?? fallback
}

interface RegistrationWizardModalProps {
  isOpen: boolean
  onClose: () => void
}

export function RegistrationWizardModal({ isOpen, onClose }: RegistrationWizardModalProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registration, setRegistration] = useState<VendorRegistrationResponse | null>(null)
  const currentStep = steps[stepIndex]
  const progress = useMemo(() => Math.round(((stepIndex + 1) / steps.length) * 100), [stepIndex])
  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      name: '',
      business_name: '',
      farm_type: 'Poultry',
      country: 'Uganda',
      address: '',
      timezone: 'Africa/Kampala',
      contact_person: '',
      email: '',
      phone: '',
      password: '',
      confirm_password: '',
      accepted_terms: false,
    },
  })

  const closeModal = () => {
    if (isSubmitting) return
    onClose()
  }

  const goNext = async () => {
    const isValid = await form.trigger([...currentStep.fields])
    if (!isValid) return
    setStepIndex((value) => Math.min(value + 1, steps.length - 1))
  }

  const goBack = () => {
    setStepIndex((value) => Math.max(value - 1, 0))
  }

  const onSubmit = async (values: RegistrationFormValues) => {
    setIsSubmitting(true)
    try {
      const response = await authService.registerTenant({
        name: values.name,
        business_name: values.business_name,
        contact_person: values.contact_person,
        email: values.email,
        phone: values.phone,
        address: values.address,
        country: values.country,
        password: values.password,
        confirm_password: values.confirm_password,
      })
      setRegistration(response)
      toast.success('Farmexa workspace registered.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Registration failed.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title={registration ? 'Your Farmexa trial is ready' : 'Start your 14-day Farmexa trial'}
      description={registration ? 'Use the tenant workspace link below to sign in as the farm administrator.' : `Step ${stepIndex + 1} of ${steps.length}: ${currentStep.title}`}
    >
      {registration ? (
        <div className="space-y-5">
          <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
              <CheckCircle2 className="h-4 w-4" />
              {registration.tenant_name} is provisioned
            </div>
            <div className="mt-3 space-y-1 text-sm text-emerald-800">
              <div>Admin email: {registration.admin_email}</div>
              <div>Tenant domain: {registration.primary_domain}</div>
              <div>Trial ends: {registration.trial_expiry_date ?? '14 days after activation'}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <a className="btn-primary btn-lg" href={registration.login_url}>Sign in to workspace</a>
            <button type="button" className="btn-secondary btn-lg" onClick={closeModal}>Close</button>
          </div>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between text-[12px] font-bold text-slate-600">
              <span>Step {stepIndex + 1} of {steps.length}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-[#d6a62e] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {stepIndex === 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="form-label">Farm name</label>
                <input className="form-input" {...form.register('name')} />
                {form.formState.errors.name ? <p className="form-error">{form.formState.errors.name.message}</p> : null}
              </div>
              <div>
                <label className="form-label">Farm focus</label>
                <select className="form-input" {...form.register('farm_type')}>
                  <option>Poultry</option>
                  <option>Layers</option>
                  <option>Broilers</option>
                  <option>Mixed poultry</option>
                </select>
              </div>
              <div>
                <label className="form-label">Country</label>
                <input className="form-input" {...form.register('country')} />
                {form.formState.errors.country ? <p className="form-error">{form.formState.errors.country.message}</p> : null}
              </div>
              <div>
                <label className="form-label">District / location</label>
                <input className="form-input" {...form.register('address')} />
                {form.formState.errors.address ? <p className="form-error">{form.formState.errors.address.message}</p> : null}
              </div>
              <div>
                <label className="form-label">Timezone</label>
                <input className="form-input" {...form.register('timezone')} />
              </div>
            </div>
          ) : null}

          {stepIndex === 1 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">Owner / full name</label>
                <input className="form-input" {...form.register('contact_person')} />
                {form.formState.errors.contact_person ? <p className="form-error">{form.formState.errors.contact_person.message}</p> : null}
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input className="form-input" {...form.register('phone')} />
                {form.formState.errors.phone ? <p className="form-error">{form.formState.errors.phone.message}</p> : null}
              </div>
              <div>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" {...form.register('email')} />
                {form.formState.errors.email ? <p className="form-error">{form.formState.errors.email.message}</p> : null}
              </div>
              <div>
                <label className="form-label">Business name</label>
                <input className="form-input" {...form.register('business_name')} />
              </div>
            </div>
          ) : null}

          {stepIndex === 2 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2 rounded-[8px] border border-[#ead9ac] bg-[#fffaf0] px-4 py-3 text-[13px] leading-6 text-slate-700">
                Your email address will be used as the administrator login. Farmexa generates your tenant subdomain automatically from the farm name.
              </div>
              <div>
                <label className="form-label">Password</label>
                <input className="form-input" type="password" {...form.register('password')} />
                {form.formState.errors.password ? <p className="form-error">{form.formState.errors.password.message}</p> : null}
              </div>
              <div>
                <label className="form-label">Confirm password</label>
                <input className="form-input" type="password" {...form.register('confirm_password')} />
                {form.formState.errors.confirm_password ? <p className="form-error">{form.formState.errors.confirm_password.message}</p> : null}
              </div>
            </div>
          ) : null}

          {stepIndex === 3 ? (
            <div className="space-y-4">
              <div className="rounded-[8px] border border-[#ead9ac] bg-[#fffaf0] p-4 text-[14px] leading-7 text-slate-700">
                You are starting a 14-day full-feature Farmexa trial. All modules are enabled during the trial and the workspace is locked to the upgrade path after expiry unless a plan is activated.
              </div>
              <label className="flex items-start gap-3 rounded-[8px] border border-slate-200 p-4 text-sm font-semibold text-slate-700">
                <input type="checkbox" className="mt-1" {...form.register('accepted_terms')} />
                I confirm that I want to create a Farmexa trial workspace and accept the trial terms.
              </label>
              {form.formState.errors.accepted_terms ? <p className="form-error">{form.formState.errors.accepted_terms.message}</p> : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <button type="button" className="btn-secondary" onClick={stepIndex === 0 ? closeModal : goBack} disabled={isSubmitting}>
              {stepIndex === 0 ? 'Cancel' : 'Back'}
            </button>
            {stepIndex < steps.length - 1 ? (
              <button type="button" className="btn-primary" onClick={goNext}>Next</button>
            ) : (
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? 'Provisioning...' : 'Create trial workspace'}
              </button>
            )}
          </div>
          <div className="text-center text-[13px] text-slate-500">
            Already registered? <Link to="/login" className="font-bold text-slate-800">Sign in</Link>
          </div>
        </form>
      )}
    </Modal>
  )
}
