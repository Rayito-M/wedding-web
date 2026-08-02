import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type Signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EntityCollectionService, EntityServices } from '@ngrx/data';

import { EntityNamesEnum, UserProfileDto } from '@app/core';

import { Pill } from '@app/shared/pill/pill';
import { TextInput } from '@app/shared/input/input';
import { Avatar } from '@app/shared/avatar/avatar';

/**
 * Presentational scaffold only (T237). Per design reference `ScreenPeople.jsx`
 * — the guest directory: a single-column card list on mobile, and on desktop
 * (`wide`) a header + right-aligned search/filter column followed by a
 * `repeat(auto-fill, minmax(280px,1fr))` grid of profile cards, at
 * `maxWidth: 980`. One template, switched purely by CSS
 * (`@media (min-width: 900px)`), same approach as `seating-plan` (T229) /
 * `config-manager`.
 *
 * `PEOPLE_SEED` below is a small hardcoded fixture mirroring the shape of the
 * reference's `WEDDING_PEOPLE` — not a service, not wired to any API. Local
 * signals (`query`, `filter`) only drive the search/filter visual states
 * already shown in the reference; there is no persistence layer, no
 * `HttpClient`, no `EntityCollectionService`.
 */

type FilterId = 'all' | 'bride' | 'groom' | 'provider';

interface FilterOption {
  readonly id: FilterId;
  /** i18n key under `people.filter.*`, resolved via the `translate` pipe in the template. */
  readonly labelKey: string;
  readonly labelParams: Readonly<Record<string, string>>;
}

// "Sara" / "Christophe" are the fixture's fixed couple names (matches the
// `dashboard.greeting` template's own hardcoded `{ name: 'Sara' }` pattern) —
// not sourced from wedding config, since this scaffold has no config wiring.
const FILTERS: readonly FilterOption[] = [
  { id: 'all', labelKey: 'people.filter.all', labelParams: {} },
  { id: 'bride', labelKey: 'people.filter.side', labelParams: { name: 'Sara' } },
  { id: 'groom', labelKey: 'people.filter.side', labelParams: { name: 'Christophe' } },
  { id: 'provider', labelKey: 'people.filter.provider', labelParams: {} },
];

@Component({
  selector: 'app-people',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Pill, TextInput, RouterLink, TranslatePipe],
  templateUrl: './people.html',
  styleUrl: './people.scss',
})
export class People {
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);
  // Read inside `filteredPeople` so relation-label search stays correct after
  // a language switch — `translateService.instant()` isn't itself a signal.
  private readonly langChange = toSignal(this.translateService.onLangChange, {
    initialValue: null,
  });

  private readonly userProfileCollection: EntityCollectionService<UserProfileDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE);
  protected readonly userProfileList: Signal<UserProfileDto[]> = toSignal(
    this.userProfileCollection.entities$,
    {
      initialValue: [],
    },
  );

  protected readonly filters = FILTERS;

  protected readonly query = signal('');
  protected readonly filter = signal<FilterId>('all');

  protected readonly eyebrowKey = computed(() =>
    this.userProfileList().length === 1 ? 'people.eyebrow_singular' : 'people.eyebrow_plural',
  );

  protected readonly filteredPeople = computed<readonly UserProfileDto[]>(() => {
    this.langChange();
    const query = this.query().trim().toLowerCase();
    const filter = this.filter();
    return this.userProfileList().filter((person) => {
      const name = `${person.firstName} ${person.lastName}`.toLowerCase();
      const rel = person.guestInfo?.relation
        ? this.translateService.instant(person.guestInfo.relation.link).toLowerCase()
        : '';
      if (query && !name.includes(query) && !rel.includes(query)) return false;
      if (filter === 'provider') return person.role === 'provider';
      if (filter === 'bride' || filter === 'groom') {
        if (person.role === 'provider') return false;
        if (person.role === 'bride') return filter === 'bride';
        if (person.role === 'groom') return filter === 'groom';
        return person.guestInfo?.relation?.side === filter;
      }
      return true;
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
  // fixture entry `u3` ("Laura Ortega"), so only that card links to `/profile`.
  protected isMine(person: UserProfileDto): boolean {
    return person.id === 'u3';
  }

  /** Keyboard fallback for the "mine" card — `routerLink` only binds to
   *  `click`, so Enter/Space on the focused card need an explicit trigger. */
  protected goToProfile(person: UserProfileDto): void {
    if (!this.isMine(person)) return;
    void this.router.navigate(['/profile']);
  }

  protected initials(person: UserProfileDto): string {
    return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase() || '·';
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
