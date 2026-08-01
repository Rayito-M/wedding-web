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

import { EntityNamesEnum, UserProfileDto, RsvpDto } from '@app/core';
import { Btn } from '@app/shared/button/button';
import { RsvpDetailsModal } from './rsvp-details-modal';

@Component({
  selector: 'app-guest-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [Btn, TranslatePipe, RsvpDetailsModal],
  templateUrl: './guest-manager.html',
  styleUrl: './guest-manager.scss',
})
export class GuestManager {
  protected readonly Math = Math;

  @ViewChild(RsvpDetailsModal) rsvpModal!: RsvpDetailsModal;

  private readonly userProfileCollection: EntityCollectionService<UserProfileDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE);
  private readonly userProfileList: Signal<UserProfileDto[]> = toSignal(
    this.userProfileCollection.entities$,
    {
      initialValue: [],
    },
  );

  private readonly rsvpCollection: EntityCollectionService<RsvpDto> = inject(
    EntityServices,
  ).getEntityCollectionService<RsvpDto>(EntityNamesEnum.RSVP);

  private readonly rsvpList: Signal<RsvpDto[]> = toSignal(this.rsvpCollection.entities$, {
    initialValue: [],
  });

  protected readonly userProfilesLoaded = computed(() => {
    return this.userProfileList().map((profile) => profile.id);
  });

  protected readonly count = computed(() => {
    const rsvps = this.rsvpList();
    const counts = { attending: 0, declined: 0, pending: 0, total: 0 };

    for (const rsvp of rsvps) {
      switch (rsvp.status) {
        case 'attending':
          counts.attending++;
          counts.total++;
          if (rsvp.adults.partner2) {
            counts.total++;
          }
          if (rsvp.children) {
            counts.total += rsvp.children.length;
          }
          break;
        case 'declined':
          counts.declined++;
          break;
        case 'pending':
          counts.pending++;
          break;
      }
    }
    return counts;
  });

  private readonly filter = signal<'all' | 'attending' | 'pending' | 'declined'>('all');
  private readonly searchQuery = signal('');
  private readonly currentPage = signal(0);
  private readonly pageSize = 10;

  protected readonly filteredRsvps = computed(() => {
    const rsvps = this.rsvpList();
    const filterValue = this.filter();
    const searchValue = this.searchQuery().toLowerCase();

    return rsvps.filter((rsvp) => {
      const matchesFilter = filterValue === 'all' || rsvp.status === filterValue;
      const guestName =
        `${rsvp.adults.partner1.firstName} ${rsvp.adults.partner1.lastName}`.toLowerCase();
      const matchesSearch = !searchValue || guestName.includes(searchValue);
      return matchesFilter && matchesSearch;
    });
  });

  protected readonly paginatedRsvps = computed(() => {
    const filtered = this.filteredRsvps();
    const page = this.currentPage();
    const start = page * this.pageSize;
    const end = start + this.pageSize;
    return filtered.slice(start, end);
  });

  protected readonly totalPages = computed(() => {
    return Math.ceil(this.filteredRsvps().length / this.pageSize);
  });

  constructor() {
    this.rsvpCollection.loaded$.subscribe((loaded) => {
      if (!loaded) {
        this.rsvpCollection.getAll(); // Only fetches if cache is empty
      }
    });
  }

  /** Set the active filter and reset pagination */
  setFilter(f: 'all' | 'attending' | 'pending' | 'declined'): void {
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

  /**
   * Add a new guest — opens the shared guest overlay on a blank draft, the way
   * the design system's `ScreenGuestManager`/`ScreenGuestManagerMobile`
   * `addGuest()` reuses the profile overlay in "New guest" mode rather than
   * navigating away. The modal owns the form and the create calls.
   */
  addNewGuest(): void {
    this.rsvpModal.openNew();
  }

  /**
   * A guest was just created: its RSVP is already in the collection (the modal
   * created it), but its profile is not — fetch it so the row renders the same
   * side/group and contact details as any other guest.
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

  /** Open RSVP details modal */
  openRsvpModal(rsvp: RsvpDto): void {
    if (!this.userProfilesLoaded().includes(rsvp.adults.partner1.id)) {
      this.userProfileCollection.getByKey(rsvp.adults.partner1.id);
    }

    if (rsvp.adults.partner2?.id && !this.userProfilesLoaded().includes(rsvp.adults.partner2.id)) {
      this.userProfileCollection.getByKey(rsvp.adults.partner2.id);
    }
    this.rsvpModal.open(rsvp);
  }

  /** Handle comment save from modal */
  onSaveComments(event: { rsvpId: string; comments: string }): void {
    // TODO: Call API to update RSVP comments
    console.log('Save comments:', event);
  }
}
