import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

export type MotorcycleRiderMode = 'ground' | 'ridge';

interface MotorcycleRun {
  key: number;
  dir: 1 | -1;
  durationSeconds: number;
}

interface WheelDetailLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// knobby-tyre ticks around the rim
function buildKnobTicks(cx: number): WheelDetailLine[] {
  return Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * Math.PI * 2;
    const inner = 15.5;
    const outer = 18;
    return {
      x1: cx + inner * Math.cos(angle),
      y1: 51 + inner * Math.sin(angle),
      x2: cx + outer * Math.cos(angle),
      y2: 51 + outer * Math.sin(angle),
    };
  });
}

function buildWheelSpokes(cx: number): WheelDetailLine[] {
  return [0, 45, 90, 135].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x1: cx - 13 * Math.cos(rad),
      y1: 51 - 13 * Math.sin(rad),
      x2: cx + 13 * Math.cos(rad),
      y2: 51 + 13 * Math.sin(rad),
    };
  });
}

const FRONT_WHEEL_CX = 32;
const REAR_WHEEL_CX = 98;
const KNOB_TICKS = [...buildKnobTicks(FRONT_WHEEL_CX), ...buildKnobTicks(REAR_WHEEL_CX)];
const WHEEL_SPOKES = [...buildWheelSpokes(FRONT_WHEEL_CX), ...buildWheelSpokes(REAR_WHEEL_CX)];

/**
 * Decorative side-profile motorcycle + rider, line-art, that randomly crosses
 * the screen (DS `components/motion/MotorcycleRider`). `mode="ridge"` adds an
 * up/down bob as if following a skyline; `mode="ground"` runs flat. Timing
 * (initial delay, crossing duration, gap between passes, direction) is
 * randomized per pass via signals + scheduled timers — no RxJS.
 */
@Component({
  selector: 'app-decor-motorcycle-rider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './motorcycle-rider.html',
  styleUrl: './motorcycle-rider.scss',
})
export class DecorMotorcycleRider {
  readonly mode = input<MotorcycleRiderMode>('ground');
  readonly color = input('var(--ink)');
  readonly accentColor = input('var(--accent)');
  readonly width = input(78);
  readonly bottom = input(0);
  readonly zIndex = input(3);

  private readonly track = viewChild<ElementRef<HTMLDivElement>>('track');
  private readonly trackWidth = signal(0);
  private readonly destroyRef = inject(DestroyRef);
  private nextRunKey = 0;
  private timer?: ReturnType<typeof setTimeout>;

  protected readonly run = signal<MotorcycleRun | null>(null);
  protected readonly knobTicks = KNOB_TICKS;
  protected readonly wheelSpokes = WHEEL_SPOKES;

  protected readonly overlayHeight = computed(() => this.width() * (74 / 130) + 16);
  protected readonly svgHeight = computed(() => this.width() * (74 / 130));

  // Travel distance is the CONTAINER width, not the bike's own width — measured
  // on render so a pass always crosses the full illustration.
  protected readonly crossing = computed(() => {
    const current = this.run();
    if (!current) return null;
    const off = -(this.width() + 40);
    const on = (this.trackWidth() || 360) + 40;
    const [from, to] = current.dir === 1 ? [off, on] : [on, off];
    return {
      durationSeconds: current.durationSeconds,
      from,
      to,
      dir: current.dir,
      transformOrigin: current.dir === 1 ? '20% 78%' : '80% 78%',
      flip: current.dir !== 1,
    };
  });

  constructor() {
    afterNextRender(() => {
      const measure = (): void => this.trackWidth.set(this.track()?.nativeElement.offsetWidth ?? 0);
      measure();
      window.addEventListener('resize', measure);
      this.destroyRef.onDestroy(() => window.removeEventListener('resize', measure));
    });

    this.scheduleNextRun(randomBetween(1200, 3500));
    this.destroyRef.onDestroy(() => clearTimeout(this.timer));
  }

  protected onCrossingEnd(): void {
    this.run.set(null);
    this.scheduleNextRun(randomBetween(4500, 11000));
  }

  private scheduleNextRun(delayMs: number): void {
    this.timer = setTimeout(() => {
      this.run.set({
        key: ++this.nextRunKey,
        dir: Math.random() < 0.5 ? 1 : -1,
        durationSeconds: randomBetween(4.2, 6.8),
      });
    }, delayMs);
  }
}
