import { useEffect } from 'react'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'
import { BRAND_SOCIAL_IMAGE } from '@/lib/branding'

interface SEOProps {
  title: string
  description: string
  canonicalPath?: string
  robots?: string
  image?: string
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
}

function originFromSettings(platformDomain?: string) {
  if (platformDomain) return platformDomain.startsWith('http') ? platformDomain : `https://${platformDomain}`
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return 'https://farm.arosoftlabs.com'
}

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attr, key)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

export function SEO({ title, description, canonicalPath = '/', robots = 'index,follow', image = BRAND_SOCIAL_IMAGE, jsonLd }: SEOProps) {
  const { settings } = usePlatformSettings()
  useEffect(() => {
    const ORIGIN = originFromSettings(settings?.platform_domain)
    const url = `${ORIGIN}${canonicalPath}`
    const imageUrl = image.startsWith('http') ? image : `${ORIGIN}${image}`
    document.title = title
    setMeta('meta[name="description"]', 'name', 'description', description)
    setMeta('meta[name="robots"]', 'name', 'robots', robots)
    setMeta('meta[property="og:title"]', 'property', 'og:title', title)
    setMeta('meta[property="og:description"]', 'property', 'og:description', description)
    setMeta('meta[property="og:url"]', 'property', 'og:url', url)
    setMeta('meta[property="og:type"]', 'property', 'og:type', 'website')
    setMeta('meta[property="og:image"]', 'property', 'og:image', imageUrl)
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image')
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title)
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description)
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', imageUrl)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = url

    document.querySelectorAll('[data-farmexa-jsonld]').forEach((node) => node.remove())
    if (jsonLd) {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.dataset.farmexaJsonld = 'true'
      script.text = JSON.stringify(jsonLd)
      document.head.appendChild(script)
    }
  }, [canonicalPath, description, image, jsonLd, robots, title])

  return null
}

