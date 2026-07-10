import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Two trout sharing a kiss (DS illustrations/FishPairIllustration) — mouths meeting at center. */
@Component({
  selector: 'app-decor-fish-pair',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fish-pair.html',
  styleUrl: './decor.scss',
})
export class DecorFishPair {
  readonly color = input('var(--accent)');
  readonly accent = input('var(--accent-2)');
  readonly size = input(220);

  protected readonly h = computed(() => this.size() * (60 / 216));
  protected readonly fishes = computed(() => [
    // Left fish: head right, mouth meeting at viewBox center (x=108)
    { transform: 'translate(4 0)', stroke: this.color() },
    // Right fish: mirrored — mouths kiss at center
    { transform: 'translate(212 0) scale(-1 1)', stroke: this.accent() },
  ]);
}
