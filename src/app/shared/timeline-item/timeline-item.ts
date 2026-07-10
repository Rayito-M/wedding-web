import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Agenda row (DS data-display/TimelineItem) — serif time, accent dot rail,
 *  title + optional uppercase tag + sub line. Set `last` on the final row. */
@Component({
  selector: 'app-timeline-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline-item.html',
  styleUrl: './timeline-item.scss',
})
export class TimelineItem {
  readonly time = input.required<string>();
  readonly heading = input.required<string>();
  readonly tag = input('');
  readonly sub = input('');
  readonly last = input(false);
}
