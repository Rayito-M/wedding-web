import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type Signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EntityCollectionService, EntityServices } from '@ngrx/data';

import {
  EntityNamesEnum,
  UserProfileDto,
  isFirstLoad,
  LoginService,
  ProfileModalService,
  TranslateLanguageService,
  lastSeenLabel as formatLastSeen,
  relationLinkLabel,
  RelationLinkPipe,
  todayInMadrid,
} from '@app/core';

import { Pill } from '@app/shared/pill/pill';
import { TextInput } from '@app/shared/input/input';
import { Avatar } from '@app/shared/avatar/avatar';

/**
 * Per design reference `ScreenPeople.jsx` — the guest directory: a
 * single-column card list on mobile, and on desktop (`wide`) a header +
 * right-aligned search/filter column followed by a
 * `repeat(auto-fill, minmax(280px,1fr))` grid of profile cards, at
 * `maxWidth: 980`. One template, switched purely by CSS
 * (`@media (min-width: 900px)`), same approach as `seating-plan` (T229) /
 * `config-manager`.
 *
 * Real screen since at least T290/T292: `userProfileList` is backed by
 * `EntityCollectionService<UserProfileDto>` (`GET /v1/profile` via
 * `EntityNamesEnum.USER_PROFILE`), `showContact` is wired to
 * `LoginService.isCouple`, and `lastSeenLabel` formats against
 * `todayInMadrid()` — there is no local fixture and no scaffold layer left.
 */

type FilterId = 'all' | 'bride' | 'groom' | 'provider';

interface FilterOption {
  readonly id: FilterId;
  /** i18n key under `people.filter.*`, resolved via the `translate` pipe in the template. */
  readonly labelKey: string;
  readonly labelParams: Readonly<Record<string, string | undefined>>;
}

@Component({
  selector: 'app-people',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Pill, TextInput, TranslatePipe, RelationLinkPipe],
  templateUrl: './people.html',
  styleUrl: './people.scss',
})
export class People {
  private readonly profileModal = inject(ProfileModalService);
  private readonly translateService = inject(TranslateService);
  // Read inside `filteredPeople` so relation-label search stays correct after
  // a language switch — `translateService.instant()` isn't itself a signal.
  private readonly langChange = toSignal(this.translateService.onLangChange, {
    initialValue: null,
  });

  private readonly loginService = inject(LoginService);
  private readonly translateLanguageService = inject(TranslateLanguageService);

  /**
   * DS `ScreenPeople.jsx`'s `showContact={role === 'couple'}` — the real
   * auth/role signal this scaffold otherwise lacks (see `isMine`'s note),
   * wired here because it's the one thing `ProfileCard.lastSeen` needs to
   * render correctly (hub ADR-0035 §6, widened by ADR-0036).
   *
   * `UserProfileDto.email`/`phoneNumber` are also couple-gated on the API
   * side, but their `@if (person.email || person.phoneNumber)` in the
   * template needs no client-side check: `undefined` unambiguously means
   * "don't show this line" for contact details. `lastSeen` can't use the
   * same trick — the API returns `undefined` for both "I can't see it" and
   * "this admin-visible guest never signed in", and only the second one
   * should render "Never signed in" — so the last-seen line is gated on this
   * signal explicitly, never on whether `person.lastSeen` happens to be set.
   */
  protected readonly showContact = this.loginService.isCouple;

