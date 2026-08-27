import type { AppLanguage } from '@/types/product'

/** Stable keys used for grouping, similarity, and fingerprints. */
export type CategoryKey =
  | 'watch'
  | 'phone'
  | 'laptop'
  | 'audio'
  | 'tv'
  | 'shoes'
  | 'perfume'
  | 'cosmetics'
  | 'food'
  | 'clothing'
  | 'other'

const LABELS: Record<CategoryKey, { ar: string; en: string }> = {
  watch: { ar: 'ساعات', en: 'Watches' },
  phone: { ar: 'هواتف', en: 'Phones' },
  laptop: { ar: 'لابتوب', en: 'Laptops' },
  audio: { ar: 'سماعات', en: 'Audio' },
  tv: { ar: 'تلفزيون', en: 'TVs' },
  shoes: { ar: 'أحذية', en: 'Shoes' },
  perfume: { ar: 'عطور', en: 'Perfumes' },
  cosmetics: { ar: 'تجميل', en: 'Cosmetics' },
  food: { ar: 'طعام', en: 'Food' },
  clothing: { ar: 'ملابس', en: 'Clothing' },
  other: { ar: 'أخرى', en: 'Other' },
}

/**
 * Order matters for first-match scans: specific product types before
 * mega-menu words like Perfumes / Fashion that appear on every Amazon page.
 */
const SYNONYMS: { key: CategoryKey; re: RegExp }[] = [
  {
    key: 'watch',
    re: /\b(watch|watches|wristwatch|wrist\s*watch|smartwatch|timepiece)\b|ساعات?|ساعة\s*(?:يد|رقمية|رجالية|نسائية)?/i,
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
    re: /\b(headphone|headphones|earbud|earbuds|earphone|earphones|headset|airpods|speaker)\b|سماعات?|سبيكر/i,
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
    key: 'perfume',
    // Avoid lone "oud" / nav-only noise; prefer clear perfume signals
    re: /\b(perfume|perfumes|fragrance|fragrances|cologne|attar|eau\s*de\s*parfum|edp|edt|solid\s*perfume|body\s*mist|makhmaria)\b|مخمر(?:ية|يات)?|عطور|عطر(?:ة|ات)?|بخور|دهن\s*عود/i,
  },
  {
    key: 'cosmetics',
    re: /\b(cosmetic|cosmetics|skincare|makeup|serum|moisturizer|lipstick)\b|تجميل|مكياج/i,
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

/** Pull the strongest product-facing lines out of an extraction blob. */
function productFocusText(
  raw: string | null | undefined,
  sourceHint?: string,
): string {
  const parts: string[] = []
  if (raw?.trim()) parts.push(raw.trim())

  const hint = sourceHint ?? ''
  const titled = hint.match(
    /(?:^|\n)(?:Title|Page title|Heading):\s*(.+)/i,
  )?.[1]
  if (titled) parts.unshift(titled.trim())

  const about = hint.match(
    /(?:^|\n)(?:Description|About this item|نبذة|الوصف):\s*(.+)/i,
  )?.[1]
  if (about) parts.push(about.trim().slice(0, 400))

  // First non-chrome lines of the hint (often the real product name)
  for (const line of hint.split(/\n+/)) {
    const l = line.trim()
    if (
      l.length > 12 &&
      l.length < 180 &&
      !/^(URL|Title|Page title|Heading|Description|Shared text|Page text|Perfumes|Fashion|Electronics)\b/i.test(
        l,
      )
    ) {
      parts.push(l)
      break
    }
  }

  return parts.join('\n')
}

/**
 * Map free-form / LLM / heuristic labels onto one canonical localized label.
 * Prefers title / product lines over full-page text so Amazon nav “Perfumes”
 * does not override a watch/phone/etc.
 */
export function normalizeCategory(
  raw: string | null | undefined,
  language: AppLanguage,
  sourceHint?: string,
): string | null {
  const focus = productFocusText(raw, sourceHint)
  const fromFocus = categoryKeyFromText(focus)

  // Full-page fallback only when focus had nothing useful
  const fromFull =
    !fromFocus && sourceHint ? categoryKeyFromText(sourceHint) : null

  // If LLM said Perfumes but the product title clearly says Watch, trust the title
  const fromRawAlone = categoryKeyFromText(raw)
  const titleOnly =
    sourceHint?.match(/(?:^|\n)(?:Title|Page title|Heading):\s*(.+)/i)?.[1] ??
    raw
  const fromTitle = titleOnly ? categoryKeyFromText(titleOnly) : null

  let key = fromTitle ?? fromFocus ?? fromRawAlone ?? fromFull

  // Conflict: nav perfume vs real product type in title
  if (
    (fromRawAlone === 'perfume' || fromFull === 'perfume') &&
    fromTitle &&
    fromTitle !== 'perfume'
  ) {
    key = fromTitle
  }

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
