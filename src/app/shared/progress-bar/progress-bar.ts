import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Thin accent progress bar (DS data-display/ProgressBar). */
@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './progress-bar.html',
  styleUrl: './progress-bar.scss',
  host: {
    '[style.height.px]': 'height()',
    '[attr.role]': "'progressbar'",
    '[attr.aria-valuenow]': 'percent()',
    '[attr.aria-valuemin]': '0',
    '[attr.aria-valuemax]': '100',
  },
})
export class ProgressBar {
  readonly percent = input(0);
  readonly height = input(4);
}
