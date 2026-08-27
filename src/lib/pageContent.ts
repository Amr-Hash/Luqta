import type { AppLanguage } from '@/types/product'

/** Decode common HTML entities that leak through reader markdown. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n)
      return Number.isFinite(code) ? String.fromCharCode(code) : ''
    })
}

/** Strip markdown images/links and reader chrome from page text. */
export function stripMarkdownNoise(raw: string): string {
  let text = decodeEntities(raw).replace(/\r/g, '')

  // Complete + truncated image markdown (Jina often truncates)
  text = text.replace(/!\[[^\]]*\]\([^)\s]*\)?/g, ' ')
  // Keep link labels, drop URLs
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  // Bare leftover markdown image alt crumbs
  text = text.replace(/!\[[^\]]*\]/g, ' ')
  text = text.replace(/\[[^\]]*\]/g, (m) => m.slice(1, -1))

  // Reader / scrape chrome
  text = text.replace(/^Title:\s*/gim, '')
  text = text.replace(/^URL Source:\s*\S+/gim, '')
  text = text.replace(/^Markdown Content:\s*/gim, '')
  text = text.replace(/^Warning:\s*.+$/gim, '')
  text = text.replace(/^Error Source:\s*.+$/gim, '')
  text = text.replace(/^Published Time:\s*.+$/gim, '')

  // Collapse bullets that are only noise
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^[*•\-]\s+/, '').trim())
    .filter((l) => {
      if (!l) return false
      if (/^https?:\/\//i.test(l)) return false
      if (/^(URL Source|Markdown Content|Page text|Shared text)\b/i.test(l))
        return false
      if (/^Image\s*\d+/i.test(l)) return false
      if (l.length < 2) return false
      return true
    })

  return lines.join('\n').replace(/[ \t]{2,}/g, ' ').trim()
}

/**
 * Rewrite shop URLs toward the UI language when the site supports it
 * (e.g. amazon.eg/-/en/ → /-/ar/).
 */
export function localizeProductUrl(
  url: string,
  language: AppLanguage,
): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()

    if (host.includes('amazon.')) {
      u.pathname = u.pathname.replace(
        /\/-\/(en|ar)(?=\/|$)/i,
        `/-/${language}`,
      )
      if (u.searchParams.has('language')) {
        u.searchParams.set(
          'language',
          language === 'ar' ? 'ar_AE' : 'en_AE',
        )
      }
    }

    if (host === 'noon.com' || host.endsWith('.noon.com')) {
      u.pathname = u.pathname.replace(
        /^\/(egypt-en|saudi-en|uae-en|egypt-ar|saudi-ar|uae-ar)/i,
        (m) =>
          language === 'ar'
            ? m.replace(/-en$/i, '-ar')
            : m.replace(/-ar$/i, '-en'),
      )
    }

    return u.href
  } catch {
    return url
  }
}

/**
 * Shorten noisy shop URLs when safe. For Noon we keep the descriptive slug
 * (bot walls often hit the SKU-only form harder in browsers) and only drop tracking.
 */
export function canonicalizeProductUrl(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()

    if (host === 'noon.com' || host.endsWith('.noon.com')) {
      // Keep /egypt-ar/{slug}/N…/p/ — only strip ?o= tracking
      u.search = ''
      u.hash = ''
      return u.href
    }

    // Amazon: drop noisy ref tracking when ASIN present
    if (host.includes('amazon.')) {
      const asin = u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})\b/i)?.[1]
      if (asin) {
        const locale = u.pathname.match(/\/-\/(ar|en)(?=\/)/i)?.[0] ?? ''
        u.pathname = `${locale}/dp/${asin}`
        u.search = ''
        u.hash = ''
        return u.href
      }
    }

    return u.href
  } catch {
    return url
  }
}

/** Noon SKU-only URL — useful as a second fetch attempt. */
export function noonSkuUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()
    if (!(host === 'noon.com' || host.endsWith('.noon.com'))) return null
    const sku = u.pathname.match(/\/(N[A-Z0-9]+)\b/i)?.[1]
    const locale =
      u.pathname
        .match(/^\/((?:egypt|saudi|uae|kuwait|bahrain|oman|qatar)-(?:ar|en))\b/i)?.[1] ||
      'egypt-ar'
    if (!sku) return null
    return `https://www.noon.com/${locale}/${sku}/p/`
  } catch {
    return null
  }
}

