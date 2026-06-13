import { motion } from 'framer-motion'
import { Activity, ArrowUpRight, Bird, CheckCircle2, Egg, TrendingUp } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'

const FEATURES = [
  'Real-time flock, mortality & vaccination tracking',
  'Feed formulation and inventory management',
  'Integrated POS, invoicing & financial reports',
  'Compliance alerts and document expiry tracking',
]

const BARS = [42, 58, 36, 70, 52, 84, 64]

/**
 * Self-contained animated login hero — no external image/video assets.
 * Animated gradient blobs + a floating glass "live dashboard" preview card.
 */
export function LoginHero() {
  return (
    <div className="relative hidden lg:flex lg:w-[52%] xl:w-[54%] flex-col overflow-hidden bg-[#0B1B3F]">
      {/* Gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A8A] via-[#1D4ED8] to-[#162C73]" />

      {/* Animated colour blobs */}
      <motion.div
        className="absolute -top-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-blue-400/25 blur-[90px]"
        animate={{ x: [0, 30, 0], y: [0, 20, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/3 -left-28 h-[26rem] w-[26rem] rounded-full bg-cyan-400/15 blur-[90px]"
        animate={{ x: [0, 24, 0], y: [0, -26, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-40 right-10 h-[24rem] w-[24rem] rounded-full bg-indigo-400/20 blur-[90px]"
        animate={{ x: [0, -20, 0], y: [0, 18, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Dotted grid texture */}
      <div
        className="absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage: 'radial-gradient(circle, #FFFFFF 1px, transparent 1px)',
          backgroundSize: '26px 26px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
        <div className="flex items-center justify-between">
          <BrandMark compact light />
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">Live</span>
          </div>
        </div>

        {/* Headline + floating dashboard */}
        <div className="grid gap-10">
          <div className="max-w-[480px]">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-300/30 bg-blue-400/10 px-4 py-1.5 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-200">Modern Poultry ERP</span>
            </div>

            <h1 className="text-[2.7rem] font-extrabold leading-[1.08] tracking-tight text-white xl:text-[3.2rem]">
              Complete farm<br />
              <span className="text-blue-300">management</span> made simple.
            </h1>

            <p className="mt-5 max-w-[420px] text-[15px] leading-relaxed text-white/70">
              Farmexa connects your entire poultry operation — from feed mill to sales invoice — in one secure, intuitive platform.
            </p>
          </div>

          <FloatingDashboard />

          <ul className="grid max-w-[480px] grid-cols-1 gap-2.5 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-300" />
                <span className="text-[12.5px] font-medium text-white/75">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex items-end justify-between border-t border-white/10 pt-6">
          <div className="flex items-center gap-7">
            {[['12+', 'Modules'], ['100%', 'Cloud'], ['24/7', 'Access']].map(([v, l]) => (
              <div key={l}>
                <div className="text-[19px] font-bold text-white">{v}</div>
                <div className="text-[11px] text-white/55">{l}</div>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-white/35">© {new Date().getFullYear()} Arosoft Labs</div>
        </div>
      </div>
    </div>
  )
}

function FloatingDashboard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      className="max-w-[460px]"
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="rounded-[20px] border border-white/15 bg-white/10 p-5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      >
        {/* Card header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[13px] font-semibold text-white">Production overview</div>
            <div className="text-[11px] text-white/55">This week</div>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
            <TrendingUp className="h-3 w-3" /> +12.4%
          </div>
        </div>

        {/* KPI chips */}
        <div className="mb-4 grid grid-cols-3 gap-2.5">
          <KpiChip icon={Bird} label="Birds" value="8,420" />
          <KpiChip icon={Egg} label="Eggs/day" value="6,180" />
          <KpiChip icon={Activity} label="Yield" value="74.2%" />
        </div>

        {/* Animated bar chart */}
        <div className="rounded-[14px] bg-[#0B1B3F]/40 p-4">
          <div className="flex h-24 items-end justify-between gap-2">
            {BARS.map((h, i) => (
              <motion.div
                key={i}
                className="w-full rounded-t-[5px] bg-gradient-to-t from-blue-500 to-cyan-300"
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.8, delay: 0.4 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-white/45">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
        </div>

        {/* Footer row */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex -space-x-2">
            {['#60A5FA', '#34D399', '#A78BFA'].map((c) => (
              <span key={c} className="h-6 w-6 rounded-full border-2 border-[#1E3A8A]" style={{ background: c }} />
            ))}
          </div>
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-200">
            View dashboard <ArrowUpRight className="h-3 w-3" />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function KpiChip({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-white/10 bg-white/5 px-3 py-2.5">
      <Icon className="mb-1.5 h-3.5 w-3.5 text-blue-300" />
      <div className="text-[14px] font-bold leading-none text-white">{value}</div>
      <div className="mt-1 text-[10px] text-white/55">{label}</div>
    </div>
  )
}
