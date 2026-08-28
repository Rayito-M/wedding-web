import { DatePipe } from '@angular/common';

import type { LangCode } from '../../model';

/**
 * The relative-day label for the admin-only "Last seen" column/row (hub
 * ADR-0035 §6, T290): "Today", "Yesterday", "Last week", "Last month",
 * falling back to an absolute date for older values, and "Never signed in"
 * for an absent value.
 *
 * The API ships a raw `YYYY-MM-DD` calendar date and no words at all — every
 * phrase this function can return is a whole, locale-specific string pulled
 * from `public/i18n/{en,es,fr}.json` via `translate`. It never builds a
 * sentence by lower-casing a bucket label into an English template
 * (`Last seen ${lastSeen.toLowerCase()}`, the DS `ProfileCard.jsx` anti-
 * pattern) — that assumes English word order and does not survive ES/FR.
 *
 * There is no time of day anywhere in this pipeline (ADR-0035 §1): the DS's
 * `ScreenConfigManager` mocks render `'Today, 09:12'`, but that field does
 * not exist in the data this function reads, and it must never be invented.
 *
 * Buckets are computed purely against the two `YYYY-MM-DD` strings — the
 * server already resolved the `Europe/Madrid` day (`todayInMadrid()` is the
 * caller's job to supply as `todayIso`), so this never reconstructs an
 * instant from `rawDate` and never re-timezones it. The absolute-date
 * fallback (`formatAbsoluteDate` below) keeps that same guarantee: no
 * `timezone` override is passed to `DatePipe`, so the named calendar day
 * never shifts with the reader's own timezone (see that function's doc for
 * why an explicit override would do the opposite of what it sounds like).
 */
export function lastSeenLabel(
  rawDate: string | null | undefined,
  todayIso: string,
  locale: LangCode,
  translate: (key: string) => string,
): string {
  if (!rawDate) return translate('guest_manager.lastSeen.never');

  const diff = daysSince(todayIso, rawDate);
  if (diff === 0) return translate('guest_manager.lastSeen.today');
  if (diff === 1) return translate('guest_manager.lastSeen.yesterday');
  if (diff >= 2 && diff <= 7) return translate('guest_manager.lastSeen.lastWeek');
  if (diff >= 8 && diff <= 30) return translate('guest_manager.lastSeen.lastMonth');
  return formatAbsoluteDate(rawDate, locale);
}

/** Whole calendar days from `date` to `today` (positive when `date` is
 *  earlier) — both are plain `YYYY-MM-DD` business dates, anchored to UTC
 *  midnight rather than a local-timezone `Date`, mirroring `milestones.ts`'s
 *  own `daysBetween`/`parseIsoDate` (kept local here since that pair isn't
 *  exported for reuse). */
function daysSince(todayIso: string, date: string): number {
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const [dy, dm, dd] = date.split('-').map(Number);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  const dateUtc = Date.UTC(dy, dm - 1, dd);
  return Math.round((todayUtc - dateUtc) / 86_400_000);
}

// `DatePipe` instances are locale-bound at construction; the three the app
// supports (`main.ts` registers `es`/`fr`, `en` is Angular's built-in) are
// cheap enough to keep around rather than rebuild per call.
const datePipesByLocale = new Map<LangCode, DatePipe>();

/**
 * `rawDate` formatted per `locale`, e.g. "12 Mar 2027". No `timezone`
 * argument is passed to `DatePipe.transform`: Angular's `DatePipe` parses a
 * bare `YYYY-MM-DD` string by constructing a *local*-time `Date` from its
 * year/month/day (`toDate()` in `@angular/common`, not the native `Date`
 * ISO-8601 parser, which would treat the same string as UTC midnight) — so
 * the calendar fields it set are exactly the ones default (no-timezone-
 * override) formatting reads back, regardless of the reader's own offset.
 * Passing an explicit `timezone` (including `'UTC'` or `'+0000'`) instead
 * *re-converts* that already-local instant, which is what shifts the
 * displayed day by one depending on the reader's offset from UTC — the
 * opposite of what "do not re-timezone it" (ADR-0035 §6/T290) requires.
 */
function formatAbsoluteDate(rawDate: string, locale: LangCode): string {
  let pipe = datePipesByLocale.get(locale);
  if (!pipe) {
    pipe = new DatePipe(locale);
    datePipesByLocale.set(locale, pipe);
  }
  return pipe.transform(rawDate, 'd MMM y', undefined, locale) ?? rawDate;
}
