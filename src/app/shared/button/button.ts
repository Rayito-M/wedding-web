import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Pill button. Primary = accent bg / white text; ghost = hairline border. */
@Component({
  selector: 'button[app-btn]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  styles: `
    :host {
      appearance: none;
      border: none;
      background: var(--accent);
      color: var(--surface);
      padding: 12px 18px;
      border-radius: 999px;
      font-family: 'DM Sans', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.02em;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    :host(:hover) {
      opacity: 0.85;
    }
    :host(.ghost) {
      border: 1px solid var(--line);
      background: transparent;
      color: var(--ink);
    }
    :host(.full) {
      width: 100%;
    }
  `,
  host: {
    '[class.ghost]': '!primary()',
    '[class.full]': 'full()',
  },
})
export class Btn {
  readonly primary = input(true);
  readonly full = input(false);
}
