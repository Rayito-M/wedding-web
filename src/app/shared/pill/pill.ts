import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Small uppercase pill (DS core/Pill) — soft (chip bg) or accent tone. */
@Component({
  selector: 'app-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pill.html',
  styleUrl: './pill.scss',
  host: {
    '[class.accent]': "tone() === 'accent'",
  },
})
export class Pill {
  readonly tone = input<'soft' | 'accent'>('soft');
}
