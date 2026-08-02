import {
  ChangeDetectionStrategy,
  Component,
  signal,
  computed,
  inject,
  type Signal,
  ViewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { TranslatePipe } from '@ngx-translate/core';
import { EntityCollectionService, EntityServices } from '@ngrx/data';

import { EntityNamesEnum, UserProfileDto, PluralTranslatePipe } from '@app/core';
import { Btn } from '@app/shared/button/button';
import { RsvpDetailsModal, GuestCreateModal } from './modal';

@Component({
  selector: 'app-guest-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [Btn, TranslatePipe, PluralTranslatePipe, RsvpDetailsModal, GuestCreateModal],
  templateUrl: './guest-manager.html',
  styleUrl: './guest-manager.scss',
})
export class GuestManager {
  protected readonly Math = Math;

  @ViewChild(RsvpDetailsModal) rsvpModal!: RsvpDetailsModal;
  @ViewChild(GuestCreateModal) createModal!: GuestCreateModal;

  private readonly userProfileCollection: EntityCollectionService<UserProfileDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE);
  private readonly userProfileList: Signal<UserProfileDto[]> = toSignal(
    this.userProfileCollection.entities$,
    {
      initialValue: [],
    },
  );

  /**
   * A profile is a guest-list row only if it owns the RSVP it points to
   * (`rsvp.id === profile.id`) — a partner with their own account carries the
   * same shared `guestInfo.rsvp`, but not its id, so this keeps couples to a
   * single row instead of one per account holder.
   */
  private ownRsvp(
    profile: UserProfileDto,
  ): NonNullable<UserProfileDto['guestInfo']>['rsvp'] | undefined {
    const rsvp = profile.guestInfo?.rsvp;
    return rsvp && rsvp.id === profile.id ? rsvp : undefined;
  }

  /**
   * Table rows are guest profiles, not RSVPs: `UserProfileDto.rsvp` already
   * carries the status/adults/children summary the list needs, so there is no
   * separate RSVP collection to fetch or join here. Bride/groom/provider
   * profiles have no `rsvp` and are filtered out below.
   */
  protected readonly count = computed(() => {
    const profiles = this.userProfileList();
    const counts = {
      rsvp: { attending: 0, declined: 0, pending: 0, undefined: 0, total: 0 },
      headCount: { adults: 0, children: 0 },
    };

    for (const profile of profiles) {
      const rsvp = this.ownRsvp(profile);
      if (!rsvp) {
        counts.rsvp.undefined++;
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
    counts.rsvp.total = counts.rsvp.attending + counts.rsvp.declined + counts.rsvp.pending;
    return counts;
  });

  private readonly filter = signal<'all' | 'attending' | 'pending' | 'declined' | 'undefined'>(
    'all',
  );
  private readonly searchQuery = signal('');
  private readonly currentPage = signal(0);
  private readonly pageSize = 10;

  protected readonly filteredGuests = computed(() => {
    const profiles = this.userProfileList();
    const filterValue = this.filter();
    const searchValue = this.searchQuery().toLowerCase();

    return profiles.filter((profile) => {
      if (profile.role !== 'guest') return false;
      const guestName = `${profile.firstName} ${profile.lastName}`.toLowerCase();
      let matchesSearch = !searchValue || guestName.includes(searchValue);

      if (!profile.guestInfo?.rsvp) {
        if (filterValue !== 'undefined' && filterValue !== 'all') return false;
        return matchesSearch;
      }

      if (profile.guestInfo?.rsvp) {
        if (profile.guestInfo.rsvp.id !== profile.id) return false;
        const matchesFilter =
          filterValue === 'all' || profile.guestInfo.rsvp.status === filterValue;
        matchesSearch = matchesSearch && matchesFilter;
      }
      // const rsvp = this.ownRsvp(profile);
      // const matchesFilter = filterValue === 'all' || rsvp.status === filterValue;
      return matchesSearch;
    });
  });

  protected readonly paginatedGuests = computed(() => {
    const filtered = this.filteredGuests();
    const page = this.currentPage();
    const start = page * this.pageSize;
    const end = start + this.pageSize;
    return filtered.slice(start, end);
  });

  protected readonly totalPages = computed(() => {
    return Math.ceil(this.filteredGuests().length / this.pageSize);
  });

  constructor() {
    this.userProfileCollection.loaded$.subscribe((loaded) => {
      if (!loaded) {
        this.userProfileCollection.getAll(); // Only fetches if cache is empty
      }
    });
  }

  /** Set the active filter and reset pagination */
  setFilter(f: 'all' | 'attending' | 'pending' | 'declined' | 'undefined'): void {
    this.filter.set(f);
    this.currentPage.set(0);
  }

  /** Update search query and reset pagination */
  updateSearch(query: string): void {
    this.searchQuery.set(query);
    this.currentPage.set(0);
  }

  /** Go to previous page */
  previousPage(): void {
    this.currentPage.set(Math.max(0, this.currentPage() - 1));
  }

  /** Go to next page */
  nextPage(maxPage: number): void {
    this.currentPage.set(Math.min(maxPage, this.currentPage() + 1));
  }

  /** Add a new guest — opens the dedicated create-guest modal on a blank draft. */
  addNewGuest(): void {
    this.createModal.open();
  }

  /**
   * A guest was just created: the modal's own `update()` call already merged
   * `firstName`/`lastName`/`relation` into the profile cache, but not the
   * `rsvp` summary the new pending RSVP produces — re-fetch so the row shows
   * the same status/count columns as any other guest.
   */
  onGuestCreated(userId: string): void {
    this.userProfileCollection.getByKey(userId);
  }

  /** Get the current filter value (for template) */
  getFilter(): string {
    return this.filter();
  }

  /** Get the current search query (for template) */
  getSearchQuery(): string {
    return this.searchQuery();
  }

  /** Get the current page (for template) */
  getCurrentPage(): number {
    return this.currentPage();
  }

  /** Open the RSVP details modal — it owns fetching the full RSVP for this guest. */
  openRsvpModal(userId: string): void {
    this.rsvpModal.open(userId);
  }

  /** Handle comment save from modal */
  onSaveComments(event: { rsvpId: string; comments: string }): void {
    // TODO: Call API to update RSVP comments
    console.log('Save comments:', event);
  }
}
