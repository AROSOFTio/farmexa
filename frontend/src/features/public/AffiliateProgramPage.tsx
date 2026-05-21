import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, Link as LinkIcon, Megaphone, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { InstallPrompt } from '@/components/InstallPrompt'
import { Modal } from '@/components/Modal'
import { SEO } from '@/components/SEO'
import { BrandMark } from '@/components/BrandMark'
import { ThemeToggle } from '@/components/ThemeControls'
import { getErrorMessage } from '@/lib/errors'
import api from '@/services/api'

const schema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().min(5, 'Phone is required'),
  country: z.string().min(2, 'Country is required'),
  organization: z.string().optional(),
  website_url: z.string().optional(),
  accepted_terms: z.boolean().refine(Boolean, 'Accept the affiliate terms to continue'),
})

type AffiliateForm = z.infer<typeof schema>
const processCards = [
  { icon: Megaphone, title: 'Share Farmexa', text: 'Use your referral link in conversations, campaigns, websites, and farm networks.' },
  { icon: Users, title: 'Farms Register', text: 'Farmers start a 14-day trial through your link and get their own tenant workspace.' },
  { icon: LinkIcon, title: 'Earn Commission', text: 'When a referred farm becomes a paying subscriber, Farmexa records a first-payment commission.' },
]

export function AffiliateProgramPage() {
  const [isOpen, setIsOpen] = useState(false)
  const [successCode, setSuccessCode] = useState<string | null>(null)
  const form = useForm<AffiliateForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      country: '',
      organization: '',
      website_url: '',
      accepted_terms: false,
    },
  })

  const submit = async (values: AffiliateForm) => {
    try {
      const { data } = await api.post('/affiliates/register', values)
      setSuccessCode(data.affiliate.referral_code)
      toast.success('Affiliate application received.')
      form.reset()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Affiliate registration failed.'))
    }
  }

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Farmexa',
      url: 'https://farmexa.arosoft.io',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How does the Farmexa affiliate program work?',
          acceptedAnswer: { '@type': 'Answer', text: 'Approved affiliates share a referral link. When a referred farm becomes a paying subscriber, Farmexa records a first-payment commission using the configured plan rate.' },
        },
        {
          '@type': 'Question',
          name: 'What is the default commission?',
          acceptedAnswer: { '@type': 'Answer', text: 'The default commission is 20% per subscription tier unless a Farmexa platform administrator adjusts the rate.' },
        },
      ],
    },
  ]

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-ink-900">
      <SEO
        title="Farmexa Affiliate Program | Earn by Referring Poultry Farms"
        description="Join the Farmexa affiliate program and refer poultry farms to a cloud ERP for feed, flock, inventory, sales, finance, and compliance management."
        canonicalPath="/affiliate-program"
        jsonLd={jsonLd}
      />
      <header className="border-b border-[var(--border-subtle)] bg-[var(--topbar-bg)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" aria-label="Farmexa home"><BrandMark /></Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button type="button" className="btn-primary" onClick={() => setIsOpen(true)}>Become an Affiliate</button>
          </div>
        </div>
      </header>

      <section className="bg-[var(--brand-secondary)] px-4 py-14 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="page-eyebrow text-brand-200">Farmexa Affiliate Program</div>
          <h1 className="mt-4 max-w-3xl text-[2.25rem] font-bold leading-tight text-white md:text-[3.35rem]">Refer farms to software that helps them operate clearly.</h1>
          <p className="mt-5 max-w-2xl text-[15.5px] leading-8 text-white/72">
            Farmexa affiliates introduce poultry farms, consultants, software resellers, and agricultural networks to a practical farm ERP. Approved affiliates earn up to 20% by default unless plan rates are adjusted by the platform team.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" className="btn-primary btn-lg" onClick={() => setIsOpen(true)}>Become an Affiliate</button>
            <Link to="/" className="btn-secondary btn-lg border-white/20 bg-white/10 text-white hover:bg-white/15">View Farmexa</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-12 md:grid-cols-3">
        {processCards.map(({ icon: Icon, title, text }) => (
          <article key={title} className="card p-5">
            <Icon className="h-6 w-6 text-brand-700" />
            <h2 className="mt-4 text-lg font-bold">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-ink-600">{text}</p>
          </article>
        ))}
      </section>

      <section className="border-y border-black/10 bg-white px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold">Helpful facts for affiliates</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              ['Who can join?', 'Agriculture consultants, farm advisors, software resellers, poultry networks, and creators who serve farm owners.'],
              ['Default commission', 'Farmexa seeds each subscription tier with a 20% commission rule. Developer admins can adjust rates by tier.'],
              ['Referral tracking', 'Referral codes are stored safely in the browser for 30 days and attached to tenant registration.'],
              ['Payout rule', 'This implementation records first successful subscription payment commissions. Recurring commissions can be enabled per plan later.'],
            ].map(([question, answer]) => (
              <div key={question} className="rounded-[8px] border border-neutral-200 p-5">
                <div className="font-semibold">{question}</div>
                <p className="mt-2 text-sm leading-7 text-ink-600">{answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Become a Farmexa affiliate" description="Applications are reviewed before referrals can earn commissions.">
        {successCode ? (
          <div className="space-y-4">
            <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                Application received
              </div>
              <p className="mt-2 text-sm leading-7">Your referral code is {successCode}. It starts earning after admin approval.</p>
            </div>
            <button type="button" className="btn-primary" onClick={() => setIsOpen(false)}>Close</button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">Full name</label>
                <input className="form-input" {...form.register('full_name')} />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" {...form.register('email')} />
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input className="form-input" {...form.register('phone')} />
              </div>
              <div>
                <label className="form-label">Country</label>
                <input className="form-input" {...form.register('country')} />
              </div>
              <div>
                <label className="form-label">Organization</label>
                <input className="form-input" {...form.register('organization')} />
              </div>
              <div>
                <label className="form-label">Website or social media</label>
                <input className="form-input" {...form.register('website_url')} />
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-[8px] border border-neutral-200 p-4 text-sm font-semibold text-ink-700">
              <input type="checkbox" className="mt-1" {...form.register('accepted_terms')} />
              I agree to ethical referral marketing and understand that commissions require affiliate approval and valid paid conversions.
            </label>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setIsOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Submit application</button>
            </div>
          </form>
        )}
      </Modal>
      <InstallPrompt />
    </main>
  )
}
