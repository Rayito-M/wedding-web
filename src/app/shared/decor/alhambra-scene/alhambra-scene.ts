import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { BrideAnimation } from '@app/shared/bride-animation/bride-animation';
import { DecorMotorcycleRider } from '@app/shared/decor/motorcycle-rider/motorcycle-rider';

import { DecorAlhambra } from '../alhambra';

// AlhambraIllustration height / width ratio (DS components/illustrations/AlhambraIllustration).
const RATIO = 0.34;

// Fractions of the skyline's own width — the ONLY correct way to place the
// bride and rider animations against it (DS components/motion/AlhambraScene).
// Every offset scales with `width` so nothing drifts when the page, gutter or
// viewport changes.
const BRIDE = { width: 0.3, left: 0.15, bottom: 0.078 };
const RIDER = { width: 0.135, bottom: 0.222 };

/**
 * Alhambra vignette: skyline + the groom riding the ridge + the bride
 * stepping out of the left tower (DS `components/motion/AlhambraScene`).
 * Always use this instead of composing DecorAlhambra + DecorMotorcycleRider +
 * BrideAnimation by hand — hand-placed offsets align to the page, not the art.
 */
@Component({
  selector: 'app-alhambra-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecorAlhambra, DecorMotorcycleRider, BrideAnimation],
  templateUrl: './alhambra-scene.html',
  styleUrl: './alhambra-scene.scss',
})
export class AlhambraScene {
  readonly color = input('var(--brand-accent)');
  readonly accentColor = input('var(--brand-accent-soft)');
  readonly mountainColor = input('var(--brand-accent-tertiary)');
  /** Skyline width in px — every animation offset is derived from it. */
  readonly width = input(360);
  /** Show the groom crossing the ridge. */
  readonly rider = input(true);
  /** Show the bride stepping out of the tower. */
  readonly bride = input(true);
  /** Raise both animations this many px above their geometric anchor. */
  readonly lift = input(0);
  /** Extra px on the bride only, on top of `lift` (negative lowers her). */
  readonly brideLift = input(0);
  /** Bride's speech-bubble text. Falls back to BrideAnimation's own default. */
  readonly greeting = input('¡Hola!');

  protected readonly height = computed(() => Math.round(this.width() * RATIO));
  protected readonly brideWidth = computed(() => this.width() * BRIDE.width);
  protected readonly brideLeft = computed(() => this.width() * BRIDE.left);
  protected readonly brideBottom = computed(
    () => this.width() * BRIDE.bottom + this.lift() + this.brideLift(),
  );
  protected readonly riderWidth = computed(() => this.width() * RIDER.width);
  protected readonly riderBottom = computed(() => this.width() * RIDER.bottom + this.lift());
}
