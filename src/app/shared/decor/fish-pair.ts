import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Two trout sharing a kiss — mouths meeting at the center, profile view. */
@Component({
  selector: 'app-decor-fish-pair',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="h()" viewBox="0 0 216 60" aria-hidden="true">
      @for (fish of fishes(); track $index) {
        <g [attr.transform]="fish.transform">
          <!-- forked tail -->
          <path
            d="M 18 30 L 4 18 L 10 30 L 4 42 Z"
            fill="none"
            [style.stroke]="fish.stroke"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
          <!-- body lens -->
          <path
            d="M 18 30 C 36 8, 86 8, 104 30 C 86 52, 36 52, 18 30 Z"
            fill="none"
            [style.stroke]="fish.stroke"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
          <!-- dorsal fin -->
          <path
            d="M 50 16 Q 60 6, 72 16"
            fill="none"
            [style.stroke]="fish.stroke"
            stroke-width="1.6"
            stroke-linecap="round"
          />
          <!-- belly fin -->
          <path
            d="M 56 46 Q 62 52, 68 46"
            fill="none"
            [style.stroke]="fish.stroke"
            stroke-width="1.6"
            stroke-linecap="round"
          />
          <!-- gill curve -->
          <path
            d="M 86 22 Q 82 30, 86 38"
            fill="none"
            [style.stroke]="fish.stroke"
            stroke-width="1.12"
            stroke-linecap="round"
            opacity="0.7"
          />
          <!-- eye -->
          <circle cx="96" cy="28" r="1.6" [style.fill]="fish.stroke" />
        </g>
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; line-height: 0; }`,
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
