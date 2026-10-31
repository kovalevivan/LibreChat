import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import translationEn from './en/translation.json';
import translationRu from './ru/translation.json';

export const defaultNS = 'translation';

export const resources = {
  en: { translation: translationEn },
  ru: { translation: translationRu },
} as const;

i18n.use(initReactI18next).init({
  lng: 'ru',
  fallbackLng: 'en',
  supportedLngs: ['ru', 'en'],
  fallbackNS: 'translation',
  ns: ['translation'],
  debug: false,
  defaultNS,
  resources,
  interpolation: { escapeValue: false },
});

export default i18n;
