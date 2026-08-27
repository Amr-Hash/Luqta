import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Product } from '@/types/product'
import { summarizeWishlist } from '@/lib/wishlistBalance'

function formatMoney(
  amount: number,
  currency: string | null,
  locale: string,
): string {
  const code = currency && currency !== '—' ? currency : undefined
  try {
    if (code) {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code,
        maximumFractionDigits: 0,
      }).format(amount)
    }
  } catch {
    /* fall through */
  }
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    amount,
  )
  return code ? `${n} ${code}` : n
}

export function WishlistBalanceCard({ products }: { products: Product[] }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language.startsWith('ar') ? 'ar' : 'en'
  const balance = useMemo(
    () => summarizeWishlist(products, lang),
    [products, lang],
  )

  if (products.length === 0) return null

  const primary = balance.byCurrency[0]

  return (
    <section className="surface space-y-3 rounded-2xl p-4" aria-live="polite">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium tracking-wide text-ink-muted">
            {t('home.balanceTitle')}
          </p>
          {primary ? (
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight text-olive-deep">
              {formatMoney(primary.total, primary.currency, i18n.language)}
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">{t('home.balanceEmpty')}</p>
          )}
          {balance.byCurrency.length > 1 && (
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
              {balance.byCurrency.slice(1).map((c) => (
                <li key={c.currency} className="tabular-nums">
                  {formatMoney(c.total, c.currency, i18n.language)}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-xs text-ink-muted">
          {t('home.balancePriced', {
            priced: balance.pricedCount,
            total: products.length,
          })}
        </p>
      </div>

      {balance.byCategory.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-ink-muted">
            {t('home.balanceByCategory')}
          </p>
          <ul className="space-y-2">
            {balance.byCategory.map((cat) => {
              const amountLabel =
                cat.byCurrency.length === 0
                  ? t('home.balanceNoPrice')
                  : cat.byCurrency.length === 1
                    ? formatMoney(
                        cat.byCurrency[0]!.total,
                        cat.byCurrency[0]!.currency,
                        i18n.language,
                      )
                    : cat.byCurrency
                        .map((c) =>
                          formatMoney(c.total, c.currency, i18n.language),
                        )
                        .join(' · ')

              const max = Math.max(
                ...balance.byCategory.map((c) => c.total || 0),
                1,
              )
              const width =
                cat.total > 0 ? Math.max(8, Math.round((cat.total / max) * 100)) : 0

              return (
                <li key={cat.key}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-ink">
                      {cat.label}
                      <span className="ms-1.5 text-xs font-normal text-ink-muted">
                        ({cat.count})
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-ink-muted">
                      {amountLabel}
                    </span>
                  </div>
                  {width > 0 && (
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-mist/60">
                      <div
                        className="h-full rounded-full bg-olive/70"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
