import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Selectable choice card (DS core/ChoiceCard) — serif label, accent fill when
 *  selected: `<button app-choice-card [selected]="…" (click)="…">Yes</button>`. */
@Component({
  selector: 'button[app-choice-card]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './choice-card.html',
  styleUrl: './choice-card.scss',
  host: {
    '[class.on]': 'selected()',
    '[attr.aria-pressed]': 'selected()',
  },
})
export class ChoiceCard {
  readonly selected = input(false);
}
