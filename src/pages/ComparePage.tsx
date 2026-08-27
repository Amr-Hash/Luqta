import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ComparisonTable } from '@/components/ComparisonTable'
import { useProducts } from '@/hooks/useProducts'
import {
  categoryKeyOf,
  categoryLabel,
  type CategoryKey,
} from '@/lib/categories'
import type { Product } from '@/types/product'

type CategoryBucket = {
  key: CategoryKey | string
  label: string
  products: Product[]
}

function focusCategoryKey(selected: Product[]): CategoryKey | null {
  if (selected.length === 0) return null
  const counts = new Map<CategoryKey, number>()
  for (const p of selected) {
    const k = categoryKeyOf(p.category)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  let best: CategoryKey | null = null
  let bestN = -1
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k
      bestN = n
    }
  }
  return best
}

export function ComparePage() {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()
  const { products } = useProducts()
  const lang = i18n.language.startsWith('ar') ? 'ar' : 'en'

  const selectedIds = useMemo(() => {
    const raw = params.get('ids') ?? ''
    return raw
      .split(',')
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isFinite(n))
  }, [params])

  const selected = useMemo(
    () => products.filter((p) => p.id != null && selectedIds.includes(p.id)),
    [products, selectedIds],
  )

  const anchorCategory = useMemo(
    () => focusCategoryKey(selected),
    [selected],
  )

  const buckets = useMemo((): CategoryBucket[] => {
    const map = new Map<string, CategoryBucket>()
    for (const product of products) {
      const key = categoryKeyOf(product.category)
      const label =
        key !== 'other'
          ? categoryLabel(key, lang)
          : product.category?.trim() || t('home.unknownGroup')
      if (!map.has(key)) {
        map.set(key, { key, label, products: [] })
      }
      map.get(key)!.products.push(product)
    }

    const list = [...map.values()].sort((a, b) => {
      // Focus category first when comparing
      if (anchorCategory) {
        if (a.key === anchorCategory && b.key !== anchorCategory) return -1
        if (b.key === anchorCategory && a.key !== anchorCategory) return 1
      }
      return (
        b.products.length - a.products.length ||
        a.label.localeCompare(b.label, lang)
      )
    })
    return list
  }, [products, lang, t, anchorCategory])

  const setIds = (next: number[]) => {
    const sp = new URLSearchParams(params)
    if (next.length) sp.set('ids', next.join(','))
    else sp.delete('ids')
    setParams(sp, { replace: true })
  }

  const toggle = (id: number) => {
    const product = products.find((p) => p.id === id)
    if (!product) return

    if (selectedIds.includes(id)) {
      setIds(selectedIds.filter((x) => x !== id))
      return
    }

    // Prefer staying in one category: if picking from another, replace selection
    const nextKey = categoryKeyOf(product.category)
    if (
      anchorCategory &&
      selectedIds.length >= 1 &&
      nextKey !== anchorCategory
    ) {
      setIds([id])
      return
    }

    setIds([...selectedIds, id])
  }

  const selectCategoryPeers = (bucket: CategoryBucket) => {
    const ids = bucket.products
      .map((p) => p.id)
      .filter((id): id is number => id != null)
      .slice(0, 6)
    setIds(ids)
  }

  const sameCategoryCount = anchorCategory
    ? products.filter((p) => categoryKeyOf(p.category) === anchorCategory)
        .length
    : 0

  return (
    <section className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {t('compare.title')}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {anchorCategory
            ? t('compare.hintFocused', {
                category: categoryLabel(anchorCategory, lang),
                count: sameCategoryCount,
              })
            : t('compare.hint')}
        </p>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {t('home.emptyBody')}{' '}
          <Link
            to="/share"
            className="text-olive underline-offset-2 hover:underline"
          >
            {t('home.pasteCta')}
          </Link>
        </p>
      ) : (
        <div className="space-y-5">
          {buckets.map((bucket) => {
            const isFocus =
              !anchorCategory || bucket.key === anchorCategory
            const selectedInBucket = bucket.products.filter(
              (p) => p.id != null && selectedIds.includes(p.id),
            ).length

            return (
              <section
                key={bucket.key}
                className={[
                  'space-y-2.5',
                  !isFocus ? 'opacity-55' : '',
                ].join(' ')}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-sm font-semibold tracking-tight text-ink">
                    {bucket.label}
                    <span className="ms-1.5 font-normal text-ink-muted">
                      ({bucket.products.length})
                    </span>
                    {isFocus && anchorCategory && (
                      <span className="ms-2 rounded-md bg-olive/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-olive-deep">
                        {t('compare.comparing')}
                      </span>
                    )}
                  </h2>
                  {bucket.products.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => selectCategoryPeers(bucket)}
                      className="pressable min-h-9 rounded-lg px-2.5 text-xs font-medium text-olive transition-colors duration-150 hover:bg-olive/10"
                    >
                      {selectedInBucket >= 2 && isFocus
                        ? t('compare.useThese')
                        : t('compare.pickCategory', {
                            count: Math.min(bucket.products.length, 6),
                          })}
                    </button>
                  )}
                </div>
                <ul className="flex flex-wrap gap-2">
                  {bucket.products.map((p) => {
                    const on = p.id != null && selectedIds.includes(p.id)
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => p.id != null && toggle(p.id)}
                          className={[
                            'pressable min-h-11 max-w-[14rem] truncate rounded-xl px-3 text-sm font-medium transition-colors duration-150',
                            on
                              ? 'bg-olive text-paper-raised'
                              : isFocus
                                ? 'bg-paper-raised text-ink ring-1 ring-mist/70 hover:ring-olive/35'
                                : 'bg-paper text-ink-muted ring-1 ring-mist/40',
                          ].join(' ')}
                        >
                          {p.title}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      <ComparisonTable products={selected} />
    </section>
  )
}
