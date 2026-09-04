import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  signal,
  computed,
  inject,
  type Signal,
  viewChild,
  ViewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EntityCollectionService, EntityServices } from '@ngrx/data';

import {
  AppScreenFoot,
  AppScreenHead,
  EntityNamesEnum,
  UserProfileDto,
  isFirstLoad,
  UserProfileDataService,
  PluralTranslatePipe,
  ScreenChromeService,
  StatisticService,
  TranslateLanguageService,
  lastSeenLabel as formatLastSeen,
  todayInMadrid,
  partnerHasAccount,
} from '@app/core';
import { Btn } from '@app/shared/button/button';
import { GuestProfileModal, ManageRsvpModal, GuestCreateModal } from './modal';

/** Columns backed by real per-guest data — the only ones the table can sort by. */
type SortColumn = 'lastName' | 'status' | 'adults' | 'children' | 'lastSeen';

@Component({
  selector: 'app-guest-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    AppScreenFoot,
    AppScreenHead,
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
  /**
   * Shared predicate (ADR W-0002 §Decision.2) exposed to the row template, which
   * renders a partner with their own guest account differently from a plus-one.
   */
  protected readonly partnerHasAccount = partnerHasAccount;

  /**
   * A zero-height marker after the last row (`guest-manager.html`). Intersecting
   * it — via {@link IntersectionObserver}, wired in the constructor — is the
   * "observation" half of hub ADR-0042 §Consequences / T348: it resolves
   * against the real viewport regardless of which ancestor actually scrolls
   * (`PrivateLayout`'s `.screen-scroll`, not any element of this screen's own
   * template), so this screen never needs a reference to that element.
   */
  private readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');

  /** The "control" half of the same gap — see {@link resetWindow}. */
  private readonly screenChrome = inject(ScreenChromeService);

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

  /**
   * The same singleton the collection above reads through — injected directly
   * for one thing the `@ngrx/data` collection does not carry: the API's
   * `nextCursor` (ADR W-0009 §2).
   */
  private readonly profileData = inject(UserProfileDataService);

  /**
   * True while a list read is in flight. A fetch-backed grow has real latency,
   * so the button reports it by going disabled — this is the busy state ADR
   * W-0008 §3 correctly refused to fake when the grow was a synchronous array
   * slice (ADR W-0009 §3).
   */
  /** Filter captions, in the order the settled toolbar renders them — the
   *  loading state shows the real labels and skeletons only their counts. */
  protected readonly pendingFilters = [
    'guest_manager.filter.all',
    'guest_manager.filter.attending',
    'guest_manager.filter.pending',
    'guest_manager.filter.declined',
  ];

  /** Column cells of the loading table's header, matching the settled header's
   *  order — the class carries each column's width, the key its label. */
  protected readonly pendingColumns = [
    { key: 'col-guest', labelKey: 'guest_manager.table.guest' },
    { key: 'col-status', labelKey: 'guest_manager.table.status' },
    { key: 'col-adults', labelKey: 'guest_manager.table.adults' },
    { key: 'col-children', labelKey: 'guest_manager.table.children' },
    { key: 'col-dietary', labelKey: 'guest_manager.table.dietary' },
    { key: 'col-table', labelKey: 'guest_manager.table.table' },
    { key: 'col-last-seen', labelKey: 'guest_manager.table.lastSeen' },
  ];

  /** Placeholder rows for the loading table — see the note in the template. */
  protected readonly pendingRows = [0, 1, 2, 3, 4, 5, 6, 7];

  protected readonly loadingMore = toSignal(this.userProfileCollection.loading$, {
    initialValue: false,
  });

  /**
   * The screen has nothing to draw yet — the state the in-place
   * `app-content-loading` replaces the content region with (header excluded).
   * The three conditions behind it live in {@link isFirstLoad}, shared with
   * every other screen that fronts a collection.
   */
  protected readonly initialLoading = isFirstLoad(this.userProfileCollection);

  private readonly statistics = inject(StatisticService);

  private readonly translateService = inject(TranslateService);
  private readonly translateLanguageService = inject(TranslateLanguageService);

  /**
   * Header counts come from the shared {@link StatisticService} so this table
   * and the couple dashboard cannot drift apart.
   */
  protected readonly count = this.statistics.guestStatistics;

  private readonly filter = signal<'all' | 'attending' | 'pending' | 'declined'>('all');
  private readonly searchQuery = signal('');

  /**
   * How many extra pages the user has pulled in. Only ever non-zero once a
   * grow has actually cost an API call, which is what the end-of-list line
   * keys off — with the whole collection already in hand there is no "end" to
   * announce (ADR W-0009 §4).
   */
  private readonly pagesFetched = signal(0);

  /**
   * SPEC.md's admin capability list promises "Filter, sort, search" — filter and
   * search are already wired above; this is that column-sort piece. Only columns
   * backed by real per-guest data are sortable — `.col-dietary`/`.col-table`
   * stay static placeholders (see the template) because the list summary DTO
   * doesn't carry that data yet.
   */
  private readonly sortColumn = signal<SortColumn>('lastName');
  private readonly sortDirection = signal<'asc' | 'desc'>('asc');

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
        return filterValue === 'all' || filterValue === 'pending';
      }

      // A partner with their own account carries the couple's shared RSVP but
      // not its id; the owning profile is already the row for that couple.
      if (rsvp.id !== profile.id) return false;

      return filterValue === 'all' || rsvp.status === filterValue;
    });
  });

  /**
   * `filteredGuests` re-ordered per the active column/direction. Default is
   * lastname ascending — the table's baseline order before anyone touches a
   * header.
   */
  protected readonly sortedGuests = computed(() => {
    const column = this.sortColumn();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    return [...this.filteredGuests()].sort(
      (a, b) => this.compareByColumn(a, b, column) * direction,
    );
  });

  /**
   * Whether growing the list would cost another API call — the **only**
   * question "Load more" is allowed to be asked (ADR W-0009 §1). The answer is
   * the API's own `nextCursor`: a string while rows remain unfetched, `null`
   * once the collection is exhausted, `undefined` before the first read has
   * landed. Both non-string cases mean "nothing to fetch", so neither the
   * button nor the scroll trigger has anything to offer.
   *
   * Today this screen reads the collection with no `limit`, so the API answers
   * with every profile and `nextCursor: null` — the affordance never appears,
   * because a second call would return nothing. Nothing here assumes that: the
   * day this screen asks for a page, the button appears on its own.
   */
  protected readonly hasMore = computed(() => typeof this.profileData.nextCursor() === 'string');

  /** Whether the end-of-list line has anything to mark; see {@link pagesFetched}. */
  protected readonly reachedEnd = computed(() => this.pagesFetched() > 0 && !this.hasMore());

  constructor() {
    this.statistics.load(); // Only fetches if cache is empty

    // Auto-load the next page as {@link scrollSentinel} nears the viewport
    // (hub ADR-0042 §Consequences, T348) — see that field's own doc for why
    // this needs no reference to whichever element actually scrolls.
    // `rootMargin` re-creates the old "within 120px of the bottom" trigger
    // (the pre-T341 `onListScroll` threshold) without reading any scroll
    // geometry directly. The observer is rebuilt whenever the sentinel's
    // `ElementRef` changes (it does not exist while `initialLoading()` shows
    // the skeleton instead) and torn down via `effect`'s own cleanup, never
    // left dangling across that swap.
    //
    // The `typeof` guard is feature detection, not a test seam: `IntersectionObserver`
    // is a real browser global every target here ships (CLAUDE.md hard rule 4's
    // browser list), but JSDOM — this screen's own Vitest environment — has
    // never implemented it (T348's whole reason for a Playwright spec instead
    // of a Vitest one, `e2e/layout/`). Skipping construction where the global
    // is absent keeps the unit suite from crashing on every test that renders
    // past the loading skeleton; it does not stand in for exercising the
    // observer itself, which no mock here claims to do.
    effect((onCleanup) => {
      const sentinel = this.scrollSentinel()?.nativeElement;
      if (!sentinel || typeof IntersectionObserver === 'undefined') return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) this.loadMore();
        },
        { rootMargin: '120px' },
      );
      observer.observe(sentinel);
      onCleanup(() => observer.disconnect());
    });
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

  /**
   * `-1 / 0 / 1` for one column between two rows, ascending. `toggleSort`
   * applies direction on top of this.
   */
  private compareByColumn(a: UserProfileDto, b: UserProfileDto, column: SortColumn): number {
    switch (column) {
      case 'lastName':
        // Tie-break on first name so same-surname rows (e.g. siblings) don't
        // land in an arbitrary order.
        return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
      case 'status':
        return this.statusRank(a) - this.statusRank(b);
      case 'adults':
        return (a.guestInfo?.rsvp?.adults ?? 0) - (b.guestInfo?.rsvp?.adults ?? 0);
      case 'children':
        return (a.guestInfo?.rsvp?.children ?? 0) - (b.guestInfo?.rsvp?.children ?? 0);
      case 'lastSeen':
        // Ascending means "most recently seen first", matching the DS's
        // `SEEN_RANK` (`ScreenGuestManager.jsx` L119: Today → … → Never), so
        // ISO date strings compare reversed and the never-signed-in sentinel
        // sorts last (and therefore first when the direction flips).
        if (!a.lastSeen && !b.lastSeen) return 0;
        if (!a.lastSeen) return 1;
        if (!b.lastSeen) return -1;
        return b.lastSeen.localeCompare(a.lastSeen);
    }
  }

  /**
   * Attending first, then pending, then a guest with no RSVP record at all
   * (distinct from an explicit "pending" answer), then declined last —
   * roughly "how much attention this row still needs".
   */
  private statusRank(profile: UserProfileDto): number {
    const status = profile.guestInfo?.rsvp?.status;
    switch (status) {
      case 'attending':
        return 0;
      case 'pending':
        return 1;
      case 'declined':
        return 3;
      default:
        return 2;
    }
  }

  /**
   * Clicking a header: same column toggles direction, a new column starts
   * ascending. The window resets, same as changing the filter or search does.
   */
  toggleSort(column: SortColumn): void {
    if (this.sortColumn() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
    this.resetWindow();
  }

  /** Get the current sort column (for template) */
  getSortColumn(): SortColumn {
    return this.sortColumn();
  }

  /** Get the current sort direction (for template) */
  getSortDirection(): 'asc' | 'desc' {
    return this.sortDirection();
  }

  /**
   * `aria-sort` for one sortable `role="columnheader"` (T332) — the direction
   * on the active column, `"none"` on the other sortable ones. The header
   * buttons' accessible name stays the plain "Sort by {column}" action, because
   * repeating the direction there would announce it twice.
   *
   * The two placeholder columns (`dietary`, `table`) omit the attribute
   * altogether rather than passing through here: `"none"` claims "sortable, not
   * currently sorted", which they are not.
   */
  ariaSort(column: SortColumn): 'ascending' | 'descending' | 'none' {
    if (this.sortColumn() !== column) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  /** Set the active filter and reset the window */
  setFilter(f: 'all' | 'attending' | 'pending' | 'declined'): void {
    this.filter.set(f);
    this.resetWindow();
  }

  /** Update search query and reset the window */
  updateSearch(query: string): void {
    this.searchQuery.set(query);
    this.resetWindow();
  }

  /**
   * Fetch the next page. Unlike the window it replaces this is a real request,
   * so it is guarded on the collection's own `loading$` — a scroll that keeps
   * firing while a page is in flight must not queue a second call for the same
   * cursor. `@ngrx/data` merges the response into the collection, so the rows
   * already on screen stay put and the new ones join them.
   */
  loadMore(): void {
    const cursor = this.profileData.nextCursor();
    if (typeof cursor !== 'string' || this.loadingMore()) return;
    this.userProfileCollection.getWithQuery({ cursor });
    this.pagesFetched.update((n) => n + 1);
  }

  /**
   * Back to the top of the list. Called whenever the row set changes out from
   * under the reader (ADR W-0009 §5). Rows already fetched are **not**
   * discarded: they cost a request, and re-fetching them because someone typed
   * in the search box would be the fake-pagination problem in reverse.
   *
   * Goes through `ScreenChromeService` (hub ADR-0042 §Consequences, T348)
   * rather than zeroing a `scrollTop` this screen holds a reference to: since
   * T341 the element that actually scrolls is `PrivateLayout`'s
   * `.screen-scroll`, outside this component's own template, so the reset is
   * a request the layout carries out — the same shape as handing over a
   * head/foot template.
   */
  private resetWindow(): void {
    this.screenChrome.requestScrollReset();
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

  /**
   * A row click opens the guest profile overlay read-only-first — it owns
   * fetching the full RSVP behind the summary card it shows. The manage-RSVP
   * overlay's "Back" also uses this entry point (T269): both land on the
   * read-only profile view.
   */
  openGuestProfile(userId: string): void {
    this.profileModal.open(userId);
  }

  /**
   * The manage-RSVP overlay's "Open their profile" jump from a linked
   * partner's locked name (T269) — the couple followed it specifically to
   * fix something about that guest's own account, so it opens straight into
   * edit mode instead of the read-only view (T308).
   */
  openGuestProfileEdit(userId: string): void {
    this.profileModal.open(userId, { edit: true });
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
