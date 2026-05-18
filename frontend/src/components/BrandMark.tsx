import { clsx } from 'clsx'
import { useEffect, useState } from 'react'
import { BRAND_LOGO_FULL, BRAND_LOGO_FULL_GREEN, BRAND_LOGO_ICON, BRAND_LOGO_ICON_GREEN } from '@/lib/branding'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'
import { resolveInitialTheme, THEME_CHANGE_EVENT, type BrandTheme } from '@/lib/theme'

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
  const [brandTheme, setBrandTheme] = useState<BrandTheme>(() => resolveInitialTheme().brandTheme)

  useEffect(() => {
    const onThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ brandTheme?: BrandTheme }>).detail
      if (detail?.brandTheme) setBrandTheme(detail.brandTheme)
    }
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange)
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange)
  }, [])

  const themedFullLogo = brandTheme === 'green-black' ? BRAND_LOGO_FULL_GREEN : BRAND_LOGO_FULL
  const themedIconLogo = brandTheme === 'green-black' ? BRAND_LOGO_ICON_GREEN : BRAND_LOGO_ICON
  const systemLogoIsDefault = !settings.system_logo_url || settings.system_logo_url === BRAND_LOGO_FULL
  const fullLogo = systemLogoIsDefault ? themedFullLogo : settings.system_logo_url

  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <img
        src={compact ? themedIconLogo : fullLogo}
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
