import { useEffect } from 'react'

interface SEOProps {
  title: string
  description: string
  canonicalPath?: string
  robots?: string
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
}

const ORIGIN = 'https://farmexa.arosoft.io'

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attr, key)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

export function SEO({ title, description, canonicalPath = '/', robots = 'index,follow', jsonLd }: SEOProps) {
  useEffect(() => {
    const url = `${ORIGIN}${canonicalPath}`
    document.title = title
    setMeta('meta[name="description"]', 'name', 'description', description)
    setMeta('meta[name="robots"]', 'name', 'robots', robots)
    setMeta('meta[property="og:title"]', 'property', 'og:title', title)
    setMeta('meta[property="og:description"]', 'property', 'og:description', description)
    setMeta('meta[property="og:url"]', 'property', 'og:url', url)
    setMeta('meta[property="og:type"]', 'property', 'og:type', 'website')
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image')
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title)
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description)

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
  }, [canonicalPath, description, jsonLd, robots, title])

  return null
}
