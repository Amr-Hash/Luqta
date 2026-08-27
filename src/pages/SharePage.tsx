import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ExtractionProgress,
  initialExtractSteps,
  patchStep,
  type ExtractStep,
  type ExtractStepId,
  type StepState,
} from '@/components/ExtractionProgress'
import { MiniBrowser } from '@/components/MiniBrowser'
import { SmartCapture, type CaptureReason } from '@/components/SmartCapture'
import { saveProduct } from '@/db'
import { useProducts } from '@/hooks/useProducts'
import {
  pingExtension,
  scrapeUrlViaExtension,
} from '@/lib/extensionBridge'
import { extractProductSmart } from '@/lib/llm'
import {
  composeExtractionSource,
  fetchPageDetailed,
  hasShareContent,
  normalizeProductUrl,
  parseShareSearch,
} from '@/lib/share'
import { buildFingerprint, findSimilarProducts } from '@/lib/similarity'
import { normalizeCategory } from '@/lib/categories'
import { findFirstUrl, sourceFromUrl } from '@/lib/source'
import type { ExtractedProduct } from '@/types/product'

function failRemaining(
  steps: ExtractStep[],
  fromId: ExtractStepId,
  errorDetail: string,
): ExtractStep[] {
  const order: ExtractStepId[] = [
    'readLink',
    'extension',
    'parse',
    'ai',
    'done',
  ]
  const start = order.indexOf(fromId)
  return steps.map((s) => {
    const idx = order.indexOf(s.id)
    if (idx < start) return s
    if (s.id === fromId) return { ...s, state: 'error' as StepState, detail: errorDetail }
    if (s.id === 'done') {
      return { ...s, state: 'error' as StepState, detail: errorDetail }
    }
    return {
      ...s,
      state: 'skipped' as StepState,
      detail: undefined,
    }
  })
}

