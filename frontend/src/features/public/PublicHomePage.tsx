import { Link } from 'react-router-dom'
import { useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  Bird,
  Building2,
  ClipboardCheck,
  Database,
  FileWarning,
  HeadsetIcon,
  Lock,
  Pill,
  PieChart,
  RefreshCw,
  Scissors,
  ShoppingCart,
  Users,
  Wheat,
  Zap,
} from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { SEO } from '@/components/SEO'
import { ThemeToggle } from '@/components/ThemeControls'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'
import { RegistrationWizardModal } from '@/features/auth/RegistrationWizardModal'

const modules = [
  {
    name: 'Feed Mill',
    description: 'Manage feed production, formulations, inventory, and procurement',
    icon: Wheat,
    color: 'from-amber-500 to-orange-600',
    features: ['Feed formulation', 'Stock management', 'GRN tracking'],
  },
  {
    name: 'Farm Operations',
    description: 'Complete house management, flock tracking, and health monitoring',
    icon: Building2,
    color: 'from-green-500 to-emerald-600',
    features: ['Batch management', 'House tracking', 'Vaccination records'],
  },
  {
    name: 'Inventory & Transfers',
    description: 'Track stock movements, goods received, goods issued notes',
    icon: Database,
    color: 'from-blue-500 to-cyan-600',
    features: ['GRN/GIV management', 'Stock transfers', 'Real-time tracking'],
  },
  {
    name: 'Slaughter & Processing',
    description: 'Process birds, track meat production, manage cold storage',
    icon: Scissors,
    color: 'from-red-500 to-rose-600',
    features: ['Processing records', 'Yield analysis', 'Cold room management'],
  },
  {
    name: 'Sales & POS',
    description: 'Point of sale, invoicing, payment processing, customer orders',
    icon: ShoppingCart,
    color: 'from-purple-500 to-violet-600',
    features: ['Invoicing', 'KG-based sales', 'Payment tracking'],
  },
  {
    name: 'Finance & CoA',
    description: 'Chart of accounts, journals, profit/loss, financial reports',
    icon: BarChart3,
    color: 'from-indigo-500 to-blue-600',
    features: ['Journal entries', 'P&L reports', 'Financial analysis'],
  },
  {
    name: 'Compliance & Alerts',
    description: 'Document expiry tracking, compliance monitoring, alert system',
    icon: FileWarning,
    color: 'from-orange-500 to-amber-600',
    features: ['Document tracking', 'Expiry alerts', 'Compliance reports'],
  },
  {
    name: 'Users & Roles',
    description: 'Multi-user management, role-based access, permissions control',
    icon: Lock,
    color: 'from-slate-500 to-gray-600',
    features: ['Role management', 'Permissions', 'Audit logs'],
  },
]

const features = [
  {
    icon: Zap,
    title: 'Real-time Tracking',
    description: 'Live flock, mortality, feed usage, and sales data',
  },
  {
    icon: Pill,
    title: 'Health Management',
    description: 'Vaccination records, mortality tracking, health alerts',
  },
  {
    icon: PieChart,
    title: 'Advanced Reports',
    description: 'Profitability, yield analysis, financial summaries',
  },
  {
    icon: RefreshCw,
    title: 'Automated Workflows',
    description: 'Stock movements, batch progression, compliance alerts',
  },
  {
    icon: Users,
    title: 'Multi-user Support',
    description: 'Role-based access with granular permissions',
  },
  {
    icon: HeadsetIcon,
    title: 'Premium Support',
    description: '24/7 customer support and training available',
  },
]

const reasons = [
  'Purpose-built for poultry operations',
  'Track every KG from feed mill to customer',
  'Real-time dashboards and KPIs',
  'Secure multi-tenant cloud platform',
  'Reduce losses and improve margins',
  'Complete financial integration',
  'Mobile-responsive design',
  '14-day free trial included',
]

