import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import ar from './locales/ar.json'
import en from './locales/en.json'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    fallbackLng: 'ar',
    supportedLngs: ['ar', 'en'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'luqta-lang',
    },
  })

export function applyDocumentDirection(lng: string) {
  const dir = lng.startsWith('ar') ? 'rtl' : 'ltr'
  document.documentElement.lang = lng.startsWith('ar') ? 'ar' : 'en'
  document.documentElement.dir = dir
}

i18n.on('languageChanged', applyDocumentDirection)
applyDocumentDirection(i18n.language)

export default i18n
