import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ComparisonTable } from '@/components/ComparisonTable'
import { useProducts } from '@/hooks/useProducts'

export function ComparePage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const { products } = useProducts()

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

  const toggle = (id: number) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    const sp = new URLSearchParams(params)
    if (next.length) sp.set('ids', next.join(','))
    else sp.delete('ids')
    setParams(sp, { replace: true })
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {t('compare.title')}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">{t('compare.hint')}</p>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {t('home.emptyBody')}{' '}
          <Link to="/share" className="text-olive underline-offset-2 hover:underline">
            {t('home.pasteCta')}
          </Link>
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {products.map((p) => {
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
                      : 'bg-paper-raised text-ink ring-1 ring-mist/70 hover:ring-olive/35',
                  ].join(' ')}
                >
                  {p.title}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <ComparisonTable products={selected} />
    </section>
  )
}
