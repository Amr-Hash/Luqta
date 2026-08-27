import type { AppLanguage, ExtractedProduct, ProductSpecs } from '@/types/product'
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
    /(?:SAR|USD|EGP|AED|EUR|GBP|€|\$|£|ر\.?\s?س\.?|ج\.?\s?م\.?)\s*([\d,.]+)|([\d,.]+)\s*(?:SAR|USD|EGP|AED|EUR|GBP|ريال|جنيه|درهم)/i,
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
    /(?:size|screen)\s*[:：]?\s*([^\n,|/]+)/i,
    /(?:المقاس|الحجم|الشاشة)\s*[:：]?\s*([^\n,|/]+)/i,
  ])
  if (size) specs.size = size

  return specs
}

function guessBrand(title: string): string | null {
  const token = title.trim().split(/\s+/)[0]
  if (!token || token.length < 2) return null
  if (/^\d/.test(token)) return null
  return token.replace(/[^a-zA-Z\u0600-\u06FF0-9.+-]/g, '') || null
}

function guessCategory(source: string, language: AppLanguage): string | null {
  const rules: { re: RegExp; ar: string; en: string }[] = [
    { re: /phone|iphone|galaxy|موبايل|هاتف|جوال/i, ar: 'هواتف', en: 'Phones' },
    { re: /laptop|notebook|macbook|لابتوب|حاسوب/i, ar: 'لابتوب', en: 'Laptops' },
    { re: /headphone|earbud|سماعة/i, ar: 'سماعات', en: 'Audio' },
    { re: /tv|television|تلفاز/i, ar: 'تلفزيون', en: 'TVs' },
    { re: /shoe|sneakers|حذاء/i, ar: 'أحذية', en: 'Shoes' },
  ]
  for (const rule of rules) {
    if (rule.re.test(source)) return language === 'ar' ? rule.ar : rule.en
  }
  return null
}

/** Fully local extraction — no network, no WebGPU, no external models. */
export function extractProductFromText(source: string): ExtractedProduct {
  const language = detectInputLanguage(source)
  const lines = source
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)

  const urlLine = lines.find((l) => l.startsWith('URL:'))
  const titleLine =
    lines.find((l) => l.startsWith('Title:'))?.replace(/^Title:\s*/i, '') ||
    lines.find(
      (l) =>
        !l.startsWith('URL:') &&
        !l.startsWith('Shared') &&
        !/^https?:\/\//i.test(l),
    ) ||
    'Untitled product'

  const { price, currency } = parsePrice(source)
  const specs = extractSpecs(source)
  if (urlLine) {
    specs.source = urlLine.replace(/^URL:\s*/i, '')
  }

  const brand = guessBrand(titleLine)
  const category = guessCategory(source, language)
  const sharedBlock = lines
    .filter((l) => !l.startsWith('Title:') && !l.startsWith('URL:'))
    .slice(0, 4)
    .join(' · ')

  return {
    title: titleLine.slice(0, 160),
    brand,
    price,
    currency,
    category,
    specs,
    summary: sharedBlock.slice(0, 280) || null,
    language,
  }
}
