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

/** Stylised Alhambra + Sierra Nevada skyline. Line-art only. */
@Component({
  selector: 'app-decor-alhambra',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="w()"
      [attr.height]="h()"
      viewBox="0 0 400 136"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
    >
      <!-- Sierra Nevada — soft layered fills in back, grounded to the baseline -->
      <path
        d="M 0 56 L 30 38 L 60 50 L 95 30 L 130 46 L 165 34 L 200 50 L 240 32 L 280 48 L 320 38 L 360 50 L 400 42 L 400 128 L 0 128 Z"
        [style.fill]="mountain()"
        opacity="0.12"
      />
      <path
        d="M 0 72 L 50 60 L 100 70 L 150 58 L 200 68 L 250 58 L 300 70 L 350 62 L 400 68 L 400 128 L 0 128 Z"
        [style.fill]="mountain()"
        opacity="0.20"
      />

      <g
        fill="none"
        [style.stroke]="color()"
        [attr.stroke-width]="strokeWidth()"
        stroke-linejoin="round"
        stroke-linecap="round"
      >
        <!-- Ground line -->
        <line x1="8" y1="128" x2="392" y2="128" opacity="0.45" />

        <!-- Alcazaba — left wall with crenellated top -->
        <path [attr.d]="alcazaba" />

        <!-- Torre de la Vela — taller tower on the left -->
        <path [attr.d]="vela" />
        <!-- Flag pole -->
        <line x1="43" y1="56" x2="43" y2="44" />

        <!-- Small arched windows on Vela -->
        <path d="M 34 84 L 34 78 A 3 3 0 0 1 40 78 L 40 84" />
        <path d="M 46 84 L 46 78 A 3 3 0 0 1 52 78 L 52 84" />

        <!-- Palacio de Comares — central larger tower -->
        <path [attr.d]="comares" />
        <!-- roof base line -->
        <line x1="164" y1="64" x2="252" y2="64" />

        <!-- Palacio de los Córdova — right block with pitched roof -->
        <path d="M 278 128 L 278 96 L 308 78 L 338 96 L 338 128" />
        <!-- eave line -->
        <line x1="296" y1="84" x2="320" y2="84" opacity="0.55" />
        <!-- twin windows -->
        <rect x="290" y="104" width="8" height="16" rx="1" />
        <rect x="318" y="104" width="8" height="16" rx="1" />

        <!-- Generalife cypresses -->
        @for (c of cypresses; track $index) {
          <path [attr.d]="c.crown" />
          <line [attr.x1]="c.trunk.x" [attr.y1]="c.trunk.y1" [attr.x2]="c.trunk.x" y2="128" />
        }

        <!-- Horseshoe arch + twin sub-arches on Comares -->
        <path d="M 198 116 L 198 90 A 10 10 0 0 1 218 90 L 218 116" />
        <path d="M 180 124 L 180 118 A 3 3 0 0 1 186 118 L 186 124" />
        <path d="M 230 124 L 230 118 A 3 3 0 0 1 236 118 L 236 124" />
      </g>

      <!-- tiny sun-finial dot atop the Vela flagpole -->
      <circle cx="43" cy="42" r="1.6" [style.fill]="accent()" />
    </svg>
  `,
  styles: `:host { display: inline-flex; line-height: 0; max-width: 100%; } svg { max-width: 100%; height: auto; }`,
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
