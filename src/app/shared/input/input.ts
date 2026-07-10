import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Text input (DS core/Input) — serif entry field. Attribute component:
 *  `<input app-input type="text" formControlName="…" />`. */
@Component({
  selector: 'input[app-input]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './input.html',
  styleUrl: './input.scss',
})
export class TextInput {}
