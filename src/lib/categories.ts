import type { AppLanguage } from '@/types/product'

/** Stable keys used for grouping, similarity, and fingerprints. */
export type CategoryKey =
  | 'perfume'
  | 'phone'
  | 'laptop'
  | 'audio'
  | 'tv'
  | 'shoes'
  | 'cosmetics'
  | 'food'
  | 'clothing'
  | 'other'

const LABELS: Record<CategoryKey, { ar: string; en: string }> = {
  perfume: { ar: 'عطور', en: 'Perfumes' },
  phone: { ar: 'هواتف', en: 'Phones' },
  laptop: { ar: 'لابتوب', en: 'Laptops' },
  audio: { ar: 'سماعات', en: 'Audio' },
  tv: { ar: 'تلفزيون', en: 'TVs' },
  shoes: { ar: 'أحذية', en: 'Shoes' },
  cosmetics: { ar: 'تجميل', en: 'Cosmetics' },
  food: { ar: 'طعام', en: 'Food' },
  clothing: { ar: 'ملابس', en: 'Clothing' },
  other: { ar: 'أخرى', en: 'Other' },
}

/** Synonyms / singular / plural / Arabic → one key. */
const SYNONYMS: { key: CategoryKey; re: RegExp }[] = [
  {
    key: 'perfume',
    re: /\b(perfume|perfumes|fragrance|fragrances|cologne|attar|oud|eau\s*de\s*parfum|edp|edt|solid\s*perfume|body\s*mist)\b|مخمر(?:ية|يات)?|عطر(?:ة|ات|ي|ية)?|عطور|بخور|دهن\s*عود/i,
  },
  {
    key: 'phone',
    re: /\b(phone|phones|smartphone|iphone|galaxy|mobile|handset)\b|موبايل|هواتف?|جوال|آيفون/i,
  },
  {
    key: 'laptop',
    re: /\b(laptop|laptops|notebook|macbook|ultrabook)\b|لابتوب|حاسوب|كمبيوتر\s*محمول/i,
  },
  {
    key: 'audio',
    re: /\b(headphone|headphones|earbud|earbuds|earphone|earphones|headset|airpods|speaker|audio)\b|سماعات?|سبيكر/i,
  },
  {
    key: 'tv',
    re: /\b(tv|tvs|television|televisions|smart\s*tv)\b|تلفاز|تلفزيون/i,
  },
  {
    key: 'shoes',
    re: /\b(shoe|shoes|sneaker|sneakers|boot|boots|sandal|sandals)\b|أحذية?|حذاء|صندل/i,
  },
  {
    key: 'cosmetics',
    re: /\b(cosmetic|cosmetics|skincare|makeup|serum|moisturizer|cream|lotion|lipstick)\b|تجميل|مكياج|عناية|كريم|مرطب/i,
  },
  {
    key: 'food',
    re: /\b(food|spice|spices|nuts|honey|tea|snack)\b|\bcoffee\b(?!\s*(?:machine|maker|espresso|grinder))|طعام|بهارات?|مكسرات?|قهوة(?!\s*ماكينة)|عسل|شاي/i,
  },
  {
    key: 'clothing',
    re: /\b(clothing|clothes|apparel|shirt|dress|jacket|hoodie|pants)\b|ملابس|قميص|فستان|جاكيت/i,
  },
]

export function categoryLabel(key: CategoryKey, language: AppLanguage): string {
  return language === 'ar' ? LABELS[key].ar : LABELS[key].en
}

export function categoryKeyFromText(raw: string | null | undefined): CategoryKey | null {
  if (!raw?.trim()) return null
  const text = raw.trim()
  for (const { key, re } of SYNONYMS) {
    if (re.test(text)) return key
  }
  return null
}

/** Map free-form / LLM / heuristic labels onto one canonical localized label. */
export function normalizeCategory(
  raw: string | null | undefined,
  language: AppLanguage,
  sourceHint?: string,
): string | null {
  const fromRaw = categoryKeyFromText(raw)
  const fromHint = sourceHint ? categoryKeyFromText(sourceHint) : null
  const key = fromRaw ?? fromHint
  if (!key) {
    const cleaned = raw?.trim()
    return cleaned || null
  }
  return categoryLabel(key, language)
}

export function categoryKeyOf(label: string | null | undefined): CategoryKey {
  return categoryKeyFromText(label) ?? 'other'
}

export function categoriesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a?.trim() || !b?.trim()) return false
  const ka = categoryKeyFromText(a)
  const kb = categoryKeyFromText(b)
  if (ka && kb) return ka === kb
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** Canonical English names for the LLM system prompt. */
export const CANONICAL_CATEGORY_NAMES = Object.values(LABELS).map((l) => l.en)
