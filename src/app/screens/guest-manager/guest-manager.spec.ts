import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideEffects } from '@ngrx/effects';
import { EntityServices, provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  EntityNamesEnum,
  RsvpDto,
  ScreenChromeHarness,
  UserProfileDto,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { GuestManager } from './guest-manager';

/**
 * An `attending` flag that is **absent**, not `false`.
 *
 * Hub ADR-0040 made `attending` required on every adult member, so a member
 * carrying no flag is no longer constructible — but it is still readable
 * (stored RSVPs are not re-validated on read, ADR-0040 §1; and this bundle
 * outlives any single API deploy, CLAUDE.md hard rule 17). These fixtures keep
 * the shape they were written with, so what they assert is unchanged.
 */
const NO_FLAG = undefined as unknown as boolean;

function profile(overrides: Partial<UserProfileDto> = {}): UserProfileDto {
  return {
    id: 'guest-1',
    firstName: 'Laura',
    lastName: 'Mendoza',
    preferredLang: UserProfileDto.PreferredLangEnum.EN,
    role: UserProfileDto.RoleEnum.GUEST,
    ...overrides,
  };
}

async function createGuestManager(
  profiles: UserProfileDto[],
): Promise<ComponentFixture<GuestManager>> {
  await TestBed.configureTestingModule({
    imports: [GuestManager],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
      provideStore(),
      provideEffects(),
      provideEntityData(entityConfig, withEffects()),
      provideEntityDataServices(),
    ],
  }).compileComponents();

  TestBed.inject(TranslateService).setTranslation('en', {}, true);

  const collection = TestBed.inject(EntityServices).getEntityCollectionService<UserProfileDto>(
    EntityNamesEnum.USER_PROFILE,
  );
  for (const p of profiles) collection.addOneToCache(p);

  const fixture = TestBed.createComponent(GuestManager);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

/**
 * T300 — the `filteredGuests` search predicate also matches `profile.nickname`,
 * case-insensitively, mirroring DS `ScreenGuestManager.jsx`'s
 * `(r.pseudo || '').toLowerCase().includes(query.toLowerCase())` clause.
 */
describe('GuestManager — search matches on nickname (T300)', () => {
  let fixture: ComponentFixture<GuestManager>;

  async function create(profiles: UserProfileDto[]): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [GuestManager],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        provideStore(),
        provideEffects(),
        provideEntityData(entityConfig, withEffects()),
        provideEntityDataServices(),
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    const collection = TestBed.inject(EntityServices).getEntityCollectionService<UserProfileDto>(
      EntityNamesEnum.USER_PROFILE,
    );
    for (const p of profiles) collection.addOneToCache(p);

    fixture = TestBed.createComponent(GuestManager);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function rowNames(): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.table-row .guest-name') as NodeListOf<HTMLElement>,
    ).map((el) => el.textContent?.trim() ?? '');
  }

  function search(query: string): void {
    const input = fixture.nativeElement.querySelector('.search-input') as HTMLInputElement;
    input.value = query;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('matches a guest whose nickname contains the query, even when the name does not', async () => {
    await create([
      profile({ id: 'g1', firstName: 'Laura', lastName: 'Mendoza', nickname: 'Lau' }),
      profile({ id: 'g2', firstName: 'Diego', lastName: 'Ferrer' }),
    ]);

    search('lau');

    expect(rowNames()).toEqual(['Laura Mendoza']);
  });

  it('is case-insensitive on the nickname', async () => {
    await create([profile({ id: 'g1', firstName: 'Julien', lastName: 'Roux', nickname: 'Ju' })]);

    search('JU');

    expect(rowNames()).toEqual(['Julien Roux']);
  });

  it('excludes a guest with no matching name or nickname', async () => {
    await create([profile({ id: 'g1', firstName: 'Laura', lastName: 'Mendoza', nickname: 'Lau' })]);

    search('zzz');

    expect(rowNames()).toEqual([]);
  });
});

/**
 * Column sort — `SPEC.md`'s admin capability list promises "Filter, sort,
 * search"; filter and search already existed, this is the sort piece. The
 * table defaults to lastname ascending; clicking a sortable header re-orders
 * `visibleGuests` in place, toggling direction on a repeat click of the
 * same column and resetting to ascending on a switch to a different one.
 */
