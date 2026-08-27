import type { AppLanguage } from '@/types/product'

/** Stable keys used for grouping, similarity, and fingerprints. */
export type CategoryKey =
  | 'watch'
  | 'jewelry'
  | 'phone'
  | 'laptop'
  | 'gaming'
  | 'audio'
  | 'tv'
  | 'appliances'
  | 'furniture'
  | 'bags'
  | 'shoes'
  | 'clothing'
  | 'sports'
  | 'baby'
  | 'perfume'
  | 'cosmetics'
  | 'food'
  | 'books'
  | 'other'

const LABELS: Record<CategoryKey, { ar: string; en: string }> = {
  watch: { ar: 'ساعات', en: 'Watches' },
  jewelry: { ar: 'مجوهرات', en: 'Jewelry' },
  phone: { ar: 'هواتف', en: 'Phones' },
  laptop: { ar: 'لابتوب', en: 'Laptops' },
  gaming: { ar: 'ألعاب', en: 'Gaming' },
  audio: { ar: 'سماعات', en: 'Audio' },
  tv: { ar: 'تلفزيون', en: 'TVs' },
  appliances: { ar: 'أجهزة منزلية', en: 'Appliances' },
  furniture: { ar: 'أثاث', en: 'Furniture' },
  bags: { ar: 'حقائب', en: 'Bags' },
  shoes: { ar: 'أحذية', en: 'Shoes' },
  clothing: { ar: 'ملابس', en: 'Clothing' },
  sports: { ar: 'رياضة', en: 'Sports' },
  baby: { ar: 'أطفال', en: 'Baby' },
  perfume: { ar: 'عطور', en: 'Perfumes' },
  cosmetics: { ar: 'تجميل', en: 'Cosmetics' },
  food: { ar: 'طعام', en: 'Food' },
  books: { ar: 'كتب', en: 'Books' },
  other: { ar: 'أخرى', en: 'Other' },
}

/**
 * Specific product types first — mega-menu words (Perfumes, Fashion) last
 * among ambiguous groups so title/leaf crumbs win when scanned alone.
 */
const SYNONYMS: { key: CategoryKey; re: RegExp }[] = [
  {
    key: 'watch',
    re: /\b(watch|watches|wristwatch|wrist\s*watch|smartwatch|timepiece)\b|ساعات?|ساعة\s*(?:يد|رقمية|رجالية|نسائية|ذكية)?/i,
  },
  {
    key: 'jewelry',
    re: /\b(jewelry|jewellery|necklace|bracelet|earrings?|pendant|wedding\s+rings?)\b|مجوهرات|عقد|أسورة|أقراط|خاتم/i,
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
    key: 'gaming',
    re: /\b(playstation|xbox|nintendo|gaming\s*console|video\s*game|controller)\b|بلايستيشن|إكس\s*بوكس|نintendو|ألعاب\s*فيديو/i,
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
    key: 'appliances',
    re: /\b(espresso(?:\s*machine)?|coffee\s*(?:machine|maker)|cappuccino\s*machine|milk\s*frother|thermo\s*block|kitchen\s*appliance|home\s*appliance|blender|mixer|toaster|kettle|microwave|micro[\s-]?wave|air\s*fryer|vacuum\s*cleaner|washing\s*machine|dishwasher|refrigerator|fridge|oven)\b|ماكينة|ماكينات|إسبرسو|اسبريسو|إكسبريسو|صانعات?\s*(?:ال)?قهوة|أجهزة\s*(?:صغيرة|منزلية)|الأجهزة\s*الصغيرة|المطبخ\s*والأجهزة|فرّامة|خلاط|غلاية|مكنسة|توستر|ثلاجة|غسالة|مايكروويف|ميكروويف|أفران?\s*مايكروويف|فرن/i,
  },
  {
    key: 'furniture',
    re: /\b(furniture|sofa|couch|mattress|desk|wardrobe|dining\s*table)\b|أثاث|كنبة|سرير|مكتب|خزانة/i,
  },
  {
    key: 'bags',
    re: /\b(bag|bags|handbag|backpack|tote|luggage|suitcase)\b|حقائب?|حقيبة|شنطة|ظهرية/i,
  },
  {
    key: 'shoes',
    re: /\b(shoe|shoes|sneaker|sneakers|boot|boots|sandal|sandals)\b|أحذية?|حذاء|صندل/i,
  },
  {
    key: 'sports',
    re: /\b(sports?|fitness|yoga|dumbbell|treadmill|bicycle|bike)\b|رياضة|لياقة|دراجة|أوزان/i,
  },
  {
    key: 'baby',
    re: /\b(baby|infant|stroller|diaper|pacifier)\b|أطفال|رضع|عربة\s*أطفال|حفاض/i,
  },
  {
    key: 'perfume',
    re: /\b(perfume|perfumes|fragrance|fragrances|cologne|attar|eau\s*de\s*parfum|edp|edt|solid\s*perfume|body\s*mist|makhmaria)\b|مخمر(?:ية|يات)?|عطور|عطر(?:ة|ات)?|بخور|دهن\s*عود/i,
  },
  {
    key: 'cosmetics',
    re: /\b(cosmetic|cosmetics|skincare|makeup|serum|moisturizer|lipstick|shampoo)\b|تجميل|مكياج|عناية\s*بالبشرة/i,
  },
  {
    key: 'food',
    re: /\b(food|spice|spices|nuts|honey|tea|snack|grocery)\b|\bcoffee\b(?!\s*(?:machine|maker|espresso|grinder|pod|capsule))|طعام|بهارات?|مكسرات?|عسل|شاي|حبوب\s*قهوة|قهوة\s*(?:مطحونة|سريعة|غامقة|فاتحة)?(?:\s|$)|بقالة/i,
  },
  {
    key: 'clothing',
    re: /\b(clothing|clothes|apparel|shirt|dress|jacket|hoodie|pants|fashion)\b|ملابس|قميص|فستان|جاكيت|أزياء/i,
  },
  {
    key: 'books',
    re: /\b(book|books|novel|textbook|ebook)\b|كتب|كتاب|رواية/i,
  },
]

