import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  type Signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { firstValueFrom, map } from 'rxjs';
import { EntityCollectionService, EntityServices } from '@ngrx/data';

import { EntityNamesEnum, LoginService, RsvpDto, WeddingRsvpService } from '@app/core';
import { AppLoadingComponent } from '@app/shared/loading/loading';

import { RsvpCreate } from '../rsvp-create/rsvp-create';
import { RsvpEdit } from '../rsvp-edit/rsvp-edit';

/** `adults.partner2`'s account id, when it has one — the union's second
 *  member (`…OneOf1`) carries no `id` at all, so it is only readable behind
 *  an `in` check (ADR W-0004 §Decision.1, §Consequences). */
function partner2Id(rsvp: RsvpDto): string | undefined {
  const partner2 = rsvp.adults.partner2;
  return partner2 && 'id' in partner2 ? partner2.id : undefined;
}

/**
 * Thin orchestrator (ad hoc rebuild, see design system `ScreenRSVPCreate.jsx`
 * / `ScreenRSVPEdit.jsx`, commit 9e44df2): on init, reads the guest's `RsvpDto`
 * directly from the API (a 204 "no RSVP yet" needs a definite answer before
 * deciding whether to provision one — not a racy cache read) and, if none
 * exists, immediately asks the API to create the minimal `pending` record
 * (server fills `adults.partner1` and, if the guest already has a linked
 * partner account, `adults.partner2`). From then on the guest always has a
 * real, patchable record: `pending` stays on the first-time reply flow
 * (`app-rsvp-create`, which now only ever PATCHes — the record already
 * exists); `attending`/`declined` go to the standing record editor
 * (`app-rsvp-edit`). No route, no step state, no form of its own lives here.
 */
@Component({
  selector: 'app-rsvp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RsvpCreate, RsvpEdit, AppLoadingComponent],
  templateUrl: './rsvp.html',
  styleUrl: './rsvp.scss',
})
export class Rsvp implements OnInit {
  private readonly login = inject(LoginService);
  private readonly rsvpApi = inject(WeddingRsvpService);

  private readonly rsvpCollection: EntityCollectionService<RsvpDto> = inject(
    EntityServices,
  ).getEntityCollectionService<RsvpDto>(EntityNamesEnum.RSVP);

  /** Gates the initial render until the existence check (and, if needed, the
   *  auto-provision create call) below has resolved. */
  protected readonly loaded = signal(false);

  // Read pattern copied verbatim from `invitee.ts`: derive the current
  // guest's RSVP from the cached collection, so subsequent PATCHes made by
  // `app-rsvp-create` / `app-rsvp-edit` (which go through this same
  // collection) are reflected here reactively.
  protected readonly rsvp: Signal<RsvpDto | undefined> = toSignal(
    this.rsvpCollection.entities$.pipe(
      map((rsvps) => {
        const currentUser = this.login.currentUserClaims();
        const found = rsvps.find(
          (r) => r.id === currentUser?.sub || partner2Id(r) === currentUser?.sub,
        );
        return found;
      }),
    ),
    { initialValue: undefined },
  );

  protected readonly isDecided = computed(() => {
    const status = this.rsvp()?.status;
    return status === RsvpDto.StatusEnum.ATTENDING || status === RsvpDto.StatusEnum.DECLINED;
  });

  async ngOnInit(): Promise<void> {
    const currentUser = this.login.currentUserClaims();
    if (!currentUser) {
      this.loaded.set(true);
      return;
    }

    let rsvp = await firstValueFrom(this.rsvpApi.rsvpControllerGetV1({ id: currentUser.sub }));
    if (!rsvp) {
      try {
        rsvp = await firstValueFrom(
          this.rsvpApi.rsvpControllerCreateV1({ id: currentUser.sub }),
        );
      } catch {
        // Lost a create race (e.g. two tabs open at once) — it exists now, re-read it.
        rsvp = await firstValueFrom(this.rsvpApi.rsvpControllerGetV1({ id: currentUser.sub }));
      }
    }
    if (rsvp) {
      this.rsvpCollection.addOneToCache(rsvp);
    }
    this.loaded.set(true);
  }
}
