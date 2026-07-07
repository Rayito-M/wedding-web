import { ChangeDetectionStrategy, Component, input } from '@angular/core';

interface Ray {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const RAYS: Ray[] = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI * 2) / 12;
  return {
    x1: 40 + Math.cos(a) * 22,
    y1: 40 + Math.sin(a) * 22,
    x2: 40 + Math.cos(a) * 32,
    y2: 40 + Math.sin(a) * 32,
  };
});

@Component({
  selector: 'app-decor-sun',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 80 80" aria-hidden="true">
      <circle cx="40" cy="40" r="16" [style.fill]="color()" />
      @for (r of rays; track $index) {
        <line
          [attr.x1]="r.x1"
          [attr.y1]="r.y1"
          [attr.x2]="r.x2"
          [attr.y2]="r.y2"
          [style.stroke]="color()"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; line-height: 0; }`,
})
export class DecorSun {
  readonly color = input('var(--accent-2)');
  readonly size = input(80);
  protected readonly rays = RAYS;
}
