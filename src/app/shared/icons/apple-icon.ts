import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Apple brand mark. Uses `currentColor` so it inherits the button's text
 *  colour (adapts to light/dark). Decorative — hidden from a11y tree. */
@Component({
  selector: 'app-apple-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M17.05 12.04c-.03-2.86 2.34-4.23 2.44-4.3-1.33-1.95-3.4-2.22-4.13-2.25-1.76-.18-3.43 1.03-4.32 1.03-.89 0-2.26-1-3.72-.98-1.91.03-3.68 1.11-4.66 2.82-1.99 3.45-.51 8.55 1.42 11.35.94 1.37 2.06 2.91 3.53 2.85 1.42-.06 1.95-.92 3.66-.92 1.71 0 2.19.92 3.69.89 1.52-.03 2.49-1.4 3.42-2.78 1.08-1.59 1.53-3.13 1.55-3.21-.03-.02-2.98-1.15-3.01-4.55zM14.25 3.6c.78-.95 1.31-2.27 1.16-3.6-1.13.05-2.49.75-3.3 1.7-.72.83-1.36 2.18-1.19 3.46 1.26.1 2.55-.64 3.33-1.56z"
      />
    </svg>
  `,
})
export class AppleIcon {
  readonly size = input(18);
}