/**
 * Build a readable product title from a Noon (or similar) URL slug when
 * the shop blocks remote reading.
 */
export function productHintFromUrl(url: string | null | undefined): {
  title: string | null
  brand: string | null
  sku: string | null
} {
  if (!url?.trim()) return { title: null, brand: null, sku: null }
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()

    if (host === 'noon.com' || host.endsWith('.noon.com')) {
      const sku = u.pathname.match(/\/(N[A-Z0-9]+)\b/i)?.[1] ?? null
      const slug = u.pathname.match(
        /\/(?:egypt|saudi|uae|kuwait|bahrain|oman|qatar)-(?:ar|en)\/([^/]+)\/N[A-Z0-9]+/i,
      )?.[1]
      if (!slug || /^N[A-Z0-9]+$/i.test(slug)) {
        return { title: null, brand: null, sku }
      }
      const words = slug.split(/[-_]+/).filter(Boolean)
      const title = words
        .map((w) => {
          if (/^\d+(?:l|w|ml|kg|gb|tb)$/i.test(w)) return w.toUpperCase()
          if (/^[a-z]{1,3}\d/i.test(w)) return w.toUpperCase() // EC685
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        })
        .join(' ')
        .replace(/\bBk\b/g, 'Black')
        .trim()
      const brand = words[0]
        ? words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase()
        : null
      // "Dedica" is the model line; brand often comes from page — keep first token as hint only if known
      return {
        title: title || null,
        brand: /delonghi|skmei|apple|samsung|lapetra|sony|huawei/i.test(slug)
          ? brand
          : null,
        sku,
      }
    }

    if (host.includes('amazon.')) {
      const slug = u.pathname.match(/\/([^/]+)\/dp\//i)?.[1]
      if (slug && slug.length > 3 && !/^dp$/i.test(slug)) {
        const title = slug.split(/[-_]+/).filter(Boolean).join(' ')
        return {
          title: title.slice(0, 160),
          brand: slug.split('-')[0] || null,
          sku: u.pathname.match(/\/dp\/([A-Z0-9]{10})/i)?.[1] ?? null,
        }
      }
    }

    return { title: null, brand: null, sku: null }
  } catch {
    return { title: null, brand: null, sku: null }
  }
}

/** True when a reader returned a bot / privacy interstitial instead of a PDP. */
export function isBlockedShopShell(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  const wall =
    /powered and protected by privacy|just a moment(?:\.\.\.)?|attention required|cf-browser-verification|enable javascript to continue|access denied|robot check|captcha|verify you are human/i.test(
      t,
    )
  if (!wall) return false
  // Real product pages mention price / cart even if a banner exists (amount may be on next line)
  const hasProduct =
    /(?:EGP|SAR|AED|USD|جنيه|ريال|درهم)\s*[\d,.]+|[\d,.]{2,}\s*(?:EGP|SAR|AED|USD|جنيه|ريال|درهم)|(?:جنيه|EGP)\s*\n\s*[\d,.]+|add to cart|أضف إلى|اشتر|buy now|السعر/i.test(
      t,
    )
  return !hasProduct
}

/**
 * When readers bury the PDP under privacy/nav chrome, keep a window around
 * the first substantial price (or a titled product block). Never blind-truncate
 * the head of the document — Noon prices often sit past 40k chars.
 */
export function extractProductReaderWindow(
  raw: string,
  maxChars = 12000,
): string {
  const text = raw.replace(/\r/g, '')
  if (text.length <= maxChars) return text

  const priceAt = (() => {
    const patterns = [
      /(?:جنيه|EGP)\s*\n\s*[\d]{2,7}(?:\.\d+)?/i,
      /(?:جنيه|EGP|SAR|AED|USD)\s*[\d]{2,7}(?:[.,]\d+)*/i,
      /[\d]{2,7}(?:\.\d+)?\s*(?:جنيه|EGP)/i,
    ]
    let best = -1
    for (const re of patterns) {
      const m = re.exec(text)
      if (m && (best < 0 || m.index < best)) best = m.index
    }
    return best
  })()

  if (priceAt >= 0) {
    const start = Math.max(0, priceAt - 2500)
    return text.slice(start, start + maxChars)
  }

  // Fall back: skip leading privacy wall, keep from first Title: or long line
  const titleAt = text.search(/^Title:\s*.{12,}/im)
  if (titleAt > 500) {
    return text.slice(titleAt, titleAt + maxChars)
  }

  return text.slice(0, maxChars)
}