describe('GuestManager — column sort', () => {
  const relation = { side: 'bride', kind: 'family', link: 'sister' } as const;

  function rowNames(fixture: ComponentFixture<GuestManager>): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.table-row .guest-name') as NodeListOf<HTMLElement>,
    ).map((el) => el.textContent?.trim() ?? '');
  }

  // T332 wrapped each header button in its own `role="columnheader"` div, so
  // the sortable control is `.col-sort` *inside* `.col-<column>`.
  function clickHeader(fixture: ComponentFixture<GuestManager>, column: string): void {
    const btn = fixture.nativeElement.querySelector(
      `.table-header .col-${column} .col-sort`,
    ) as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();
  }

  it('defaults to lastname ascending, tie-broken by first name', async () => {
    const fixture = await createGuestManager([
      profile({ id: 'g1', firstName: 'Zoe', lastName: 'Alvarez' }),
      profile({ id: 'g2', firstName: 'Bea', lastName: 'Alvarez' }),
      profile({ id: 'g3', firstName: 'Ana', lastName: 'Perez' }),
    ]);

    expect(rowNames(fixture)).toEqual(['Bea Alvarez', 'Zoe Alvarez', 'Ana Perez']);
  });

  it('clicking the adults header sorts numerically, ascending', async () => {
    const fixture = await createGuestManager([
      profile({
        id: 'g1',
        firstName: 'Zoe',
        lastName: 'Alvarez',
        guestInfo: { relation, rsvp: { id: 'g1', status: 'attending', adults: 3 } },
      }),
      profile({
        id: 'g2',
        firstName: 'Ana',
        lastName: 'Perez',
        guestInfo: { relation, rsvp: { id: 'g2', status: 'attending', adults: 1 } },
      }),
    ]);

    clickHeader(fixture, 'adults');

    expect(rowNames(fixture)).toEqual(['Ana Perez', 'Zoe Alvarez']);
  });

  it('clicking the already-active header reverses direction', async () => {
    const fixture = await createGuestManager([
      profile({ id: 'g1', firstName: 'Zoe', lastName: 'Alvarez' }),
      profile({ id: 'g2', firstName: 'Ana', lastName: 'Perez' }),
    ]);

    // The guest column is already the (default) active sort, so this click
    // reverses lastname order rather than restarting ascending.
    clickHeader(fixture, 'guest');

    expect(rowNames(fixture)).toEqual(['Ana Perez', 'Zoe Alvarez']);
  });

  it('switching to a different column starts ascending, not carrying over the previous direction', async () => {
    const fixture = await createGuestManager([
      profile({
        id: 'g1',
        firstName: 'Zoe',
        lastName: 'Alvarez',
        guestInfo: { relation, rsvp: { id: 'g1', status: 'attending', adults: 3 } },
      }),
      profile({
        id: 'g2',
        firstName: 'Ana',
        lastName: 'Perez',
        guestInfo: { relation, rsvp: { id: 'g2', status: 'attending', adults: 1 } },
      }),
    ]);

    clickHeader(fixture, 'guest'); // lastname descending: Perez, Alvarez
    clickHeader(fixture, 'adults'); // new column: back to ascending

    expect(rowNames(fixture)).toEqual(['Ana Perez', 'Zoe Alvarez']);
  });

  it('on the status column, a guest with no RSVP record ranks between pending and declined', async () => {
    const fixture = await createGuestManager([
      profile({
        id: 'g1',
        firstName: 'Ana',
        lastName: 'Attending',
        guestInfo: { relation, rsvp: { id: 'g1', status: 'attending', adults: 1 } },
      }),
      profile({ id: 'g2', firstName: 'Nora', lastName: 'NoRsvp' }),
      profile({
        id: 'g3',
        firstName: 'Deb',
        lastName: 'Declined',
        guestInfo: { relation, rsvp: { id: 'g3', status: 'declined', adults: 1 } },
      }),
      profile({
        id: 'g4',
        firstName: 'Pat',
        lastName: 'Pending',
        guestInfo: { relation, rsvp: { id: 'g4', status: 'pending', adults: 1 } },
      }),
    ]);

    clickHeader(fixture, 'status');

    expect(rowNames(fixture)).toEqual([
      'Ana Attending',
      'Pat Pending',
      'Nora NoRsvp',
      'Deb Declined',
    ]);
  });

  /**
   * T331 — every sortable header carries an arrow at all times (DS
   * `ScreenGuestManager.jsx` L200); only the active column's is `.active`
   * (full opacity, accent-toned) and only it flips to `▼`.
   */
  it('renders an arrow on every sortable header, marking only the active one', async () => {
    const fixture = await createGuestManager([
      profile({ id: 'g1', firstName: 'Zoe', lastName: 'Alvarez' }),
    ]);

    const icons = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.table-header .col-sort .sort-icon',
      ) as NodeListOf<HTMLElement>,
    );

    expect(icons).toHaveLength(5);
    expect(icons.every((el) => el.textContent?.trim() === '▲')).toBe(true);
    expect(icons.filter((el) => el.classList.contains('active'))).toHaveLength(1);

    clickHeader(fixture, 'guest'); // active column, second click: descending

    const guestIcon = fixture.nativeElement.querySelector(
      '.table-header .col-guest .sort-icon',
    ) as HTMLElement;
    expect(guestIcon.textContent?.trim()).toBe('▼');
    expect(guestIcon.classList.contains('active')).toBe(true);
  });

  /**
   * T331 — "Last seen" ascending means *most recently seen first*, mirroring
   * the DS's `SEEN_RANK` (`ScreenGuestManager.jsx` L119: Today, Yesterday, …,
   * Never). The never-signed-in sentinel therefore sorts last in ascending and
   * first in descending; both directions are pinned so the sign cannot flip
   * back silently. `lastSeen` stays read-only and couple-only — the route's
   * `rbacGuard` is what gates it, never the field's presence (hub ADR-0035/36).
   */
  describe('last seen column', () => {
    const seenProfiles = (): UserProfileDto[] => [
      profile({ id: 'g1', firstName: 'Old', lastName: 'Ember', lastSeen: '2026-01-04T09:00:00Z' }),
      profile({ id: 'g2', firstName: 'Never', lastName: 'Signedin' }),
      profile({
        id: 'g3',
        firstName: 'Recent',
        lastName: 'Alba',
        lastSeen: '2026-08-29T18:30:00Z',
      }),
      profile({ id: 'g4', firstName: 'Mid', lastName: 'Costa', lastSeen: '2026-05-12T07:15:00Z' }),
    ];

    it('ascending lists the most recently seen first and the never-signed-in last', async () => {
      const fixture = await createGuestManager(seenProfiles());

      clickHeader(fixture, 'last-seen');

      expect(rowNames(fixture)).toEqual([
        'Recent Alba',
        'Mid Costa',
        'Old Ember',
        'Never Signedin',
      ]);
    });

    it('descending is the exact reverse — never-signed-in first, oldest to newest after it', async () => {
      const fixture = await createGuestManager(seenProfiles());

      clickHeader(fixture, 'last-seen'); // ascending
      clickHeader(fixture, 'last-seen'); // same column again: descending

      expect(rowNames(fixture)).toEqual([
        'Never Signedin',
        'Old Ember',
        'Mid Costa',
        'Recent Alba',
      ]);
    });

    it('keeps the incoming order when no guest has ever signed in', async () => {
      const fixture = await createGuestManager([
        profile({ id: 'g1', firstName: 'Zoe', lastName: 'Alvarez' }),
        profile({ id: 'g2', firstName: 'Ana', lastName: 'Perez' }),
      ]);

      clickHeader(fixture, 'last-seen');

      // All ties (compare returns 0), so the stable sort preserves the
      // previous (default lastname-ascending) order in both directions.
      expect(rowNames(fixture)).toEqual(['Zoe Alvarez', 'Ana Perez']);

      clickHeader(fixture, 'last-seen');

      expect(rowNames(fixture)).toEqual(['Zoe Alvarez', 'Ana Perez']);
    });
  });
});

