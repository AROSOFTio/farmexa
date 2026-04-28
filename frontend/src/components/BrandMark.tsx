import { APP_SHORT_NAME, APP_TAGLINE } from '@/lib/branding'
import { clsx } from 'clsx'

interface BrandMarkProps {
  className?: string
  compact?: boolean
  light?: boolean
  showTagline?: boolean
}

export function BrandMark({
  className,
  compact = false,
  light = false,
  showTagline = false,
}: BrandMarkProps) {
  const textClass = light ? 'text-white' : 'text-ink-900'
  const mutedClass = light ? 'text-white/70' : 'text-ink-500'

  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <svg
        viewBox="0 0 96 96"
        aria-hidden="true"
        className={clsx(compact ? 'h-10 w-10' : 'h-12 w-12', 'shrink-0')}
      >
        <defs>
          <linearGradient id="farmexaLeaf" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id="farmexaStem" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
        </defs>
        <path
          d="M17 60c0-19 10-35 30-47-10 10-15 21-15 34 0 11 4 20 13 28 8 7 18 11 29 11-8 5-17 7-26 7-19 0-31-12-31-33Z"
          fill="url(#farmexaLeaf)"
          opacity="0.92"
        />
        <path
          d="M47 10h28c6 0 10 6 8 11l-3 7c-2 4-6 7-11 7H56v12h16c6 0 10 6 8 11l-2 5c-2 5-7 8-12 8H56v15H47c-6 0-11-5-11-11V22c0-7 5-12 11-12Z"
          fill="url(#farmexaStem)"
        />
        <path
          d="M63 49 77 39l13 9 7 14H85V52H66v10H55l8-13Z"
          fill="#0f172a"
        />
        <path
          d="M37 71c8-6 19-10 34-12-7 3-13 6-17 10 8 1 15 3 22 6-13 1-26 1-39-4Z"
          fill="#f59e0b"
        />
      </svg>

      {!compact && (
        <div className="min-w-0">
          <div className={clsx('font-display text-2xl font-semibold tracking-[0.18em]', textClass)}>
            {APP_SHORT_NAME.toUpperCase()}
          </div>
          {showTagline ? (
            <div className={clsx('text-[0.68rem] font-semibold uppercase tracking-[0.38em]', mutedClass)}>
              {APP_TAGLINE}
            </div>
          ) : (
            <div className={clsx('text-xs font-medium uppercase tracking-[0.3em]', mutedClass)}>
              ERP
            </div>
          )}
        </div>
      )}
    </div>
  )
}