const faqs = [
  {
    q: 'What is Farmexa?',
    a: 'Farmexa is a complete ERP system built specifically for poultry and farm operations. It connects feed production, farm management, inventory, processing, sales, and finance in one integrated platform.',
  },
  {
    q: 'Who should use Farmexa?',
    a: 'Farm owners, farm managers, accountants, inventory officers, sales teams, feed mill operators, and poultry consultants can all benefit from Farmexa.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes! New farms get a 14-day trial period to explore all features with sample data before committing to a plan.',
  },
  {
    q: 'Is my farm data secure?',
    a: 'Absolutely. Each farm operates in an isolated workspace with enterprise-grade encryption, regular backups, and compliance certifications.',
  },
  {
    q: 'Can multiple users access Farmexa?',
    a: 'Yes. You can create multiple user accounts with different roles and permissions. Each user sees only the data they\'re authorized to access.',
  },
  {
    q: 'Does Farmexa support my local currency?',
    a: 'Yes. Farmexa supports multiple currencies and can be configured for your local tax and accounting requirements.',
  },
]

export function PublicHomePage() {
  const { settings } = usePlatformSettings()
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <SEO
        title="Farmexa ERP | Poultry Farm Management System"
        description="Complete ERP system for poultry farms. Feed mill, farm operations, inventory, slaughter, sales, finance, and compliance all in one platform."
        canonicalPath="/"
      />

      {/* ═══════════════════════════════════════════════════════════════════════════════
          NAVIGATION
          ═══════════════════════════════════════════════════════════════════════════════ */}
      <nav className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <BrandMark />
            <div className="flex items-center gap-6">
              <a href="#modules" className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition">
                Modules
              </a>
              <a href="#why" className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition">
                Why Farmexa
              </a>
              <a href="#faq" className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition">
                FAQ
              </a>
              <ThemeToggle />
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-neutral-50 py-20 sm:py-32">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 right-0 h-80 w-80 rounded-full bg-blue-100 opacity-20 blur-3xl" />
          <div className="absolute -bottom-40 left-0 h-80 w-80 rounded-full bg-blue-100 opacity-30 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2">
              <Bird className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-600">Modern Poultry ERP Platform</span>
            </div>

            <h1 className="mb-6 text-5xl font-bold leading-tight text-neutral-900 sm:text-6xl">
              Complete Farm Management
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400">
                Made Simple
              </span>
            </h1>

            <p className="mb-8 max-w-2xl mx-auto text-xl text-neutral-600">
              Farmexa connects your entire poultry operation—from feed mill to sales invoice—in one secure,
              intuitive platform. Manage flocks, track inventory, process orders, and grow your farm.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setIsRegistrationOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-8 py-4 text-lg font-semibold text-white hover:bg-blue-700 transition"
              >
                Start Free 14-Day Trial
                <ArrowRight className="h-5 w-5" />
              </button>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-8 py-4 text-lg font-semibold text-neutral-900 hover:bg-neutral-50 transition"
              >
                Sign In
              </Link>
            </div>

            <p className="mt-6 text-sm text-neutral-500">
              No credit card required • Full access to all features
            </p>
          </div>

          {/* Hero Features Grid */}
          <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              ['Real-time tracking', 'Live dashboards for all operations'],
              ['Multi-user support', 'Role-based access control'],
              ['Complete reports', 'Profitability, yield, and financials'],
              ['Secure & scalable', 'Enterprise-grade cloud platform'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-xl border border-neutral-200 bg-white p-4">
                <p className="font-semibold text-neutral-900">{title}</p>
                <p className="mt-1 text-sm text-neutral-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════════
          MODULES SHOWCASE
          ═══════════════════════════════════════════════════════════════════════════════ */}
      <section id="modules" className="py-20 sm:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-neutral-900">
              Complete Modules for Your Farm
            </h2>
            <p className="max-w-2xl mx-auto text-xl text-neutral-600">
              Every aspect of your poultry operation covered in one integrated platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {modules.map((module) => {
              const Icon = module.icon
              return (
                <div
                  key={module.name}
                  className="group rounded-xl border border-neutral-200 bg-white p-6 hover:border-neutral-300 hover:shadow-lg transition duration-300"
                >
                  <div className={`inline-flex rounded-lg bg-gradient-to-br ${module.color} p-3 mb-4`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>

                  <h3 className="mb-2 text-lg font-bold text-neutral-900">{module.name}</h3>
                  <p className="mb-4 text-sm text-neutral-600">{module.description}</p>

                  <ul className="space-y-2">
                    {module.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-neutral-600">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════════
          FEATURES SECTION
          ═══════════════════════════════════════════════════════════════════════════════ */}
      <section id="why" className="bg-gradient-to-b from-neutral-50 to-white py-20 sm:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-neutral-900">
              Why Choose Farmexa
            </h2>
            <p className="max-w-2xl mx-auto text-xl text-neutral-600">
              Built by farmers, for farmers. Designed specifically for modern poultry operations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div key={feature.title} className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                      <Icon className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold text-neutral-900">{feature.title}</h3>
                    <p className="text-neutral-600">{feature.description}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Reasons Grid */}
          <div className="mt-16">
            <h3 className="mb-8 text-2xl font-bold text-neutral-900">What makes us different:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {reasons.map((reason) => (
                <div
                  key={reason}
                  className="rounded-lg border border-neutral-200 bg-white p-4 flex items-center gap-3"
                >
                  <div className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0 mt-1" />
                  <p className="text-neutral-700">{reason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════════
          FAQ SECTION
          ═══════════════════════════════════════════════════════════════════════════════ */}
      <section id="faq" className="py-20 sm:py-32">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-neutral-900">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-neutral-600">
              Everything you need to know about Farmexa
            </p>
          </div>

          <div className="space-y-6">
            {faqs.map((faq, i) => (
              <details
                key={i}
                className="group rounded-lg border border-neutral-200 bg-white p-6 cursor-pointer hover:border-neutral-300 transition"
              >
                <summary className="flex items-center justify-between font-semibold text-neutral-900">
                  {faq.q}
                  <span className="ml-4 inline-flex h-6 w-6 items-center justify-center rounded-md bg-neutral-100 text-neutral-600 group-open:bg-blue-100 group-open:text-blue-600 transition">
                    <svg className="h-4 w-4 transition group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-4 text-neutral-600 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════════
          CTA SECTION
          ═══════════════════════════════════════════════════════════════════════════════ */}
      <section className="bg-gradient-to-r from-blue-700 to-blue-500 py-20 sm:py-32">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="mb-6 text-4xl font-bold text-white">Ready to transform your farm?</h2>
          <p className="mb-8 text-xl text-blue-100">
            Start your 14-day free trial today. No credit card required.
          </p>

          <button
            onClick={() => setIsRegistrationOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-8 py-4 text-lg font-semibold text-blue-600 hover:bg-blue-50 transition"
          >
            Start Free Trial
            <ArrowRight className="h-5 w-5" />
          </button>

          <p className="mt-8 text-sm text-blue-100">
            • Free 14-day trial • All features included • No credit card needed
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-neutral-200 bg-neutral-50 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-8 grid grid-cols-1 sm:grid-cols-4 gap-8">
            <div>
              <p className="font-semibold text-neutral-900">Product</p>
              <ul className="mt-4 space-y-2 text-sm text-neutral-600">
                <li><a href="#modules" className="hover:text-neutral-900 transition">Modules</a></li>
                <li><a href="#why" className="hover:text-neutral-900 transition">Features</a></li>
                <li><a href="#faq" className="hover:text-neutral-900 transition">Pricing</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-neutral-900">Company</p>
              <ul className="mt-4 space-y-2 text-sm text-neutral-600">
                <li><a href="#" className="hover:text-neutral-900 transition">About</a></li>
                <li><a href="#" className="hover:text-neutral-900 transition">Blog</a></li>
                <li><a href="#" className="hover:text-neutral-900 transition">Careers</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-neutral-900">Legal</p>
              <ul className="mt-4 space-y-2 text-sm text-neutral-600">
                <li><a href="#" className="hover:text-neutral-900 transition">Privacy</a></li>
                <li><a href="#" className="hover:text-neutral-900 transition">Terms</a></li>
                <li><a href="#" className="hover:text-neutral-900 transition">Security</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-neutral-900">Support</p>
              <ul className="mt-4 space-y-2 text-sm text-neutral-600">
                <li><a href="#" className="hover:text-neutral-900 transition">Help Center</a></li>
                <li><a href="#" className="hover:text-neutral-900 transition">Contact</a></li>
                <li><a href="#" className="hover:text-neutral-900 transition">Community</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-neutral-200 pt-8">
            <p className="text-center text-sm text-neutral-600">
              © {new Date().getFullYear()} Farmexa by Arosoft Labs. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <RegistrationWizardModal
        isOpen={isRegistrationOpen}
        onClose={() => setIsRegistrationOpen(false)}
      />
    </div>
  )
}
