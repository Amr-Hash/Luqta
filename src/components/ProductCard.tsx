import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Product } from '@/types/product'

function formatPrice(product: Product, locale: string) {
  if (product.price == null) return null
  try {
    return new Intl.NumberFormat(locale, {
      style: product.currency ? 'currency' : 'decimal',
      currency: product.currency || undefined,
      maximumFractionDigits: 2,
    }).format(product.price)
  } catch {
    return `${product.price}${product.currency ? ` ${product.currency}` : ''}`
  }
}

interface ProductCardProps {
  product: Product
  selected?: boolean
  selectable?: boolean
  onToggleSelect?: () => void
}

export function ProductCard({
  product,
  selected,
  selectable,
  onToggleSelect,
}: ProductCardProps) {
  const { t, i18n } = useTranslation()
  const price = formatPrice(product, i18n.language)

  return (
    <article
      className={[
        'rise-in group relative rounded-2xl border bg-paper-raised/80 p-4 transition-[border-color,transform,opacity] duration-200 ease-out',
        selected
          ? 'border-olive shadow-[0_0_0_1px_var(--color-olive)]'
          : 'border-mist/80 hover:border-olive/40',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        {selectable && (
          <button
            type="button"
            aria-pressed={selected}
            aria-label={t('home.selectCompare')}
            onClick={onToggleSelect}
            className={[
              'mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl border text-sm font-semibold transition-colors duration-150',
              selected
                ? 'border-olive bg-olive text-paper-raised'
                : 'border-mist bg-paper text-ink-muted',
            ].join(' ')}
          >
            {selected ? '✓' : ''}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <Link
            to={`/product/${product.id}`}
            className="block rounded-lg outline-offset-4"
          >
            <h2 className="font-display text-base font-semibold leading-snug text-ink">
              {product.title}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
              {product.brand && <span>{product.brand}</span>}
              {product.category && (
                <>
                  {product.brand && <span aria-hidden>·</span>}
                  <span>{product.category}</span>
                </>
              )}
            </p>
            {price && (
              <p className="mt-2 font-display text-lg font-semibold tabular-nums text-olive-deep">
                {price}
              </p>
            )}
          </Link>
        </div>
      </div>
    </article>
  )
}
