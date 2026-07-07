import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const LEAVES = [20, 36, 52, 68, 80].map((y, i) => {
  const side = i % 2 === 0 ? -1 : 1;
  const cx = 30 + side * 9;
  return { cx, cy: y, transform: `rotate(${side * 25} ${cx} ${y})` };
});

@Component({
  selector: 'app-decor-sprig',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="h()" viewBox="0 0 60 96" aria-hidden="true">
      <path d="M30 96 L30 8" [style.stroke]="color()" stroke-width="1.4" stroke-linecap="round" />
      @for (l of leaves; track $index) {
        <ellipse
          [attr.cx]="l.cx"
          [attr.cy]="l.cy"
          rx="9"
          ry="4"
          [style.fill]="color()"
          [attr.transform]="l.transform"
          opacity="0.85"
        />
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; line-height: 0; }`,
})
export class DecorSprig {
  readonly color = input('var(--accent-3)');
  readonly size = input(60);
  protected readonly h = computed(() => this.size() * 1.6);
  protected readonly leaves = LEAVES;
}
