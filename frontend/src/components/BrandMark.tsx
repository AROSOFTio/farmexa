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
  const textClass = light ? 'text-[var(--sidebar-heading)]' : 'text-ink-900'
  const mutedClass = light ? 'text-[var(--sidebar-text-muted)]' : 'text-ink-500'

  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <svg
        viewBox="0 0 96 96"
        aria-hidden="true"
        className={clsx(compact ? 'h-9 w-9' : 'h-11 w-11', 'shrink-0', light ? 'text-[var(--sidebar-heading)]' : 'text-[#202020]')}
      >
        <path
          d="M17 60c0-19 10-35 30-47-10 10-15 21-15 34 0 11 4 20 13 28 8 7 18 11 29 11-8 5-17 7-26 7-19 0-31-12-31-33Z"
          fill="#34a853"
        />
        <path
          d="M47 10h28c6 0 10 6 8 11l-3 7c-2 4-6 7-11 7H56v12h16c6 0 10 6 8 11l-2 5c-2 5-7 8-12 8H56v15H47c-6 0-11-5-11-11V22c0-7 5-12 11-12Z"
          fill={light ? 'currentColor' : '#202020'}
          opacity={light ? 0.94 : 1}
        />
      </svg>

      {!compact && (
        <div className="min-w-0">
          <div className={clsx('text-[15px] font-semibold leading-tight tracking-[0.01em]', textClass)}>
            {APP_SHORT_NAME}
          </div>
          {showTagline ? (
            <div className={clsx('mt-0.5 max-w-[120px] text-[11px] font-medium leading-[1.2] tracking-[0.01em]', mutedClass)}>
              {APP_TAGLINE}
            </div>
          ) : (
            <div className={clsx('text-xs font-medium tracking-[0.08em]', mutedClass)}>
              ERP
            </div>
          )}
        </div>
      )}
    </div>
  )
}
