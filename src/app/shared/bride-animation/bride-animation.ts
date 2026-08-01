import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';

interface BrideRun {
  key: number;
  durationSeconds: number;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function ensureKeyframes(): void {
  if (typeof document === 'undefined' || document.getElementById('bride-tower-kf')) return;
  const el = document.createElement('style');
  el.id = 'bride-tower-kf';
  el.textContent = `
@keyframes btaSeq {
  0% { transform: translateX(-48px); }
  16% { transform: translateX(0); }
  82% { transform: translateX(0); }
  97%, 100% { transform: translateX(-50px); }
}
@keyframes btaBob {
  from { transform: translateY(0); } to { transform: translateY(-1.6px); }
}
@keyframes btaWave {
  0%, 18% { transform: rotate(56deg); }
  26% { transform: rotate(0deg); }
  34% { transform: rotate(-14deg); }
  42% { transform: rotate(14deg); }
  50% { transform: rotate(-14deg); }
  58% { transform: rotate(14deg); }
  66% { transform: rotate(0deg); }
  78%, 100% { transform: rotate(56deg); }
}
@keyframes btaBubble {
  0%, 27% { opacity: 0; transform: scale(0.6); }
  33% { opacity: 1; transform: scale(1); }
  70% { opacity: 1; transform: scale(1); }
  77%, 100% { opacity: 0; transform: scale(0.85); }
}`;
  document.head.appendChild(el);
}

/**
 * Bride animation from the Alhambra tower (DS `components/motion/BrideAtTower`).
 * The bride randomly steps out of the tower, waves with a "¡Hola!" bubble, then
 * steps back inside. Line-art only, themed via CSS vars.
 */
@Component({
  selector: 'app-bride-animation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bride-animation.html',
  styleUrl: './bride-animation.scss',
})
export class BrideAnimation {
  readonly color = input('var(--ink)');
  readonly accentColor = input('var(--accent-2)');
  readonly width = input(147);
  readonly greeting = input('¡Hola!');

  private readonly destroyRef = inject(DestroyRef);
  private nextRunKey = 0;
  private timer?: ReturnType<typeof setTimeout>;

  protected readonly run = signal<BrideRun | null>(null);

  protected readonly height = (): number => this.width() * (90 / 147);

  protected readonly clipId = (): string => `btaclip-${Math.random().toString(36).substring(7)}`;

  constructor() {
    // Inject keyframes on component creation
    ensureKeyframes();

    // Initialize the animation loop
    this.scheduleNextRun(randomBetween(900, 2800));

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
  }

  protected onAnimationEnd(): void {
    this.run.set(null);
    this.scheduleNextRun(randomBetween(4000, 10000));
  }

  private scheduleNextRun(delayMs: number): void {
    this.timer = setTimeout(() => {
      this.run.set({
        key: ++this.nextRunKey,
        durationSeconds: randomBetween(6.2, 8),
      });
    }, delayMs);
  }
}
