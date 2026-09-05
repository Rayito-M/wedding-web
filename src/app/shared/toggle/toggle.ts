import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Toggle row (DS core/Toggle) — full-width labeled row with a switch.
 *  Label is projected content: `<button app-toggle [checked]="…" (toggled)="…">Label</button>`. */
@Component({
  selector: 'button[app-toggle]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toggle.html',
  styleUrl: './toggle.scss',
  host: {
    '(click)': 'onClick()',
    '[attr.role]': "'switch'",
    '[attr.aria-checked]': 'checked()',
    '[disabled]': 'disabled()',
  },
})
export class Toggle {
  readonly checked = input(false);
  /** DS Toggle.disabled — dimmed (0.45) and inert (disabled recipe). */
  readonly disabled = input(false);
  readonly toggled = output<boolean>();

  protected onClick() {
    if (!this.disabled()) this.toggled.emit(!this.checked());
  }
}
