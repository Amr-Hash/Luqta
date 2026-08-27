import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Product } from '@/types/product'
import { categoryKeyOf, categoryLabel } from '@/lib/categories'
import { resolveProductSource } from '@/lib/source'

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

function displayCategory(product: Product, lang: 'ar' | 'en') {
  const key = categoryKeyOf(product.category)
  if (product.category && key !== 'other') return categoryLabel(key, lang)
  return product.category
}

interface ProductCardProps {
  product: Product
  selected?: boolean
  selectable?: boolean
  onToggleSelect?: () => void
  onDelete?: () => void
}

export function ProductCard({
  product,
  selected,
  selectable,
  onToggleSelect,
  onDelete,
}: ProductCardProps) {
  const { t, i18n } = useTranslation()
  const price = formatPrice(product, i18n.language)
  const lang = i18n.language.startsWith('ar') ? 'ar' : 'en'
  const category = displayCategory(product, lang)
  const source = resolveProductSource(product, lang)

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
              {category && (
                <>
                  {product.brand && <span aria-hidden>·</span>}
                  <span>{category}</span>
                </>
              )}
              {source && (
                <>
                  {(product.brand || category) && <span aria-hidden>·</span>}
                  <span title={source.domain}>{source.label}</span>
                </>
              )}
            </p>
          </Link>
        </div>

        {onDelete && !selectable && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete()
            }}
            className="pressable mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl text-danger ring-1 ring-danger/25 transition-colors duration-150 hover:bg-danger/10"
            aria-label={t('home.quickDelete')}
            title={t('home.quickDelete')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 8h14M10 8V6h4v2M9 8v11a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </article>
  )
}
