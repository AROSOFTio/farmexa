import { Check, Crown, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { RegistrationWizardModal } from '@/features/auth/RegistrationWizardModal'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'
import { SEO } from '@/components/SEO'
import { BrandMark } from '@/components/BrandMark'
import { ThemeToggle } from '@/components/ThemeControls'

const plans = [
  { name: 'Trial', price: 'Free', note: '14 days', features: ['All core modules', 'Tenant workspace', 'Email onboarding', 'No installation'] },
  { name: 'Basic', price: 'UGX 100,000', note: 'per month', features: ['Farm setup', 'Inventory', 'Reports', 'User roles'] },
  { name: 'Standard', price: 'UGX 250,000', note: 'per month', features: ['Feed mill', 'Farm operations', 'GRN/GIV transfers', 'Compliance alerts'] },
  { name: 'Premium', price: 'UGX 500,000', note: 'per month', features: ['Slaughter', 'POS cashier', 'Finance reports', 'Priority support'] },
]

export function PricingPage() {
  const { settings } = usePlatformSettings()
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false)

  return (
    <main className="min-h-screen bg-[var(--app-bg)]">
      <SEO
        title="Farmexa Pricing | Poultry ERP Plans"
        description="Review Farmexa pricing and start a 14-day trial for poultry ERP modules including feed, flocks, inventory, slaughter, sales, finance, compliance, and reports."
        canonicalPath="/pricing"
      />
      <header className="border-b border-[var(--border-subtle)] bg-[var(--topbar-bg)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" aria-label="Farmexa home"><BrandMark /></Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link className="btn-secondary" to="/login">Sign in</Link>
          </div>
        </div>
      </header>
      <section className="bg-[var(--brand-secondary)] px-4 py-14 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="inline-flex items-center gap-2 rounded-[7px] border border-brand-400/40 bg-brand-400/10 px-3 py-1.5 text-sm font-semibold text-brand-100">
            <Crown className="h-4 w-4" />
            {settings.system_name} plans
          </div>
          <h1 className="mt-6 max-w-3xl text-[2.25rem] font-bold leading-tight tracking-tight text-white md:text-[3.35rem]">Start with a 14-day trial, then scale by modules.</h1>
          <p className="mt-5 max-w-2xl text-[15.5px] leading-8 text-white/70">Choose the package that matches your poultry operation. Your workspace, records, and tenant domain stay active as you upgrade.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={() => setIsRegistrationOpen(true)}>Start free trial</button>
            <Link className="btn-secondary bg-white text-ink-900 hover:bg-brand-50" to="/login">Sign in</Link>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-12 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <article key={plan.name} className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-ink-900">{plan.name}</h2>
              <ShieldCheck className="h-5 w-5 text-brand-700" />
            </div>
            <div className="mt-5 text-3xl font-bold text-ink-950">{plan.price}</div>
            <div className="text-sm font-semibold text-ink-500">{plan.note}</div>
            <ul className="mt-6 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-ink-700">
                  <Check className="h-4 w-4 text-brand-700" />
                  {feature}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
      <footer className="border-t border-neutral-200 px-4 py-8 text-center text-sm text-ink-500">
        {settings.footer_text} · Support: {settings.support_email}
      </footer>
      <RegistrationWizardModal isOpen={isRegistrationOpen} onClose={() => setIsRegistrationOpen(false)} />
    </main>
  )
}
