import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  buildCaptureBookmarkletHref,
  isCoarsePointerDevice,
} from '@/lib/capture'

export type CaptureReason = 'default' | 'blocked' | 'weak'

interface SmartCaptureProps {
  productUrl?: string | null
  highlight?: boolean
  reason?: CaptureReason
  /** Called when user fills quick title/price and taps extract */
  onQuickCapture?: (payload: {
    title: string
    text: string
    url: string
  }) => void
}

export function SmartCapture({
  productUrl,
  highlight,
  reason = 'default',
  onQuickCapture,
}: SmartCaptureProps) {
  const { t } = useTranslation()
  const bookmarklet = useMemo(() => buildCaptureBookmarkletHref(), [])
  const mobile = useMemo(() => isCoarsePointerDevice(), [])
  const [copied, setCopied] = useState(false)
  const [howOpen, setHowOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')

  const headline =
    reason === 'blocked'
      ? t('capture.blockedTitle')
      : reason === 'weak'
        ? t('capture.weakTitle')
        : t('capture.title')

  const body =
    reason === 'blocked'
      ? t('capture.blockedBody')
      : reason === 'weak'
        ? t('capture.weakBody')
        : t('capture.body')

  const copyBookmarklet = async () => {
    try {
      await navigator.clipboard.writeText(bookmarklet)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const submitQuick = () => {
    if (!onQuickCapture) return
    const text = [price && `Price: ${price}`, notes].filter(Boolean).join('\n\n')
    onQuickCapture({
      title: title.trim(),
      text: text.trim(),
      url: productUrl?.trim() || '',
    })
  }

  return (
    <div
      className={[
        'space-y-4 rounded-2xl p-4',
        highlight
          ? 'bg-saffron/12 ring-1 ring-saffron/30'
          : 'surface',
      ].join(' ')}
    >
      <div>
        <h2 className="font-display text-lg font-semibold text-olive-deep">
          {headline}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
      </div>

      {/* 1 — Share (best on phone) */}
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {mobile ? t('capture.bestOnPhone') : t('capture.stepShare')}
        </p>
        <div className="rounded-xl bg-paper px-3 py-3 ring-1 ring-mist/60">
          <p className="text-sm font-medium text-ink">{t('capture.stepShare')}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            {t('capture.stepShareBody')}
          </p>
        </div>
      </section>

      {/* 2 — Open product + bookmarklet */}
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {t('capture.seeWithEyes')}
        </p>
        <p className="text-sm leading-relaxed text-ink-muted">
          {t('capture.stepBookmarkBody')}
        </p>

        <div className="flex flex-wrap gap-2">
          {productUrl && (
            <a
              href={productUrl}
              target="_blank"
              rel="noreferrer"
              className="pressable inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-olive px-4 text-sm font-medium text-paper-raised transition-colors duration-150 hover:bg-olive-deep sm:flex-none"
            >
              {t('capture.openProduct')}
            </a>
          )}

          {!mobile && (
            <a
              href={bookmarklet}
              onClick={(e) => e.preventDefault()}
              draggable
              className="pressable inline-flex min-h-11 cursor-grab items-center justify-center rounded-xl bg-paper px-4 text-sm font-semibold text-olive-deep ring-1 ring-dashed ring-olive/45"
              title={t('capture.dragTitle')}
            >
              {t('capture.bookmarkLabel')}
            </a>
          )}

          <button
            type="button"
            onClick={() => void copyBookmarklet()}
            className="pressable inline-flex min-h-11 items-center justify-center rounded-xl bg-paper px-4 text-sm font-medium text-ink ring-1 ring-mist/70"
          >
            {copied ? t('capture.copied') : t('capture.copyShortcut')}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setHowOpen((v) => !v)}
          className="text-sm font-medium text-olive underline-offset-2 hover:underline"
          aria-expanded={howOpen}
        >
          {howOpen ? t('capture.hideHow') : t('capture.showHow')}
        </button>

        {howOpen && (
          <ol className="list-decimal space-y-2 ps-5 text-sm leading-relaxed text-ink-muted">
            {mobile ? (
              <>
                <li>{t('capture.mobileHow1')}</li>
                <li>{t('capture.mobileHow2')}</li>
                <li>{t('capture.mobileHow3')}</li>
                <li>{t('capture.mobileHow4')}</li>
              </>
            ) : (
              <>
                <li>{t('capture.desktopHow1')}</li>
                <li>{t('capture.desktopHow2')}</li>
                <li>{t('capture.desktopHow3')}</li>
              </>
            )}
          </ol>
        )}
      </section>

      {/* 3 — Quick paste what you see */}
      {onQuickCapture && (
        <section className="space-y-3 border-t border-mist/50 pt-4">
          <div>
            <p className="text-sm font-medium text-ink">{t('capture.pasteTitle')}</p>
            <p className="mt-1 text-sm text-ink-muted">{t('capture.pasteBody')}</p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-muted">
              {t('capture.fieldTitle')}
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="surface w-full rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-transparent focus:ring-olive/40"
              placeholder={t('capture.fieldTitlePh')}
              autoComplete="off"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-muted">
              {t('capture.fieldPrice')}
            </span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="surface w-full rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-transparent focus:ring-olive/40"
              placeholder={t('capture.fieldPricePh')}
              inputMode="decimal"
              autoComplete="off"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-muted">
              {t('capture.fieldNotes')}
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="surface w-full resize-y rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-transparent focus:ring-olive/40"
              placeholder={t('capture.fieldNotesPh')}
            />
          </label>
          <button
            type="button"
            disabled={!title.trim() && !price.trim() && !notes.trim()}
            onClick={submitQuick}
            className="pressable inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-olive px-4 text-sm font-medium text-paper-raised disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {t('capture.pasteExtract')}
          </button>
        </section>
      )}

      {/* 4 — Extension (desktop) */}
      <section className="space-y-1 border-t border-mist/50 pt-4">
        <p className="text-sm font-medium text-ink">{t('capture.stepExtension')}</p>
        <p className="text-sm leading-relaxed text-ink-muted">
          {t('capture.stepExtensionBody')}
        </p>
      </section>
    </div>
  )
}
