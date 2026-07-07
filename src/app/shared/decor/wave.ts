import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-decor-wave',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="w()" [attr.height]="h()" viewBox="0 0 180 24" aria-hidden="true">
      <path
        d="M2 12 q 11 -10 22 0 t 22 0 t 22 0 t 22 0 t 22 0 t 22 0 t 22 0 t 22 0"
        fill="none"
        [style.stroke]="color()"
        stroke-width="1.6"
        stroke-linecap="round"
      />
    </svg>
  `,
  styles: `:host { display: inline-flex; line-height: 0; }`,
})
export class DecorWave {
  readonly color = input('var(--accent-3)');
  readonly w = input(180);
  readonly h = input(24);
}
