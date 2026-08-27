import { useTranslation } from 'react-i18next'
import { applyDocumentDirection } from '@/i18n'

export function SettingsPage() {
  const { t, i18n } = useTranslation()

  const setLang = (lng: 'ar' | 'en') => {
    void i18n.changeLanguage(lng)
    applyDocumentDirection(lng)
  }

  return (
    <section className="space-y-6">
      <h1 className="font-display text-xl font-semibold">{t('settings.title')}</h1>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-ink-muted">{t('app.language')}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={i18n.language.startsWith('ar')}
            onClick={() => setLang('ar')}
            className={[
              'min-h-11 flex-1 rounded-xl border px-3 text-sm font-medium transition-colors duration-150',
              i18n.language.startsWith('ar')
                ? 'border-olive bg-olive text-paper-raised'
                : 'border-mist bg-paper-raised',
            ].join(' ')}
          >
            {t('app.arabic')}
          </button>
          <button
            type="button"
            aria-pressed={i18n.language.startsWith('en')}
            onClick={() => setLang('en')}
            className={[
              'min-h-11 flex-1 rounded-xl border px-3 text-sm font-medium transition-colors duration-150',
              i18n.language.startsWith('en')
                ? 'border-olive bg-olive text-paper-raised'
                : 'border-mist bg-paper-raised',
            ].join(' ')}
          >
            {t('app.english')}
          </button>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-mist bg-paper-raised/80 p-4">
        <h2 className="font-medium">{t('settings.privacy')}</h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          {t('settings.privacyBody')}
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-mist bg-paper-raised/80 p-4">
        <h2 className="font-medium">{t('settings.offline')}</h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          {t('settings.offlineBody')}
        </p>
      </div>

      <div className="space-y-2 rounded-2xl border border-mist bg-paper-raised/80 p-4">
        <h2 className="font-medium">{t('settings.install')}</h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          {t('settings.installHint')}
        </p>
      </div>
    </section>
  )
}
