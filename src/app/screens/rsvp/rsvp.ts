import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
  type Signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { firstValueFrom, map } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { EntityCollectionService, EntityServices } from '@ngrx/data';

import { EntityNamesEnum, LoginService, RsvpDto, WeddingRsvpService, partyLabel } from '@app/core';
import { AppLoadingComponent } from '@app/shared/loading/loading';

import { DelegateEdit } from './delegate-edit/delegate-edit';
import { RsvpHub } from './rsvp-hub/rsvp-hub';
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
  imports: [RsvpCreate, RsvpEdit, RsvpHub, DelegateEdit, AppLoadingComponent],
  templateUrl: './rsvp.html',
  styleUrl: './rsvp.scss',
})
export class Rsvp implements OnInit {
  private readonly login = inject(LoginService);
  private readonly rsvpApi = inject(WeddingRsvpService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly rsvpCollection: EntityCollectionService<RsvpDto> = inject(
    EntityServices,
  ).getEntityCollectionService<RsvpDto>(EntityNamesEnum.RSVP);

  /** Gates the initial render until the existence check (and, if needed, the
   *  auto-provision create call) below has resolved. */
  protected readonly loaded = signal(false);

  /**
   * The subject ids `GET /v1/rsvp` returned (hub ADR-0039 §3/§6, T337) —
   * that endpoint already returns, for a non-couple caller (this route is
   * `roles: ['guest']`, hard-gated), exactly the RSVPs the signed-in guest
   * is a delegate for, and no other endpoint is needed. Membership only
   * ever changes on a fresh load of this screen (a grant/revoke is the
   * couple's, elsewhere); the RSVPs themselves stay reactive by being read
   * back out of `rsvpCollection` (`delegatedRsvps` below) rather than kept
   * as a static snapshot, so a save `app-delegate-edit` makes — through that
   * same collection — is reflected on the hub the moment the guest goes
   * back to it. No pagination wired: the API returns everything in one
   * response when no `limit` is passed, and a guest with more delegations
   * than one page returns is not a case this task's acceptance covers.
   */
  private readonly delegateIds: Signal<Set<string>> = computed(() => {
    return new Set(this.delegatedRsvps().map((r) => r.id));
  });

  // Read pattern copied verbatim from `invitee.ts`: derive the current
  // guest's RSVP (and, below, every delegated one) from the cached
  // collection, so subsequent PATCHes made by `app-rsvp-create` /
  // `app-rsvp-edit` / `app-delegate-edit` (which all go through this same
  // collection) are reflected here reactively.
  private readonly rsvps: Signal<RsvpDto[]> = toSignal(this.rsvpCollection.entities$, {
    initialValue: [],
  });

  protected readonly rsvp: Signal<RsvpDto | undefined> = computed(() => {
    const currentUser = this.login.currentUserClaims();
    return this.rsvps().find(
      (r) => r.id === currentUser?.sub || partner2Id(r) === currentUser?.sub,
    );
  });

  protected readonly delegatedRsvps: Signal<RsvpDto[]> = computed<RsvpDto[]>(() => {
    const currentUser = this.login.currentUserClaims();
    return this.rsvps().filter(
      (r) => r.id !== currentUser?.sub && partner2Id(r) !== currentUser?.sub,
    );
  });

  /**
   * With **zero** delegations this screen is byte-for-byte what it was
   * before T337 (this task's own acceptance, asserted in `rsvp.spec.ts`) —
   * every hub-only signal below is only ever read from the template inside
   * an `@if (hasDelegations())` branch.
   */
  protected readonly hasDelegations = computed(() => this.delegateIds().size > 0);

  /**
   * Which card the guest has open, held in the URL (`?open=me|<rsvp id>`)
   * rather than in a component signal: the hub is a screen the guest can
   * leave, so leaving it has to be what the device's own back gesture /
   * browser back button does. A plain signal is invisible to history — back
   * would have taken them off the RSVP page entirely, past the hub. The
   * param is also what makes an opened card survive a refresh.
   *
   * Absent — the hub itself. `'me'` — the guest's own reply. Anything else —
   * that subject's `app-delegate-edit`.
   */
  private readonly openParam: Signal<string | null> = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('open'))),
    { initialValue: null },
  );

  /** `true` — the hub itself; `false` — either the guest's own reply or a
   *  delegate's detail is showing (`activeDelegateId` tells which). Only
   *  meaningful while `hasDelegations()` is true. */
  protected readonly hubMode = computed(() => !this.openParam());

  /** `null` while on the hub or the guest's own reply; a subject's RSVP id
   *  while `app-delegate-edit` is showing. */
  protected readonly activeDelegateId = computed<string | null>(() => {
    const open = this.openParam();
    return open && open !== 'me' ? open : null;
  });

  protected readonly activeDelegateRsvp = computed<RsvpDto | undefined>(() => {
    const id = this.activeDelegateId();
    if (!id) return undefined;
    return this.delegatedRsvps().find((r) => r.id === id);
  });

  /** The subject's party label (hub ADR-0039 §7), headed on the
   *  `app-delegate-edit` screen — the same helper the hub card itself
   *  reads (`partyLabel`, `core/helper/rsvp-draft.ts`), so the two can never
   *  show a different name for the same subject. */
  protected readonly activeDelegateName = computed(() => {
    const rsvp = this.activeDelegateRsvp();
    return rsvp ? partyLabel(rsvp) : '';
  });

  protected readonly isDecided = computed(() => {
    const status = this.rsvp()?.status;
    return status === RsvpDto.StatusEnum.ATTENDING || status === RsvpDto.StatusEnum.DECLINED;
  });

  /** Latched while the first-time reply flow owns the screen. `app-rsvp-create`
   *  now sends the reply *before* it shows its confirmation receipt, so the
   *  record is already `attending`/`declined` while that receipt is on
   *  screen — without this latch the editor would swap in underneath the
   *  guest the instant they replied, and they would never see it. Released
   *  when the create screen says it is done (`submitted`). */
  private readonly replying = signal(false);

  protected readonly showCreate = computed(
    () => !!this.rsvp() && (!this.isDecided() || this.replying()),
  );

  constructor() {
    // A `pending` record can only become decided through the create screen's
    // own PATCH, so latching here (rather than on mount) is enough to keep it
    // mounted across that transition.
    effect(() => {
      if (this.rsvp()?.status === RsvpDto.StatusEnum.PENDING) this.replying.set(true);
    });
  }

  /** The guest has left the confirmation receipt — hand them the standing
   *  record editor (meals, allergies, note). */
  protected onReplyFlowDone(): void {
    this.replying.set(false);
  }

  /** The hub's `(open)` — `'me'` for the own-reply card, otherwise a
   *  subject's RSVP id (ADR-0039 §9: the subject is always a Guest record,
   *  keyed by its own user id, same as the RSVP's own `id`). */
  protected onHubOpen(key: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { open: key },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * The `(back)` of both hub destinations — `app-delegate-edit` and, when
   * mounted from the hub, `app-rsvp-edit` (`showBack`). Navigates rather
   * than calling `location.back()`: the guest may have arrived on an opened
   * card directly (a refresh, a pasted link), where there is no hub entry
   * behind them to pop. Each screen renders its own back link inside its
   * scrolling `.content`, not as a sibling of it, so neither host's
   * percentage `height` sees a changed content box.
   */
  protected backToHub(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { open: null },
      queryParamsHandling: 'merge',
    });
  }

  async ngOnInit(): Promise<void> {
    const currentUser = this.login.currentUserClaims();
    if (!currentUser) {
      this.loaded.set(true);
      return;
    }
    try {
      // The delegate mirror list (hub ADR-0039 §3/§6, T337): `GET /v1/rsvp`
      // hands a guest caller exactly the RSVPs they are a delegate for, never
      // their own. Fired alongside the own-record read below and never
      // awaited with it — a guest holding zero delegations must reach their
      // own reply exactly as fast as before this task.
      this.rsvpCollection.getAll();

      // The own record, awaited: "no RSVP yet" needs a definite answer before
      // deciding whether to provision one (not a racy cache read). Without
      // the provision below a first-time guest reaches no screen at all —
      // `app-rsvp-create` only ever PATCHes an existing record — and that is
      // true whether or not they hold delegations.
      let mine: RsvpDto | undefined;
      try {
        mine = await firstValueFrom(this.rsvpCollection.getByKey(currentUser.sub));
      } catch {
        mine = undefined;
      }
      if (!mine) {
        try {
          this.rsvpCollection.addOneToCache(
            await firstValueFrom(this.rsvpApi.rsvpControllerCreateV1({ guestId: currentUser.sub })),
          );
        } catch {
          // Lost a create race (e.g. two tabs open at once) — it exists now,
          // re-read it.
          this.rsvpCollection.addOneToCache(
            await firstValueFrom(this.rsvpApi.rsvpControllerGetV1({ guestId: currentUser.sub })),
          );
        }
      }
    } finally {
      this.loaded.set(true);
    }
  }
}
