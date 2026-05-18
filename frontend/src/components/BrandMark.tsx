import { clsx } from 'clsx'
import { BRAND_LOGO_FULL, BRAND_LOGO_ICON } from '@/lib/branding'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'

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
  const { settings } = usePlatformSettings()
  const fullLogo = settings.system_logo_url || BRAND_LOGO_FULL

  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <img
        src={compact ? BRAND_LOGO_ICON : fullLogo}
        alt={compact ? `${settings.system_name} icon` : `${settings.system_name} logo`}
        className={clsx(
          'shrink-0 object-contain',
          compact ? 'h-9 w-9 rounded-[8px]' : 'h-11 w-auto max-w-[170px]',
          light && 'drop-shadow-[0_1px_0_rgba(255,255,255,.08)]'
        )}
        loading="eager"
      />
      {!compact && showTagline ? <span className="sr-only">{settings.system_name} - Manage Smart. Grow Better.</span> : null}
    </div>
  )
}
