import type { AppLanguage, Product, SimilarityMatch } from '@/types/product'

/** Normalize for fingerprint / similarity (Arabic + Latin). */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '') // Arabic diacritics
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildFingerprint(input: {
  title: string
  brand?: string | null
  category?: string | null
}): string {
  const parts = [input.brand, input.title, input.category]
    .filter(Boolean)
    .map((p) => normalizeText(String(p)))
  return parts.join('|')
}

function tokens(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(' ')
      .filter((t) => t.length > 1),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter += 1
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

export function scoreSimilarity(a: Product, b: Product): number {
  const titleScore = jaccard(tokens(a.title), tokens(b.title))
  const brandA = normalizeText(a.brand ?? '')
  const brandB = normalizeText(b.brand ?? '')
  const brandBonus =
    brandA && brandB && brandA === brandB ? 0.2 : brandA && brandB ? -0.05 : 0
  const categoryBonus =
    a.category &&
    b.category &&
    normalizeText(a.category) === normalizeText(b.category)
      ? 0.1
      : 0
  return Math.min(1, Math.max(0, titleScore + brandBonus + categoryBonus))
}

export function findSimilarProducts(
  candidate: Pick<Product, 'title' | 'brand' | 'category' | 'fingerprint'>,
  existing: Product[],
  threshold = 0.45,
): SimilarityMatch[] {
  const matches: SimilarityMatch[] = []
  for (const product of existing) {
    if (product.fingerprint === candidate.fingerprint) {
      matches.push({ product, score: 1, reason: 'duplicate' })
      continue
    }
    const score = scoreSimilarity(candidate as Product, product)
    if (score >= threshold) {
      matches.push({
        product,
        score,
        reason: score >= 0.85 ? 'duplicate' : 'similar',
      })
    }
  }
  return matches.sort((x, y) => y.score - x.score)
}

export function detectInputLanguage(text: string): AppLanguage {
  const arabic = (text.match(/[\u0600-\u06FF]/g) ?? []).length
  const latin = (text.match(/[A-Za-z]/g) ?? []).length
  return arabic >= latin ? 'ar' : 'en'
}
