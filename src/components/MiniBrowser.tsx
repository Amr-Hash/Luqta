import { useTranslation } from 'react-i18next'

interface MiniBrowserProps {
  url: string
  status: string
  open: boolean
  onClose: () => void
  /** When true, capture finished with an error */
  failed?: boolean
}

/**
 * Capture chrome while the extension scrapes in a background tab.
 * Intentionally does NOT iframe the shop — most stores block framing and
 * their preload/404 noise floods the console and looks like a Luqta failure.
 */
export function MiniBrowser({
  url,
  status,
  open,
  onClose,
  failed = false,
}: MiniBrowserProps) {
  const { t } = useTranslation()

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={t('browser.title')}
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-paper"
        style={{ boxShadow: 'var(--shadow-dock)' }}
      >
        <div className="flex items-center gap-2 border-b border-mist/70 bg-paper-raised px-3 py-2.5">
          <span className="shrink-0 text-xs font-medium text-ink-muted">
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

        <div className="relative flex min-h-[200px] flex-col items-center justify-center gap-4 px-6 py-10">
          <div
            className={[
              'grid size-14 place-items-center rounded-full',
              failed ? 'bg-danger/12 text-danger' : 'bg-olive/12 text-olive',
            ].join(' ')}
            aria-hidden
          >
            {failed ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 8v5M12 16.5h.01M12 3.5 2.8 19.5h18.4L12 3.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect
                  x="3.5"
                  y="5.5"
                  width="17"
                  height="13"
                  rx="2.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="3.25"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            )}
          </div>

          {!failed && (
            <div className="h-1 w-40 overflow-hidden rounded-full bg-mist/70">
              <div className="extract-bar h-full w-1/3 rounded-full bg-olive" />
            </div>
          )}

          <p
            className={[
              'max-w-sm text-center text-sm font-medium leading-relaxed',
              failed ? 'text-danger' : 'text-olive-deep',
            ].join(' ')}
            role="status"
          >
            {status}
          </p>
          <p className="max-w-sm text-center text-xs leading-relaxed text-ink-muted">
            {failed ? t('browser.failedHint') : t('browser.extensionHint')}
          </p>
        </div>
      </div>
    </div>
  )
}
