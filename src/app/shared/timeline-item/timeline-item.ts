import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { RouterLink } from '@angular/router';

import { CreateWeddingConfigDtoAgendaItemsInner } from '@app/core';
import { TRAVEL_ROUTE, travelPlaceQueryParams } from '../travel-link';

/** Agenda row (DS data-display/TimelineItem) — serif time, accent dot rail,
 *  title + optional uppercase tag + sub line + optional venue line. `sub` is
 *  the tagline/explanation; `venue` is where it happens — both render only
 *  when non-empty, independently of each other. Pass `venueId` alongside
 *  `venue` to turn that line into a link onto the Travel map with the venue
 *  already selected; without it the line is plain text. Set `last` on the final row.
 *  `status` colors the time/dot/badge from the matching `--status-*` token:
 *  `confirmed` (default) draws a solid dot and no badge; `planned` draws a
 *  hollow dot, a dashed connector and an outline badge; `cancelled` also
 *  dims the row and strikes the time/title. Set `showStatus=false` to
 *  suppress the badge only (e.g. when every row in a provisional schedule
 *  would otherwise show "Planned"). */
@Component({
  selector: 'app-timeline-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './timeline-item.html',
  styleUrl: './timeline-item.scss',
  host: {
    '[attr.data-status]': 'status()',
  },
})
export class TimelineItem {
  // Not `input.required`: a `loading` row has no time or heading to give yet.
  // Every settled call site still passes both.
  readonly time = input('');
  readonly heading = input('');
  readonly tag = input('');
  readonly sub = input('');
  readonly venue = input('');
  readonly venueId = input('');
  readonly last = input(false);
  readonly status = input<CreateWeddingConfigDtoAgendaItemsInner.StatusEnum>('confirmed');
  readonly showStatus = input(true);
  /** Render the row as a skeleton — same height, no content. */
  readonly loading = input(false);

  protected readonly showBadge = computed(() => this.showStatus() && this.status() !== 'confirmed');

  protected readonly statusLabelKey = computed(() => `shared.agendaStatus.${this.status()}`);

  protected readonly travelRoute = TRAVEL_ROUTE;

  protected readonly venueQueryParams = computed(() => travelPlaceQueryParams(this.venueId()));
}
