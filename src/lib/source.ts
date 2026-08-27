/** Extract clean shop domain + merchant name from product URLs / share text. */

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

/** Friendly merchant names keyed by registrable domain. */
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
  /** Stable group id (usually registrable domain) */
  id: string
  /** Merchant display name (e.g. Amazon) */
  merchant: string
  /** Clean domain only (e.g. amazon.eg) */
  domain: string
  /** Hostname without www */
  host: string
  /** "Merchant · domain" or just domain */
  label: string
}

const URL_IN_TEXT =
  /(?:https?:\/\/|www\.)[^\s<>"']+/gi

function stripTrailingJunk(token: string): string {
  return token.replace(/[),.;:!?\]}'"\u060C\u061B]+$/g, '')
}

/** First http(s)/www URL found in arbitrary share text. */
export function findFirstUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const trimmed = raw.trim()
  URL_IN_TEXT.lastIndex = 0
  const match = trimmed.match(URL_IN_TEXT)
  if (match?.[0]) {
    let token = stripTrailingJunk(match[0])
    if (/^www\./i.test(token)) token = `https://${token}`
    return token
  }
  // Bare domain/path without scheme (common in some share sheets)
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}([/:?#].*)?$/i.test(trimmed)) {
    return trimmed.includes('://') ? trimmed : `https://${trimmed}`
  }
  return null
}

function tryNewUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    /* continue */
  }
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    return new URL(withProtocol)
  } catch {
    return null
  }
}

/** Hostname without leading www. */
export function hostnameFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  const token = findFirstUrl(url) ?? url.trim()
  const parsed = tryNewUrl(stripTrailingJunk(token))
  if (!parsed?.hostname) return null
  return parsed.hostname.replace(/^www\./i, '').toLowerCase()
}

/**
 * Registrable domain only (eTLD+1 for common multi-part TLDs).
 * shop.amazon.eg → amazon.eg
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

export function domainFromUrl(url: string | null | undefined): string | null {
  const host = hostnameFromUrl(url)
  if (!host) return null
  return registrableDomain(host)
}

function prettyMerchantFromDomain(domain: string): string {
  const base = domain.split('.')[0] || domain
  if (!base) return domain
  return base.charAt(0).toUpperCase() + base.slice(1)
}

function merchantFor(
  host: string,
  domain: string,
  language: 'ar' | 'en',
): string {
  if (/^ruh(\.|$)/i.test(host) || host.includes('ruh.myshopx')) {
    return language === 'ar' ? 'روح' : 'RUH'
  }
  const hit = FRIENDLY[domain]
  if (hit) return language === 'ar' ? hit.ar : hit.en
  return prettyMerchantFromDomain(domain)
}

export function sourceFromUrl(
  url: string | null | undefined,
  language: 'ar' | 'en' = 'en',
): ProductSource | null {
  const host = hostnameFromUrl(url)
  if (!host) return null

  const domain = registrableDomain(host)
  const merchant = merchantFor(host, domain, language)
  // Keep multi-tenant shop hosts distinct (ruh.myshopx.store ≠ other.myshopx.store)
  const id =
    host.endsWith('.myshopx.store') || host.includes('.myshopify.com')
      ? host
      : domain

  const label =
    merchant.toLowerCase() === domain.toLowerCase()
      ? domain
      : `${merchant} · ${domain}`

  return { id, merchant, domain, host, label }
}

/** Resolve source from saved fields and/or URL / shared text. */
export function resolveProductSource(
  input: {
    sourceUrl?: string | null
    sourceDomain?: string | null
    sourceLabel?: string | null
    sourceText?: string | null
  },
  language: 'ar' | 'en' = 'en',
): ProductSource | null {
  const fromUrl =
    sourceFromUrl(input.sourceUrl, language) ||
    sourceFromUrl(findFirstUrl(input.sourceText ?? '') ?? '', language)

  if (fromUrl) {
    // Prefer a previously saved display label when domain matches
    if (
      input.sourceLabel?.trim() &&
      input.sourceDomain &&
      input.sourceDomain.toLowerCase() === fromUrl.domain
    ) {
      return { ...fromUrl, label: input.sourceLabel.trim() }
    }
    return fromUrl
  }

  if (input.sourceDomain?.trim()) {
    const domain = input.sourceDomain.trim().toLowerCase()
    const merchant =
      input.sourceLabel?.split('·')[0]?.trim() ||
      merchantFor(domain, domain, language)
    const label =
      input.sourceLabel?.trim() ||
      (merchant.toLowerCase() === domain
        ? domain
        : `${merchant} · ${domain}`)
    return {
      id: domain,
      merchant,
      domain,
      host: domain,
      label,
    }
  }

  if (input.sourceLabel?.trim()) {
    const label = input.sourceLabel.trim()
    const merchant = label.split('·')[0]?.trim() || label
    return {
      id: label.toLowerCase(),
      merchant,
      domain: label,
      host: label,
      label,
    }
  }

  return null
}

export function sourceKeyFromProduct(
  input: {
    sourceUrl?: string | null
    sourceDomain?: string | null
    sourceLabel?: string | null
    sourceText?: string | null
  },
  language: 'ar' | 'en' = 'en',
): string {
  return resolveProductSource(input, language)?.id ?? 'unknown'
}
