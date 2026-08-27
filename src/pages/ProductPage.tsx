import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { deleteProduct, getProduct } from '@/db'

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
    <article className="rise-in space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold leading-tight">
            {product.title}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {[product.brand, product.category].filter(Boolean).join(' · ')}
          </p>
          {priceLabel && (
            <p className="mt-3 font-display text-2xl font-semibold tabular-nums text-olive-deep">
              {priceLabel}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/compare?ids=${product.id}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-mist bg-paper-raised px-3 text-sm font-medium"
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
            className="inline-flex min-h-11 items-center rounded-xl border border-danger/30 bg-danger/10 px-3 text-sm font-medium text-danger"
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
        {Object.keys(product.specs).length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">—</p>
        ) : (
          <dl className="mt-2 divide-y divide-mist/70 rounded-2xl border border-mist bg-paper-raised/80">
            {Object.entries(product.specs).map(([k, v]) => (
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
        >
          {t('product.openSource')}
        </a>
      )}
    </article>
  )
}