  private readonly userProfileCollection: EntityCollectionService<UserProfileDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE);
  protected readonly userProfileList: Signal<UserProfileDto[]> = toSignal(
    this.userProfileCollection.entities$,
    {
      initialValue: [],
    },
  );

  /**
   * The first profile read is still in flight. Until it lands the grid is not
   * empty, it is unknown — and `people.empty` ("no one matches") would be a
   * false statement, so the loader stands in for the grid instead.
   */
  protected readonly loading = isFirstLoad(this.userProfileCollection);

  /** Placeholder counts for the loading state. `filters()` always returns four
   *  options, so the chip row is exact; the card count is a guess — see the
   *  note in the template. */
  protected readonly pendingFilters = [0, 1, 2, 3];
  protected readonly pendingCards = [0, 1, 2, 3, 4, 5];

  protected readonly filters = computed((): FilterOption[] => {
    const couple = this.userProfileList().filter((p) => p.role === 'bride' || p.role === 'groom');
    return [
      { id: 'all', labelKey: 'people.filter.all', labelParams: {} },
      {
        id: 'bride',
        labelKey: 'people.filter.side',
        labelParams: { name: couple.find((p) => p.role === 'bride')?.firstName },
      },
      {
        id: 'groom',
        labelKey: 'people.filter.side',
        labelParams: { name: couple.find((p) => p.role === 'groom')?.firstName },
      },
      { id: 'provider', labelKey: 'people.filter.provider', labelParams: {} },
    ];
  });

  protected readonly query = signal('');
  protected readonly filter = signal<FilterId>('all');

  /**
   * The viewer has narrowed the list themselves — a search term, or a chip
   * other than "All". Only then is an empty grid a *result*: `people.empty`
   * ("no one matches") is a statement about a search, and with no search
   * running it is both false and, on the very first paint, printed against an
   * empty `{{query}}`. Un-narrowed, an empty grid means the list is not known
   * yet, so the grid stays silent and the loader speaks instead.
   */
  protected readonly narrowed = computed(
    () => this.query().trim() !== '' || this.filter() !== 'all',
  );

  protected readonly eyebrowKey = computed(() =>
    this.userProfileList().length === 1 ? 'people.eyebrow_singular' : 'people.eyebrow_plural',
  );

  protected readonly filteredPeople = computed<readonly UserProfileDto[]>(() => {
    this.langChange();
    const query = this.query().trim().toLowerCase();
    const filter = this.filter();
    return this.userProfileList()
      .filter((person) => {
        // Exclude current user's profile
        if (this.isMine(person)) return false;

        // DS `ScreenPeople.jsx` folds the nickname into the same joined string
        // it searches on name (`${firstName} ${lastName} ${pseudo || ''}`),
        // unlike `guest-manager`'s parallel nickname check — this screen
        // matches its own reference exactly.
        const name =
          `${person.firstName} ${person.lastName} ${person.nickname ?? ''}`.toLowerCase();
        // Search matches what the card actually shows: the translated catalog
        // term for a family relation, the free text verbatim for every other
        // kind (shared `relationLinkLabel`, same rule as the pill above).
        const rel = relationLinkLabel(person.guestInfo?.relation, (key) =>
          this.translateService.instant(key),
        ).toLowerCase();
        if (query && !name.includes(query) && !rel.includes(query)) return false;
        if (filter === 'provider') return person.role === 'provider';
        if (filter === 'bride' || filter === 'groom') {
          if (person.role === 'provider') return false;
          if (person.role === 'bride') return filter === 'bride';
          if (person.role === 'groom') return filter === 'groom';
          return person.guestInfo?.relation?.side === filter;
        }
        return true;
      })
      .sort((profileA, profileB) => {
        const isCoupleA = profileA.role === 'bride' || profileA.role === 'groom';
        const isCoupleB = profileB.role === 'bride' || profileB.role === 'groom';

        // Bride and groom always first
        if (isCoupleA && !isCoupleB) return -1;
        if (!isCoupleA && isCoupleB) return 1;

        const nameA = `${profileA.firstName} ${profileA.lastName}`.toLowerCase();
        const nameB = `${profileB.firstName} ${profileB.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
  });

  constructor() {
    this.userProfileCollection.loaded$.subscribe((loaded) => {
      if (!loaded) {
        this.userProfileCollection.getAll(); // Only fetches if cache is empty
      }
    });
  }
  protected setQuery(value: string): void {
    this.query.set(value);
  }

  protected setFilter(id: FilterId): void {
    this.filter.set(id);
  }

  protected isCouple(person: UserProfileDto): boolean {
    return person.role === 'bride' || person.role === 'groom';
  }

  // No real auth/role signal is wired into this scaffold (T237) — mirrors the
  // DS reference's guest-role rule (`ScreenPeople.jsx`): the signed-in user is
  // fixture entry `u3` ("Laura Ortega"), so only that card opens the "My
  // profile" modal. Fixing this placeholder to use the real signed-in user's
  // id is a separate, pre-existing gap — out of scope for T304.
  protected isMine(person: UserProfileDto): boolean {
    return person.id === this.loginService.currentUserClaims()?.sub;
  }

  /** The "mine" card opens the account-dropdown "My profile" overlay
   *  (`ProfileModalService`, T304) instead of navigating to the old
   *  `/profile` route — wired to both `click` and the existing Enter/Space
   *  keyboard fallback. */
  protected goToProfile(person: UserProfileDto): void {
    if (!this.isMine(person)) return;
    this.profileModal.open();
  }

  protected initials(person: UserProfileDto): string {
    return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase() || '·';
  }

  /**
   * T290's pure helper over `UserProfileDto.lastSeen` — only ever called from
   * the template behind {@link showContact}, so `person.lastSeen` is always
   * the real value here (or genuinely absent: "Never signed in").
   */
  protected lastSeenLabel(person: UserProfileDto): string {
    return formatLastSeen(
      person.lastSeen,
      todayInMadrid(),
      this.translateLanguageService.currentLang(),
      (key) => this.translateService.instant(key),
    );
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
