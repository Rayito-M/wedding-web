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
  CreateWeddingConfigDtoVenuesInner,
  WeddingConfigResponseDto,
  WeddingConfigurationService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { Schedule } from './schedule';

function venue(overrides: Partial<CreateWeddingConfigDtoVenuesInner> = {}): CreateWeddingConfigDtoVenuesInner {
  return {
    id: 'v1',
    name: "St. Anne's Church",
    country: 'Spain',
    city: 'Granada',
    postalCode: '18001',
    address: 'Calle Real 1',
    mapUrl: '',
    type: CreateWeddingConfigDtoVenuesInner.TypeEnum.CEREMONY,
    ...overrides,
  };
}

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

describe('Schedule — venue line (T295)', () => {
  let fixture: ComponentFixture<Schedule>;
  let currentConfig: WeddingConfigResponseDto;

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Schedule],
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
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    fixture = TestBed.createComponent(Schedule);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function queryAll<T extends HTMLElement>(selector: string): T[] {
    return Array.from(fixture.nativeElement.querySelectorAll(selector)) as T[];
  }

  it('renders the venue name for an item whose venueId matches a venue', async () => {
    currentConfig = {
      ...BASE_CONFIG,
      venues: [venue({ id: 'v1', name: "St. Anne's Church" })],
      agenda: { status: 'final', items: [agendaItem({ id: 'a1', venueId: 'v1' })] },
    };
    await create();

    const rows = queryAll('app-timeline-item');
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector('.item-venue')?.textContent?.trim()).toBe("St. Anne's Church");
  });

  it('renders no venue line for an item with venueId null', async () => {
    currentConfig = {
      ...BASE_CONFIG,
      venues: [venue({ id: 'v1' })],
      agenda: { status: 'final', items: [agendaItem({ id: 'a1', venueId: null })] },
    };
    await create();

    const rows = queryAll('app-timeline-item');
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector('.item-venue')).toBeNull();
  });

  it('renders no venue line for an item whose venueId matches no venue', async () => {
    currentConfig = {
      ...BASE_CONFIG,
      venues: [venue({ id: 'v1' })],
      agenda: { status: 'final', items: [agendaItem({ id: 'a1', venueId: 'does-not-exist' })] },
    };
    await create();

    const rows = queryAll('app-timeline-item');
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector('.item-venue')).toBeNull();
  });

  it('renders sub and venue together, sub first', async () => {
    currentConfig = {
      ...BASE_CONFIG,
      venues: [venue({ id: 'v1', name: 'Riverside Gardens' })],
      agenda: {
        status: 'final',
        items: [
          agendaItem({
            id: 'a1',
            venueId: 'v1',
            desc: { es: 'Ceremonia al aire libre', en: 'Outdoor ceremony', fr: 'Cérémonie en plein air' },
          }),
        ],
      },
    };
    await create();

    const row = queryAll('app-timeline-item')[0];
    const sub = row.querySelector('.item-sub');
    const venueLine = row.querySelector('.item-venue');
    expect(sub?.textContent?.trim()).toBe('Outdoor ceremony');
    expect(venueLine?.textContent?.trim()).toBe('Riverside Gardens');

    // sub must precede venue in document order (DS: venue is the *second* subtitle).
    expect(
      sub!.compareDocumentPosition(venueLine!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
