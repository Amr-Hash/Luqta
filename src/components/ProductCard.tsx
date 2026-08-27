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
        'rise-in group relative rounded-2xl p-4 transition-[background-color,color,transform,opacity] duration-200 ease-out',
        selected
          ? 'bg-olive text-paper-raised'
          : 'surface hover:bg-paper-raised',
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
              'pressable mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl text-sm font-semibold transition-colors duration-150',
              selected
                ? 'bg-paper-raised text-olive'
                : 'bg-paper text-ink-muted ring-1 ring-mist/70',
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
            {price && (
              <p
                className={[
                  'font-display text-xl font-semibold tabular-nums tracking-tight',
                  selected ? 'text-paper-raised' : 'text-olive-deep',
                ].join(' ')}
              >
                {price}
              </p>
            )}
            <h2
              className={[
                'font-display text-base font-semibold leading-snug',
                price ? 'mt-1.5' : '',
                selected ? 'text-paper-raised' : 'text-ink',
              ].join(' ')}
            >
              {product.title}
            </h2>
            <p
              className={[
                'mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm',
                selected ? 'text-paper-raised/75' : 'text-ink-muted',
              ].join(' ')}
            >
              {product.brand && <span>{product.brand}</span>}
              {product.category && (
                <>
                  {product.brand && <span aria-hidden>·</span>}
                  <span>{product.category}</span>
                </>
              )}
            </p>
          </Link>
        </div>
      </div>
    </article>
  )
}
