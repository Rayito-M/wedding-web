/**
 * Today's calendar date in `Europe/Madrid` (`YYYY-MM-DD`), independent of the
 * browser's own timezone (hub ADR-0029 §4.2: "in the past" is judged against
 * the wedding's timezone, not the visitor's — the web and the API must not be
 * able to disagree about what day it is for a guest or admin travelling
 * abroad). Milestone `plannedDate` is itself a plain `YYYY-MM-DD` date with no
 * time component, so a same-shaped string compares correctly with `<`/`>`/`===`
 * without ever constructing a `Date`.
 *
 * `en-CA` is a locale trick, not a locale choice: it is the one built-in
 * `Intl.DateTimeFormat` locale whose default numeric date order is
 * year-month-day, which is exactly `YYYY-MM-DD` once the separators are
 * normalised.
 */
export function todayInMadrid(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
