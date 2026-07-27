import { LangCode } from './i18n';

/** A dialable country entry for the phone-number country-code selector. */
export interface PhoneCountry {
  /** ISO 3166-1 alpha-2 code, e.g. `ES`. */
  iso: string;
  /** Display name. */
  name: string;
  /** E.164 dial prefix including the `+`, e.g. `+34`. */
  dialCode: string;
  /** Flag emoji. */
  flag: string;
}

/**
 * Curated list of countries offered in the phone-code dropdown. Kept short and
 * wedding-relevant (host country + common guest origins); extend as needed.
 */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: 'ES', name: 'España', dialCode: '+34', flag: '🇪🇸' },
  { iso: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷' },
  { iso: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧' },
  { iso: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸' },
  { iso: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹' },
  { iso: 'IT', name: 'Italia', dialCode: '+39', flag: '🇮🇹' },
  { iso: 'DE', name: 'Deutschland', dialCode: '+49', flag: '🇩🇪' },
  { iso: 'BE', name: 'Belgique', dialCode: '+32', flag: '🇧🇪' },
  { iso: 'CH', name: 'Suisse', dialCode: '+41', flag: '🇨🇭' },
  { iso: 'NL', name: 'Nederland', dialCode: '+31', flag: '🇳🇱' },
  { iso: 'IE', name: 'Ireland', dialCode: '+353', flag: '🇮🇪' },
  { iso: 'MX', name: 'México', dialCode: '+52', flag: '🇲🇽' },
];

/** Default country per UI language (host country falls to Spain otherwise). */
const DEFAULT_ISO_BY_LANG: Record<LangCode, string> = {
  es: 'ES',
  fr: 'FR',
  en: 'GB',
};

/** The country to preselect for `lang`, defaulting to Spain (the venue). */
export function defaultCountryForLang(lang: LangCode): PhoneCountry {
  const iso = DEFAULT_ISO_BY_LANG[lang] ?? 'ES';
  return PHONE_COUNTRIES.find((c) => c.iso === iso) ?? PHONE_COUNTRIES[0];
}