const NOON_CHROME =
  /^(آخر|القاهرة|دبي|الرياض|English|العربية|تسجيل الدخول|الطلبيات|المفضلة|عربة التسوق|الإلكترونيات|أزياء|لوازم|البيبي|الألعاب|السوبرماركت|الرئيسية|عرض الكل|يُباع معها|تفاصيل التوصيل|اطلب خلال|احصل عليه|خصم على الدفع|إدفع|تم بيع|باقي \d|أفضل المنتجات|#\d+|Grey|Metal|Pink|Silver|White|Beige|Green|متعدد الألوان|أحمر|Electronics|Fashion|Cart|Wishlist|Sign in|Powered and protected by Privacy)$/i

/** Drop Noon mega-menu chrome; keep product block around title/price. */
export function distillShopReaderText(text: string, pageUrl?: string | null): string {
  const host = (() => {
    try {
      return pageUrl ? new URL(pageUrl).hostname : ''
    } catch {
      return ''
    }
  })().replace(/^www\./i, '').toLowerCase()

  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (!host.includes('noon.com')) {
    return lines.join('\n')
  }

  const filtered = lines.filter((l) => !NOON_CHROME.test(l) && l.length > 1)

  // Prefer window around first big EGP price (product, not accessory 100–500)
  const priceIdx = filtered.findIndex((l, i) => {
    const next = filtered[i + 1] ?? ''
    const prev = filtered[i - 1] ?? ''
    const joined = `${prev} ${l} ${next}`
    const m = joined.match(
      /(?:جنيه|EGP)\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:جنيه|EGP)/i,
    )
    if (!(m?.[1] || m?.[2])) return false
    const n = Number.parseFloat((m[1] ?? m[2] ?? '').replace(/,/g, ''))
    return Number.isFinite(n) && n >= 50
  })

  if (priceIdx >= 0) {
    const start = Math.max(0, priceIdx - 8)
    const end = Math.min(filtered.length, priceIdx + 40)
    return filtered.slice(start, end).join('\n')
  }

  return filtered.join('\n')
}

function pickLabeled(text: string, labels: RegExp[]): string | null {
  for (const re of labels) {
    const m = text.match(re)
    if (m?.[1]?.trim()) return m[1].trim()
  }
  return null
}

/**
 * Turn raw Jina / reader markdown into a clean extraction snippet
 * (Page title / Description / Page text).
 */
