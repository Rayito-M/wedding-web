import { LangCode } from '../../model';

/**
 * The configured RSVP deadline as prose for the active locale — T393.
 *
 * Six locale strings used to say the deadline in words ("1 May" / "1 de
 * mayo" / "1er mai") while `rsvpDeadline` is a field the couple edits in
 * Settings → Basics; the copy was right only because the configured value
 * happened to be 2027-05-01. The RSVP screens now interpolate this label
 * instead, from the public config the app already loads at the root.
 *
 * A date is prose and IS localized — unlike the identifiers hard rule 19a
 * pins byte-identical — so this uses `Intl.DateTimeFormat`, which every
 * target browser (hard rule 4) ships with full es/fr/en CLDR data and which
 * needs none of Angular's `registerLocaleData` machinery (the app registers
 * no locale data, so `DatePipe` would throw for es/fr). Per-locale forms:
 *
 * - `en` → `en-GB` ("1 May", the day-first form the shipped copy used and
 *   the natural one for the British guests; `en-US` would flip it to
 *   "May 1")
 * - `es` → `es-ES` ("1 de mayo")
 * - `fr` → `fr-FR` ("1 mai"), with one documented exception: French writes
 *   the FIRST of a month as an ordinal ("1er mai") and `Intl` has no
 *   ordinal-day support, so a day-part of "1" is rendered "1er" — exactly
 *   the form the shipped copy used. Other days carry no ordinal in French
 *   dates ("15 mai"), so the exception is only ever the first.
 *
 * The calendar date is taken in `Europe/Madrid`, the timezone every other
 * date judgement in this app uses (hub ADR-0029 §4.2, `todayInMadrid`), so a
 * deadline stored as UTC midnight cannot render as the previous day for a
 * guest browsing from another timezone.
 *
 * An unparseable value returns the raw string rather than empty prose — a
 * visible degradation instead of a sentence with a hole in it.
 */
export const INTL_LOCALE: Record<LangCode, string> = {
  en: 'en-GB',
  es: 'es-ES',
  fr: 'fr-FR',
};

export function rsvpDeadlineLabel(rsvpDeadline: string, lang: LangCode): string {
  const date = new Date(rsvpDeadline);
  if (Number.isNaN(date.getTime())) return rsvpDeadline;

  return new Intl.DateTimeFormat(INTL_LOCALE[lang], {
    timeZone: 'Europe/Madrid',
    day: 'numeric',
    month: 'long',
  })
    .formatToParts(date)
    .map((part) => (lang === 'fr' && part.type === 'day' && part.value === '1' ? '1er' : part.value))
    .join('');
}
