import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { PluralTranslatePipe, RsvpDto, RsvpListResponseDtoItemsInner, partyLabel } from '@app/core';

/** Either shape works: the caller's own `RsvpDto` and a delegated
 *  `RsvpListResponseDtoItemsInner` share every field this component reads
 *  (`status`/`adults`/`children`) — see `wedding-rsvp.service.ts`'s models,
 *  `RsvpListResponseDtoItemsInnerAdults` imports the exact same
 *  `RsvpDtoAdultsPartner1`/`RsvpDtoAdultsPartner2` the plain `RsvpDto` does.
 *  `delegatedTo` (present only on the list shape) is never read here. */
type HubRsvp = RsvpDto | RsvpListResponseDtoItemsInner;

/** One rendered card — own reply or a delegation, the two differ only in
 *  `mine`/`key`/copy, never in how the state/party/seats are derived. */
interface HubCard {
  readonly key: string;
  readonly title: string;
  readonly rsvp: HubRsvp;
  readonly mine: boolean;
}

/**
 * The delegate's RSVP hub (hub ADR-0039 §6, T337): own reply first, then one
 * card per subject the signed-in guest is a delegate for. Purely
 * presentational — `Rsvp` (the orchestrator) owns the data and the "which
 * screen is showing" state; this component only renders the list and emits
 * which card was opened.
 *
 * **No relation line, on any card** (hard rule 18(c)) — `HubCard` carries no
 * `kind`/`relation` field at all, structurally: the kind is stored
 * subject-side and is not renderable from the delegate's side in any of the
 * three shipped locales (ADR-0039 §6). Only the subject's party label, the
 * reply's state, and (once answered) the party size.
 */
@Component({
  selector: 'app-rsvp-hub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, PluralTranslatePipe],
  templateUrl: './rsvp-hub.html',
  styleUrl: './rsvp-hub.scss',
})
export class RsvpHub {
  /** `undefined` while the guest's own RSVP has not loaded yet — the card
   *  still renders (DS parity: "Your own reply" is always first), just with
   *  nothing to derive a state/seat count from. */
  readonly myReply = input<RsvpDto | undefined>(undefined);
  readonly delegations = input<RsvpListResponseDtoItemsInner[]>([]);

  /** `'me'` for the own-reply card, otherwise the subject's RSVP id
   *  (identical to their user id, ADR-0022). */
  readonly open = output<string>();

  protected readonly delegateCards = computed<HubCard[]>(() =>
    this.delegations().map((rsvp) => ({
      key: rsvp.id,
      title: partyLabel(rsvp),
      rsvp,
      mine: false,
    })),
  );

  /** Still `pending` — the header's outstanding count (T337 acceptance).
   *  Own reply counts too: it is still a reply the guest looks after. */
  protected readonly outstandingCount = computed(() => {
    const mine = this.myReply();
    const minePending = mine ? Number(mine.status === RsvpDto.StatusEnum.PENDING) : 0;
    return (
      minePending +
      this.delegations().filter((d) => d.status === RsvpDto.StatusEnum.PENDING).length
    );
  });

  protected stateKey(rsvp: HubRsvp | undefined): string {
    return `rsvp.hub.state.${rsvp?.status ?? 'pending'}`;
  }

  /** `attending` (accent) / `declined` (muted) / `pending` (provisional) —
   *  DS `ScreenRSVPHub.jsx`'s per-state label color, ported to a class. */
  protected stateClass(rsvp: HubRsvp | undefined): string {
    return rsvp?.status ?? 'pending';
  }

  protected seatCount(rsvp: HubRsvp): number {
    return (rsvp.adults.partner2 ? 2 : 1) + (rsvp.children?.length ?? 0);
  }

  protected isPending(rsvp: HubRsvp | undefined): boolean {
    return !rsvp || rsvp.status === RsvpDto.StatusEnum.PENDING;
  }

  protected onOpen(key: string): void {
    this.open.emit(key);
  }
}
