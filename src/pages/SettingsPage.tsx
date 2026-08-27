import { useTranslation } from 'react-i18next'
import { ModelStatus } from '@/components/ModelStatus'
import { SmartCapture } from '@/components/SmartCapture'
import { useLlm } from '@/hooks/useLlm'
import { applyDocumentDirection } from '@/i18n'
import { MODEL_ID } from '@/lib/llm'

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { preload, ready, loading, webGpu, mode } = useLlm()

  const setLang = (lng: 'ar' | 'en') => {
    void i18n.changeLanguage(lng)
    applyDocumentDirection(lng)
  }

  return (
    <section className="space-y-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {t('settings.title')}
      </h1>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-ink-muted">{t('app.language')}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={i18n.language.startsWith('ar')}
            onClick={() => setLang('ar')}
            className={[
              'pressable min-h-11 flex-1 rounded-xl px-3 text-sm font-medium transition-colors duration-150',
              i18n.language.startsWith('ar')
                ? 'bg-olive text-paper-raised'
                : 'bg-paper-raised ring-1 ring-mist/70',
            ].join(' ')}
          >
            {t('app.arabic')}
          </button>
          <button
            type="button"
            aria-pressed={i18n.language.startsWith('en')}
            onClick={() => setLang('en')}
            className={[
              'pressable min-h-11 flex-1 rounded-xl px-3 text-sm font-medium transition-colors duration-150',
              i18n.language.startsWith('en')
                ? 'bg-olive text-paper-raised'
                : 'bg-paper-raised ring-1 ring-mist/70',
            ].join(' ')}
          >
            {t('app.english')}
          </button>
        </div>
      </div>

      <SmartCapture />

      <div className="surface space-y-3 rounded-2xl p-4">
        <h2 className="font-medium">{t('settings.privacy')}</h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          {t('settings.privacyBody')}
        </p>
      </div>

      <div className="surface space-y-3 rounded-2xl p-4">
        <h2 className="font-medium">{t('settings.model')}</h2>
        <p className="text-sm text-ink-muted">{t('settings.modelName')}</p>
        <p className="font-mono text-xs text-ink-muted break-all">{MODEL_ID}</p>
        <p className="text-sm leading-relaxed text-ink-muted">
          {t('settings.modelBody')}
        </p>
        <ModelStatus />
        {webGpu && mode !== 'fallback' && (
          <button
            type="button"
            disabled={ready || loading}
            onClick={() => void preload()}
            className="inline-flex min-h-11 items-center rounded-xl bg-olive px-4 text-sm font-medium text-paper-raised transition-colors duration-150 hover:bg-olive-deep disabled:opacity-50"
          >
            {ready ? t('share.modelReady') : t('settings.preload')}
          </button>
        )}
      </div>

      <div className="surface space-y-2 rounded-2xl p-4">
        <h2 className="font-medium">{t('settings.install')}</h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          {t('settings.installHint')}
        </p>
      </div>
    </section>
  )
}
