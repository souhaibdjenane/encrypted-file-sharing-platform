import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from '@/locales/en.json'
import fr from '@/locales/fr.json'
import ar from '@/locales/ar.json'

export const LANGUAGES = [
    { code: 'en', label: 'English', shortCode: 'EN', dir: 'ltr' },
    { code: 'fr', label: 'Français', shortCode: 'FR', dir: 'ltr' },
    { code: 'ar', label: 'العربية', shortCode: 'AR', dir: 'rtl' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            fr: { translation: fr },
            ar: { translation: ar },
        },
        fallbackLng: 'en',
        supportedLngs: ['en', 'fr', 'ar'],
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
            lookupLocalStorage: 'vaultshare-lang',
        },
    })

export function applyLanguage(code: LanguageCode) {
    const lang = LANGUAGES.find((l) => l.code === code)
    if (!lang) return
    const root = document.documentElement
    root.setAttribute('lang', code)
    root.setAttribute('dir', lang.dir)
}

// Apply on init
const currentLang = (i18n.language?.split('-')[0] as LanguageCode) ?? 'en'
applyLanguage(LANGUAGES.find((l) => l.code === currentLang) ? currentLang : 'en')

export default i18n
