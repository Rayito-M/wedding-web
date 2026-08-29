import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { provideEffects } from '@ngrx/effects';
import { provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  CreateWeddingConfigDtoAgendaItemsInner,
  LoginService,
  TranslateLanguageService,
  WeddingConfigResponseDto,
  WeddingConfigurationService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { Invitee } from './invitee';

function agendaItem(
  overrides: Partial<CreateWeddingConfigDtoAgendaItemsInner> = {},
): CreateWeddingConfigDtoAgendaItemsInner {
  return {
    id: 'a1',
    status: CreateWeddingConfigDtoAgendaItemsInner.StatusEnum.CONFIRMED,
    time: '10:00',
    title: { es: 'Ceremonia', en: 'Ceremony', fr: 'Cérémonie' },
    desc: { es: 'Descripción', en: 'Description', fr: 'Description' },
    venueId: null,
    highlight: false,
    ...overrides,
  };
}

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
 * T297's guest-side bug fix: the home preview's `@for` used to compute
 * `let last = $last` over *every* agenda item while filtering to
 * `event.highlight` inside the loop, so `last` reflected the final agenda
 * item overall, not the final *rendered* (highlighted) row. `invitee.ts`
 * now pre-filters to highlighted items in `highlightedAgendaItems` before
 * the loop runs, mirroring `schedule.ts`'s `items` pattern.
 */
describe('Invitee — home preview last-row bug (T297)', () => {
  let fixture: ComponentFixture<Invitee>;
  let currentConfig: WeddingConfigResponseDto;

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Invitee],
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
          provide: WeddingConfigurationService,
          useValue: { weddingConfigControllerGetV1: () => of(currentConfig) },
        },
        {
          // No signed-in user: the "current RSVP" fetch branch never fires,
          // which is irrelevant to the agenda block under test here.
          provide: LoginService,
          useValue: { currentUserClaims: () => undefined },
        },
        {
          provide: TranslateLanguageService,
          useValue: { currentLang: signal('en') },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    fixture = TestBed.createComponent(Invitee);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function queryAll<T extends HTMLElement>(selector: string): T[] {
    return Array.from(fixture.nativeElement.querySelectorAll(selector)) as T[];
  }

  it('marks the last *rendered* (highlighted) row as last, not the last agenda item overall', async () => {
    currentConfig = {
      ...BASE_CONFIG,
      agenda: {
        status: 'final',
        items: [
          agendaItem({ id: 'a1', time: '10:00', highlight: true }),
          agendaItem({ id: 'a2', time: '12:00', highlight: true }),
          // The final agenda item is *not* a key moment — before the fix,
          // this is the one `$last` would land on, and it never renders.
          agendaItem({ id: 'a3', time: '20:00', highlight: false }),
        ],
      },
    };
    await create();

    const rows = queryAll('app-timeline-item');
    expect(rows.length).toBe(2);

    // Not the last rendered row: still draws its trailing connector.
    expect(rows[0].querySelector('.line')).not.toBeNull();
    // Last rendered row: connector suppressed.
    expect(rows[1].querySelector('.line')).toBeNull();
  });

  it('only renders highlighted agenda items on the home preview', async () => {
    currentConfig = {
      ...BASE_CONFIG,
      agenda: {
        status: 'final',
        items: [
          agendaItem({ id: 'a1', highlight: true }),
          agendaItem({ id: 'a2', highlight: false }),
        ],
      },
    };
    await create();

    expect(queryAll('app-timeline-item').length).toBe(1);
  });
});
