import { useTranslation } from 'react-i18next'
import { buildCaptureBookmarkletHref } from '@/lib/capture'

interface SmartCaptureProps {
  productUrl?: string | null
  highlight?: boolean
}

export function SmartCapture({ productUrl, highlight }: SmartCaptureProps) {
  const { t } = useTranslation()
  const bookmarklet = buildCaptureBookmarkletHref()

  return (
    <div
      className={[
        'space-y-3 rounded-2xl border p-4',
        highlight
          ? 'border-saffron/45 bg-saffron/10'
          : 'border-mist bg-paper-raised/80',
      ].join(' ')}
    >
      <h2 className="font-medium text-olive-deep">{t('capture.title')}</h2>
      <p className="text-sm leading-relaxed text-ink-muted">{t('capture.body')}</p>

      <ol className="list-decimal space-y-3 ps-5 text-sm leading-relaxed text-ink">
        <li>
          <span className="font-medium">{t('capture.stepShare')}</span>
          <p className="mt-1 text-ink-muted">{t('capture.stepShareBody')}</p>
        </li>
        <li>
          <span className="font-medium">{t('capture.stepExtension')}</span>
          <p className="mt-1 text-ink-muted">{t('capture.stepExtensionBody')}</p>
        </li>
        <li>
          <span className="font-medium">{t('capture.stepBookmark')}</span>
          <p className="mt-1 text-ink-muted">{t('capture.stepBookmarkBody')}</p>
          <a
            href={bookmarklet}
            onClick={(e) => e.preventDefault()}
            className="mt-2 inline-flex min-h-11 cursor-grab items-center rounded-xl border border-dashed border-olive/50 bg-paper px-4 text-sm font-semibold text-olive-deep"
            title={t('capture.dragTitle')}
          >
            {t('capture.bookmarkLabel')}
          </a>
        </li>
      </ol>

      {productUrl && (
        <a
          href={productUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-olive px-4 text-sm font-medium text-paper-raised transition-colors duration-150 hover:bg-olive-deep sm:w-auto"
        >
          {t('capture.openProduct')}
        </a>
      )}
    </div>
  )
}
