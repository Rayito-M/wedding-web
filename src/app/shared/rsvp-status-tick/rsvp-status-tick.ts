import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RsvpDto } from '@app/core';

/** Small status badge: check (attending), cross (declined), or a clock (pending/unset). */
@Component({
  selector: 'app-rsvp-status-tick',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rsvp-status-tick.html',
  styleUrl: './rsvp-status-tick.scss',
  host: {
    class: 'tick',
    '[class]': "'status-' + (status() ?? 'pending')",
  },
})
export class RsvpStatusTick {
  readonly status = input<RsvpDto.StatusEnum | undefined>(undefined);
}
