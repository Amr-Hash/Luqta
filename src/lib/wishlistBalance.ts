import type { AppLanguage, Product } from '@/types/product'
import {
  categoryKeyOf,
  categoryLabel,
  type CategoryKey,
} from '@/lib/categories'

export type CurrencyTotal = {
  currency: string
  total: number
  count: number
}

export type CategoryTotal = {
  key: CategoryKey
  label: string
  total: number
  count: number
  /** Set when all priced items in the bucket share one currency */
  currency: string | null
  byCurrency: CurrencyTotal[]
}

export type WishlistBalance = {
  pricedCount: number
  unpricedCount: number
  byCurrency: CurrencyTotal[]
  byCategory: CategoryTotal[]
}

function currencyCode(raw: string | null | undefined): string {
  return (raw ?? '').trim().toUpperCase() || '—'
}

export function summarizeWishlist(
  products: Product[],
  language: AppLanguage,
): WishlistBalance {
  const currencyMap = new Map<string, CurrencyTotal>()
  const categoryMap = new Map<
    CategoryKey,
    {
      key: CategoryKey
      label: string
      count: number
      currencyMap: Map<string, CurrencyTotal>
    }
  >()

  let pricedCount = 0
  let unpricedCount = 0

  for (const p of products) {
    const key = categoryKeyOf(p.category)
    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        key,
        label: categoryLabel(key, language),
        count: 0,
        currencyMap: new Map(),
      })
    }
    const bucket = categoryMap.get(key)!
    bucket.count += 1

    if (p.price == null || !Number.isFinite(p.price)) {
      unpricedCount += 1
      continue
    }

    pricedCount += 1
    const cur = currencyCode(p.currency)

    const cTot = currencyMap.get(cur) ?? { currency: cur, total: 0, count: 0 }
    cTot.total += p.price
    cTot.count += 1
    currencyMap.set(cur, cTot)

    const catCur =
      bucket.currencyMap.get(cur) ?? { currency: cur, total: 0, count: 0 }
    catCur.total += p.price
    catCur.count += 1
    bucket.currencyMap.set(cur, catCur)
  }

  const byCurrency = [...currencyMap.values()].sort((a, b) => b.total - a.total)

  const byCategory: CategoryTotal[] = [...categoryMap.values()]
    .map((b) => {
      const cats = [...b.currencyMap.values()].sort((a, c) => c.total - a.total)
      const total = cats.reduce((s, x) => s + x.total, 0)
      return {
        key: b.key,
        label: b.label,
        total,
        count: b.count,
        currency: cats.length === 1 ? cats[0]!.currency : null,
        byCurrency: cats,
      }
    })
    .sort((a, b) => b.total - a.total || b.count - a.count)

  return { pricedCount, unpricedCount, byCurrency, byCategory }
}
