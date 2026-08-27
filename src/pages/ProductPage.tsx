import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { deleteProduct, getProduct } from '@/db'
import { resolveProductSource } from '@/lib/source'

function isUrlLikeSpec(key: string, value: unknown): boolean {
  if (/^(source|url|link|website|href)$/i.test(key) && typeof value === 'string') {
    return /^(https?:\/\/|www\.)/i.test(value.trim()) || value.includes('/')
  }
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
}

export function ProductPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const productId = Number.parseInt(id ?? '', 10)
  const product = useLiveQuery(
    () => (Number.isFinite(productId) ? getProduct(productId) : undefined),
    [productId],
  )

  if (product === undefined) {
    return <div className="h-40 animate-pulse rounded-2xl bg-mist/40" />
  }

  if (!product) {
    return (
      <p className="text-ink-muted">
        {t('product.notFound')}{' '}
        <Link to="/" className="text-olive underline-offset-2 hover:underline">
          {t('app.back')}
        </Link>
      </p>
    )
  }

  const lang = i18n.language.startsWith('ar') ? 'ar' : 'en'
  const source = resolveProductSource(product, lang)
  const visibleSpecs = Object.entries(product.specs).filter(
    ([k, v]) => !isUrlLikeSpec(k, v),
  )

  let priceLabel: string | null = null
  if (product.price != null) {
    try {
      priceLabel = new Intl.NumberFormat(i18n.language, {
        style: product.currency ? 'currency' : 'decimal',
        currency: product.currency || undefined,
      }).format(product.price)
    } catch {
      priceLabel = `${product.price}${product.currency ? ` ${product.currency}` : ''}`
    }
  }

  return (
    <article className="rise-in space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {priceLabel && (
            <p className="font-display text-3xl font-semibold tabular-nums tracking-tight text-olive-deep">
              {priceLabel}
            </p>
          )}
          <h1
            className={[
              'font-display text-2xl font-semibold leading-tight',
              priceLabel ? 'mt-2' : '',
            ].join(' ')}
          >
            {product.title}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {[product.brand, product.category, source?.label]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/compare?ids=${product.id}`}
            className="pressable inline-flex min-h-11 items-center rounded-xl bg-paper-raised px-3 text-sm font-medium ring-1 ring-mist/70"
          >
            {t('app.compare')}
          </Link>
          <button
            type="button"
            onClick={async () => {
              if (product.id == null) return
              await deleteProduct(product.id)
              navigate('/')
            }}
            className="pressable inline-flex min-h-11 items-center rounded-xl bg-danger/10 px-3 text-sm font-medium text-danger ring-1 ring-danger/25"
          >
            {t('app.delete')}
          </button>
        </div>
      </div>

      {product.summary && (
        <section>
          <h2 className="text-sm font-medium text-ink-muted">{t('product.summary')}</h2>
          <p className="mt-1 leading-relaxed">{product.summary}</p>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium text-ink-muted">{t('product.specs')}</h2>
        {visibleSpecs.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">—</p>
        ) : (
          <dl className="surface mt-2 divide-y divide-mist/50 rounded-2xl">
            {visibleSpecs.map(([k, v]) => (
              <div
                key={k}
                className="grid grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] gap-3 px-4 py-3 text-sm"
              >
                <dt className="text-ink-muted">{k}</dt>
                <dd className="font-medium">{String(v ?? '—')}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {product.sourceUrl && (
        <a
          href={product.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center text-sm font-medium text-olive underline-offset-2 hover:underline"
          title={product.sourceUrl}
        >
          {source
            ? t('product.openSourceNamed', { store: source.merchant })
            : t('product.openSource')}
        </a>
      )}
    </article>
  )
}