export function SharePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { products } = useProducts()
  const autoRan = useRef(false)
  const appLang = i18n.language.startsWith('ar') ? 'ar' : 'en'

  const shared = useMemo(() => {
    const fromRouter = params.toString()
    // Mobile Chrome share-target: prefer window search (more reliable than RR
    // when the SW hands off /Luqta/share?... into the SPA).
    const fromWindow =
      typeof window !== 'undefined'
        ? window.location.search.replace(/^\?/, '')
        : ''
    const raw =
      fromWindow.length >= fromRouter.length ? fromWindow : fromRouter
    return parseShareSearch(raw ? `?${raw}` : '')
  }, [params])

  const [draft, setDraft] = useState(() =>
    hasShareContent(shared)
      ? [shared.title, shared.text, shared.url].filter(Boolean).join('\n')
      : '',
  )
  const [busy, setBusy] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedProduct | null>(null)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [sourceText, setSourceText] = useState<string | null>(null)
  const [needsCapture, setNeedsCapture] = useState(false)
  const [captureReason, setCaptureReason] = useState<CaptureReason>('default')
  const [extractMode, setExtractMode] = useState<'llm' | 'heuristic' | null>(
    null,
  )
  const [browserOpen, setBrowserOpen] = useState(false)
  const [browserUrl, setBrowserUrl] = useState('')
  const [browserStatus, setBrowserStatus] = useState('')
  const [browserFailed, setBrowserFailed] = useState(false)
  const [steps, setSteps] = useState<ExtractStep[]>([])
  const [progressError, setProgressError] = useState<string | null>(null)
  const [progressVisible, setProgressVisible] = useState(false)
  const [extractStartedAt, setExtractStartedAt] = useState<number | null>(null)

  const draftUrl = useMemo(() => {
    const found = findFirstUrl(draft) || shared.url || null
    return found ? normalizeProductUrl(found) : null
  }, [draft, shared.url])

  const matches = useMemo(() => {
    if (!extracted) return []
    const fingerprint = buildFingerprint(extracted)
    return findSimilarProducts({ ...extracted, fingerprint }, products)
  }, [extracted, products])

  const setStep = useCallback(
    (
      id: Parameters<typeof patchStep>[1],
      state: Parameters<typeof patchStep>[2],
      detail?: string,
    ) => {
      setSteps((prev) => patchStep(prev, id, state, detail))
    },
    [],
  )

  const runExtract = useCallback(
    async (title: string, text: string, url: string) => {
      setBusy(true)
      setExtracted(null)
      setNeedsCapture(false)
      setCaptureReason('default')
      setExtractMode(null)
      setProgressError(null)
      setProgressVisible(true)
      setBrowserFailed(false)
      setExtractStartedAt(Date.now())
      setSteps(initialExtractSteps())

      const stopWithError = (stepId: ExtractStepId, message: string) => {
        setSteps((prev) => failRemaining(prev, stepId, message))
        setProgressError(message)
        setNeedsCapture(true)
        setCaptureReason('blocked')
        setBrowserFailed(true)
        setBrowserStatus(message)
      }

      try {
        let nextTitle = title
        let nextText = text
        let snippet: string | null = null
        const normalizedUrl = url ? normalizeProductUrl(url) : ''

        setStep('readLink', 'active', t('progress.details.checkingLink'))
        if (normalizedUrl) {
          const host =
            sourceFromUrl(normalizedUrl)?.domain ||
            (() => {
              try {
                return new URL(normalizedUrl).hostname.replace(/^www\./i, '')
              } catch {
                return normalizedUrl
              }
            })()
          setStep(
            'readLink',
            'active',
            t('progress.details.checkingHost', { host }),
          )
          const fetched = await fetchPageDetailed(normalizedUrl, appLang)
          snippet = fetched.snippet

          if (fetched.failure === 'insecure') {
            if (!nextTitle.trim() && !nextText.trim()) {
              stopWithError('readLink', t('progress.details.insecureLink'))
              return
            }
            setStep('readLink', 'done', t('progress.details.insecureLink'))
            setStep(
              'extension',
              'skipped',
              t('progress.details.usingSharedText'),
            )
          } else if (snippet) {
            const viaDetail =
              fetched.via === 'proxy'
                ? t('progress.details.pageReadProxy')
                : fetched.via === 'reader'
                  ? t('progress.details.pageReadReader')
                  : t('progress.details.pageRead')
            setStep('readLink', 'done', viaDetail)
            setStep('extension', 'skipped', t('progress.details.noExtensionNeeded'))
          } else {
            setStep(
              'readLink',
              'done',
              t('progress.details.corsBlocked'),
            )
            setStep('extension', 'active', t('progress.details.lookingExtension'))

            const hasExt = await pingExtension()
            if (hasExt) {
              setBrowserUrl(normalizedUrl)
              setBrowserOpen(true)
              setBrowserFailed(false)
              setBrowserStatus(t('browser.loading'))
              setStep(
                'extension',
                'active',
                t('progress.details.scrapingHost', { host }),
              )

              const scraped = await scrapeUrlViaExtension(
                normalizedUrl,
                45000,
                (elapsedMs, timeoutMs) => {
                  const sec = Math.floor(elapsedMs / 1000)
                  const left = Math.max(0, Math.ceil((timeoutMs - elapsedMs) / 1000))
                  const detail = t('progress.details.scrapingTick', {
                    host,
                    sec,
                    left,
                  })
                  setStep('extension', 'active', detail)
                  setBrowserStatus(detail)
                },
              )
              if (scraped.ok) {
                nextTitle = scraped.title || nextTitle
                nextText = scraped.text || nextText
                setBrowserStatus(t('browser.done'))
                setDraft(
                  [nextTitle, nextText, normalizedUrl]
                    .filter(Boolean)
                    .join('\n\n'),
                )
                setStep(
                  'extension',
                  'done',
                  scraped.title
                    ? t('progress.details.gotTitle', { title: scraped.title })
                    : t('progress.details.pageCaptured'),
                )
              } else {
                const err =
                  scraped.error === 'TIMEOUT'
                    ? t('browser.timeout')
                    : scraped.error || t('browser.failed')
                setBrowserStatus(err)
                if (nextTitle.trim() || nextText.trim()) {
                  setStep(
                    'extension',
                    'skipped',
                    t('progress.details.usingSharedText'),
                  )
                  window.setTimeout(() => setBrowserOpen(false), 600)
                } else {
                  stopWithError('extension', err)
                  return
                }
              }
              window.setTimeout(() => setBrowserOpen(false), 900)
            } else if (!title.trim() && !text.trim()) {
              const err = t('browser.needExtension')
              setBrowserUrl(normalizedUrl)
              setBrowserOpen(true)
              setBrowserStatus(err)
              stopWithError('extension', err)
              return
            } else {
              setStep(
                'extension',
                'skipped',
                t('progress.details.usingSharedText'),
              )
            }
          }
        } else {
          setStep('readLink', 'skipped', t('progress.details.noUrl'))
          setStep('extension', 'skipped', t('progress.details.noUrl'))
        }

        const hasMaterial = Boolean(
          snippet || nextTitle.trim() || nextText.trim(),
        )
        if (normalizedUrl && !hasMaterial) {
          stopWithError('parse', t('progress.details.couldNotReadPage'))
          return
        }

        setStep('parse', 'active', t('progress.details.building'))
        const source = composeExtractionSource(
          { title: nextTitle, text: nextText, url: normalizedUrl },
          snippet,
        )
        setStep('parse', 'done', t('progress.details.readyChars', { n: source.length }))

        setStep('ai', 'active', t('progress.details.extracting'))
        const { product, mode } = await extractProductSmart(source, {
          preferredLanguage: appLang,
          onStatus: (status) => {
            const map = {
              checking_gpu: t('progress.details.aiCheckingGpu'),
              waiting_engine: t('progress.details.aiWaitingEngine'),
              running_model: t('progress.details.aiRunningModel'),
              using_rules: t('progress.details.aiUsingRules'),
            } as const
            setStep('ai', 'active', map[status])
          },
        })
        setExtracted(product)
        setExtractMode(mode)
        setSourceUrl(normalizedUrl || null)
        setSourceText(source)
        setStep(
          'ai',
          'done',
          mode === 'llm'
            ? t('progress.details.usedLlm')
            : t('progress.details.usedHeuristic'),
        )

        const privacyJunk =
          /powered and protected by privacy/i.test(product.title) ||
          /powered and protected by privacy/i.test(product.summary ?? '')

        const linkOnly =
          Boolean(normalizedUrl) &&
          product.price == null &&
          /could not be downloaded|bot wall|shop privacy/i.test(source)

        const weak =
          privacyJunk ||
          (product.title === 'Untitled product' &&
            Boolean(normalizedUrl) &&
            !nextTitle.trim() &&
            !nextText.trim() &&
            !snippet)

        if (weak) {
          setNeedsCapture(true)
          setCaptureReason('blocked')
          setStep('done', 'error', t('progress.details.shopWall'))
          setProgressError(t('progress.details.shopWall'))
        } else if (linkOnly) {
          // Title from URL slug — still need price via share / shortcut / paste
          setNeedsCapture(true)
          setCaptureReason('blocked')
          setStep('done', 'done', t('progress.details.partialFromLink'))
          setProgressError(null)
        } else {
          setStep('done', 'done', t('progress.details.success'))
          setProgressError(null)
        }
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : t('errors.extractFailed')
        setProgressError(msg)
        setSteps((prev) => {
          const active = prev.find((s) => s.state === 'active')
          if (!active) return failRemaining(prev, 'ai', msg)
          return failRemaining(prev, active.id, msg)
        })
        setNeedsCapture(true)
        setCaptureReason('blocked')
        setBrowserFailed(true)
        setBrowserOpen(false)
      } finally {
        setBusy(false)
      }
    },
    [setStep, t, appLang],
  )

  useEffect(() => {
    if (!hasShareContent(shared)) return
    setDraft((prev) => {
      if (prev.trim()) return prev
      return [shared.title, shared.text, shared.url].filter(Boolean).join('\n')
    })
    if (autoRan.current) return
    autoRan.current = true
    void runExtract(shared.title, shared.text, shared.url)
  }, [shared, runExtract])

  async function handleSave() {
    if (!extracted) return
    const product: ExtractedProduct = {
      ...extracted,
      category: normalizeCategory(
        extracted.category,
        extracted.language,
        extracted.title,
      ),
    }
    // Prefer explicit sourceUrl, then URL inside shared/draft text
    const resolvedSourceUrl =
      sourceUrl ||
      shared.url ||
      findFirstUrl(draft) ||
      findFirstUrl(sourceText) ||
      null
    const normalizedResolved = resolvedSourceUrl
      ? normalizeProductUrl(resolvedSourceUrl)
      : null
    const src = sourceFromUrl(
      normalizedResolved,
      product.language === 'ar' ? 'ar' : 'en',
    )
    // Drop legacy full-URL "source" spec if the model put one there
    const specs = { ...product.specs }
    if (typeof specs.source === 'string' && /^https?:\/\//i.test(specs.source)) {
      delete specs.source
    }
    if (src && !specs.store) {
      specs.store = src.merchant
    }

    const fingerprint = buildFingerprint(product)
    const similarIds = matches
      .filter((m) => m.product.id != null && m.score >= 0.45)
      .slice(0, 4)
      .map((m) => m.product.id as number)

    const id = await saveProduct({
      ...product,
      specs,
      sourceUrl: normalizedResolved,
      sourceDomain: src?.domain ?? null,
      sourceLabel: src?.label ?? null,
      sourceText,
      imageUrl: null,
      fingerprint,
    })

    if (similarIds.length >= 1) {
      navigate(`/compare?ids=${[id, ...similarIds].join(',')}`)
      return
    }
    navigate(`/product/${id}`)
  }

  return (
    <section className="space-y-5">
      <MiniBrowser
        open={browserOpen}
        url={browserUrl}
        status={browserStatus}
        failed={browserFailed}
        onClose={() => setBrowserOpen(false)}
      />

      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {t('share.title')}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          {t('share.localOnly')}
        </p>
        {extractMode && !busy && (
          <p className="mt-1 text-xs text-ink-muted">
            {extractMode === 'llm' ? t('share.usedLlm') : t('share.usedHeuristic')}
          </p>
        )}
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-ink-muted">
          {t('share.pasteHint')}
        </span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          className="surface w-full resize-y rounded-2xl px-3 py-3 text-sm leading-relaxed text-ink outline-none ring-1 ring-transparent transition-[box-shadow,ring-color] duration-150 focus:ring-olive/45"
          placeholder="https://…"
        />
      </label>

      <button
        type="button"
        disabled={busy || !draft.trim()}
        onClick={() => {
          const found = findFirstUrl(draft)
          const url = found ? normalizeProductUrl(found) : ''
          let text = draft.trim()
          if (found) {
            text = text.split(found).join(' ').replace(/\s+/g, ' ').trim()
            const bare = found.replace(/^https?:\/\//i, '')
            if (bare) text = text.split(bare).join(' ').replace(/\s+/g, ' ').trim()
          }
          void runExtract(shared.title || '', text, url || shared.url || '')
        }}
        className="pressable inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-olive px-4 font-medium text-paper-raised transition-colors duration-150 hover:bg-olive-deep disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {busy ? t('share.processing') : t('share.extract')}
      </button>

      <ExtractionProgress
        visible={progressVisible}
        steps={steps}
        error={progressError}
        startedAt={extractStartedAt}
      />

      {(needsCapture || (!extracted && !busy && !progressVisible)) && (
        <SmartCapture
          productUrl={draftUrl}
          highlight={needsCapture}
          reason={needsCapture ? captureReason : 'default'}
          onQuickCapture={({ title, text, url }) => {
            const nextDraft = [title, text, url || draftUrl]
              .filter(Boolean)
              .join('\n\n')
            setDraft(nextDraft)
            void runExtract(title, text, url || draftUrl || '')
          }}
        />
      )}

      {!hasShareContent(shared) && !draft && !extracted && !progressVisible && (
        <p className="text-sm text-ink-muted">{t('share.missingShare')}</p>
      )}

      {extracted && (
        <div className="surface rise-in space-y-4 rounded-2xl p-5">
          <div>
            {extracted.price != null && (
              <p className="font-display text-2xl font-semibold tabular-nums tracking-tight text-olive-deep">
                {extracted.price}
                {extracted.currency ? ` ${extracted.currency}` : ''}
              </p>
            )}
            <h2
              className={[
                'font-display text-lg font-semibold',
                extracted.price != null ? 'mt-1.5' : '',
              ].join(' ')}
            >
              {extracted.title}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {[
                extracted.brand,
                extracted.category,
                sourceFromUrl(
                  sourceUrl || shared.url || findFirstUrl(draft),
                  extracted.language === 'ar' ? 'ar' : 'en',
                )?.label,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {extracted.summary && (
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                {extracted.summary}
              </p>
            )}
          </div>

          {Object.entries(extracted.specs).filter(
            ([k, v]) =>
              !(
                typeof v === 'string' &&
                (/^(source|url|link|website|href)$/i.test(k) ||
                  /^https?:\/\//i.test(v.trim()))
              ),
          ).length > 0 && (
            <dl className="grid gap-2 text-sm">
              {Object.entries(extracted.specs)
                .filter(
                  ([k, v]) =>
                    !(
                      typeof v === 'string' &&
                      (/^(source|url|link|website|href)$/i.test(k) ||
                        /^https?:\/\//i.test(v.trim()))
                    ),
                )
                .map(([k, v]) => (
                <div
                  key={k}
                  className="grid grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] gap-2 border-t border-mist/50 pt-2"
                >
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="font-medium text-ink">{String(v ?? '—')}</dd>
                </div>
              ))}
            </dl>
          )}

          {matches.length > 0 && (
            <div className="rounded-xl bg-saffron/12 p-3 ring-1 ring-saffron/25">
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
              className="pressable inline-flex min-h-11 items-center rounded-xl bg-olive px-4 font-medium text-paper-raised transition-colors duration-150 hover:bg-olive-deep"
            >
              {matches.some((m) => m.reason === 'duplicate')
                ? t('share.saveAnyway')
                : matches.length > 0
                  ? t('share.saveAndCompare')
                  : t('app.save')}
            </button>
            <button
              type="button"
              onClick={() => setExtracted(null)}
              className="pressable inline-flex min-h-11 items-center rounded-xl bg-paper px-4 font-medium text-ink ring-1 ring-mist/70"
            >
              {t('app.cancel')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
