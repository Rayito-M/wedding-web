import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PhotoPlaceholder } from '../photo-placeholder/photo-placeholder';

/** Accommodation row (DS data-display/StayCard) — chip thumb, serif name,
 *  accent price/tag, muted meta line. */
@Component({
  selector: 'app-stay-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhotoPlaceholder],
  templateUrl: './stay-card.html',
  styleUrl: './stay-card.scss',
})
export class StayCard {
  readonly name = input.required<string>();
  readonly meta = input('');
  readonly tag = input('');
  readonly price = input('');
  readonly thumbLabel = input('');
}
