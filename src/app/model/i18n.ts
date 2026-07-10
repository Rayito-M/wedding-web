export type LangCode = 'en' | 'fr' | 'es';

export type LangDescriptionType = Record<LangCode, string>;

export const langDescription: LangDescriptionType = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
};
