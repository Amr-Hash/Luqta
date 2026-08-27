import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ProductCard } from '@/components/ProductCard'
import { useProducts } from '@/hooks/useProducts'

export function HomePage() {
  const { t } = useTranslation()
  const { products, loading } = useProducts()
  const [selected, setSelected] = useState<number[]>([])
  const [selectMode, setSelectMode] = useState(false)

  const compareQuery = useMemo(
    () => selected.filter((id) => products.some((p) => p.id === id)).join(','),
    [selected, products],
  )

  const toggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
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

      <ul className="space-y-3">
        {products.map((product, index) => (
          <li
            key={product.id}
            style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
          >
            <ProductCard
              product={product}
              selectable={selectMode}
              selected={product.id != null && selected.includes(product.id)}
              onToggleSelect={() => product.id != null && toggle(product.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
