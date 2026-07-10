import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Pill button (DS core/Button). Primary = accent bg / on-accent text;
 *  ghost = hairline border. Native `disabled` gets the DS disabled treatment. */
@Component({
  selector: 'button[app-btn]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './button.html',
  styleUrl: './button.scss',
  host: {
    '[class.ghost]': '!primary()',
    '[class.full]': 'full()',
  },
})
export class Btn {
  readonly primary = input(true);
  readonly full = input(false);
}
