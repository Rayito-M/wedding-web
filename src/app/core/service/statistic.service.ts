import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { EntityCollectionService, EntityServices } from '@ngrx/data';

import type { UserProfileDto, RsvpDto } from '../api';
import { EntityNamesEnum } from '../data';

/** RSVP summary carried on a guest profile (`UserProfileDto.guestInfo.rsvp`). */
export type ProfileRsvp = NonNullable<UserProfileDto['guestInfo']>['rsvp'];

export interface HeadCount {
  adults: number;
  children: number;
}

export interface GuestStatistics {
  declined: number;
  /**
   * Everyone still owed a reply: rows sitting at `status: 'pending'` **plus**
   * the {@link RsvpCount.undefined} rows that have no RSVP record at all.
   */
  pending: number;
  /**
   * Every guest-list row: `attending + declined + pending`. Because `pending`
   * absorbs the not-answered rows, this still matches what the "All" filter
   * renders — which includes rows with no RSVP.
   */
  total: number;
  headCount: HeadCount;
}

/**
 * The profile id behind `adults.partner2`, when that seat is held by a guest
 * with their own account (`kind: 'guest'`) — a `kind: 'plus-one'` is a named
 * companion with no account and no id.
 *
 * The narrowing is on `id`, not on `kind`, because the generated union widens
 * `kind` to a plain `string` and so cannot discriminate the two variants.
 * `wedding-api` narrows the same shape the same way (`'id' in seated`).
 */
export function partner2GuestId(rsvp: RsvpDto): string | undefined {
  const partner2 = rsvp.adults.partner2;
  return partner2 && 'id' in partner2 ? partner2.id : undefined;
}

/**
 * Adult seats one RSVP takes at the reception. `partner1` always counts; the
 * second seat counts only when someone is coming in it — a `kind: 'guest'`
 * partner has to have said yes, a `kind: 'plus-one'` carries no `attending`
 * flag and always counts. Same rule the API applies when it collapses an RSVP
 * into `UserProfileDto.guestInfo.rsvp.adults`.
 */
export function adultHeadCount(rsvp: RsvpDto): number {
  let count = rsvp.adults.partner1.attending === true ? 1 : 0;
  if (rsvp.adults.partner2?.attending) {
    count++;
  }

  return count;
}

/**
 * Cross-screen guest/RSVP aggregates derived from the `UserProfile` entity
 * collection — shared by the guest manager table header and the couple
 * dashboard so both read the same numbers from the same cache.
 *
 * The collection is the singleton @ngrx/data one, so injecting it here does not
 * duplicate state: screens that also need the raw list keep their own handle.
 */
