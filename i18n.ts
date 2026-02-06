import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/locales/en';
import th from '@/locales/th';

export type I18nLanguage = 'en' | 'th';

export const APP_LANG_TO_I18N_LANG: Record<'EN' | 'TH', I18nLanguage> = {
  EN: 'en',
  TH: 'th',
};

const resources = {
  en: { translation: en },
  th: { translation: th },
} as const;

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export default i18n;
