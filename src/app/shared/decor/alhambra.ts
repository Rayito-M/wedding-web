import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// Mid-path L commands for a crenellated top edge from x1 to x2 at baseY.
// Teeth point upward.
function crenelate(x1: number, x2: number, baseY: number, teethH = 5, teethW = 5, gapW = 5): string {
  const span = x2 - x1;
  const unit = teethW + gapW;
  const n = Math.max(2, Math.round(span / unit));
  const u = span / n;
  const tFrac = teethW / (teethW + gapW);
  let d = '';
  for (let i = 0; i < n; i++) {
    const xa = x1 + i * u;
    const xb = xa + u * tFrac;
    const xc = xa + u;
    d += ` L ${xa} ${baseY - teethH} L ${xb} ${baseY - teethH} L ${xb} ${baseY} L ${xc} ${baseY}`;
  }
  return d;
}

const CYPRESSES = [352, 366, 380].map((x, i) => {
  const top = 78 + (i % 2) * 8;
  return {
    crown: `M ${x} ${top + 12} L ${x - 5} ${top + 12} Q ${x} ${top - 4}, ${x + 5} ${top + 12} Z`,
    trunk: { x, y1: top + 12 },
  };
});

/** Stylised Alhambra + Sierra Nevada skyline (DS illustrations/AlhambraIllustration). */
@Component({
  selector: 'app-decor-alhambra',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './alhambra.html',
  styleUrl: './alhambra.scss',
})
export class DecorAlhambra {
  readonly color = input('var(--accent)');
  readonly accent = input('var(--accent-2)');
  readonly mountain = input('var(--accent-3)');
  readonly w = input(400);
  readonly strokeWidth = input(1.5);

  protected readonly h = computed(() => this.w() * 0.34);
  protected readonly alcazaba = `M 14 128 L 14 100${crenelate(14, 138, 100, 5, 5, 5)} L 138 128`;
  protected readonly vela = `M 26 100 L 26 56${crenelate(26, 60, 56, 5, 4, 4)} L 60 100`;
  protected readonly comares = `M 168 128 L 168 64${crenelate(168, 248, 64, 6, 6, 6)} L 248 128`;
  protected readonly cypresses = CYPRESSES;
}
