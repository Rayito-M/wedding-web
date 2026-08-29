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

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EntityCollectionService, EntityServices } from '@ngrx/data';

import {
  EntityNamesEnum,
  UserProfileDto,
  PluralTranslatePipe,
  StatisticService,
  TranslateLanguageService,
  lastSeenLabel as formatLastSeen,
  todayInMadrid,
  partnerHasAccount,
} from '@app/core';
import { Btn } from '@app/shared/button/button';
import { GuestProfileModal, ManageRsvpModal, GuestCreateModal } from './modal';

@Component({
  selector: 'app-guest-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    Btn,
    TranslatePipe,
    PluralTranslatePipe,
    GuestProfileModal,
    ManageRsvpModal,
    GuestCreateModal,
  ],
  templateUrl: './guest-manager.html',
  styleUrl: './guest-manager.scss',
})
export class GuestManager {
  protected readonly Math = Math;

  /**
   * Shared predicate (ADR W-0002 §Decision.2) exposed to the row template, which
   * renders a partner with their own guest account differently from a plus-one.
   */
  protected readonly partnerHasAccount = partnerHasAccount;

  @ViewChild(GuestProfileModal) profileModal!: GuestProfileModal;
  @ViewChild(ManageRsvpModal) manageRsvpModal!: ManageRsvpModal;
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

  private readonly statistics = inject(StatisticService);

  private readonly translateService = inject(TranslateService);
  private readonly translateLanguageService = inject(TranslateLanguageService);

  /**
   * Header counts come from the shared {@link StatisticService} so this table
   * and the couple dashboard cannot drift apart.
   */
  protected readonly count = this.statistics.guestStatistics;

  private readonly filter = signal<'all' | 'attending' | 'pending' | 'declined' | 'undefined'>(
    'all',
  );
  private readonly searchQuery = signal('');
  private readonly currentPage = signal(0);
  private readonly pageSize = 10;

  protected readonly filteredGuests = computed(() => {
    const filterValue = this.filter();
    const searchValue = this.searchQuery().toLowerCase();

    return this.userProfileList().filter((profile) => {
      if (profile.role !== 'guest') return false;

      const guestName = `${profile.firstName} ${profile.lastName}`.toLowerCase();
      // Nickname is a parallel match, not folded into `guestName` — DS
      // `ScreenGuestManager.jsx`'s `(r.pseudo || '')` clause is its own
      // `.includes()` check alongside the name's.
      const nickname = (profile.nickname ?? '').toLowerCase();
      if (searchValue && !guestName.includes(searchValue) && !nickname.includes(searchValue)) {
        return false;
      }

      const rsvp = profile.guestInfo?.rsvp;
      if (!rsvp) {
        // No RSVP record at all. "Pending" covers these alongside the rows
        // sitting at `status: 'pending'` — both are guests who still owe a
        // reply, which is how StatisticService counts them too.
        return filterValue === 'all' || filterValue === 'pending' || filterValue === 'undefined';
      }

      // A partner with their own account carries the couple's shared RSVP but
      // not its id; the owning profile is already the row for that couple.
      if (rsvp.id !== profile.id) return false;

      return filterValue === 'all' || rsvp.status === filterValue;
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
    this.statistics.load(); // Only fetches if cache is empty
  }

  /**
   * The desktop column, the mobile secondary line, and the profile modal's
   * detail row (T291) all render this — the one pre-formatted label T290's
   * pure helper produces from `UserProfileDto.lastSeen`, this screen's own
   * "today" (`todayInMadrid()`, hub ADR-0029 §4.2) and the active UI
   * language. Read-only: there is no setter anywhere, because the API
   * ignores the field on write (ADR-0035 §2).
   *
   * `lastSeen` rides the same `requesterIsAdmin` gate as `email`/`phoneNumber`
   * on this DTO (hub ADR-0036): `/guests` sits behind `rbacGuard` with
   * `roles: ['groom', 'bride']`, so every caller here is the couple and the
   * API always populates the real value — this screen needs no separate role
   * check.
   */
  protected lastSeenLabel(profile: UserProfileDto): string {
    return formatLastSeen(
      profile.lastSeen,
      todayInMadrid(),
      this.translateLanguageService.currentLang(),
      (key) => this.translateService.instant(key),
    );
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
   * A guest was just created: the modal writes through `/v1/guests`, not this
   * Profile collection, and only the profile carries the `relation`, `partner`
   * and `rsvp` summary the row renders — so fetch it rather than deriving a row
   * locally. Also emitted when the partner link failed after the account was
   * created, in which case the row simply shows the guest unlinked.
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

  /**
   * A row click opens the guest profile overlay — it owns fetching the full
   * RSVP behind the summary card it shows. The same entry point serves the
   * manage-RSVP overlay's "Back" and its "Open their profile" jump from a
   * linked partner's locked name (T269): one swap, one code path.
   */
  openGuestProfile(userId: string): void {
    this.profileModal.open(userId);
  }

  /**
   * "Manage RSVP" / the profile's summary card. The two overlays are swapped
   * rather than stacked (the DS shows one dialog at a time); the profile modal
   * has already closed itself by the time this fires, and `(back)` on the RSVP
   * editor calls `openGuestProfile` to return here.
   */
  openManageRsvp(userId: string): void {
    this.manageRsvpModal.open(userId);
  }

  /**
   * The RSVP was saved: the table row renders the `UserProfileDto.guestInfo.rsvp`
   * summary, which lives in the Profile collection the RSVP write doesn't
   * touch — so refetch that profile to pick up the new status/head count.
   */
  onRsvpSaved(userId: string): void {
    this.userProfileCollection.getByKey(userId);
  }
}
