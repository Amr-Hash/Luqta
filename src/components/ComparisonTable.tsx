import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Product } from '@/types/product'

interface ComparisonTableProps {
  products: Product[]
}

function formatCell(value: unknown, locale: string): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? '✓' : '✗'
  if (typeof value === 'number') {
    return new Intl.NumberFormat(locale).format(value)
  }
  return String(value)
}

export function ComparisonTable({ products }: ComparisonTableProps) {
  const { t, i18n } = useTranslation()

  const rows = useMemo(() => {
    const baseKeys = ['brand', 'price', 'currency', 'category'] as const
    const specKeys = new Set<string>()
    for (const p of products) {
      for (const key of Object.keys(p.specs ?? {})) specKeys.add(key)
    }

    const all: { key: string; label: string; values: string[] }[] = []

    for (const key of baseKeys) {
      const label =
        key === 'brand'
          ? t('product.brand')
          : key === 'price'
            ? t('product.price')
            : key === 'category'
              ? t('product.category')
              : key
      const values = products.map((p) => {
        if (key === 'price') {
          if (p.price == null) return '—'
          const cur = p.currency ? ` ${p.currency}` : ''
          return `${formatCell(p.price, i18n.language)}${cur}`
        }
        return formatCell(p[key], i18n.language)
      })
      if (key === 'currency') continue
      all.push({ key, label, values })
    }

    for (const key of [...specKeys].sort()) {
      all.push({
        key: `spec:${key}`,
        label: key,
        values: products.map((p) => formatCell(p.specs?.[key], i18n.language)),
      })
    }

    return all
  }, [products, t, i18n.language])

  if (products.length < 2) {
    return (
      <p className="surface-quiet rounded-2xl px-4 py-8 text-center text-ink-muted ring-1 ring-dashed ring-mist/80">
        {t('compare.needTwo')}
      </p>
    )
  }

  return (
    <div className="surface rise-in overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[28rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-mist/60">
            <th
              scope="col"
              className="sticky start-0 z-10 bg-paper-raised px-3 py-3 text-start font-medium text-ink-muted"
            >
              {t('compare.attribute')}
            </th>
            {products.map((p) => (
              <th
                key={p.id}
                scope="col"
                className="max-w-[10rem] px-3 py-3 text-start font-semibold text-ink"
              >
                <span className="line-clamp-2">{p.title}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const unique = new Set(row.values)
            const differs = unique.size > 1
            return (
              <tr key={row.key} className="border-b border-mist/50 last:border-0">
                <th
                  scope="row"
                  className="sticky start-0 bg-paper-raised px-3 py-2.5 text-start font-medium text-ink-muted"
                >
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {row.label}
                    <span
                      className={[
                        'rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        differs
                          ? 'bg-saffron/20 text-olive-deep'
                          : 'bg-mist/50 text-ink-muted',
                      ].join(' ')}
                    >
                      {differs ? t('compare.diff') : t('compare.same')}
                    </span>
                  </span>
                </th>
                {row.values.map((value, i) => (
                  <td
                    key={`${row.key}-${products[i]?.id}`}
                    className={[
                      'px-3 py-2.5 align-top text-ink',
                      differs ? 'font-medium' : '',
                    ].join(' ')}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
