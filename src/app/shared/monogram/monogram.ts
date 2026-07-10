import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** "S & C" monogram (DS core/Monogram) — serif, ampersand in accent. */
@Component({
  selector: 'app-monogram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './monogram.html',
  styleUrl: './monogram.scss',
  host: {
    '[style.font-size.px]': 'size()',
  },
})
export class Monogram {
  readonly size = input(24);
}
