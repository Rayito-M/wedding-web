import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-decor-blob',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 120 120" aria-hidden="true">
      <path
        d="M60 8c18 0 38 10 44 28 6 18-6 36-18 48s-30 22-46 16S12 76 10 58 24 22 36 14 48 8 60 8z"
        [style.fill]="color()"
        opacity="0.85"
      />
    </svg>
  `,
  styles: `:host { display: inline-flex; line-height: 0; }`,
})
export class DecorBlob {
  readonly color = input('var(--accent-2)');
  readonly size = input(120);
}
