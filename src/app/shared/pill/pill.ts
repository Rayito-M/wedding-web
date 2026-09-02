import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Small uppercase pill (DS core/Pill) — soft (chip bg) or accent tone. */
@Component({
  selector: 'app-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pill.html',
  styleUrl: './pill.scss',
  host: {
    '[class.accent]': "tone() === 'accent'",
    '[class.is-loading]': 'loading()',
  },
})
export class Pill {
  readonly tone = input<'soft' | 'accent'>('soft');

  /** Render as a skeleton of the pill's own box — keeps the pill's metrics
   *  here rather than having each screen with a loading state restate them. */
  readonly loading = input(false);
}
