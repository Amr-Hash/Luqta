import { useTranslation } from 'react-i18next'
import { useLlm } from '@/hooks/useLlm'

export function ModelStatus({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const { progress, ready, webGpu, error } = useLlm()

  if (!webGpu) {
    return (
      <p className="rounded-xl border border-saffron/40 bg-saffron/10 px-3 py-2 text-sm text-olive-deep">
        {t('share.noWebGpu')}
      </p>
    )
  }

  if (error) {
    return (
      <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
        {error}
      </p>
    )
  }

  if (ready) {
    return compact ? null : (
      <p className="text-sm text-olive">{t('share.modelReady')}</p>
    )
  }

  const pct = progress?.progress != null ? Math.round(progress.progress * 100) : null

  return (
    <div className="rounded-xl border border-mist bg-paper-raised px-3 py-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-ink-muted">{t('share.loadingModel')}</span>
        {pct != null && (
          <span className="font-display tabular-nums text-olive-deep">{pct}%</span>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist/70">
        <div
          className="h-full rounded-full bg-olive transition-[width] duration-300 ease-out"
          style={{ width: `${pct ?? 8}%` }}
        />
      </div>
      {progress?.text && !compact && (
        <p className="mt-2 line-clamp-2 text-xs text-ink-muted">{progress.text}</p>
      )}
    </div>
  )
}