/**
 * T330 — the list grows by fetching, never by slicing (ADR W-0009, superseding
 * W-0008). `GET /v1/profile` answers with a page envelope, and its
 * `nextCursor` is the single thing that decides whether "Load more" exists: a
 * string means another call would return rows, `null` means the collection is
 * exhausted and there is nothing left to offer. There is no batch size in this
 * screen to assert against any more, because the screen no longer invents one.
 */
describe('GuestManager — growing list (T330, ADR W-0009)', () => {
  /** `n` guests whose last names sort in creation order (`Guest00`, `Guest01`, …). */
  function guests(n: number, offset = 0): UserProfileDto[] {
    return Array.from({ length: n }, (_, i) =>
      profile({
        id: `g${i + offset}`,
        firstName: 'Ana',
        lastName: `Guest${String(i + offset).padStart(2, '0')}`,
      }),
    );
  }

  function rowNames(fixture: ComponentFixture<GuestManager>): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.table-row .guest-name') as NodeListOf<HTMLElement>,
    ).map((el) => el.textContent?.trim() ?? '');
  }

  function tableBody(fixture: ComponentFixture<GuestManager>): HTMLElement {
    return fixture.nativeElement.querySelector('.table-body') as HTMLElement;
  }

  /**
   * jsdom has no layout, so the scroll geometry the handler reads has to be
   * stood up by hand before the event is dispatched.
   */
  function scrollList(
    fixture: ComponentFixture<GuestManager>,
    geometry: { scrollHeight: number; scrollTop: number; clientHeight: number },
  ): void {
    const body = tableBody(fixture);
    Object.defineProperty(body, 'scrollHeight', {
      value: geometry.scrollHeight,
      configurable: true,
    });
    Object.defineProperty(body, 'clientHeight', {
      value: geometry.clientHeight,
      configurable: true,
    });
    Object.defineProperty(body, 'scrollTop', {
      value: geometry.scrollTop,
      configurable: true,
      writable: true,
    });
    body.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
  }

  /** Every outstanding `GET /v1/profile`, newest last. */
  function listRequests(http: HttpTestingController): TestRequest[] {
    return http.match((req) => req.method === 'GET' && req.url.endsWith('/v1/profile'));
  }

  /**
   * Answer the pending list read with one page. `profiles` mirrors `items`
   * exactly as the API does during the deprecation window, so a test can never
   * pass by accidentally reading the field the client is supposed to ignore.
   */
  function respondWith(
    http: HttpTestingController,
    items: UserProfileDto[],
    nextCursor: string | null,
  ): TestRequest {
    const requests = listRequests(http);
    expect(requests.length).toBe(1);
    requests[0].flush({ items, nextCursor, count: items.length, profiles: items });
    return requests[0];
  }

  /**
   * A rendered guest manager whose one list read has been answered with
   * `items` and `nextCursor` — the component under test then knows exactly
   * what the real API would have told it.
   */
  async function createWithPage(
    items: UserProfileDto[],
    nextCursor: string | null,
  ): Promise<{ fixture: ComponentFixture<GuestManager>; http: HttpTestingController }> {
    const fixture = await createGuestManager([]);
    const http = TestBed.inject(HttpTestingController);
    respondWith(http, items, nextCursor);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http };
  }

  it('renders every row it has — there is no window to be outside of', async () => {
    const { fixture } = await createWithPage(guests(30), null);

    expect(rowNames(fixture).length).toBe(30);
    expect(rowNames(fixture)[0]).toBe('Ana Guest00');
    expect(rowNames(fixture)[29]).toBe('Ana Guest29');
  });

  it('offers nothing to load when the API says the collection is exhausted', async () => {
    const { fixture } = await createWithPage(guests(30), null);

    // `nextCursor: null` — a second call would return nothing, so neither
    // affordance appears no matter how many rows are on screen.
    expect(fixture.nativeElement.querySelector('.load-more-btn')).toBeNull();
    expect(fixture.nativeElement.querySelector('.end-of-list')).toBeNull();
  });

  it('offers "Load more" only while the API is holding a cursor', async () => {
    const { fixture } = await createWithPage(guests(12), 'cursor-1');

    expect(fixture.nativeElement.querySelector('.load-more-btn')).not.toBeNull();
  });

  it('"Load more" fetches the next page with the cursor the API handed back', async () => {
    const { fixture, http } = await createWithPage(guests(12), 'cursor-1');

    (fixture.nativeElement.querySelector('.load-more-btn') as HTMLButtonElement).click();
    await fixture.whenStable();

    const requests = listRequests(http);
    expect(requests.length).toBe(1);
    expect(requests[0].request.params.get('cursor')).toBe('cursor-1');

    // The page merges into the rows already on screen rather than replacing them.
    requests[0].flush({
      items: guests(3, 12),
      nextCursor: null,
      count: 3,
      profiles: guests(3, 12),
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(rowNames(fixture).length).toBe(15);
    expect(fixture.nativeElement.querySelector('.load-more-btn')).toBeNull();
    // Only now is there an "end" worth announcing: the user actually grew the list.
    expect(fixture.nativeElement.querySelector('.end-of-list')).not.toBeNull();
  });

  it('a scroll within 120px of the bottom fetches the next page', async () => {
    const { fixture, http } = await createWithPage(guests(12), 'cursor-1');

    scrollList(fixture, { scrollHeight: 1000, scrollTop: 900, clientHeight: 50 });
    await fixture.whenStable();

    expect(listRequests(http).length).toBe(1);
  });

  it('a scroll far from the bottom fetches nothing', async () => {
    const { fixture, http } = await createWithPage(guests(12), 'cursor-1');

    scrollList(fixture, { scrollHeight: 1000, scrollTop: 100, clientHeight: 50 });
    await fixture.whenStable();

    http.expectNone((req) => req.method === 'GET' && req.url.endsWith('/v1/profile'));
  });

  it('a scroll to the bottom of an exhausted list fetches nothing', async () => {
    const { fixture, http } = await createWithPage(guests(30), null);

    scrollList(fixture, { scrollHeight: 1000, scrollTop: 900, clientHeight: 50 });
    await fixture.whenStable();

    // The old screen would have grown here. Without a cursor there is nothing
    // to grow into, and firing a request to discover that is the waste this
    // ADR exists to remove.
    http.expectNone((req) => req.method === 'GET' && req.url.endsWith('/v1/profile'));
  });

  it('does not queue a second request for a cursor already in flight', async () => {
    const { fixture, http } = await createWithPage(guests(12), 'cursor-1');

    (fixture.nativeElement.querySelector('.load-more-btn') as HTMLButtonElement).click();
    await fixture.whenStable();
    scrollList(fixture, { scrollHeight: 1000, scrollTop: 900, clientHeight: 50 });
    await fixture.whenStable();

    expect(listRequests(http).length).toBe(1);
  });

  it('changing the filter scrolls back to the top and keeps the fetched rows', async () => {
    const { fixture } = await createWithPage(guests(30), null);

    const body = tableBody(fixture);
    Object.defineProperty(body, 'scrollTop', { value: 480, configurable: true, writable: true });

    // Every seeded guest has no RSVP record, so "pending" keeps all 30 rows.
    const pendingFilter = fixture.nativeElement.querySelectorAll(
      '.filter-btn',
    )[2] as HTMLButtonElement;
    pendingFilter.click();
    fixture.detectChanges();

    // Rows survive: they cost a request, and re-fetching them because someone
    // touched a filter would be the fake window's problem in reverse.
    expect(rowNames(fixture).length).toBe(30);
    expect(body.scrollTop).toBe(0);
  });

  it('changing the search scrolls back to the top', async () => {
    const { fixture } = await createWithPage(guests(30), null);

    const body = tableBody(fixture);
    Object.defineProperty(body, 'scrollTop', { value: 480, configurable: true, writable: true });

    const input = fixture.nativeElement.querySelector('.search-input') as HTMLInputElement;
    input.value = 'guest'; // matches every seeded last name
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(rowNames(fixture).length).toBe(30);
    expect(body.scrollTop).toBe(0);
  });

  it('clicking a column header scrolls back to the top', async () => {
    const { fixture } = await createWithPage(guests(30), null);

    const body = tableBody(fixture);
    Object.defineProperty(body, 'scrollTop', { value: 480, configurable: true, writable: true });

    const header = fixture.nativeElement.querySelector(
      '.table-header .col-guest .col-sort',
    ) as HTMLButtonElement;
    header.click();
    fixture.detectChanges();

    expect(rowNames(fixture).length).toBe(30);
    expect(body.scrollTop).toBe(0);
  });
});