@Injectable({ providedIn: 'root' })
export class StatisticService {
  private readonly userProfileCollection: EntityCollectionService<UserProfileDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE);

  private readonly rsvpCollection: EntityCollectionService<RsvpDto> = inject(
    EntityServices,
  ).getEntityCollectionService<RsvpDto>(EntityNamesEnum.RSVP);

  private readonly userProfileList: Signal<UserProfileDto[]> = toSignal(
    this.userProfileCollection.entities$,
    { initialValue: [] },
  );

  private readonly rsvpList: Signal<RsvpDto[]> = toSignal(this.rsvpCollection.entities$, {
    initialValue: [],
  });

  private loadRequested = false;

  /**
   * The `getAll` in {@link load} came back empty-handed. Nothing more is
   * coming, so the wait has to end or the dashboard spins forever — it has no
   * error branch of its own.
   */
  private readonly readFailed = signal(false);

  /** Whether a full-collection read has completed. See {@link loading}. */
  private readonly profilesLoaded = toSignal(this.userProfileCollection.loaded$, {
    initialValue: false,
  });

  /**
   * No full read of the profile collection has completed, so every aggregate
   * below is a zero that means "not known yet", not "none". Screens that render
   * those numbers show `app-content-loading` instead of publishing them.
   *
   * Deliberately **not** {@link isFirstLoad}, and the difference is the whole
   * bug this replaced. That helper ends its wait as soon as the collection
   * holds any entity — right for rows, wrong here. `ScreenHeader.ngOnInit`
   * calls `getByKey(sub)` on this same singleton collection to draw the account
   * monogram, so on the couple dashboard exactly one profile lands first: their
   * own, `role: 'bride'` or `'groom'`. The collection is no longer empty, the
   * wait ends, and {@link guestStatistics} skips that row for not being a guest
   * — publishing a full set of zeros that the real counts replace a moment
   * later once `getAll` resolves.
   *
   * `loaded` is the one flag that cannot be raised by a partial fill:
   * `@ngrx/data` sets it only from `QUERY_ALL`/`QUERY_LOAD`, never from
   * `getByKey` or `getWithQuery`. An aggregate is only meaningful over a
   * complete collection, so a complete read is exactly what it must wait for.
   */
  readonly loading = computed(() => !this.profilesLoaded() && !this.readFailed());

  /**
   * A profile is a guest-list row only if it owns the RSVP it points to
   * (`rsvp.id === profile.id`) — a partner with their own account carries the
   * same shared `guestInfo.rsvp`, but not its id, so this keeps couples to a
   * single row instead of one per account holder.
   */
  ownRsvp(profile: UserProfileDto): ProfileRsvp | undefined {
    const rsvp = profile.guestInfo?.rsvp;
    return rsvp && rsvp.id === profile.id ? rsvp : undefined;
  }

  /**
   * Guest-list counts. Rows are guest profiles joined to the RSVP collection —
   * `UserProfileDto.guestInfo.rsvp` carries only a collapsed summary, while the
   * head count needs the real party (who holds the second adult seat, and how
   * many children are named). Bride/groom/provider profiles are not guest-list
   * rows and are excluded.
   */
  readonly guestStatistics = computed<GuestStatistics>(() => {
    const counts: GuestStatistics = {
      declined: 0,
      pending: 0,
      total: 0,
      headCount: { adults: 0, children: 0 },
    };

    const userProfiles = this.userProfileList();
    const rsvpList = this.rsvpList();
    /** RSVP ids already counted — see the couple check below. */

    const countedRsvpIds = new Set<string>();

    for (const profile of userProfiles) {
      if (profile.role !== 'guest') continue;

      counts.total++;

      const rsvp = rsvpList.find(
        (rvp) => rvp.id === profile.id || profile.id === partner2GuestId(rvp),
      );
      if (!rsvp) {
        // No RSVP record at all — the only way to land here now that a partner
        // matches their couple's record through `partner2GuestId`.
        counts.pending++;
        continue;
      }

      if (countedRsvpIds.has(rsvp.id)) continue;

      countedRsvpIds.add(rsvp.id);

      switch (rsvp.status) {
        case 'attending':
          counts.headCount.adults += adultHeadCount(rsvp);
          counts.headCount.children += rsvp.children?.length ?? 0;
          break;
        case 'declined':
          counts.declined++;
          break;
        case 'pending':
          counts.pending++;
          if (partner2GuestId(rsvp)) counts.pending++;
          break;
      }
    }
    return counts;
  });

  /**
   * Share of guest rows that answered attending or declined, 0–100. Pending and
   * not-answered rows count against the denominator — they are the ones still
   * owed a reply.
   */
  readonly repliedPercent = computed(() => {
    return this.guestStatistics().total === 0
      ? 0
      : Math.round(
          ((this.guestStatistics().headCount.adults + this.guestStatistics().declined) /
            this.guestStatistics().total) *
            100,
        );
  });

  /**
   * Fill the profile cache if it is empty. Safe to call from every screen that
   * reads these aggregates — only the first caller wires the subscription, and
   * `getAll` fires only while the collection reports itself unloaded.
   */
  load(): void {
    if (this.loadRequested) return;
    this.loadRequested = true;
    this.userProfileCollection.loaded$.subscribe((loaded) => {
      if (!loaded) {
        // Subscribed for the failure only — the entities reach the screen
        // through the collection, not through here.
        this.userProfileCollection.getAll().subscribe({
          error: () => this.readFailed.set(true),
        });
      }
    });
    this.rsvpCollection.loaded$.subscribe((loaded) => {
      if (!loaded) {
        // Subscribed for the failure only — the entities reach the screen
        // through the collection, not through here.
        this.rsvpCollection.getAll().subscribe({
          error: () => this.readFailed.set(true),
        });
      }
    });
  }
}
