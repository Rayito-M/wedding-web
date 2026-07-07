import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-decor-arch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="w()" [attr.height]="h()" viewBox="0 0 120 160" aria-hidden="true">
      <path
        d="M10 160 L10 60 A50 50 0 0 1 110 60 L110 160"
        [style.fill]="filled() ? color() : 'none'"
        [style.stroke]="color()"
        stroke-width="1.6"
      />
    </svg>
  `,
  styles: `:host { display: inline-flex; line-height: 0; }`,
})
export class DecorArch {
  readonly color = input('var(--accent)');
  readonly w = input(120);
  readonly h = input(160);
  readonly filled = input(false);
}
