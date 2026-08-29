import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { EntityServices, provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  CreateWeddingConfigDtoHotelsInner,
  CreateWeddingConfigDtoVenuesInner,
  EntityNamesEnum,
  WeddingConfigResponseDto,
  WeddingConfigurationService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { Travel } from './travel';

function venue(overrides: Partial<CreateWeddingConfigDtoVenuesInner> = {}): CreateWeddingConfigDtoVenuesInner {
  return {
    id: 'venue-1',
    name: 'Iglesia de San Pedro',
    country: 'Spain',
    city: 'Granada',
    postalCode: '18010',
    address: 'Carrera del Darro, 12',
    mapUrl: '',
    type: CreateWeddingConfigDtoVenuesInner.TypeEnum.CEREMONY,
    ...overrides,
  };
}

function hotel(overrides: Partial<CreateWeddingConfigDtoHotelsInner> = {}): CreateWeddingConfigDtoHotelsInner {
  return {
    id: 'hotel-1',
    name: 'Hotel Casa 1800',
    priceTier: CreateWeddingConfigDtoHotelsInner.PriceTierEnum.EURO_EURO,
    distanceKm: 0.6,
    bookingUrl: '',
    photoKey: null,
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
  agenda: { status: 'provisional', items: [] },
  hotels: [],
  dietaryPreferences: [],
  allergies: [],
  menus: [],
};

describe('Travel', () => {
  let fixture: ComponentFixture<Travel>;
  // Read lazily by the `WeddingConfigurationService` stub below.
  let currentConfig: WeddingConfigResponseDto;
  // Drives `?place=` — a subject so a test can navigate to a second link.
  let queryParamMap: BehaviorSubject<ParamMap>;

  async function create(config: WeddingConfigResponseDto, place?: string): Promise<void> {
    currentConfig = config;
    queryParamMap.next(convertToParamMap(place === undefined ? {} : { place }));
    fixture = TestBed.createComponent(Travel);
    fixture.detectChanges();
    await fixture.whenStable();
    // The entity round trip is an async `getByKey()` — flush the microtask
    // queue and run a second CD pass before assertions (same pattern as
    // `rsvp.spec.ts`).
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    queryParamMap = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [Travel],
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
          useValue: { weddingConfigControllerGetV1: () => of(currentConfig) },
        },
        { provide: ActivatedRoute, useValue: { queryParamMap } },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);
    TestBed.inject(EntityServices)
      .getEntityCollectionService<WeddingConfigResponseDto>(EntityNamesEnum.WEDDING_CONFIG)
      .clearCache();
  });

  function venueRows(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.venue-row'));
  }

  function stayButtons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.stay-btn'));
  }

  function mapSrc(): string | null {
    const iframe = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement | null;
    return iframe?.getAttribute('src') ?? null;
  }

  it('builds the venues and stays lists from config, with the venue no longer in the stays list', async () => {
    await create({
      ...BASE_CONFIG,
      venues: [
        venue(),
        venue({
          id: 'venue-2',
          name: 'Palacio de los Córdova',
          type: CreateWeddingConfigDtoVenuesInner.TypeEnum.RECEPTION,
        }),
      ],
      hotels: [hotel()],
    });

    expect(venueRows().length).toBe(2);
    expect(stayButtons().length).toBe(1);
    expect(fixture.nativeElement.textContent).not.toContain('undefined');
  });

  it('selects the first place by default and points the map at it', async () => {
    await create({ ...BASE_CONFIG, venues: [venue()], hotels: [hotel()] });

    const firstRow = venueRows()[0];
    expect(firstRow.getAttribute('aria-pressed')).toBe('true');
    // `mapUrl` is empty on the fixture, so the address fallback is what renders.
    expect(mapSrc()).toContain(encodeURIComponent('Carrera del Darro, 12'));
  });

  it('embeds a "Share \u2192 Embed a map" URL as-is', async () => {
    const mapUrl = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3183.1';
    await create({ ...BASE_CONFIG, venues: [venue({ mapUrl })], hotels: [] });

    expect(mapSrc()).toBe(mapUrl);
  });

  it('pins the map on the coordinates of an address-bar link, which cannot be framed', async () => {
    await create({
      ...BASE_CONFIG,
      venues: [
        venue({
          mapUrl: 'https://www.google.com/maps/place/Iglesia/@37.1761,-3.5881,17z/data=!3m1',
        }),
      ],
      hotels: [],
    });

    expect(mapSrc()).toBe(
      `https://www.google.com/maps?q=${encodeURIComponent('37.1761,-3.5881')}&z=15&output=embed`,
    );
  });

  it('adds the embed switch to a ?q= link', async () => {
    await create({
      ...BASE_CONFIG,
      venues: [venue({ mapUrl: 'https://www.google.com/maps?q=Iglesia+de+San+Pedro' })],
      hotels: [],
    });

    expect(mapSrc()).toBe(
      `https://www.google.com/maps?q=${encodeURIComponent('Iglesia de San Pedro')}&z=15&output=embed`,
    );
  });

  it('falls back to the address when the map link is an opaque share link', async () => {
    await create({
      ...BASE_CONFIG,
      venues: [venue({ mapUrl: 'https://maps.app.goo.gl/aBcDeF12345' })],
      hotels: [],
    });

    expect(mapSrc()).toContain(encodeURIComponent('Carrera del Darro, 12'));
  });

  it('selecting a different row re-centres the map and updates aria-pressed', async () => {
    await create({
      ...BASE_CONFIG,
      venues: [venue()],
      hotels: [hotel({ name: 'Carmen de la Victoria' })],
    });

    const stayButton = stayButtons()[0];
    stayButton.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(stayButton.getAttribute('aria-pressed')).toBe('true');
    expect(venueRows()[0].getAttribute('aria-pressed')).toBe('false');
    expect(mapSrc()).toContain(encodeURIComponent('Carmen de la Victoria, Granada'));
  });

  it('preselects the venue named by ?place=, not the first row', async () => {
    const second = venue({ id: 'venue-2', name: 'Palacio de los Córdova', mapUrl: 'https://www.google.com/maps/embed?pb=!palacio' });
    await create({ ...BASE_CONFIG, venues: [venue(), second], hotels: [] }, 'venue-2');

    expect(venueRows()[0].getAttribute('aria-pressed')).toBe('false');
    expect(venueRows()[1].getAttribute('aria-pressed')).toBe('true');
    expect(mapSrc()).toBe('https://www.google.com/maps/embed?pb=!palacio');
  });

  it('preselects a hotel by ?place= too', async () => {
    await create(
      { ...BASE_CONFIG, venues: [venue()], hotels: [hotel({ id: 'hotel-9', name: 'Carmen de la Victoria' })] },
      'hotel-9',
    );

    expect(stayButtons()[0].getAttribute('aria-pressed')).toBe('true');
    expect(mapSrc()).toContain(encodeURIComponent('Carmen de la Victoria, Granada'));
  });

  it('falls back to the first place when ?place= names nothing in the config', async () => {
    await create({ ...BASE_CONFIG, venues: [venue()], hotels: [] }, 'no-such-id');

    expect(venueRows()[0].getAttribute('aria-pressed')).toBe('true');
    expect(mapSrc()).not.toBeNull();
  });

  it('re-seeds the selection when a different ?place= arrives after a click', async () => {
    await create(
      {
        ...BASE_CONFIG,
        venues: [venue(), venue({ id: 'venue-2' }), venue({ id: 'venue-3' })],
        hotels: [],
      },
      'venue-1',
    );

    // A click overrides the route's choice...
    venueRows()[1].click();
    fixture.detectChanges();
    expect(venueRows()[1].getAttribute('aria-pressed')).toBe('true');

    // ...until a second link (or the back button) names a different place.
    queryParamMap.next(convertToParamMap({ place: 'venue-3' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(venueRows()[2].getAttribute('aria-pressed')).toBe('true');
    expect(venueRows()[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('renders without a broken or blank map when the config has no venues and no hotels', async () => {
    await create({ ...BASE_CONFIG, venues: [], hotels: [] });

    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
    expect(fixture.nativeElement.querySelector('.map-empty')).not.toBeNull();
    expect(venueRows().length).toBe(0);
    expect(stayButtons().length).toBe(0);
  });
});
