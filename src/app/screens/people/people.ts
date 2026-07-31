import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { Pill } from '@app/shared/pill/pill';
import { TextInput } from '@app/shared/input/input';

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

type Role = 'bride' | 'groom' | 'guest' | 'provider';
type Side = 'bride' | 'groom';
type FilterId = 'all' | 'bride' | 'groom' | 'provider';
type LangCode = 'es' | 'en' | 'fr';

interface Relation {
  readonly label: string;
  readonly side?: Side;
}

interface Person {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email?: string;
  readonly phoneNumber: string;
  readonly preferredLang?: LangCode;
  readonly role: Role;
  readonly relation?: Relation;
}

// Small representative subset of the reference's WEDDING_PEOPLE fixture —
// enough to show every visual state (bride/groom, a guest with full
// relation+side, a guest missing an email, a preferredLang chip, and
// providers with a label-only relation) without mirroring all 12 entries.
const PEOPLE_SEED: readonly Person[] = [
  {
    id: 'u1',
    firstName: 'Sara',
    lastName: 'Moreno',
    email: 'sara@example.com',
    phoneNumber: '+34 600 112 233',
    preferredLang: 'es',
    role: 'bride',
  },
  {
    id: 'u2',
    firstName: 'Christophe',
    lastName: 'Lefèvre',
    email: 'christophe@example.com',
    phoneNumber: '+33 6 12 34 56 78',
    preferredLang: 'fr',
    role: 'groom',
  },
  {
    id: 'u3',
    firstName: 'Laura',
    lastName: 'Ortega',
    email: 'laura.ortega@example.com',
    phoneNumber: '+34 655 908 771',
    preferredLang: 'es',
    role: 'guest',
    relation: { label: 'Cousin', side: 'bride' },
  },
  {
    id: 'u4',
    firstName: 'Marco',
    lastName: 'Ortega',
    phoneNumber: '+34 655 908 772',
    preferredLang: 'es',
    role: 'guest',
    relation: { label: 'Plus one', side: 'bride' },
  },
  {
    id: 'u5',
    firstName: 'Élodie',
    lastName: 'Barbier',
    email: 'elodie.b@example.com',
    phoneNumber: '+33 6 88 20 41 09',
    preferredLang: 'fr',
    role: 'guest',
    relation: { label: 'Sister', side: 'groom' },
  },
  {
    id: 'u7',
    firstName: 'Hannah',
    lastName: 'Whitfield',
    email: 'hannah.w@example.com',
    phoneNumber: '+44 7700 900 812',
    preferredLang: 'en',
    role: 'guest',
    relation: { label: 'Work', side: 'groom' },
  },
  {
    id: 'u11',
    firstName: 'Marta',
    lastName: 'Cano',
    email: 'marta@catering-alhambra.es',
    phoneNumber: '+34 958 220 114',
    preferredLang: 'es',
    role: 'provider',
    relation: { label: 'Catering' },
  },
  {
    id: 'u12',
    firstName: 'Diego',
    lastName: 'Salas',
    email: 'diego@salasfoto.es',
    phoneNumber: '+34 622 010 344',
    preferredLang: 'es',
    role: 'provider',
    relation: { label: 'Photography' },
  },
];

const FILTERS: readonly { readonly id: FilterId; readonly label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'bride', label: "Sara's side" },
  { id: 'groom', label: "Christophe's side" },
  { id: 'provider', label: 'Vendors' },
];

const ROLE_LABEL: Record<Role, string> = {
  bride: 'Bride',
  groom: 'Groom',
  guest: 'Guest',
  provider: 'Provider',
};

const LANG_LABEL: Record<LangCode, string> = {
  es: 'ES',
  en: 'EN',
  fr: 'FR',
};

@Component({
  selector: 'app-people',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Pill, TextInput, RouterLink],
  templateUrl: './people.html',
  styleUrl: './people.scss',
})
export class People {
  private readonly router = inject(Router);

  protected readonly people = PEOPLE_SEED;
  protected readonly filters = FILTERS;

  protected readonly query = signal('');
  protected readonly filter = signal<FilterId>('all');

  protected readonly filteredPeople = computed<readonly Person[]>(() => {
    const query = this.query().trim().toLowerCase();
    const filter = this.filter();
    return this.people.filter((person) => {
      const name = `${person.firstName} ${person.lastName}`.toLowerCase();
      const rel = (person.relation?.label ?? '').toLowerCase();
      if (query && !name.includes(query) && !rel.includes(query)) return false;
      if (filter === 'provider') return person.role === 'provider';
      if (filter === 'bride' || filter === 'groom') {
        if (person.role === 'provider') return false;
        if (person.role === 'bride') return filter === 'bride';
        if (person.role === 'groom') return filter === 'groom';
        return person.relation?.side === filter;
      }
      return true;
    });
  });

  protected setQuery(value: string): void {
    this.query.set(value);
  }

  protected setFilter(id: FilterId): void {
    this.filter.set(id);
  }

  protected isCouple(person: Person): boolean {
    return person.role === 'bride' || person.role === 'groom';
  }

  // No real auth/role signal is wired into this scaffold (T237) — mirrors the
  // DS reference's guest-role rule (`ScreenPeople.jsx`): the signed-in user is
  // fixture entry `u3` ("Laura Ortega"), so only that card links to `/profile`.
  protected isMine(person: Person): boolean {
    return person.id === 'u3';
  }

  /** Keyboard fallback for the "mine" card — `routerLink` only binds to
   *  `click`, so Enter/Space on the focused card need an explicit trigger. */
  protected goToProfile(person: Person): void {
    if (!this.isMine(person)) return;
    void this.router.navigate(['/profile']);
  }

  protected initials(person: Person): string {
    return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase() || '·';
  }

  protected roleLabel(role: Role): string {
    return ROLE_LABEL[role];
  }

  protected langLabel(code: LangCode): string {
    return LANG_LABEL[code];
  }

  protected relationText(person: Person): string {
    const relation = person.relation;
    if (!relation) return '';
    return relation.side ? `${relation.label} · ${relation.side}` : relation.label;
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
