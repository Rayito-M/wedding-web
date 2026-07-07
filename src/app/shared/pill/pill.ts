import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Small uppercase pill — soft (chip bg) or accent tone. */
@Component({
  selector: 'app-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  styles: `
    :host {
      display: inline-block;
      padding: 4px 10px;
      background: var(--chip);
      color: var(--ink);
      border-radius: 999px;
      font-size: 10px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-weight: 500;
    }
    :host(.accent) {
      background: var(--accent);
      color: var(--surface);
    }
  `,
  host: {
    '[class.accent]': "tone() === 'accent'",
  },
})
export class Pill {
  readonly tone = input<'soft' | 'accent'>('soft');
}
