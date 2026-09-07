import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { provideEffects } from '@ngrx/effects';
import { provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  LoginService,
  TranslateLanguageService,
  WeddingConfigResponseDto,
  WeddingConfigurationService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { Invitee } from './invitee';

const BASE_CONFIG: WeddingConfigResponseDto = {
  id: 'config',
  version: 1,
  brideName: 'Sara',
  groomName: 'Christophe',
  tagline: '',
  date: '2027-06-05',
  language: { es: 'Español', en: 'English', fr: 'Français' },
  themeId: WeddingConfigResponseDto.ThemeIdEnum.TERRACOTTA,
  city: 'Granada',
  country: 'Spain',
  rsvpDeadline: '2027-05-01',
  venues: [],
  agenda: { status: 'final', items: [] },
  hotels: [],
  dietaryPreferences: [],
  allergies: [],
  menus: [],
};

/**
 * T372: `Invitee` now owns only Home's pill-row wiring — which section is
 * active — and mounts a shared, full-data-owning component per section:
 * `app-home-today` (default, extracted to `shared/home-today/`, own spec),
 * `app-travel[embedded]`, `app-good-to-know`. This spec covers exactly that
 * composition; the countdown/highlights/RSVP behaviour it used to test
 * directly now lives in `home-today.spec.ts`.
 */
describe('Invitee — Home pill-row composition (T372)', () => {
  let fixture: ComponentFixture<Invitee>;
  let queryParamMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  async function create(params: Record<string, string> = {}): Promise<void> {
    queryParamMap = new BehaviorSubject(convertToParamMap(params));
    await TestBed.configureTestingModule({
      imports: [Invitee],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        provideStore(),
        provideEffects(),
        provideEntityData(entityConfig, withEffects()),
        provideEntityDataServices(),
        {
          provide: WeddingConfigurationService,
          useValue: { weddingConfigControllerGetV1: () => of(BASE_CONFIG) },
        },
        {
          provide: LoginService,
          useValue: { currentUserClaims: () => undefined, isCouple: () => false },
        },
        {
          provide: TranslateLanguageService,
          useValue: { currentLang: signal('en') },
        },
        // Shared by both this screen's own `?section=` read and `app-travel`'s
        // `?place=` read (Travel.spec.ts's own precedent) — a single flat
        // provider, since neither child route actually navigates here.
        { provide: ActivatedRoute, useValue: { queryParamMap } },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    fixture = TestBed.createComponent(Invitee);
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('renders the shared Today content by default', async () => {
    await create();
    expect(fixture.nativeElement.querySelector('app-home-today')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-travel')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-good-to-know')).toBeNull();
  });

  it('renders the embedded Travel screen for the "Getting there" pill', async () => {
    await create({ section: 'travel' });
    expect(fixture.nativeElement.querySelector('app-travel')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-home-today')).toBeNull();
  });

  it('renders Good to know for the "Good to know" pill', async () => {
    await create({ section: 'info' });
    expect(fixture.nativeElement.querySelector('app-good-to-know')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-home-today')).toBeNull();
  });
});
