import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Toggle row (DS core/Toggle) — full-width labeled row with a switch.
 *  Label is projected content: `<button app-toggle [checked]="…" (toggled)="…">Label</button>`. */
@Component({
  selector: 'button[app-toggle]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toggle.html',
  styleUrl: './toggle.scss',
  host: {
    '(click)': 'toggled.emit(!checked())',
    '[attr.role]': "'switch'",
    '[attr.aria-checked]': 'checked()',
  },
})
export class Toggle {
  readonly checked = input(false);
  readonly toggled = output<boolean>();
}
