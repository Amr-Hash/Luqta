import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface MiniBrowserProps {
  url: string
  status: string
  open: boolean
  onClose: () => void
}

/** Visual mini-browser while the extension loads & scrapes the product URL. */
export function MiniBrowser({ url, status, open, onClose }: MiniBrowserProps) {
  const { t } = useTranslation()
  const [frameBlocked, setFrameBlocked] = useState(false)

  useEffect(() => {
    if (!open) return
    setFrameBlocked(false)
    const timer = window.setTimeout(() => setFrameBlocked(true), 2500)
    return () => window.clearTimeout(timer)
  }, [open, url])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={t('browser.title')}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-paper"
        style={{ boxShadow: 'var(--shadow-dock)' }}
      >
        <div className="flex items-center gap-2 border-b border-mist bg-paper-raised px-3 py-2">
          <span className="text-xs font-medium text-ink-muted">
            {t('browser.title')}
          </span>
          <p className="min-w-0 flex-1 truncate rounded-lg bg-paper px-2 py-1.5 font-mono text-[11px] text-ink ring-1 ring-mist/60">
            {url}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="pressable inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl text-sm font-medium ring-1 ring-mist/70"
            aria-label={t('app.cancel')}
          >
            ✕
          </button>
        </div>

        <div className="relative min-h-[220px] flex-1 bg-mist/30">
          <iframe
            title={t('browser.preview')}
            src={url}
            className="h-[42dvh] w-full border-0 bg-paper sm:h-[48dvh]"
            sandbox="allow-scripts allow-same-origin allow-forms"
            referrerPolicy="no-referrer"
          />
          {frameBlocked && (
            <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-paper via-paper/80 to-transparent p-4">
              <p className="text-xs leading-relaxed text-ink-muted">
                {t('browser.frameHint')}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-mist px-4 py-3">
          <p className="text-sm text-olive-deep" role="status">
            {status}
          </p>
          <p className="text-xs leading-relaxed text-ink-muted">
            {t('browser.extensionHint')}
          </p>
        </div>
      </div>
    </div>
  )
}