/**
 * T308 — a normal guest-table row click still opens the profile read-only,
 * while the RSVP editor's "open their profile" jump (relayed through
 * `app-manage-rsvp-modal`'s `(openProfile)`) opens straight into edit mode.
 */
describe('GuestManager — "open their profile" edit-mode jump (T308)', () => {
  let fixture: ComponentFixture<GuestManager>;

  beforeEach(async () => {
    fixture = await createGuestManager([profile()]);
  });

  it('a row click (openGuestProfile) opens the profile read-only', () => {
    const openSpy = vi.spyOn(fixture.componentInstance.profileModal, 'open');

    fixture.componentInstance.openGuestProfile('guest-1');

    expect(openSpy).toHaveBeenCalledWith('guest-1');
  });

  it('the RSVP editor jump (openGuestProfileEdit) opens straight into edit mode', () => {
    const openSpy = vi.spyOn(fixture.componentInstance.profileModal, 'open');

    fixture.componentInstance.openGuestProfileEdit('guest-1');

    expect(openSpy).toHaveBeenCalledWith('guest-1', { edit: true });
  });
});

/**
 * T314 — the two tests above each call the *next* component's method
 * directly (`openGuestProfile`/`openGuestProfileEdit` on `GuestManager`
 * itself), so neither one exercises the real, rendered chain a couple
 * actually clicks through: `GuestManager` → `ManageRsvpModal` (mounted as a
 * sibling in `guest-manager.html`, not a separate harness) → its
 * `app-rsvp-editor` in `perspective="couple"` → the partner card's "Open
 * their profile" button → back up through `(openProfile)` →
 * `openGuestProfileEdit()` → `GuestProfileModal.open(id, { edit: true })`.
 * This test drives every one of those hops via real DOM events/clicks and a
 * real `(openProfile)`/`(back)` output binding, and asserts on the rendered
 * edit-mode inputs — not on `editDraft()` read internally — closing the gap
 * described in T314's acceptance criteria.
 */
