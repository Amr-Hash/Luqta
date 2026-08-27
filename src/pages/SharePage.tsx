import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { saveProduct } from '@/db'
import { useProducts } from '@/hooks/useProducts'
import { extractProductSmart } from '@/lib/llm'
import {
  composeExtractionSource,
  fetchPageSnippet,
  hasShareContent,
  parseShareSearch,
} from '@/lib/share'
import { buildFingerprint, findSimilarProducts } from '@/lib/similarity'
import type { ExtractedProduct } from '@/types/product'

export function SharePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { products } = useProducts()
  const autoRan = useRef(false)

  const shared = useMemo(
    () => parseShareSearch(`?${params.toString()}`),
    [params],
  )

  const [draft, setDraft] = useState(() =>
    hasShareContent(shared)
      ? [shared.title, shared.text, shared.url].filter(Boolean).join('\n')
      : '',
  )
  const [busy, setBusy] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedProduct | null>(null)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [sourceText, setSourceText] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [fetchNote, setFetchNote] = useState<string | null>(null)
  const [extractMode, setExtractMode] = useState<'llm' | 'heuristic' | null>(
    null,
  )

  const matches = useMemo(() => {
    if (!extracted) return []
    const fingerprint = buildFingerprint(extracted)
    return findSimilarProducts({ ...extracted, fingerprint }, products)
  }, [extracted, products])

  const runExtract = useCallback(
    async (title: string, text: string, url: string) => {
      setBusy(true)
      setStatus(t('share.processing'))
      setExtracted(null)
      setFetchNote(null)
      setExtractMode(null)

      try {
        const payload = { title, text, url }
        let snippet: string | null = null
        if (url) {
          snippet = await fetchPageSnippet(url)
          if (!snippet && !title && !text) {
            setFetchNote(t('share.corsHint'))
          }
        }
        const source = composeExtractionSource(payload, snippet)
        const { product, mode } = await extractProductSmart(source)
        setExtracted(product)
        setExtractMode(mode)
        setSourceUrl(url || null)
        setSourceText(source)
        setStatus(null)
      } catch {
        setStatus(t('errors.extractFailed'))
      } finally {
        setBusy(false)
      }
    },
    [t],
  )

  useEffect(() => {
    if (autoRan.current || !hasShareContent(shared)) return
    autoRan.current = true
    void runExtract(shared.title, shared.text, shared.url)
  }, [shared, runExtract])

  async function handleSave() {
    if (!extracted) return
    const fingerprint = buildFingerprint(extracted)
    const id = await saveProduct({
      ...extracted,
      sourceUrl,
      sourceText,
      imageUrl: null,
      fingerprint,
    })
    setStatus(t('share.saved'))
    navigate(`/product/${id}`)
  }

  return (
    <section className="space-y-5">
      <h1 className="font-display text-xl font-semibold">{t('share.title')}</h1>

      <p className="text-sm leading-relaxed text-ink-muted">{t('share.localOnly')}</p>
      {extractMode && (
        <p className="text-xs text-ink-muted">
          {extractMode === 'llm' ? t('share.usedLlm') : t('share.usedHeuristic')}
        </p>
      )}

      <label className="block space-y-2">
        <span className="text-sm font-medium text-ink-muted">
          {t('share.pasteHint')}
        </span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          className="w-full resize-y rounded-2xl border border-mist bg-paper-raised px-3 py-3 text-sm leading-relaxed text-ink outline-none transition-colors duration-150 focus:border-olive"
          placeholder="https://…"
        />
      </label>

      <button
        type="button"
        disabled={busy || !draft.trim()}
        onClick={() => {
          const url = draft.match(/https?:\/\/[^\s]+/i)?.[0] ?? ''
          const text = url ? draft.replace(url, '').trim() : draft.trim()
          void runExtract('', text, url)
        }}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-olive px-4 font-medium text-paper-raised transition-colors duration-150 hover:bg-olive-deep disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {busy ? t('share.processing') : t('share.extract')}
      </button>

      {status && (
        <p className="text-sm text-ink-muted" role="status">
          {status}
        </p>
      )}

      {fetchNote && (
        <p className="rounded-xl border border-saffron/40 bg-saffron/10 px-3 py-2 text-sm text-olive-deep">
          {fetchNote}
        </p>
      )}

      {!hasShareContent(shared) && !draft && !extracted && (
        <p className="text-sm text-ink-muted">{t('share.missingShare')}</p>
      )}

      {extracted && (
        <div className="rise-in space-y-4 rounded-2xl border border-mist bg-paper-raised/80 p-4">
          <div>
            <h2 className="font-display text-lg font-semibold">{extracted.title}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {[extracted.brand, extracted.category].filter(Boolean).join(' · ')}
            </p>
            {extracted.price != null && (
              <p className="mt-2 font-display text-xl font-semibold tabular-nums text-olive-deep">
                {extracted.price}
                {extracted.currency ? ` ${extracted.currency}` : ''}
              </p>
            )}
            {extracted.summary && (
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                {extracted.summary}
              </p>
            )}
          </div>

          {Object.keys(extracted.specs).length > 0 && (
            <dl className="grid gap-2 text-sm">
              {Object.entries(extracted.specs).map(([k, v]) => (
                <div
                  key={k}
                  className="grid grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] gap-2 border-t border-mist/60 pt-2"
                >
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="font-medium text-ink">{String(v ?? '—')}</dd>
                </div>
              ))}
            </dl>
          )}

          {matches.length > 0 && (
            <div className="rounded-xl border border-saffron/35 bg-saffron/10 p-3">
              <p className="text-sm font-medium text-olive-deep">
                {t('share.duplicates')}
              </p>
              <ul className="mt-2 space-y-2">
                {matches.slice(0, 3).map((m) => (
                  <li
                    key={m.product.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 truncate font-medium">
                      {m.product.title}{' '}
                      <span className="text-ink-muted">
                        ({Math.round(m.score * 100)}%)
                      </span>
                    </span>
                    <span className="flex gap-2">
                      <Link
                        to={`/product/${m.product.id}`}
                        className="text-olive underline-offset-2 hover:underline"
                      >
                        {t('share.openExisting')}
                      </Link>
                      <Link
                        to={`/compare?ids=${m.product.id}`}
                        className="text-olive underline-offset-2 hover:underline"
                      >
                        {t('share.compareWith')}
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              className="inline-flex min-h-11 items-center rounded-xl bg-olive px-4 font-medium text-paper-raised transition-colors duration-150 hover:bg-olive-deep"
            >
              {matches.some((m) => m.reason === 'duplicate')
                ? t('share.saveAnyway')
                : t('app.save')}
            </button>
            <button
              type="button"
              onClick={() => setExtracted(null)}
              className="inline-flex min-h-11 items-center rounded-xl border border-mist bg-paper px-4 font-medium text-ink"
            >
              {t('app.cancel')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
