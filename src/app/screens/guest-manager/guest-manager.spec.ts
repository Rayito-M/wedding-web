import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideEffects } from '@ngrx/effects';
import { EntityServices, provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { EntityNamesEnum, UserProfileDto, entityConfig, provideEntityDataServices } from '@app/core';

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
