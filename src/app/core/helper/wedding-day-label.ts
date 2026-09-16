import { LangCode } from '../../model';

import { INTL_LOCALE } from './rsvp-deadline-label';

/**
 * The wedding date as localized prose, from the configuration — T396.
 *
 * Two more strings used to spell the date in words: `schedule.header`
 * ("SAT · 5 JUN" ×3 locales) and `rsvp.create.confirm.yesTitle` ("See you
 * in June") — right only because the configured `date` happened to be
 * 2027-06-05, exactly the shape T393 removed from the six deadline keys.
 * These two helpers derive both from the config's `date` instead, with the
 * same conventions as `rsvpDeadlineLabel`: `Intl` (full es/fr/en CLDR data
 * in every target browser, no `registerLocaleData`), the calendar date
 * taken in `Europe/Madrid` (hub ADR-0029 §4.2), an unparseable value
 * returned raw as a visible degradation — and, for these two, an empty
 * string for an empty input, because both render in chrome (the header
 * bar, a heading) where a placeholder sentence has nowhere to hide.
 */

/**
 * "SAT · 5 JUN" / "SÁB · 5 JUN" / "SAM · 5 JUIN" — the schedule header and
 * date badge; `withYear` appends the year for the badge's wide form.
 */
export function weddingDayLabel(dateIso: string, lang: LangCode, withYear = false): string {
  if (!dateIso) return '';
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return dateIso;

  const parts = new Intl.DateTimeFormat(INTL_LOCALE[lang], {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(date);
  // es/fr abbreviations carry a trailing period ("sam.", "sept.") that the
  // DS header format does not.
  const part = (type: string): string =>
    parts.find((candidate) => candidate.type === type)?.value.replace(/\.$/, '') ?? '';

  const day = `${part('weekday')} · ${part('day')} ${part('month')}`.toLocaleUpperCase(
    INTL_LOCALE[lang],
  );
  return withYear ? `${day} ${part('year')}` : day;
}

/** "June" / "junio" / "juin" — the RSVP confirmation's month. */
export function weddingMonthLabel(dateIso: string, lang: LangCode): string {
  if (!dateIso) return '';
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return dateIso;

  return new Intl.DateTimeFormat(INTL_LOCALE[lang], {
    timeZone: 'Europe/Madrid',
    month: 'long',
  }).format(date);
}
