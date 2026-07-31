import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { CreateWeddingConfigDtoAgendaItemsInner } from '@app/core';

/** Agenda row (DS data-display/TimelineItem) — serif time, accent dot rail,
 *  title + optional uppercase tag + sub line. Set `last` on the final row.
 *  `status` colors the time/dot/badge from the matching `--status-*` token:
 *  `confirmed` (default) draws a solid dot and no badge; `planned` draws a
 *  hollow dot, a dashed connector and an outline badge; `cancelled` also
 *  dims the row and strikes the time/title. Set `showStatus=false` to
 *  suppress the badge only (e.g. when every row in a provisional schedule
 *  would otherwise show "Planned"). */
@Component({
  selector: 'app-timeline-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './timeline-item.html',
  styleUrl: './timeline-item.scss',
  host: {
    '[attr.data-status]': 'status()',
  },
})
export class TimelineItem {
  readonly time = input.required<string>();
  readonly heading = input.required<string>();
  readonly tag = input('');
  readonly sub = input('');
  readonly last = input(false);
  readonly status = input<CreateWeddingConfigDtoAgendaItemsInner.StatusEnum>('confirmed');
  readonly showStatus = input(true);

  protected readonly showBadge = computed(
    () => this.showStatus() && this.status() !== 'confirmed',
  );

  protected readonly statusLabelKey = computed(() => `shared.agendaStatus.${this.status()}`);
}