describe('GuestManager — "open their profile" full-chain jump renders the real DOM (T314)', () => {
  let fixture: ComponentFixture<GuestManager>;

  /** Same shape as `manage-rsvp-modal.spec.ts`'s `rsvpWithLinkedPartner()` —
   *  a linked partner (`kind: 'guest'`) carries their own `id`, which is what
   *  makes `partnerHasAccount()` lock their name and offer the profile jump. */
  function rsvpWithLinkedPartner(): RsvpDto {
    return {
      id: 'guest-1',
      version: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      status: RsvpDto.StatusEnum.ATTENDING,
      adults: {
        partner1: { id: 'guest-1', firstName: 'Laura', lastName: 'Mendoza', options: {}, attending: NO_FLAG },
        partner2: {
          id: 'guest-2',
          firstName: 'Diego',
          lastName: 'Ferrer',
          options: {},
          kind: 'guest',
          attending: NO_FLAG,
        },
      },
      children: [],
      submittedBy: 'guest-1',
    };
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuestManager],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        provideStore(),
        provideEffects(),
        provideEntityData(entityConfig, withEffects()),
        provideEntityDataServices(),
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    const profileCollection = TestBed.inject(
      EntityServices,
    ).getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE);
    // Two distinct profiles, seeded with different names/nicknames/relations
    // so a seeding mismatch (e.g. the wrong id threaded through the chain)
    // would show up as the wrong values in the final assertion.
    profileCollection.addOneToCache(
      profile({
        id: 'guest-1',
        firstName: 'Laura',
        lastName: 'Mendoza',
        nickname: 'Lau',
        guestInfo: { relation: { side: 'bride', kind: 'family', link: 'sister' } },
      }),
    );
    profileCollection.addOneToCache(
      profile({
        id: 'guest-2',
        firstName: 'Diego',
        lastName: 'Ferrer',
        nickname: 'Dieguito',
        guestInfo: { relation: { side: 'groom', kind: 'friends', link: 'college' } },
      }),
    );

    TestBed.inject(EntityServices)
      .getEntityCollectionService<RsvpDto>(EntityNamesEnum.RSVP)
      .addOneToCache(rsvpWithLinkedPartner());

    fixture = TestBed.createComponent(GuestManager);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('opens Manage RSVP, expands the partner card, clicks the real "Open their profile" button, and lands GuestProfileModal on the partner in edit mode', async () => {
    // "Manage RSVP" — itself a real production entry point (the profile
    // summary card / footer button), not a shortcut invented for this test.
    fixture.componentInstance.openManageRsvp('guest-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Expand the partner's card — the primary guest's is open by default,
    // mirroring `manage-rsvp-modal.spec.ts`'s `openPartnerCard()` pattern.
    const heads = fixture.nativeElement.querySelectorAll(
      'app-manage-rsvp-modal app-rsvp-editor .card-head',
    ) as NodeListOf<HTMLButtonElement>;
    expect(heads.length).toBe(2);
    heads[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // The real button in the rendered DOM — not `requestProfile()` or
    // `openGuestProfileEdit()` called directly.
    const trigger = fixture.nativeElement.querySelector(
      'app-manage-rsvp-modal app-rsvp-editor .name-hint .profile-link',
    ) as HTMLButtonElement | null;
    expect(trigger).not.toBeNull();

    trigger!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // The manage-RSVP overlay swapped for the profile overlay (the two
    // dialogs are never stacked).
    expect(fixture.componentInstance.manageRsvpModal.isOpen()).toBe(false);
    expect(fixture.componentInstance.profileModal.isOpen()).toBe(true);

    // The rendered edit-mode form, not `profileModal.editDraft()` read
    // internally: this is the assertion that would have caught a data-shape
    // mismatch or an unbound `(openProfile)`/`(back)` event that reading the
    // signal directly could not.
    const eyebrow = fixture.nativeElement.querySelector(
      'app-guest-profile-modal .modal-eyebrow',
    ) as HTMLElement;
    expect(eyebrow.textContent?.trim().startsWith('guest_manager.modal.editProfile')).toBe(true);

    const textInputs = Array.from(
      fixture.nativeElement.querySelectorAll(
        'app-guest-profile-modal input[app-input][type="text"]',
      ),
    ) as HTMLInputElement[];
    // firstName (0), lastName (1) — guest-2's values, proving the jump
    // carried the *partner's* id through every hop, not the primary guest's.
    expect(textInputs[0]?.value).toBe('Diego');
    expect(textInputs[1]?.value).toBe('Ferrer');
  });
});

/**
 * T332 — the table is a real ARIA table, which is what makes `aria-sort` legal
 * (T331 declined to add it for exactly this reason). `role="table"` rather than
 * `role="grid"`: nothing here is cell-navigable. The roles ride the existing
 * layout divs because `.table-body` is the scroll container and a scrollable
 * `<tbody>` would need `display: block`, which destroys native table layout.
 *
 * `lastSeen` gating is untouched by any of this: the "Last seen" column stays
 * couple-only through the `guests` route's `rbacGuard`, never through the
 * field's presence (hub ADR-0035/0036, CLAUDE.md rule 16), and the restructure
 * adds no control that writes or clears it.
 */
describe('GuestManager — ARIA table semantics (T332)', () => {
  const relation = { side: 'bride', kind: 'family', link: 'sister' } as const;

  function clickHeader(fixture: ComponentFixture<GuestManager>, column: string): void {
    const btn = fixture.nativeElement.querySelector(
      `.table-header .col-${column} .col-sort`,
    ) as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();
  }

  function headerSort(fixture: ComponentFixture<GuestManager>, column: string): string | null {
    const header = fixture.nativeElement.querySelector(
      `.table-header .col-${column}`,
    ) as HTMLElement;
    return header.getAttribute('aria-sort');
  }

  it('names the container as a table', async () => {
    const fixture = await createGuestManager([profile()]);

    const table = fixture.nativeElement.querySelector('.table-container') as HTMLElement;

    expect(table.getAttribute('role')).toBe('table');
    expect(table.getAttribute('aria-label')?.length).toBeGreaterThan(0);
    // Deliberately absent (T332): the rendered rows are the whole set the user
    // chose to load, and the `aria-live` footer already carries the remainder.
    expect(table.getAttribute('aria-rowcount')).toBeNull();
  });

  it('exposes the header as a row of seven column headers', async () => {
    const fixture = await createGuestManager([profile()]);

    const header = fixture.nativeElement.querySelector('.table-header') as HTMLElement;

    expect(header.getAttribute('role')).toBe('row');
    expect(header.querySelectorAll('[role="columnheader"]')).toHaveLength(7);
  });

  it('makes the scrolling body a rowgroup that a keyboard user can reach', async () => {
    const fixture = await createGuestManager([profile()]);

    const body = fixture.nativeElement.querySelector('.table-body') as HTMLElement;

    expect(body.getAttribute('role')).toBe('rowgroup');
    // WCAG 2.1.1: the region scrolls, so it needs a tab stop and a name of its
    // own — its focusable children alone are not the region.
    expect(body.getAttribute('tabindex')).toBe('0');
    expect(body.getAttribute('aria-label')?.length).toBeGreaterThan(0);
  });

  it('marks the default sort on the guest header and "none" on the other sortable ones', async () => {
    const fixture = await createGuestManager([profile()]);

    expect(headerSort(fixture, 'guest')).toBe('ascending');
    expect(headerSort(fixture, 'status')).toBe('none');
    expect(headerSort(fixture, 'adults')).toBe('none');
    expect(headerSort(fixture, 'children')).toBe('none');
    expect(headerSort(fixture, 'last-seen')).toBe('none');
  });

  it('leaves the placeholder columns with no aria-sort at all', async () => {
    const fixture = await createGuestManager([profile()]);

    // "none" would claim "sortable, not currently sorted" — a lie about two
    // columns that render a constant placeholder (T331).
    expect(headerSort(fixture, 'dietary')).toBeNull();
    expect(headerSort(fixture, 'table')).toBeNull();
  });

  it('flips the active header to descending on a second click', async () => {
    const fixture = await createGuestManager([profile()]);

    clickHeader(fixture, 'guest');

    expect(headerSort(fixture, 'guest')).toBe('descending');
  });

  it('moves aria-sort to the new column and returns the old one to "none"', async () => {
    const fixture = await createGuestManager([profile()]);

    clickHeader(fixture, 'adults');

    expect(headerSort(fixture, 'adults')).toBe('ascending');
    expect(headerSort(fixture, 'guest')).toBe('none');
  });

  it('exposes a data row as a row of seven cells, and no longer as a button', async () => {
    const fixture = await createGuestManager([
      profile({
        id: 'g1',
        firstName: 'Laura',
        lastName: 'Mendoza',
        guestInfo: { relation, rsvp: { id: 'g1', status: 'attending', adults: 2 } },
      }),
    ]);

    const row = fixture.nativeElement.querySelector('.table-row') as HTMLElement;

    expect(row.getAttribute('role')).toBe('row');
    expect(row.querySelectorAll(':scope > [role="cell"]')).toHaveLength(7);
    // A `role="row"` cannot also be a button — the keyboard path moved into the
    // first cell.
    expect(row.getAttribute('role')).not.toBe('button');
    expect(row.getAttribute('tabindex')).toBeNull();
  });

  it('wraps the guest name in a button, so the control announces as that guest', async () => {
    const fixture = await createGuestManager([
      profile({ id: 'g1', firstName: 'Laura', lastName: 'Mendoza' }),
    ]);
    const openSpy = vi.spyOn(fixture.componentInstance.profileModal, 'open');

    const btn = fixture.nativeElement.querySelector(
      '.table-row .col-guest button.row-open-btn',
    ) as HTMLButtonElement;

    expect(btn).not.toBeNull();
    expect(btn.textContent?.trim()).toBe('Laura Mendoza');

    btn.click();
    fixture.detectChanges();

    // Once, not twice: the button stops the click from also reaching the row's
    // own pointer handler.
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith('g1');
  });

  it('keeps the row itself clickable for a pointer user', async () => {
    const fixture = await createGuestManager([
      profile({ id: 'g1', firstName: 'Laura', lastName: 'Mendoza' }),
    ]);
    const openSpy = vi.spyOn(fixture.componentInstance.profileModal, 'open');

    const row = fixture.nativeElement.querySelector('.table-row') as HTMLElement;
    row.click();
    fixture.detectChanges();

    expect(openSpy).toHaveBeenCalledWith('g1');
  });

  it('gives "Load more" and "End of list" full-width row/cell semantics', async () => {
    const many = Array.from({ length: 13 }, (_, i) =>
      profile({ id: `g${i}`, firstName: 'Ana', lastName: `Guest${String(i).padStart(2, '0')}` }),
    );
    // Both rows are cursor-driven (ADR W-0009), so the list read has to answer
    // with a cursor for "Load more" to exist at all.
    const fixture = await createGuestManager([]);
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((req) => req.method === 'GET' && req.url.endsWith('/v1/profile'))
      .flush({ items: many, nextCursor: 'cursor-1', count: many.length, profiles: many });
    await fixture.whenStable();
    fixture.detectChanges();

    // A `rowgroup`'s children must be rows, so each of these three is a row
    // holding one cell spanning the table — the ARIA form of `<td colspan="7">`.
    const loadMoreRow = fixture.nativeElement.querySelector('.load-more-row') as HTMLElement;
    expect(loadMoreRow.getAttribute('role')).toBe('row');
    const loadMoreCell = loadMoreRow.querySelector('[role="cell"]') as HTMLElement;
    expect(loadMoreCell.getAttribute('aria-colspan')).toBe('7');
    expect(loadMoreCell.querySelector('.load-more-btn')).not.toBeNull();

    (loadMoreCell.querySelector('.load-more-btn') as HTMLButtonElement).click();
    await fixture.whenStable();
    http
      .expectOne((req) => req.method === 'GET' && req.url.endsWith('/v1/profile'))
      .flush({ items: [], nextCursor: null, count: 0, profiles: [] });
    await fixture.whenStable();
    fixture.detectChanges();

    const endRow = fixture.nativeElement.querySelector('.end-of-list') as HTMLElement;
    expect(endRow.getAttribute('role')).toBe('row');
    expect(endRow.querySelector('[role="cell"]')?.getAttribute('aria-colspan')).toBe('7');
  });

  it('gives the empty state the same full-width row/cell semantics', async () => {
    const fixture = await createGuestManager([]);
    // "No guests" is only true once the API has answered: until then the
    // screen shows the in-place loader in the content region, not an empty
    // table.
    TestBed.inject(HttpTestingController)
      .expectOne((req) => req.method === 'GET' && req.url.endsWith('/v1/profile'))
      .flush({ items: [], nextCursor: null, count: 0, profiles: [] });
    await fixture.whenStable();
    fixture.detectChanges();

    const emptyRow = fixture.nativeElement.querySelector('.empty-state') as HTMLElement;

    expect(emptyRow.getAttribute('role')).toBe('row');
    expect(emptyRow.querySelector('[role="cell"]')?.getAttribute('aria-colspan')).toBe('7');
  });
});

/**
 * T333 — the sort headers, the filter chips and "add guest" are native
 * `<button>`s, which the browser already activates from the keyboard on its
 * own: pressing Enter (or releasing Space) makes it dispatch a synthetic
 * `click`. Any extra `(keydown.enter)`/`(keydown.space)` binding on such a host
 * is therefore not a keyboard affordance but a second invocation of the same
 * handler — visibly fatal on `toggleSort`, which is a toggle, so the two calls
 * cancel and a keyboard user sees the sort never change.
 *
 * **Why every test below dispatches a keydown AND a click.** These specs run in
 * jsdom, which does *not* synthesize the click a real browser would fire from a
 * keydown on a button. Dispatching only the keydown would observe exactly one
 * handler call and pass identically with the bug present — an unfalsifiable
 * test. The two-event sequence is the browser's actual behaviour, and it is the
 * only thing that distinguishes one invocation from two here. Do not
 * "simplify" it away. (Same reasoning as
 * `shared/confirm-dialog/confirm-dialog.spec.ts`, which simulates a real
 * auto-repeat key sequence for the same reason.)
 */
describe('GuestManager — keyboard activation fires each handler once (T333)', () => {
  // Sibling of the `clickHeader` helper above: same target, but the full
  // browser key sequence (keydown, then the click the browser derives from it)
  // instead of a bare pointer click.
  function pressHeader(
    fixture: ComponentFixture<GuestManager>,
    column: string,
    key: 'Enter' | ' ',
  ): void {
    const btn = fixture.nativeElement.querySelector(
      `.table-header .col-${column} .col-sort`,
    ) as HTMLButtonElement;
    btn.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    btn.click();
    fixture.detectChanges();
  }

  function headerSort(fixture: ComponentFixture<GuestManager>, column: string): string | null {
    const header = fixture.nativeElement.querySelector(
      `.table-header .col-${column}`,
    ) as HTMLElement;
    return header.getAttribute('aria-sort');
  }

  it('sorts once when Enter activates a column header', async () => {
    const fixture = await createGuestManager([
      profile({ id: 'g1', firstName: 'Zoe', lastName: 'Alvarez' }),
      profile({ id: 'g2', firstName: 'Ana', lastName: 'Perez' }),
    ]);

    expect(headerSort(fixture, 'guest')).toBe('ascending');

    pressHeader(fixture, 'guest', 'Enter');

    // One toggle, not two: two would flip to descending and straight back,
    // leaving the keyboard user with a sort that never moves.
    expect(headerSort(fixture, 'guest')).toBe('descending');
    expect(
      Array.from(
        fixture.nativeElement.querySelectorAll('.table-row .guest-name') as NodeListOf<HTMLElement>,
      ).map((el) => el.textContent?.trim()),
    ).toEqual(['Ana Perez', 'Zoe Alvarez']);
  });

  it('sorts once when Space activates a column header', async () => {
    const fixture = await createGuestManager([
      profile({ id: 'g1', firstName: 'Zoe', lastName: 'Alvarez' }),
      profile({ id: 'g2', firstName: 'Ana', lastName: 'Perez' }),
    ]);

    pressHeader(fixture, 'adults', ' ');

    expect(headerSort(fixture, 'adults')).toBe('ascending');
    expect(headerSort(fixture, 'guest')).toBe('none');
  });

  it('opens the create modal exactly once when Enter activates "add guest"', async () => {
    const fixture = await createGuestManager([profile()]);
    const openSpy = vi.spyOn(fixture.componentInstance.createModal, 'open');

    const btn = fixture.nativeElement.querySelector('.add-btn') as HTMLButtonElement;
    btn.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    btn.click();
    fixture.detectChanges();

    // The call count is the assertion, deliberately: `GuestCreateModal.open()`
    // is idempotent, so counting modals in the DOM would find one either way
    // and prove nothing about the double invocation.
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('opens the create modal exactly once when Space activates "add guest"', async () => {
    const fixture = await createGuestManager([profile()]);
    const openSpy = vi.spyOn(fixture.componentInstance.createModal, 'open');

    const btn = fixture.nativeElement.querySelector('.add-btn') as HTMLButtonElement;
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    btn.click();
    fixture.detectChanges();

    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('runs the filter handler exactly once when a chip is activated from the keyboard', async () => {
    const fixture = await createGuestManager([profile()]);
    const filterSpy = vi.spyOn(fixture.componentInstance, 'setFilter');

    // Second chip: "attending". `setFilter` is idempotent too, so asserting on
    // the rendered filter state would pass with the bug present — the count is
    // what distinguishes one invocation from two.
    const chip = fixture.nativeElement.querySelectorAll('.filter-btn')[1] as HTMLButtonElement;
    chip.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    chip.click();
    fixture.detectChanges();

    expect(filterSpy).toHaveBeenCalledTimes(1);
    expect(filterSpy).toHaveBeenCalledWith('attending');
  });
});

/**
 * The in-place loading state: while the screen's first profile read is in
 * flight there is nothing honest to draw below the header — the filter chips
 * would all read "· 0" — so the content region draws its own shape with the
 * unknowns as skeletons instead of either lying or blanking. What must hold is
 * that no *real* row is on screen (the placeholder rows carry no open button),
 * and that the state is scoped to the *first* read with an empty cache: a later
 * page, or rows another screen already primed the shared collection with, must
 * never be replaced by placeholders.
 */
describe('GuestManager — in-place loading state', () => {
  it('draws placeholders instead of rows while the first read is in flight, then restores', async () => {
    const fixture = await createGuestManager([]);

    expect(fixture.nativeElement.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    // Placeholder rows, but not one real guest: the open button is what makes a
    // row real, and the placeholders deliberately carry none.
    expect(fixture.nativeElement.querySelectorAll('.table-row').length).toBeGreaterThan(0);
    expect(fixture.nativeElement.querySelector('.row-open-btn')).toBeNull();
    // The header used to be asserted here ("not part of the content region,
    // stays on screen"). Since T341 (hub ADR-0042 §1/§2) it is pinned via
    // `*appScreenHead` and rendered by `PrivateLayout`, not by this screen —
    // it never renders inside `GuestManager`'s own fixture at all, mounted
    // standalone as this one is. That is now `PrivateLayout`'s own pinning
    // contract, proven end-to-end with the real `GuestManager` in
    // `layouts/private-layout/screen-chrome.spec.ts`. See
    // `ScreenChromeHarness`, used below, for how *this* spec still asserts
    // on the header's own content (the stat counts) without mounting the
    // full layout.

    TestBed.inject(HttpTestingController)
      .expectOne((req) => req.method === 'GET' && req.url.endsWith('/v1/profile'))
      .flush({ items: [profile()], nextCursor: null, count: 1, profiles: [profile()] });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.skeleton').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.table-row').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.row-open-btn')).not.toBeNull();
  });

  it('keeps rows already in the shared cache on screen instead of replacing them', async () => {
    // `createGuestManager` primes the collection before the component mounts,
    // exactly as a screen visited earlier would have.
    const fixture = await createGuestManager([profile()]);

    expect(fixture.nativeElement.querySelectorAll('.skeleton').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.table-row').length).toBe(1);
  });
});

/**
 * T341 (hub ADR-0042 §1/§2) — `GuestManager`'s `<header class="header">` and
 * `.list-footer` are pinned via `*appScreenHead` / `*appScreenFoot`
 * (`guest-manager.html`), so `AppScreenHead`/`AppScreenFoot` only register
 * the `TemplateRef` with `ScreenChromeService`; neither renders in place.
 * Mounted standalone the way every other test above does, this screen's own
 * fixture therefore never shows that content at all — not because it is
 * wrong, but because nothing in the fixture ever asks `ScreenChromeService`
 * what to render (`PrivateLayout` is the only thing that does, in
 * production). `ScreenChromeHarness` (`core/directive/screen-chrome-harness
 * .ts`) reproduces just enough of that rendering to let this spec assert on
 * the pinned content anyway — the shared harness T341 decided once so every
 * screen T343 migrates does not invent its own workaround.
 */
@Component({
  selector: 'app-guest-manager-chrome-host',
  imports: [ScreenChromeHarness, GuestManager],
  template: `<app-screen-chrome-harness><app-guest-manager /></app-screen-chrome-harness>`,
})
class GuestManagerChromeHost {}

describe('GuestManager — pinned head/foot content, via the projected-chrome harness (T341)', () => {
  async function createHost(
    profiles: UserProfileDto[],
  ): Promise<ComponentFixture<GuestManagerChromeHost>> {
    await TestBed.configureTestingModule({
      imports: [GuestManagerChromeHost],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        provideStore(),
        provideEffects(),
        provideEntityData(entityConfig, withEffects()),
        provideEntityDataServices(),
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    const collection = TestBed.inject(EntityServices).getEntityCollectionService<UserProfileDto>(
      EntityNamesEnum.USER_PROFILE,
    );
    for (const p of profiles) collection.addOneToCache(p);

    const fixture = TestBed.createComponent(GuestManagerChromeHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('renders the pinned header through the harness, outside <app-guest-manager> itself', async () => {
    const fixture = await createHost([profile()]);
    const host = fixture.nativeElement as HTMLElement;

    const screen = host.querySelector('app-guest-manager') as HTMLElement;
    const header = host.querySelector('.header');

    expect(header).not.toBeNull();
    expect(screen.contains(header)).toBe(false);
  });

  it('renders the real guest count in the pinned header', async () => {
    const fixture = await createHost([profile(), profile({ id: 'guest-2', lastName: 'Alvarez' })]);
    const host = fixture.nativeElement as HTMLElement;

    const totalValue = host.querySelector('.stat-group .stat-value');
    expect(totalValue?.textContent?.trim()).toBe('2');
  });

  it('renders the pinned footer through the harness, outside <app-guest-manager> itself, showing the real (non-empty) result state', async () => {
    const fixture = await createHost([profile()]);
    const host = fixture.nativeElement as HTMLElement;

    const screen = host.querySelector('app-guest-manager') as HTMLElement;
    const footer = host.querySelector('.list-footer');

    expect(footer).not.toBeNull();
    expect(screen.contains(footer)).toBe(false);
    // No translation is loaded (see `createHost`), so this reads the key
    // itself rather than the rendered copy — what matters here is which
    // branch rendered: "showing" (rows present), never "noResults" (there is
    // one seeded guest).
    expect(footer!.querySelector('.list-footer-info')?.textContent).toContain(
      'guest_manager.list.showing',
    );
    expect(footer!.querySelector('.list-footer-info')?.textContent).not.toContain(
      'guest_manager.list.noResults',
    );
  });
});
