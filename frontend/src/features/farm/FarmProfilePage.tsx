import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Globe2, Mail, Phone, Save, UserRound } from 'lucide-react'
import { toast } from 'sonner'

import api from '@/services/api'
import { useAuth } from '@/features/auth/AuthContext'

interface TenantProfile {
  id: number
  name: string
  slug: string
  business_name?: string | null
  contact_person?: string | null
  email: string
  phone?: string | null
  address?: string | null
  country?: string | null
  plan: string
  subscription_status?: string | null
  primary_domain?: string | null
  trial_started_at?: string | null
  trial_ends_at?: string | null
}

const profileSchema = z.object({
  name: z.string().min(2, 'Farm name is required'),
  business_name: z.string().optional(),
  contact_person: z.string().optional(),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  country: z.string().optional(),
})

type ProfileFormValues = z.infer<typeof profileSchema>

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function FarmProfilePage() {
  const queryClient = useQueryClient()
  const { refetchMe } = useAuth()
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      business_name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      country: '',
    },
  })

  const { data: profile, isLoading } = useQuery({
    queryKey: ['tenant-profile'],
    queryFn: () => api.get<TenantProfile>('/auth/tenant-profile').then((response) => response.data),
  })

  useEffect(() => {
    if (!profile) return
    form.reset({
      name: profile.name,
      business_name: profile.business_name ?? '',
      contact_person: profile.contact_person ?? '',
      email: profile.email,
      phone: profile.phone ?? '',
      address: profile.address ?? '',
      country: profile.country ?? '',
    })
  }, [form, profile])

  const updateProfile = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      api.put<TenantProfile>('/auth/tenant-profile', {
        name: values.name,
        business_name: values.business_name || null,
        contact_person: values.contact_person || null,
        email: values.email,
        phone: values.phone || null,
        address: values.address || null,
        country: values.country || null,
      }),
    onSuccess: async () => {
      toast.success('Farm profile updated.')
      queryClient.invalidateQueries({ queryKey: ['tenant-profile'] })
      await refetchMe()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to update farm profile.')
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-[12px] border border-[#ecd8a9] bg-white" />
        <div className="h-96 animate-pulse rounded-[12px] border border-[#ecd8a9] bg-white" />
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-5">
      <div className="section-header">
        <div>
          <div className="page-eyebrow">Farm Setup</div>
          <h1 className="section-title">Farm Profile</h1>
          <p className="section-subtitle">Maintain the tenant farm identity used across workspace, emails, billing, and reports.</p>
        </div>
        <button className="btn-primary" type="button" onClick={form.handleSubmit((values) => updateProfile.mutate(values))} disabled={updateProfile.isPending}>
          <Save className="h-4 w-4" />
          {updateProfile.isPending ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Workspace</div>
          <div className="metric-value text-[1.3rem]">{profile?.slug}</div>
          <div className="metric-note">{profile?.primary_domain ?? 'No active domain yet'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Plan</div>
          <div className="metric-value text-[1.3rem] capitalize">{profile?.plan ?? '-'}</div>
          <div className="metric-note">{profile?.subscription_status ?? 'No subscription status'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Trial Started</div>
          <div className="metric-value text-[1.1rem]">{formatDate(profile?.trial_started_at)}</div>
          <div className="metric-note">From tenant registration</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Trial Ends</div>
          <div className="metric-value text-[1.1rem]">{formatDate(profile?.trial_ends_at)}</div>
          <div className="metric-note">Upgrade before expiry</div>
        </div>
      </section>

      <section className="card p-6">
        <form className="grid gap-5 xl:grid-cols-[1fr_0.9fr]" onSubmit={form.handleSubmit((values) => updateProfile.mutate(values))}>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">Farm name</label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b98512]" />
                  <input className="form-input pl-9" {...form.register('name')} />
                </div>
                {form.formState.errors.name ? <p className="form-error">{form.formState.errors.name.message}</p> : null}
              </div>
              <div>
                <label className="form-label">Registered business name</label>
                <input className="form-input" {...form.register('business_name')} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">Contact person</label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b98512]" />
                  <input className="form-input pl-9" {...form.register('contact_person')} />
                </div>
              </div>
              <div>
                <label className="form-label">Country</label>
                <div className="relative">
                  <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b98512]" />
                  <input className="form-input pl-9" {...form.register('country')} />
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">Support / admin email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b98512]" />
                  <input className="form-input pl-9" type="email" {...form.register('email')} />
                </div>
                {form.formState.errors.email ? <p className="form-error">{form.formState.errors.email.message}</p> : null}
              </div>
              <div>
                <label className="form-label">Phone</label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b98512]" />
                  <input className="form-input pl-9" {...form.register('phone')} />
                </div>
              </div>
            </div>
            <div>
              <label className="form-label">Address / location notes</label>
              <textarea className="form-input min-h-[120px]" {...form.register('address')} />
            </div>
          </div>

          <aside className="rounded-[12px] border border-[#ecd8a9] bg-[#fffaf0] p-5">
            <h2 className="text-[16px] font-extrabold text-[#111827]">Workspace Identity</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-[#ecd8a9] pb-3">
                <span className="font-semibold text-slate-500">Slug</span>
                <span className="font-bold text-[#111827]">{profile?.slug}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-[#ecd8a9] pb-3">
                <span className="font-semibold text-slate-500">Domain</span>
                <span className="font-bold text-[#111827]">{profile?.primary_domain ?? '-'}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-[#ecd8a9] pb-3">
                <span className="font-semibold text-slate-500">Subscription</span>
                <span className="font-bold capitalize text-[#111827]">{profile?.subscription_status ?? '-'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="font-semibold text-slate-500">Tenant ID</span>
                <span className="font-bold text-[#111827]">#{profile?.id}</span>
              </div>
            </div>
          </aside>
        </form>
      </section>
    </div>
  )
}
