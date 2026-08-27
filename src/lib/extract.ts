import type { AppLanguage, ExtractedProduct, ProductSpecs } from '@/types/product'
import { normalizeCategory, resolveCategoryKey, categoryLabel } from '@/lib/categories'
import {
  isJunkFieldValue,
  sanitizeSpecs,
  sanitizeSummary,
  sanitizeTitle,
  stripMarkdownNoise,
} from '@/lib/pageContent'
import { parsePriceAmount } from '@/lib/price'
import { detectInputLanguage } from '@/lib/similarity'

function firstMatch(source: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const m = source.match(pattern)
    if (m?.[1]) {
      const v = m[1].trim()
      if (!isJunkFieldValue(v)) return v
    }
  }
  return null
}

function extractBreadcrumbs(source: string): string[] {
  const line = source.match(/(?:^|\n)\s*Category breadcrumbs:\s*(.+)/i)?.[1]
  if (!line) return []
  return line
    .split(/\s*[›>\/|]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function extractSpecs(source: string, language: AppLanguage): ProductSpecs {
  const specs: ProductSpecs = {}
  const clean = stripMarkdownNoise(source)

  const ram = firstMatch(clean, [
    /(\d+)\s*GB\s*RAM/i,
    /RAM\s*[:：]?\s*(\d+\s*GB)/i,
    /ذاكرة\s*(?:رام)?\s*[:：]?\s*(\d+\s*جيجا|\d+\s*GB)/i,
  ])
  if (ram) specs[language === 'ar' ? 'الرام' : 'RAM'] = ram

  const storage = firstMatch(clean, [
    /(\d+)\s*GB\s*(?:storage|SSD|ROM)/i,
    /(?:storage|SSD|ROM)\s*[:：]?\s*(\d+\s*GB)/i,
    /تخزين\s*[:：]?\s*(\d+\s*جيجا|\d+\s*GB)/i,
  ])
  if (storage) specs[language === 'ar' ? 'التخزين' : 'storage'] = storage

  const color = firstMatch(clean, [
    /(?:color|colour)\s*[:：]?\s*([A-Za-z\u0600-\u06FF][\w\u0600-\u06FF\s-]{1,40})/i,
    /اللون\s*[:：]?\s*([\u0600-\u06FFa-zA-Z][\w\u0600-\u06FF\s-]{1,40})/i,
  ])
  if (color) specs[language === 'ar' ? 'اللون' : 'color'] = color

  const volume = firstMatch(clean, [
    /\b(\d+(?:\.\d+)?\s*(?:ml|mL|ML|غ|جرام|g|oz))\b/,
    /(?:volume|size|الحجم|المقاس|الوزن)\s*[:：]?\s*([^\n,|/]{1,40})/i,
  ])
  if (volume) specs[language === 'ar' ? 'الحجم' : 'volume'] = volume

  const scent = firstMatch(clean, [
    /(?:scent|notes|fragrance notes|الرائحة|النوتات)\s*[:：]?\s*([^\n]{3,80})/i,
  ])
  if (scent) specs[language === 'ar' ? 'الرائحة' : 'scent'] = scent

  return sanitizeSpecs(specs)
}

function guessBrand(title: string, source: string): string | null {
  const labeled = firstMatch(source, [/(?:^|\n)Brand:\s*(.+)/i])
  if (labeled) return labeled.slice(0, 60)

  if (/ruh|روح/i.test(source)) return 'RUH'
  if (/lapetra/i.test(source)) return 'Lapetra'
  if (/ديلونجي|delonghi|de'?longhi|dedica/i.test(`${title}\n${source}`)) {
    return /[\u0600-\u06FF]/.test(title) ? 'ديلونجي' : "De'Longhi"
  }
  const token = title.trim().split(/\s+/)[0]
  if (!token || token.length < 2) return null
  if (/^\d/.test(token)) return null
  if (/^(untitled|product|page|title|نبذة|الوصف|تسوق)$/i.test(token)) return null
  return token.replace(/[^a-zA-Z\u0600-\u06FF0-9.+'’-]/g, '') || null
}

function guessCategory(
  title: string,
  source: string,
  language: AppLanguage,
): string | null {
  const about = firstMatch(source, [
    /(?:^|\n)Description:\s*(.+)/i,
    /(?:^|\n)(?:نبذة|الوصف)\s*[:：]\s*(.+)/i,
  ])
  const key = resolveCategoryKey({
    title,
    breadcrumbs: extractBreadcrumbs(source),
    about,
    pageText: source,
  })
  if (key) return categoryLabel(key, language)
  return normalizeCategory(title, language, `Title: ${title}\n${source}`)
}

function pickTitle(source: string, lines: string[]): string {
  const labeled =
    firstMatch(source, [
      /(?:^|\n)Title:\s*(.+)/i,
      /(?:^|\n)Page title:\s*(.+)/i,
      /(?:^|\n)Heading:\s*(.+)/i,
    ]) ?? null

  if (labeled && !/^(untitled|product)$/i.test(labeled)) {
    return sanitizeTitle(labeled)
  }

  const contentLine = lines.find(
    (l) =>
      !/^(URL|Title|Page title|Heading|Description|Shared text|Page text|Brand|Price|SKU|Category breadcrumbs|نبذة|الوصف):/i.test(
        l,
      ) &&
      !/^https?:\/\//i.test(l) &&
      !isJunkFieldValue(l) &&
      l.length > 2,
  )
  if (contentLine) return sanitizeTitle(contentLine)

  return 'Untitled product'
}

function pickSummary(source: string, lines: string[]): string | null {
  const desc = firstMatch(source, [
    /(?:^|\n)Description:\s*(.+)/i,
    /(?:^|\n)(?:نبذة|الوصف)\s*[:：]\s*(.+)/i,
  ])
  if (desc && !/Keyboard shortcut|Product summary presents/i.test(desc)) {
    return sanitizeSummary(desc)
  }

  const prose = lines
    .filter(
      (l) =>
        !/^(URL|Title|Page title|Heading|Description|Shared text|Page text|Brand|Price|SKU|Category breadcrumbs|نبذة|الوصف)\b/i.test(
          l,
        ) &&
        !/^https?:\/\//i.test(l) &&
        !isJunkFieldValue(l) &&
        !/Keyboard shortcut|Product summary presents|Skip to|shift\+ALT/i.test(
          l,
        ) &&
        l.length > 25,
    )
    .slice(0, 2)
    .join(' · ')

  return sanitizeSummary(prose)
}

export type ExtractOptions = {
  preferredLanguage?: AppLanguage
}

/** Local parsing of shared text + optional fetched page HTML text. No AI services. */
export function extractProductFromText(
  source: string,
  opts?: ExtractOptions,
): ExtractedProduct {
  const detected = detectInputLanguage(source)
  const language = opts?.preferredLanguage ?? detected
  const cleanedSource = stripMarkdownNoise(source)
  const lines = cleanedSource
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)

  const title = pickTitle(source, lines)
  const { price, currency } = parsePriceAmount(cleanedSource)
  const specs = extractSpecs(cleanedSource, language)
  const brand = guessBrand(title, cleanedSource)
  const category = guessCategory(title, cleanedSource, language)
  const summary = pickSummary(source, lines)

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
