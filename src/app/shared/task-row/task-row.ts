import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Task row (DS data-display/TaskRow) — circular check, strike-through when
 *  done, muted due label. Set `last` on the final row to drop the divider. */
@Component({
  selector: 'app-task-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-row.html',
  styleUrl: './task-row.scss',
  host: {
    '[class.last]': 'last()',
  },
})
export class TaskRow {
  readonly label = input.required<string>();
  readonly due = input('');
  readonly done = input(false);
  readonly last = input(false);
  readonly toggled = output<boolean>();
}
