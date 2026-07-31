import { Pipe, PipeTransform } from '@angular/core';

/**
 * Agenda `time` is stored as a full ISO datetime (API contract:
 * `AgendaItemSchema.time = z.iso.datetime()`), but the schedule only ever
 * displays the bare hour ("15:30"). Extracts just the HH:MM digits verbatim
 * (no `Date`/timezone conversion — the API's `Z` suffix does not mean UTC
 * here, it's the venue's wall-clock hour). An unparseable value is returned
 * as-is.
 */
export function extractAgendaTime(iso: string | undefined): string {
  if (!iso) return '';
  const match = /T(\d{2}:\d{2})/.exec(iso);
  return match ? match[1] : iso;
}

@Pipe({ name: 'agendaTime' })
export class AgendaTimePipe implements PipeTransform {
  transform(iso: string | undefined): string {
    return extractAgendaTime(iso);
  }
}
