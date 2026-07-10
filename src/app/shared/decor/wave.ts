import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Scalloped wave (DS illustrations/WaveIllustration). */
@Component({
  selector: 'app-decor-wave',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wave.html',
  styleUrl: './decor.scss',
})
export class DecorWave {
  readonly color = input('var(--accent-3)');
  readonly w = input(180);
  readonly h = input(24);
}
