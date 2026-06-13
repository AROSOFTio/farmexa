import { motion } from 'framer-motion'
import { BarChart3, Bird, Boxes, LayoutDashboard, ShoppingCart, TrendingUp, Wheat } from 'lucide-react'

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: Bird, label: 'Flocks' },
  { icon: Wheat, label: 'Feed Mill' },
  { icon: ShoppingCart, label: 'Sales & POS' },
  { icon: Boxes, label: 'Inventory' },
]

const BARS = [38, 56, 44, 72, 50, 84, 66]

// Shared loop timing so the cursor, nav highlight and content stay in sync.
const LOOP = 9

/**
 * Minimal animated "live dashboard" — simulates someone navigating the app.
 * Pure CSS/SVG/framer-motion, no video or external assets.
 */
export function LoginShowcase() {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#EAF1FF] via-[#F4F8FF] to-[#E7EEFF] lg:flex lg:w-[48%] xl:w-[52%]">
      {/* soft animated accents */}
      <motion.div
        className="absolute -top-32 -left-20 h-80 w-80 rounded-full bg-blue-300/30 blur-[90px]"
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-indigo-300/25 blur-[90px]"
        animate={{ x: [0, -24, 0], y: [0, -18, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 flex w-full flex-col justify-center px-10 py-12 xl:px-16">
        <div className="mb-8 max-w-[420px]">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3.5 py-1.5 backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-600" />
            </span>
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand-700">Modern Poultry ERP</span>
          </div>
          <h2 className="text-[2rem] font-bold leading-tight tracking-tight text-neutral-900">
            Run your whole farm
            <br />
            from one screen.
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-neutral-600">
            Flocks, feed, processing, sales and finance — live, in real time.
          </p>
        </div>

        <DashboardMock />

        <div className="mt-8 flex items-center gap-7">
          {[['12+', 'Modules'], ['100%', 'Cloud'], ['24/7', 'Access']].map(([v, l]) => (
            <div key={l}>
              <div className="text-[18px] font-bold text-neutral-900">{v}</div>
              <div className="text-[11px] text-neutral-500">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DashboardMock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative max-w-[440px]"
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="overflow-hidden rounded-[16px] border border-white/80 bg-white shadow-[0_30px_70px_-28px_rgba(30,58,138,0.45)]"
      >
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          <div className="ml-3 rounded-md bg-white px-3 py-1 text-[10px] text-neutral-400">app.farmexa.com</div>
        </div>

        <div className="flex">
          {/* mini sidebar with cycling active highlight */}
          <div className="relative w-[116px] shrink-0 border-r border-neutral-100 bg-neutral-50/60 p-2.5">
            <motion.div
              className="absolute left-2 right-2 h-8 rounded-lg bg-brand-50"
              animate={{ top: [10, 46, 82, 118, 154, 10] }}
              transition={{ duration: LOOP, repeat: Infinity, ease: 'easeInOut', times: [0, 0.2, 0.4, 0.6, 0.8, 1] }}
            />
            {NAV.map(({ icon: Icon, label }) => (
              <div key={label} className="relative z-10 flex h-8 items-center gap-2 px-1.5 text-[10.5px] font-medium text-neutral-600">
                <Icon className="h-3.5 w-3.5 text-brand-600" />
                {label}
              </div>
            ))}
          </div>

          {/* main content */}
          <div className="flex-1 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-neutral-900">Good morning, Sarah</div>
                <div className="text-[9px] text-neutral-400">Today’s overview</div>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[9px] font-semibold text-green-600">
                <TrendingUp className="h-2.5 w-2.5" /> +12.4%
              </div>
            </div>

            {/* KPI cards */}
            <div className="mb-3 grid grid-cols-3 gap-2">
              {[
                [Bird, '8,420', 'Birds'],
                [BarChart3, '74%', 'Yield'],
                [ShoppingCart, '1.2M', 'Sales'],
              ].map(([Icon, v, l], i) => (
                <motion.div
                  key={l as string}
                  className="rounded-lg border border-neutral-100 bg-white p-2"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 3, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
                >
                  {(() => {
                    const I = Icon as React.ComponentType<{ className?: string }>
                    return <I className="mb-1 h-3 w-3 text-brand-500" />
                  })()}
                  <div className="text-[12px] font-bold leading-none text-neutral-900">{v as string}</div>
                  <div className="mt-0.5 text-[8px] text-neutral-400">{l as string}</div>
                </motion.div>
              ))}
            </div>

            {/* animated chart */}
            <div className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
              <div className="flex h-16 items-end justify-between gap-1.5">
                {BARS.map((h, i) => (
                  <motion.div
                    key={i}
                    className="w-full rounded-t-[3px] bg-gradient-to-t from-brand-600 to-brand-300"
                    animate={{ height: [`${h * 0.5}%`, `${h}%`, `${h * 0.7}%`] }}
                    transition={{ duration: 3.5, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* simulated cursor moving across the UI on a loop */}
      <motion.div
        className="pointer-events-none absolute z-20"
        animate={{
          left: ['18%', '8%', '8%', '62%', '18%'],
          top: ['52%', '24%', '40%', '78%', '52%'],
        }}
        transition={{ duration: LOOP, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.78, 1] }}
      >
        <motion.div
          animate={{ scale: [1, 1, 0.82, 1, 1] }}
          transition={{ duration: LOOP, repeat: Infinity, times: [0.2, 0.24, 0.26, 0.3, 1] }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" className="drop-shadow-md">
            <path d="M5 3l14 8-6 1.5L9 19 5 3z" fill="#1E293B" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
