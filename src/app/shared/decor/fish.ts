import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Single trout (DS illustrations/FishIllustration) — line-art, points right by default. */
@Component({
  selector: 'app-decor-fish',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fish.html',
  styleUrl: './decor.scss',
})
export class DecorFish {
  readonly color = input('var(--accent)');
  readonly w = input(120);
  readonly flip = input(false);
  readonly filled = input(false);
  readonly strokeWidth = input(1.6);
  protected readonly h = computed(() => this.w() * 0.5);
}
