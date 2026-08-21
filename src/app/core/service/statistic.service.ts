import { Injectable, computed, inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { EntityCollectionService, EntityServices } from '@ngrx/data';

import type { UserProfileDto } from '../api';
import { EntityNamesEnum } from '../data';

/** RSVP summary carried on a guest profile (`UserProfileDto.guestInfo.rsvp`). */
export type ProfileRsvp = NonNullable<UserProfileDto['guestInfo']>['rsvp'];

export interface RsvpCount {
  attending: number;
  declined: number;
  /**
   * Everyone still owed a reply: rows sitting at `status: 'pending'` **plus**
   * the {@link RsvpCount.undefined} rows that have no RSVP record at all.
   */
  pending: number;
  /** Guest rows with no RSVP record at all — "Not Answered". A subset of {@link RsvpCount.pending}. */
  undefined: number;
  /**
   * Every guest-list row: `attending + declined + pending`. Because `pending`
   * absorbs the not-answered rows, this still matches what the "All" filter
   * renders — which includes rows with no RSVP.
   */
  total: number;
}

export interface HeadCount {
  adults: number;
  children: number;
}

export interface GuestStatistics {
  rsvp: RsvpCount;
  headCount: HeadCount;
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

  private readonly userProfileList: Signal<UserProfileDto[]> = toSignal(
    this.userProfileCollection.entities$,
    { initialValue: [] },
  );

  private loadRequested = false;

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
   * Guest-list counts. Rows are guest profiles, not RSVPs:
   * `UserProfileDto.guestInfo.rsvp` already carries the status/adults/children
   * summary, so there is no separate RSVP collection to join. Bride/groom/
   * provider profiles are not guest-list rows and are excluded.
   */
  readonly guestStatistics = computed<GuestStatistics>(() => {
    const counts: GuestStatistics = {
      rsvp: { attending: 0, declined: 0, pending: 0, undefined: 0, total: 0 },
      headCount: { adults: 0, children: 0 },
    };

    for (const profile of this.userProfileList()) {
      if (profile.role !== 'guest') continue;

      const rsvp = this.ownRsvp(profile);
      if (!rsvp) {
        // Either no RSVP at all, or a partner row whose RSVP another profile
        // owns — the latter is already counted on the owning row.
        if (!profile.guestInfo?.rsvp) counts.rsvp.undefined++;
        continue;
      }

      switch (rsvp.status) {
        case 'attending':
          counts.rsvp.attending++;
          counts.headCount.adults += rsvp.adults;
          counts.headCount.children += rsvp.children ?? 0;
          break;
        case 'declined':
          counts.rsvp.declined++;
          break;
        case 'pending':
          counts.rsvp.pending++;
          break;
      }
    }

    // Not-answered rows are folded into "pending" — both are guests who still
    // owe a reply — while `undefined` stays available on its own for the
    // dedicated "Not Answered" tile and filter badge.
    counts.rsvp.pending += counts.rsvp.undefined;
    counts.rsvp.total = counts.rsvp.attending + counts.rsvp.declined + counts.rsvp.pending;
    return counts;
  });

  /**
   * Share of guest rows that answered attending or declined, 0–100. Pending and
   * not-answered rows count against the denominator — they are the ones still
   * owed a reply.
   */
  readonly repliedPercent = computed(() => {
    const { attending, declined, total } = this.guestStatistics().rsvp;
    return total === 0 ? 0 : Math.round(((attending + declined) / total) * 100);
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
        this.userProfileCollection.getAll();
      }
    });
  }
}
