import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { EntityServices, provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  EntityNamesEnum,
  LoginService,
  TranslateLanguageService,
  UserProfileDto,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { People } from './people';

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

/**
 * T301 — the `filteredPeople` search predicate also matches `person.nickname`,
 * folded into the same lowercased name string, mirroring DS `ScreenPeople.jsx`'s
 * `${firstName} ${lastName} ${pseudo || ''}` join.
 */
describe('People — search matches on nickname (T301)', () => {
  let fixture: ComponentFixture<People>;

  async function create(profiles: UserProfileDto[]): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [People],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        provideStore(),
        provideEffects(),
        provideEntityData(entityConfig, withEffects()),
        provideEntityDataServices(),
        {
          // Not relevant to the nickname search predicate — kept off so the
          // couple-only last-seen block never renders in this test.
          // `currentUserClaims` backs `isMine`; no profile here matches its
          // fixed `id`, so it stays a no-op for these assertions.
          provide: LoginService,
          useValue: { isCouple: signal(false), currentUserClaims: () => undefined },
        },
        {
          provide: TranslateLanguageService,
          useValue: { currentLang: signal('en') },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    const collection = TestBed.inject(EntityServices).getEntityCollectionService<UserProfileDto>(
      EntityNamesEnum.USER_PROFILE,
    );
    for (const p of profiles) collection.addOneToCache(p);

    fixture = TestBed.createComponent(People);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function cardNames(): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.card .name') as NodeListOf<HTMLElement>,
    ).map((el) => el.textContent?.trim() ?? '');
  }

  function search(query: string): void {
    const input = fixture.nativeElement.querySelector('.search') as HTMLInputElement;
    input.value = query;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('matches a person whose nickname contains the query, even when the name does not', async () => {
    await create([
      profile({ id: 'g1', firstName: 'Laura', lastName: 'Mendoza', nickname: 'Lau' }),
      profile({ id: 'g2', firstName: 'Diego', lastName: 'Ferrer' }),
    ]);

    search('lau');

    expect(cardNames()).toEqual(['Laura Mendoza']);
  });

  it('is case-insensitive on the nickname', async () => {
    await create([profile({ id: 'g1', firstName: 'Julien', lastName: 'Roux', nickname: 'Ju' })]);

    search('JU');

    expect(cardNames()).toEqual(['Julien Roux']);
  });

  it('excludes a person with no matching name, nickname or relation', async () => {
    await create([profile({ id: 'g1', firstName: 'Laura', lastName: 'Mendoza', nickname: 'Lau' })]);

    search('zzz');

    expect(cardNames()).toEqual([]);
  });
});
