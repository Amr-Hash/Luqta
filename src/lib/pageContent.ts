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
 * Shorten noisy shop URLs (Noon SKU page) so share/fetch is reliable.
 * https://www.noon.com/egypt-ar/…long-slug…/N36746397A/p/?o=… →
 * https://www.noon.com/egypt-ar/N36746397A/p/
 */
export function canonicalizeProductUrl(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()

    if (host === 'noon.com' || host.endsWith('.noon.com')) {
      const sku = u.pathname.match(/\/(N[A-Z0-9]+)\b/i)?.[1]
      const locale =
        u.pathname.match(
          /^\/(egypt|saudi|uae|kuwait|bahrain|oman|qatar)-(ar|en)\b/i,
        )?.[0]?.replace(/^\//, '') || 'egypt-ar'
      if (sku) {
        u.pathname = `/${locale}/${sku}/p/`
        u.search = ''
        u.hash = ''
        return u.href
      }
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

const NOON_CHROME =
  /^(آخر|القاهرة|دبي|الرياض|English|العربية|تسجيل الدخول|الطلبيات|المفضلة|عربة التسوق|الإلكترونيات|أزياء|لوازم|البيبي|الألعاب|السوبرماركت|الرئيسية|عرض الكل|يُباع معها|تفاصيل التوصيل|اطلب خلال|احصل عليه|خصم على الدفع|إدفع|تم بيع|باقي \d|أفضل المنتجات|#\d+|Grey|Metal|Pink|Silver|White|Beige|Green|متعدد الألوان|أحمر|Electronics|Fashion|Cart|Wishlist|Sign in)$/i

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
    const joined = `${l} ${next}`
    const m = joined.match(/(?:جنيه|EGP)\s*([\d,]+(?:\.\d+)?)/i)
    if (!m?.[1]) return false
    const n = Number.parseFloat(m[1].replace(/,/g, ''))
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
  const decoded = decodeEntities(raw)
  let title =
    pickLabeled(decoded, [/^Title:\s*(.+)$/im, /^#\s+(.+)$/m]) || null

  if (title) {
    title = title
      .replace(/^تسوق\s+/i, '')
      .replace(/\s*أونلاين في مصر\s*$/i, '')
      .replace(/\s*online in egypt\s*$/i, '')
      .trim()
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

  const snippet = [
    title && `Page title: ${title}`,
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
  t = t.replace(/\s*أونلاين في مصر\s*$/i, '')
  t = t.replace(/\s*online in egypt\s*$/i, '')
  if (!t || isJunkFieldValue(t)) return 'Untitled product'
  return t.slice(0, 160)
}
