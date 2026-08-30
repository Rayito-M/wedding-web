import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideEffects } from '@ngrx/effects';
import { EntityServices, provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  EntityNamesEnum,
  RsvpDto,
  UserProfileDto,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { GuestManager } from './guest-manager';

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

async function createGuestManager(profiles: UserProfileDto[]): Promise<ComponentFixture<GuestManager>> {
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
 * `paginatedGuests` in place, toggling direction on a repeat click of the
 * same column and resetting to ascending on a switch to a different one.
 */
describe('GuestManager — column sort', () => {
  const relation = { side: 'bride', kind: 'family', link: 'sister' } as const;

  function rowNames(fixture: ComponentFixture<GuestManager>): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.table-row .guest-name') as NodeListOf<HTMLElement>,
    ).map((el) => el.textContent?.trim() ?? '');
  }

  function clickHeader(fixture: ComponentFixture<GuestManager>, column: string): void {
    const btn = fixture.nativeElement.querySelector(
      `.table-header .col-${column}`,
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
        partner1: { id: 'guest-1', firstName: 'Laura', lastName: 'Mendoza', options: {} },
        partner2: {
          id: 'guest-2',
          firstName: 'Diego',
          lastName: 'Ferrer',
          options: {},
          kind: 'guest',
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

    const profileCollection = TestBed.inject(EntityServices).getEntityCollectionService<UserProfileDto>(
      EntityNamesEnum.USER_PROFILE,
    );
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
