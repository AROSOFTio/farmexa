import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import {
  BadgeCheck,
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  CreditCard,
  FileWarning,
  LockKeyhole,
  PackageCheck,
  Scale,
  Scissors,
  ShoppingCart,
  Wheat,
} from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { InstallPrompt } from '@/components/InstallPrompt'
import { SEO } from '@/components/SEO'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'
import { RegistrationWizardModal } from '@/features/auth/RegistrationWizardModal'

const features = [
  ['Feed Mill Management', Wheat],
  ['Farm House Management', Building2],
  ['Flock / Batch Tracking', BadgeCheck],
  ['Feed Formulation by Percentage', Scale],
  ['GRN / GIV Stock Transfers', PackageCheck],
  ['Mortality and Vaccination Reports', ClipboardCheck],
  ['Slaughter and Meat Processing', Scissors],
  ['Blast Room and Cold Room Stock', Boxes],
  ['POS / Cashier Sales by KG', ShoppingCart],
  ['Finance and Profit Reports', BarChart3],
  ['Compliance Document Expiry Alerts', FileWarning],
  ['Multi-user Roles and Permissions', LockKeyhole],
] as const

const modules = ['Feed Mill', 'Farm Operations', 'Inventory and Transfers', 'Slaughter', 'Sales and POS', 'Finance', 'Compliance', 'Reports', 'Users and Roles']

const reasons = [
  'Built for poultry operations',
  'Tracks stock from feed mill to sales',
  'Supports kilograms and numbers',
  'Gives real-time reports',
  'Reduces losses and wastage',
  'Supports cloud access',
  'Secure multi-tenant SaaS workspace',
  'Free 14-day trial',
]

