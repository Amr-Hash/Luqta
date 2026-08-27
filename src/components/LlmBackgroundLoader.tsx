import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLlm } from '@/hooks/useLlm'

/** Non-blocking: kicks off model download and shows a dismissible status strip. */
export function LlmBackgroundLoader() {
  const { t } = useTranslation()
  const {
    ensureBackgroundPreload,
    loading,
    progress,
    ready,
    error,
    webGpu,
    mode,
    acceptFallback,
    preload,
    cachedOnDevice,
  } = useLlm()

  useEffect(() => {
    ensureBackgroundPreload()
  }, [ensureBackgroundPreload])

  if (!webGpu || mode === 'fallback' || ready) return null

  const pct =
    progress?.progress != null ? Math.round(progress.progress * 100) : null

  if (!loading && !error && mode !== 'loading') return null

  return (
    <div className="border-b border-mist/70 bg-paper-raised/95 px-4 py-2.5 text-sm backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-ink-muted">
              {error
                ? t('setup.failed')
                : cachedOnDevice
                  ? t('setup.loadingCached')
                  : t('setup.loading')}
            </span>
            {pct != null && !error && (
              <span className="font-display tabular-nums text-olive-deep">
                {pct}%
              </span>
            )}
          </div>
          {!error && (
            <div className="h-1 overflow-hidden rounded-full bg-mist/70">
              <div
                className="h-full rounded-full bg-olive transition-[width] duration-300 ease-out"
                style={{ width: `${Math.max(pct ?? 4, 4)}%` }}
              />
            </div>
          )}
          {progress?.text && !error && (
            <p className="line-clamp-1 text-xs text-ink-muted">{progress.text}</p>
          )}
          {error && (
            <p className="text-xs text-ink-muted">{t('setup.failedHint')}</p>
          )}
          {!error && (
            <p className="text-xs text-ink-muted">
              {cachedOnDevice
                ? t('setup.cachedHint')
                : t('setup.downloadHint')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {error && (
            <button
              type="button"
              onClick={() => void preload()}
              className="inline-flex min-h-10 items-center rounded-xl bg-olive px-3 text-xs font-medium text-paper-raised"
            >
              {t('setup.retry')}
            </button>
          )}
          <button
            type="button"
            onClick={acceptFallback}
            className="inline-flex min-h-10 items-center rounded-xl border border-mist bg-paper px-3 text-xs font-medium text-ink"
          >
            {t('setup.skipForNow')}
          </button>
        </div>
      </div>
    </div>
  )
}