/** Broad / nav-heavy keys that lose to a more specific title match. */
const WEAK_KEYS = new Set<CategoryKey>([
  'perfume',
  'clothing',
  'food',
  'cosmetics',
  'other',
])

export function categoryLabel(key: CategoryKey, language: AppLanguage): string {
  return language === 'ar' ? LABELS[key].ar : LABELS[key].en
}

export function categoryKeyFromText(
  raw: string | null | undefined,
): CategoryKey | null {
  if (!raw?.trim()) return null
  const text = raw.trim()
  for (const { key, re } of SYNONYMS) {
    if (re.test(text)) return key
  }
  return null
}

function leafBreadcrumbs(crumbs: string[] | undefined): string {
  if (!crumbs?.length) return ''
  return crumbs.slice(-2).join(' ')
}

export type ResolveCategoryInput = {
  title?: string | null
  breadcrumbs?: string[]
  about?: string | null
  /** LLM or free-form label */
  hint?: string | null
  /** Full page / share blob — last resort */
  pageText?: string | null
}

/**
 * Classify from product-facing signals: title → leaf crumbs → about → hint → page.
 * Resolves conflicts (nav Perfumes vs watch; Food vs coffee machine).
 */
export function resolveCategoryKey(input: ResolveCategoryInput): CategoryKey | null {
  const title = input.title?.trim() || ''
  const crumbs = leafBreadcrumbs(input.breadcrumbs)
  const about = input.about?.trim().slice(0, 400) || ''
  const hint = input.hint?.trim() || ''
  const page = input.pageText?.trim().slice(0, 4000) || ''

  const fromTitle = title ? categoryKeyFromText(title) : null
  const fromCrumbs = crumbs ? categoryKeyFromText(crumbs) : null
  const fromAbout = about ? categoryKeyFromText(about) : null
  const fromHint = hint ? categoryKeyFromText(hint) : null
  const fromPage = page ? categoryKeyFromText(page) : null

  let key =
    fromTitle ?? fromCrumbs ?? fromAbout ?? fromHint ?? fromPage ?? null

  // Specific title beats weak nav/LLM labels
  if (
    fromTitle &&
    key &&
    WEAK_KEYS.has(key) &&
    !WEAK_KEYS.has(fromTitle) &&
    fromTitle !== key
  ) {
    key = fromTitle
  }

  // Leaf breadcrumb specific type beats weak title/hint (e.g. Espresso Machines)
  if (
    fromCrumbs &&
    !WEAK_KEYS.has(fromCrumbs) &&
    (!key || WEAK_KEYS.has(key))
  ) {
    key = fromCrumbs
  }

  // Appliances vs Food (قهوة / coffee)
  if (
    (key === 'food' || fromHint === 'food' || fromPage === 'food') &&
    (fromTitle === 'appliances' ||
      fromCrumbs === 'appliances' ||
      fromAbout === 'appliances' ||
      categoryKeyFromText(`${title} ${crumbs}`) === 'appliances')
  ) {
    key = 'appliances'
  }

  // Watches vs Jewelry
  if (
    key === 'jewelry' &&
    (fromTitle === 'watch' || /wrist|ساعة\s*يد|smartwatch/i.test(title))
  ) {
    key = 'watch'
  }

  return key
}

function extractTitleFromHint(sourceHint?: string): string | null {
  return (
    sourceHint?.match(/(?:^|\n)(?:Title|Page title|Heading):\s*(.+)/i)?.[1]?.trim() ||
    null
  )
}

function extractCrumbsFromHint(sourceHint?: string): string[] {
  const line = sourceHint?.match(
    /(?:^|\n)\s*Category breadcrumbs:\s*(.+)/i,
  )?.[1]
  if (!line) return []
  return line
    .split(/\s*[›>\/|]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function extractAboutFromHint(sourceHint?: string): string | null {
  return (
    sourceHint?.match(
      /(?:^|\n)(?:Description|About this item|نبذة|الوصف):\s*(.+)/i,
    )?.[1]?.trim() || null
  )
}

/**
 * Map free-form / LLM / heuristic labels onto one canonical localized label.
 */
export function normalizeCategory(
  raw: string | null | undefined,
  language: AppLanguage,
  sourceHint?: string,
): string | null {
  const key = resolveCategoryKey({
    title: extractTitleFromHint(sourceHint) || raw,
    breadcrumbs: extractCrumbsFromHint(sourceHint),
    about: extractAboutFromHint(sourceHint),
    hint: raw,
    pageText: sourceHint,
  })

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
