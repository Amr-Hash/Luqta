import type { AppLanguage, ExtractedProduct, ProductSpecs } from '@/types/product'
import { normalizeCategory } from '@/lib/categories'
import { detectInputLanguage } from '@/lib/similarity'

function firstMatch(source: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const m = source.match(pattern)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

function parsePrice(source: string): { price: number | null; currency: string | null } {
  const priceMatch = source.match(
    /(?:SAR|USD|EGP|AED|EUR|GBP|€|\$|£|ر\.?\s?س\.?|ج\.?\s?م\.?)\s*([\d,.]+)|([\d,.]+)\s*(?:SAR|USD|EGP|AED|EUR|GBP|ريال|جنيه|درهم|ج\.?\s?م\.?)/i,
  )
  const priceRaw = priceMatch?.[1] ?? priceMatch?.[2]
  const price = priceRaw ? Number.parseFloat(priceRaw.replace(/,/g, '')) : null

  let currency: string | null = null
  if (/SAR|ر\.?\s?س|ريال/i.test(source)) currency = 'SAR'
  else if (/EGP|ج\.?\s?م|جنيه/i.test(source)) currency = 'EGP'
  else if (/AED|درهم/i.test(source)) currency = 'AED'
  else if (/EUR|€/.test(source)) currency = 'EUR'
  else if (/GBP|£/.test(source)) currency = 'GBP'
  else if (/USD|\$/.test(source)) currency = 'USD'

  return {
    price: Number.isFinite(price) ? price : null,
    currency,
  }
}

function extractSpecs(source: string): ProductSpecs {
  const specs: ProductSpecs = {}

  const ram = firstMatch(source, [
    /(\d+)\s*GB\s*RAM/i,
    /RAM\s*[:：]?\s*(\d+\s*GB)/i,
    /ذاكرة\s*(?:رام)?\s*[:：]?\s*(\d+\s*جيجا|\d+\s*GB)/i,
  ])
  if (ram) specs.RAM = ram

  const storage = firstMatch(source, [
    /(\d+)\s*GB\s*(?:storage|SSD|ROM)/i,
    /(?:storage|SSD|ROM)\s*[:：]?\s*(\d+\s*GB)/i,
    /تخزين\s*[:：]?\s*(\d+\s*جيجا|\d+\s*GB)/i,
  ])
  if (storage) specs.storage = storage

  const color = firstMatch(source, [
    /(?:color|colour)\s*[:：]?\s*([^\n,|/]+)/i,
    /اللون\s*[:：]?\s*([^\n,|/]+)/i,
  ])
  if (color) specs.color = color

  const size = firstMatch(source, [
    /\b(30g|20g|50g|100g|\d+\s*g)\b/i,
    /(?:size|الحجم|المقاس)\s*[:：]?\s*([^\n,|/]+)/i,
  ])
  if (size) specs.size = size

  return specs
}

function guessBrand(title: string, source: string): string | null {
  if (/ruh|روح/i.test(source)) return 'RUH'
  const token = title.trim().split(/\s+/)[0]
  if (!token || token.length < 2) return null
  if (/^\d/.test(token)) return null
  if (/^(untitled|product|page|title)$/i.test(token)) return null
  return token.replace(/[^a-zA-Z\u0600-\u06FF0-9.+-]/g, '') || null
}

function guessCategory(source: string, language: AppLanguage): string | null {
  return normalizeCategory(source, language, source)
}

function pickTitle(source: string, lines: string[]): string {
  const labeled =
    firstMatch(source, [
      /(?:^|\n)Title:\s*(.+)/i,
      /(?:^|\n)Page title:\s*(.+)/i,
      /(?:^|\n)Heading:\s*(.+)/i,
    ]) ?? null

  if (labeled && !/^(untitled|product)$/i.test(labeled)) {
    return labeled.slice(0, 160)
  }

  const contentLine = lines.find(
    (l) =>
      !/^(URL|Title|Page title|Heading|Description|Shared text|Page text):/i.test(
        l,
      ) &&
      !/^https?:\/\//i.test(l) &&
      l.length > 2,
  )
  if (contentLine) return contentLine.slice(0, 160)

  return 'Untitled product'
}

/** Local parsing of shared text + optional fetched page HTML text. No AI services. */
export function extractProductFromText(source: string): ExtractedProduct {
  const language = detectInputLanguage(source)
  const lines = source
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)

  const url =
    firstMatch(source, [/(?:^|\n)URL:\s*(https?:\/\/\S+)/i]) ||
    source.match(/https?:\/\/[^\s]+/i)?.[0] ||
    null

  const title = pickTitle(source, lines)
  const { price, currency } = parsePrice(source)
  const specs = extractSpecs(source)
  if (url) specs.source = url

  const desc = firstMatch(source, [/(?:^|\n)Description:\s*(.+)/i])
  const brand = guessBrand(title, source)
  const category = normalizeCategory(
    guessCategory(source, language),
    language,
    `${title}\n${source}`,
  )

  const summary =
    desc?.slice(0, 280) ||
    lines
      .filter(
        (l) =>
          !/^(URL|Title|Page title|Heading):/i.test(l) &&
          !/^https?:\/\//i.test(l),
      )
      .slice(0, 3)
      .join(' · ')
      .slice(0, 280) ||
    null

  return {
    title,
    brand,
    price,
    currency,
    category,
    specs,
    summary,
    language,
  }
}
