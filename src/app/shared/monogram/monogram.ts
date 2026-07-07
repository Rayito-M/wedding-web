import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** "S & C" monogram — serif, ampersand in accent. */
@Component({
  selector: 'app-monogram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `S <span class="amp">&</span> C`,
  styles: `
    :host {
      font-family: 'DM Serif Display', 'Cormorant Garamond', serif;
      font-weight: 400;
      line-height: 1;
      color: var(--ink);
    }
    .amp {
      color: var(--accent);
    }
  `,
  host: {
    '[style.font-size.px]': 'size()',
  },
})
export class Monogram {
  readonly size = input(24);
}
