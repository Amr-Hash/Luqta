import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ProductCard } from '@/components/ProductCard'
import { WishlistBalanceCard } from '@/components/WishlistBalanceCard'
import { useProducts } from '@/hooks/useProducts'
import { categoryKeyOf, categoryLabel } from '@/lib/categories'
import {
  resolveProductSource,
  sourceKeyFromProduct,
} from '@/lib/source'
import type { Product } from '@/types/product'

type GroupMode = 'category' | 'source'

type ProductGroup = {
  key: string
  label: string
  products: Product[]
  orderTogether: boolean
}

function groupProducts(
  products: Product[],
  mode: GroupMode,
  lang: 'ar' | 'en',
  unknownLabel: string,
): ProductGroup[] {
  const map = new Map<string, ProductGroup>()

  for (const product of products) {
    let key: string
    let label: string
    let orderTogether = false

    if (mode === 'category') {
      const ck = categoryKeyOf(product.category)
      key = ck
      label =
        ck !== 'other'
          ? categoryLabel(ck, lang)
          : product.category?.trim() || unknownLabel
    } else {
      const src = resolveProductSource(product, lang)
      key = sourceKeyFromProduct(product, lang)
      label = src?.label ?? unknownLabel
      orderTogether = key !== 'unknown'
    }

    if (!map.has(key)) {
      map.set(key, { key, label, products: [], orderTogether })
    }
    map.get(key)!.products.push(product)
  }

  return [...map.values()]
    .map((g) => ({
      ...g,
      orderTogether: mode === 'source' && g.orderTogether && g.products.length >= 2,
    }))
    .sort((a, b) => b.products.length - a.products.length || a.label.localeCompare(b.label))
}

export function HomePage() {
  const { t, i18n } = useTranslation()
  const { products, loading, remove } = useProducts()
  const [selected, setSelected] = useState<number[]>([])
  const [selectMode, setSelectMode] = useState(false)
  const [groupMode, setGroupMode] = useState<GroupMode>('category')

  const lang = i18n.language.startsWith('ar') ? 'ar' : 'en'

  const compareQuery = useMemo(
    () => selected.filter((id) => products.some((p) => p.id === id)).join(','),
    [selected, products],
  )

  const groups = useMemo(
    () =>
      groupProducts(products, groupMode, lang, t('home.unknownGroup')),
    [products, groupMode, lang, t],
  )

  const toggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleDelete = async (id: number) => {
    const ok = window.confirm(t('home.confirmDelete'))
    if (!ok) return
    await remove(id)
    setSelected((prev) => prev.filter((x) => x !== id))
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl bg-mist/35"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <section className="fade-in flex min-h-[62dvh] flex-col items-center justify-center text-center">
        <p className="brand-mark text-[4.5rem] leading-none text-olive-deep sm:text-7xl">
          لقطة
        </p>
        <div
          className="mt-5 h-px w-16 bg-gradient-to-l from-transparent via-saffron/70 to-transparent"
          aria-hidden
        />
        <h1 className="mt-5 font-display text-xl font-semibold text-ink">
          {t('home.emptyTitle')}
        </h1>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-muted">
          {t('home.emptyBody')}
        </p>
        <Link
          to="/share"
          className="pressable mt-9 inline-flex min-h-11 items-center justify-center rounded-xl bg-olive px-6 font-medium text-paper-raised transition-colors duration-150 hover:bg-olive-deep"
        >
          {t('home.pasteCta')}
        </Link>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t('app.wishlist')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {products.length}{' '}
            {products.length === 1 ? t('home.shotOne') : t('home.shotMany')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectMode((v) => !v)
              if (selectMode) setSelected([])
            }}
            className="pressable min-h-11 rounded-xl bg-paper-raised px-3 text-sm font-medium text-ink ring-1 ring-mist/70 transition-colors duration-150 hover:ring-olive/35"
          >
            {selectMode ? t('home.clearSelection') : t('home.selectCompare')}
          </button>
          {selectMode && selected.length >= 2 && (
            <Link
              to={`/compare?ids=${compareQuery}`}
              className="pressable inline-flex min-h-11 items-center rounded-xl bg-olive px-3 text-sm font-medium text-paper-raised transition-colors duration-150 hover:bg-olive-deep"
            >
              {t('home.compareSelected')}
            </Link>
          )}
        </div>
      </div>

      <WishlistBalanceCard products={products} />

      <div
        className="flex gap-1 rounded-xl bg-paper-raised/80 p-1 ring-1 ring-mist/60"
        role="tablist"
        aria-label={t('home.groupBy')}
      >
        <button
          type="button"
          role="tab"
          aria-selected={groupMode === 'category'}
          onClick={() => setGroupMode('category')}
          className={[
            'pressable min-h-10 flex-1 rounded-lg px-3 text-sm font-medium transition-colors duration-150',
            groupMode === 'category'
              ? 'bg-olive text-paper-raised'
              : 'text-ink-muted hover:text-ink',
          ].join(' ')}
        >
          {t('home.groupCategory')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={groupMode === 'source'}
          onClick={() => setGroupMode('source')}
          className={[
            'pressable min-h-10 flex-1 rounded-lg px-3 text-sm font-medium transition-colors duration-150',
            groupMode === 'source'
              ? 'bg-olive text-paper-raised'
              : 'text-ink-muted hover:text-ink',
          ].join(' ')}
        >
          {t('home.groupSource')}
        </button>
      </div>

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.key} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                {group.label}
                <span className="ms-2 text-sm font-normal text-ink-muted">
                  ({group.products.length})
                </span>
              </h2>
              {group.orderTogether && (
                <p className="text-xs font-medium text-saffron">
                  {t('home.orderTogether', { count: group.products.length })}
                </p>
              )}
            </div>
            <ul className="space-y-3">
              {group.products.map((product, index) => (
                <li
                  key={product.id}
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                >
                  <ProductCard
                    product={product}
                    selectable={selectMode}
                    selected={
                      product.id != null && selected.includes(product.id)
                    }
                    onToggleSelect={() =>
                      product.id != null && toggle(product.id)
                    }
                    onDelete={
                      product.id != null
                        ? () => void handleDelete(product.id!)
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  )
}
