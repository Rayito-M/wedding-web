import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-decor-curve',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="w()" [attr.height]="h()" viewBox="0 0 160 60" aria-hidden="true">
      <path
        d="M2 40 C 40 8, 80 8, 120 30 S 158 52, 158 52"
        fill="none"
        [style.stroke]="color()"
        stroke-width="1.2"
        stroke-linecap="round"
      />
    </svg>
  `,
  styles: `:host { display: inline-flex; line-height: 0; }`,
})
export class DecorCurve {
  readonly color = input('var(--accent)');
  readonly w = input(160);
  readonly h = input(60);
}