export function readerMarkdownToSnippet(
  raw: string,
  pageUrl?: string | null,
): string | null {
  if (isBlockedShopShell(raw)) return null

  const decoded = decodeEntities(raw)
  let title =
    pickLabeled(decoded, [/^Title:\s*(.+)$/im, /^#\s+(.+)$/m]) || null

  if (title && isJunkFieldValue(title)) title = null

  if (title) {
    title = title
      .replace(/^تسوق\s+/i, '')
      .replace(/^تسوق\s+.+\s+و/i, '')
      .replace(/\s*أونلاين في مصر\s*$/i, '')
      .replace(/\s*online in egypt\s*$/i, '')
      .trim()
  }

  // Prefer slug title over empty / wall titles
  if (!title || isJunkFieldValue(title)) {
    const fromUrl = productHintFromUrl(pageUrl ?? undefined).title
    if (fromUrl) title = fromUrl
  }

  let cleaned = stripMarkdownNoise(decoded)
  cleaned = distillShopReaderText(cleaned, pageUrl)
  if (!cleaned && !title) return null

  // Prefer an “about / description / نبذة” paragraph
  const about = pickLabeled(cleaned, [
    /(?:^|\n)(?:About(?: this item)?|Product description|Description|Overview|Highlights|المواصفات|المميزات|نبذة|الوصف|تفاصيل المنتج)\s*[:：]?\s*\n?([\s\S]{20,600}?)(?=\n(?:About|Description|نبذة|الوصف|Specifications|المواصفات|#|\*|$)|\n\n\n)/i,
  ])

  // Noon often has brand line then product name near price
  if (!title || /^noon$/i.test(title)) {
    const productLine = cleaned
      .split('\n')
      .find(
        (l) =>
          l.length > 20 &&
          l.length < 160 &&
          !/جنيه|EGP|تقييم|تفاصيل|إدفع/i.test(l),
      )
    if (productLine) title = productLine
  }

  const body = cleaned
    .split('\n')
    .filter((l) => {
      if (title && l === title) return false
      if (/^(About|Description|نبذة|الوصف)\s*$/i.test(l)) return false
      return true
    })
    .join('\n')
    .slice(0, 5500)

  // Explicit price line helps parsers when currency & amount are on separate lines
  let priceLine: string | null = null
  const pricePair = cleaned.match(
    /(?:جنيه|EGP)\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:جنيه|EGP)/i,
  )
  if (pricePair) {
    const n = (pricePair[1] ?? pricePair[2] ?? '').replace(/,/g, '')
    if (Number.parseFloat(n) >= 50) priceLine = `Price: ${n} EGP`
  } else {
    const loose = cleaned.match(/(?:جنيه|EGP)\s*\n\s*([\d,]+(?:\.\d+)?)/i)
    if (loose?.[1] && Number.parseFloat(loose[1].replace(/,/g, '')) >= 50) {
      priceLine = `Price: ${loose[1].replace(/,/g, '')} EGP`
    }
  }

  const snippet = [
    title && `Page title: ${title}`,
    priceLine,
    about && `Description: ${about.replace(/\s+/g, ' ').trim().slice(0, 500)}`,
    body && `Page text:\n${body}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  return snippet || null
}

/** True when a spec/summary string is scrape junk, not a product attribute. */
export function isJunkFieldValue(value: string): boolean {
  const v = value.trim()
  if (!v) return true
  if (v.length > 220) return true
  if (/powered and protected by privacy/i.test(v)) return true
  if (
    /!\[[^\]]*\]|\[[^\]]+\]\(|https?:\/\/|www\.|URL Source|Markdown Content|Page text|Shared text|Image\s*\d+/i.test(
      v,
    )
  ) {
    return true
  }
  if (/^(نبذة|الوصف|About|Description|Overview|Title|Heading)\s*$/i.test(v)) {
    return true
  }
  // Truncated markdown / HTML crumbs
  if (/\(https?:\s*$/i.test(v) || /&amp;|&lt;|&gt;/.test(v)) return true
  if ((v.match(/https?:/gi) ?? []).length >= 1) return true
  return false
}

export function sanitizeSummary(
  summary: string | null | undefined,
): string | null {
  if (!summary?.trim()) return null
  let s = stripMarkdownNoise(summary)
  s = s
    .replace(/^(نبذة|الوصف|About|Description)\s*[:：]?\s*/i, '')
    .replace(/\bPage text:\s*/gi, '')
    .replace(/\bURL Source:\s*\S+/gi, '')
    .replace(/\bMarkdown Content:\s*/gi, '')
    .replace(/\s*[·|]\s*/g, ' · ')
    .replace(/(?: · ){2,}/g, ' · ')
    .trim()

  // Drop segments that are just chrome
  const parts = s
    .split(/\s·\s/)
    .map((p) => p.trim())
    .filter((p) => p && !isJunkFieldValue(p) && p.length > 2)

  s = parts.join(' · ').slice(0, 280).trim()
  if (!s || isJunkFieldValue(s)) return null
  return s
}

export function sanitizeSpecs(
  specs: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(specs)) {
    if (value == null) continue
    if (/^(source|url|link|website|href|image|img|photo)$/i.test(key)) continue
    if (typeof value === 'string') {
      const cleaned = decodeEntities(value).replace(/\s+/g, ' ').trim()
      if (isJunkFieldValue(cleaned)) continue
      if (cleaned.length > 80) continue
      out[key.trim().slice(0, 40)] = cleaned
    } else {
      out[key.trim().slice(0, 40)] = value
    }
  }
  return out
}

export function sanitizeTitle(title: string): string {
  let t = stripMarkdownNoise(title).replace(/\s+/g, ' ').trim()
  t = t.replace(/^(Title|Page title|Heading)\s*[:：]\s*/i, '')
  t = t.replace(/^تسوق\s+/i, '')
  // Noon: "تسوق Brand وActual title..." or "Brand وActual title..."
  t = t.replace(/^تسوق\s+\S+\s+و/i, '')
  t = t.replace(/^[\u0600-\u06FFa-zA-Z0-9.'’-]{2,24}\s+و(?=[\u0600-\u06FF])/i, '')
  t = t.replace(/\s*أونلاين في مصر\s*$/i, '')
  t = t.replace(/\s*online in egypt\s*$/i, '')
  if (!t || isJunkFieldValue(t)) return 'Untitled product'
  return t.slice(0, 160)
}