const reveal = {
  hidden: { opacity: 0, y: 34 },
  visible: { opacity: 1, y: 0 },
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={reveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.22 }}
      transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function PublicHomePage() {
  const { settings } = usePlatformSettings()
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false)
  const workspaceExample = `ngali.${settings.tenant_domain_suffix}`
  const openRegistration = () => setIsRegistrationOpen(true)

  return (
    <div className="min-h-screen bg-[#fbfaf7] text-[#151515]">
      <SEO
        title="Farmexa ERP | Poultry Farm Management SaaS"
        description="Farmexa is a cloud poultry ERP for feed mill, flocks, inventory, slaughter, sales, finance, compliance, reports, and secure tenant workspaces."
        canonicalPath="/"
        jsonLd={[
          { '@context': 'https://schema.org', '@type': 'Organization', name: 'Farmexa', url: 'https://farmexa.arosoft.io' },
          { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Farmexa', applicationCategory: 'BusinessApplication', operatingSystem: 'Web', url: 'https://farmexa.arosoft.io' },
        ]}
      />
      <header className="sticky top-0 z-30 border-b border-black/10 bg-white/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-3 lg:px-6">
          <BrandMark />
          <nav className="hidden items-center gap-6 text-[13px] font-semibold text-slate-700 lg:flex">
            <a href="#home">Home</a>
            <a href="#features">Features</a>
            <a href="#modules">Modules</a>
            <Link to="/pricing">Pricing</Link>
            <Link to="/affiliate-program">Affiliates</Link>
            <a href="#why">Why {settings.system_name}</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-secondary">Sign In</Link>
            <button type="button" onClick={openRegistration} className="btn-primary">Start Free Trial</button>
          </div>
        </div>
      </header>

      <main id="home">
        <section className="relative overflow-hidden border-b border-black/10 bg-[#0b1018] text-white">
          <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.18)_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1fr_0.95fr] lg:px-6 lg:py-20">
            <motion.div
              className="relative z-10 flex flex-col justify-center"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                className="mb-4 inline-flex w-fit rounded-full border border-[#d6a62e]/40 bg-[#d6a62e]/12 px-3 py-1 text-[12px] font-semibold text-[#f0cf70]"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.12, duration: 0.45 }}
              >
                14-day free poultry ERP trial
              </motion.div>
              <h1 className="max-w-3xl text-[2.7rem] font-bold leading-[1.05] text-white md:text-[4.3rem]">
                Run Your Poultry Farm Smarter With {settings.system_name}
              </h1>
              <p className="mt-5 max-w-2xl text-[16px] leading-8 text-white/74">
                {settings.system_name} helps poultry farms manage feed mill operations, farm houses, flocks, slaughter, inventory,
                POS sales, finance, compliance, and reports from one cloud ERP.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button type="button" onClick={openRegistration} className="btn-primary btn-lg">Start 14-Day Free Trial</button>
                <Link to="/login" className="btn-secondary btn-lg border-white/20 bg-white/10 text-white hover:bg-white/15">Sign In</Link>
              </div>
            </motion.div>

            <motion.div
              className="relative z-10 rounded-[8px] border border-white/12 bg-white p-3 shadow-2xl"
              initial={{ opacity: 0, y: 28, rotateX: 7 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: 0.18, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="rounded-[6px] border border-[#ead9ac] bg-[#fffaf0] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-semibold uppercase text-[#9b7618]">Farm Admin Dashboard</div>
                    <div className="text-[20px] font-bold text-[#151515]">{settings.system_name} dashboard</div>
                  </div>
                  <div className="rounded-full bg-[#d6a62e] px-3 py-1 text-[12px] font-bold text-[#151515]">Trial: 7 days remaining</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  {['28,540 birds', '12,450 kg feed', '2,850 kg meat', 'UGX 8.45M sales'].map((item, index) => (
                    <motion.div
                      key={item}
                      className="rounded-[8px] border border-[#ead9ac] bg-white p-3 text-center text-[12px] font-bold text-[#151515]"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.34 + index * 0.06, duration: 0.42 }}
                    >
                      {item}
                    </motion.div>
                  ))}
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {['Feed Mill Overview', 'Farm Operations Overview', 'Slaughter Overview', 'Sales and POS Overview'].map((title, index) => (
                    <motion.div
                      key={title}
                      className="rounded-[8px] border border-[#ead9ac] bg-white p-4"
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.52 + index * 0.06, duration: 0.45 }}
                    >
                      <div className="mb-3 text-[13px] font-bold text-[#151515]">{title}</div>
                      <div className="space-y-2">
                        {[1, 2, 3].map((row) => <div key={row} className="h-2 rounded-full bg-[#f0e2bd]" />)}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
          <Reveal className="max-w-3xl">
            <div className="page-eyebrow">What is {settings.system_name}?</div>
            <h2 className="mt-2 text-[2rem] font-bold">{settings.system_name} is a cloud-based poultry ERP system.</h2>
            <p className="mt-4 text-[15px] leading-8 text-slate-600">
              It gives farms full control over production, stock, slaughter, sales, finance, compliance, and reporting across secure tenant workspaces.
            </p>
          </Reveal>
        </section>

        <section id="features" className="border-y border-black/10 bg-white py-14">
          <div className="mx-auto max-w-7xl px-4 lg:px-6">
            <Reveal className="section-header">
              <div>
                <div className="page-eyebrow">Key Features</div>
                <h2 className="section-title">Built around real poultry workflows</h2>
              </div>
            </Reveal>
            <motion.div
              className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.12 }}
            >
              {features.map(([label, Icon]) => (
                <motion.div
                  key={label}
                  variants={reveal}
                  transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                  className="group rounded-[8px] border border-[#ead9ac] bg-[#fffdfa] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-[#d6a62e] hover:shadow-[0_22px_44px_-34px_rgba(15,23,42,.42)]"
                >
                  <Icon className="mb-3 h-5 w-5 text-[#b88a1d]" />
                  <div className="text-[14px] font-bold text-slate-900">{label}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <section id="modules" className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
          <Reveal>
            <div className="page-eyebrow">Modules</div>
            <h2 className="mt-2 text-[2rem] font-bold">One connected operating system for poultry teams</h2>
          </Reveal>
          <motion.div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.14 }}>
            {modules.map((module) => (
              <motion.div key={module} variants={reveal} className="metric-card text-[15px] font-bold transition-transform duration-300 hover:-translate-y-1">
                {module}
              </motion.div>
            ))}
          </motion.div>
        </section>

        <section id="why" className="border-y border-black/10 bg-white py-14">
          <div className="mx-auto max-w-7xl px-4 lg:px-6">
            <Reveal>
              <div className="page-eyebrow">Why Choose {settings.system_name}?</div>
              <h2 className="mt-2 text-[2rem] font-bold">Control stock, reduce losses, and keep every department aligned</h2>
            </Reveal>
            <motion.div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.16 }}>
              {reasons.map((reason) => (
                <motion.div key={reason} variants={reveal} className="rounded-[8px] border border-slate-200 p-4 text-[14px] font-semibold transition-all duration-300 hover:border-[#d6a62e] hover:bg-[#fffaf0]">
                  {reason}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
          <Reveal className="rounded-[8px] bg-[#0b1018] p-8 text-white md:p-10">
            <h2 className="text-[2rem] font-bold text-white">Start your 14-day free trial today.</h2>
            <p className="mt-3 max-w-2xl text-white/72">
              No installation required. Your farm gets its own workspace like {workspaceExample}.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={openRegistration} className="btn-primary btn-lg">Start Free Trial</button>
              <Link to="/login" className="btn-secondary btn-lg border-white/20 bg-white/10 text-white hover:bg-white/15">Sign In</Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-black/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-[13px] text-slate-600 md:flex-row md:items-center md:justify-between lg:px-6">
          <div className="font-bold text-slate-900">{settings.system_name}</div>
          <div>{settings.footer_text}</div>
          <div>Support email: {settings.support_email}</div>
          <div className="flex gap-4"><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms of Service</Link></div>
        </div>
      </footer>
      <RegistrationWizardModal isOpen={isRegistrationOpen} onClose={() => setIsRegistrationOpen(false)} />
      <InstallPrompt />
    </div>
  )
}
