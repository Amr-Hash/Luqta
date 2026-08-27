import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { MODEL_ID } from '@/lib/llm'
import { useLlm } from '@/hooks/useLlm'

export function LlmSetupGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const {
    canUseApp,
    loading,
    progress,
    error,
    webGpu,
    mode,
    preload,
    acceptFallback,
  } = useLlm()

  useEffect(() => {
    if (canUseApp || loading) return
    if (!webGpu) return
    void preload()
  }, [canUseApp, loading, webGpu, preload])

  if (canUseApp) return children

  const pct =
    progress?.progress != null ? Math.round(progress.progress * 100) : null

  return (
    <div className="fade-in mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5 py-10">
      <p className="brand-mark text-center text-5xl text-olive-deep">لقطة</p>
      <h1 className="mt-6 text-center font-display text-xl font-semibold text-ink">
        {t('setup.title')}
      </h1>
      <p className="mt-2 text-center text-sm leading-relaxed text-ink-muted">
        {t('setup.body')}
      </p>

      <div className="mt-8 space-y-4 rounded-2xl border border-mist bg-paper-raised/90 p-4">
        {!webGpu ? (
          <>
            <p className="text-sm leading-relaxed text-olive-deep">
              {t('setup.noWebGpu')}
            </p>
            <p className="text-xs leading-relaxed text-ink-muted">
              {t('setup.webGpuHint')}
            </p>
            <button
              type="button"
              onClick={acceptFallback}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-olive px-4 font-medium text-paper-raised transition-colors duration-150 hover:bg-olive-deep"
            >
              {t('setup.continueBasic')}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-ink-muted">
                {error ? t('setup.failed') : t('setup.loading')}
              </span>
              {pct != null && !error && (
                <span className="font-display tabular-nums text-olive-deep">
                  {pct}%
                </span>
              )}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-mist/70">
              <div
                className="h-full rounded-full bg-olive transition-[width] duration-300 ease-out"
                style={{
                  width: `${error ? 100 : Math.max(pct ?? 6, 6)}%`,
                  opacity: error ? 0.35 : 1,
                }}
              />
            </div>
            {progress?.text && (
              <p className="line-clamp-3 text-xs text-ink-muted">{progress.text}</p>
            )}
            <p className="font-mono text-[10px] leading-snug break-all text-ink-muted">
              {MODEL_ID}
            </p>
            <p className="text-xs leading-relaxed text-ink-muted">
              {t('setup.cdnHint')}
            </p>

            {error && (
              <div className="space-y-3">
                <p className="text-sm text-danger">{error}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void preload()}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-olive px-4 font-medium text-paper-raised transition-colors duration-150 hover:bg-olive-deep"
                  >
                    {t('setup.retry')}
                  </button>
                  <button
                    type="button"
                    onClick={acceptFallback}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-mist bg-paper px-4 font-medium text-ink"
                  >
                    {t('setup.continueBasic')}
                  </button>
                </div>
              </div>
            )}

            {!error && (loading || mode === 'loading') && (
              <p className="text-xs leading-relaxed text-ink-muted">
                {t('setup.waitHint')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
