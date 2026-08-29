/**
 * Agenda rows in clock order — shared by the guest schedule, the invitee
 * home preview's key moments, and the config manager's agenda tab, so the
 * three can never disagree about what "next" means.
 *
 * The contract stores `time` as a full ISO datetime
 * (`AgendaItemSchema.time = z.iso.datetime()`), so a plain string comparison
 * is already chronological. It is deliberately *not* a `Date` comparison,
 * which would drag the `Z` suffix into a timezone conversion it does not mean
 * here — the suffix carries the venue's wall-clock hour (see
 * `extractAgendaTime`).
 *
 * A value still being typed in the config manager is not ISO-shaped yet;
 * `\uffff` parks it at the end rather than letting it jump to the top
 * mid-keystroke. `sort` is stable, so same-hour items keep their existing
 * order. The input is never mutated, and callers may pass a `readonly` array.
 *
 * Display order only: every agenda edit addresses its item by `id`, so
 * reordering the view never mis-targets a write.
 */
export function byAgendaTime<T extends { time: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) =>
    agendaTimeSortKey(a.time).localeCompare(agendaTimeSortKey(b.time)),
  );
}

function agendaTimeSortKey(time: string): string {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(time) ? time : `\uffff${time}`;
}
