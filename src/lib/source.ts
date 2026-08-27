/** Extract a clean shop domain from a product URL (no path, query, or www). */

const MULTI_PART_TLDS = new Set([
  'co.uk',
  'org.uk',
  'ac.uk',
  'com.eg',
  'com.sa',
  'com.ae',
  'co.ae',
  'com.kw',
  'com.bh',
  'com.qa',
  'com.om',
  'com.jo',
  'com.lb',
  'co.za',
  'com.br',
  'com.au',
  'co.nz',
  'com.tr',
  'com.mx',
  'co.jp',
  'com.cn',
  'com.tw',
  'com.hk',
  'com.sg',
  'co.in',
  'com.my',
])

/** Optional friendly labels for well-known shops (keyed by registrable domain). */
const FRIENDLY: Record<string, { en: string; ar: string }> = {
  'amazon.com': { en: 'Amazon', ar: 'أمازون' },
  'amazon.eg': { en: 'Amazon', ar: 'أمازون' },
  'amazon.sa': { en: 'Amazon', ar: 'أمازون' },
  'amazon.ae': { en: 'Amazon', ar: 'أمازون' },
  'noon.com': { en: 'Noon', ar: 'نون' },
  'jumia.com.eg': { en: 'Jumia', ar: 'جوميا' },
  'jumia.com': { en: 'Jumia', ar: 'جوميا' },
  'ebay.com': { en: 'eBay', ar: 'إيباي' },
  'aliexpress.com': { en: 'AliExpress', ar: 'علي إكسبرس' },
  'shein.com': { en: 'SHEIN', ar: 'شي إن' },
  'trendyol.com': { en: 'Trendyol', ar: 'ترينديول' },
  'namshi.com': { en: 'Namshi', ar: 'نمشي' },
  'extra.com': { en: 'Extra', ar: 'إكسترا' },
  'jarir.com': { en: 'Jarir', ar: 'جرير' },
  'hajarafa.com': { en: 'Haj Arafa', ar: 'حاج عرفة' },
  'myshopx.store': { en: 'MyShopX', ar: 'ماي شوب إكس' },
}

export type ProductSource = {
  /** Registrable domain used for grouping, e.g. amazon.eg */
  id: string
  /** Display label (friendly name or domain) */
  label: string
  /** Full hostname without www, e.g. ruh.myshopx.store */
  host: string
  /** Same as id — clean domain only */
  domain: string
}

/** Pull a URL-looking token out of pasted text if needed. */
function findUrlToken(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const match = trimmed.match(/https?:\/\/[^\s<>"']+/i)
  if (match) return match[0].replace(/[),.;]+$/g, '')
  // Bare domain: example.com/path
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:?].*)?$/i.test(trimmed)) {
    return trimmed.includes('://') ? trimmed : `https://${trimmed}`
  }
  return trimmed.includes('://') ? trimmed : null
}

/** Hostname without leading www. */
export function hostnameFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  const token = findUrlToken(url) ?? url.trim()
  try {
    const withProtocol = /^https?:\/\//i.test(token) ? token : `https://${token}`
    return new URL(withProtocol).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

/**
 * Registrable domain only (eTLD+1 style for common cases).
 * shop.amazon.eg → amazon.eg
 * ruh.myshopx.store → myshopx.store
 * hajarafa.com/products/x → hajarafa.com
 */
export function registrableDomain(hostname: string): string {
  const host = hostname.replace(/^www\./i, '').toLowerCase()
  const parts = host.split('.').filter(Boolean)
  if (parts.length <= 2) return host

  const last2 = parts.slice(-2).join('.')
  if (MULTI_PART_TLDS.has(last2) && parts.length >= 3) {
    return parts.slice(-3).join('.')
  }
  return last2
}

/** Domain-only string from any product URL or pasted link text. */
export function domainFromUrl(url: string | null | undefined): string | null {
  const host = hostnameFromUrl(url)
  if (!host) return null
  return registrableDomain(host)
}

function friendlyLabel(domain: string, language: 'ar' | 'en'): string | null {
  const hit = FRIENDLY[domain]
  if (!hit) return null
  return language === 'ar' ? hit.ar : hit.en
}

/** Match known brands that live on shared platforms (subdomain = shop). */
function subdomainShopLabel(host: string, language: 'ar' | 'en'): string | null {
  if (/^ruh(\.|$)/i.test(host) || host.includes('ruh.myshopx')) {
    return language === 'ar' ? 'روح' : 'RUH'
  }
  return null
}

export function sourceFromUrl(
  url: string | null | undefined,
  language: 'ar' | 'en' = 'en',
): ProductSource | null {
  const host = hostnameFromUrl(url)
  if (!host) return null

  const domain = registrableDomain(host)
  const subLabel = subdomainShopLabel(host, language)
  const label =
    subLabel ?? friendlyLabel(domain, language) ?? domain

  // Group RUH (and similar) by full host so different myshopx shops stay separate;
  // everything else groups by registrable domain.
  const id = subLabel ? host : domain

  return { id, label, host, domain }
}

export function sourceKey(url: string | null | undefined): string {
  return sourceFromUrl(url)?.id ?? 'unknown'
}
