import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideEffects } from '@ngrx/effects';
import { provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  CreateWeddingConfigDtoAgendaItemsInner,
  WeddingConfigResponseDto,
  WeddingConfigurationService,
  WeddingUsersService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { ConfigManager } from './config-manager';

function agendaItem(
  overrides: Partial<CreateWeddingConfigDtoAgendaItemsInner> = {},
): CreateWeddingConfigDtoAgendaItemsInner {
  return {
    id: 'a1',
    status: CreateWeddingConfigDtoAgendaItemsInner.StatusEnum.CONFIRMED,
    time: '2027-06-05T09:00:00.000Z',
    title: { es: 'ES título', en: 'EN title', fr: 'FR titre' },
    desc: { es: 'ES desc', en: 'EN desc', fr: 'FR desc' },
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
 * T297: the agenda/dietary tab bar is gone — every language is edited
 * side-by-side (narrow layout, exercised here, stacks them vertically), the
 * "Key moment" toggle drives `highlight`, and an All/Key moments/Optional
 * filter narrows the agenda card list.
 */
describe('ConfigManager — all-languages editor & key moments (T297)', () => {
  let fixture: ComponentFixture<ConfigManager>;
  let currentConfig: WeddingConfigResponseDto;

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ConfigManager],
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
        {
          provide: WeddingUsersService,
          useValue: { usersControllerListV1: () => of({ items: [] }) },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    fixture = TestBed.createComponent(ConfigManager);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function selectSection(index: number): void {
    // Section order is fixed (`SECTIONS`): basics, couple, venues, agenda,
    // hotels, dietary, appearance — index 3 is agenda, 5 is dietary.
    const items = queryAll<HTMLButtonElement>('.rail-item');
    items[index].click();
    fixture.detectChanges();
  }

  function queryAll<T extends HTMLElement>(selector: string): T[] {
    return Array.from(fixture.nativeElement.querySelectorAll(selector)) as T[];
  }

  function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    el.value = value;
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('editing one language on an agenda card leaves the other two untouched', async () => {
    currentConfig = {
      ...BASE_CONFIG,
      agenda: { status: 'final', items: [agendaItem()] },
    };
    await create();
    selectSection(3); // agenda

    // Narrow layout: `.ml-stack-group` #1 is the title stack, in `editLangs`
    // order (es, en, fr).
    const titleInputs = queryAll<HTMLInputElement>('.ml-stack-group')[0].querySelectorAll('input');
    expect(titleInputs.length).toBe(3);
    expect(titleInputs[0].value).toBe('ES título');
    expect(titleInputs[1].value).toBe('EN title');
    expect(titleInputs[2].value).toBe('FR titre');

    setValue(titleInputs[0], 'ES título editado');

    const after = queryAll<HTMLInputElement>('.ml-stack-group')[0].querySelectorAll('input');
    expect(after[0].value).toBe('ES título editado');
    expect(after[1].value).toBe('EN title');
    expect(after[2].value).toBe('FR titre');
  });

  it('adding a dietary option fills all three languages', async () => {
    currentConfig = {
      ...BASE_CONFIG,
      dietaryPreferences: [],
    };
    await create();
    selectSection(5); // dietary

    const addInput = queryAll<HTMLInputElement>('.option-add-input')[0];
    setValue(addInput, 'Vegan');
    addInput.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    const optionCards = queryAll<HTMLElement>('.tag-editor')[0].querySelectorAll('.option-card');
    expect(optionCards.length).toBe(1);
    const inputs = optionCards[0].querySelectorAll('input');
    expect(inputs.length).toBe(3);
    expect(inputs[0].value).toBe('Vegan');
    expect(inputs[1].value).toBe('Vegan');
    expect(inputs[2].value).toBe('Vegan');
  });

  it('the Key moment toggle flips `highlight` and draws the accent border', async () => {
    currentConfig = {
      ...BASE_CONFIG,
      agenda: { status: 'final', items: [agendaItem({ highlight: false })] },
    };
    await create();
    selectSection(3);

    const card = queryAll<HTMLElement>('.card-list .card')[0];
    expect(card.classList.contains('key-moment')).toBe(false);

    card.querySelector<HTMLButtonElement>('button[app-toggle]')!.click();
    fixture.detectChanges();

    expect(card.classList.contains('key-moment')).toBe(true);
  });

  it('the agenda filter narrows the card list, with live counts and an empty state', async () => {
    currentConfig = {
      ...BASE_CONFIG,
      agenda: {
        status: 'final',
        items: [
          agendaItem({ id: 'a1', time: '2027-06-05T09:00:00.000Z', highlight: true }),
          agendaItem({ id: 'a2', time: '2027-06-05T10:00:00.000Z', highlight: true }),
          agendaItem({ id: 'a3', time: '2027-06-05T11:00:00.000Z', highlight: false }),
        ],
      },
    };
    await create();
    selectSection(3);

    const [allBtn, keyMomentsBtn, optionalBtn] = queryAll<HTMLButtonElement>(
      '.segmented.agenda-filter .segment',
    );

    expect(queryAll('.card-list .card:not(.empty-filter)').length).toBe(3);

    keyMomentsBtn.click();
    fixture.detectChanges();
    expect(queryAll('.card-list .card:not(.empty-filter)').length).toBe(2);

    optionalBtn.click();
    fixture.detectChanges();
    expect(queryAll('.card-list .card:not(.empty-filter)').length).toBe(1);

    allBtn.click();
    fixture.detectChanges();
    expect(queryAll('.card-list .card:not(.empty-filter)').length).toBe(3);
  });

  it('shows the dashed empty-filter card when a filter matches nothing', async () => {
    currentConfig = {
      ...BASE_CONFIG,
      agenda: {
        status: 'final',
        items: [agendaItem({ id: 'a1', highlight: false })],
      },
    };
    await create();
    selectSection(3);

    const [, keyMomentsBtn] = queryAll<HTMLButtonElement>('.segmented.agenda-filter .segment');
    keyMomentsBtn.click();
    fixture.detectChanges();

    expect(queryAll('.card-list .card:not(.empty-filter)').length).toBe(0);
    expect(queryAll('.card-list .card.empty-filter').length).toBe(1);
  });
});

describe('ConfigManager — EDIT_LANGS order (T297)', () => {
  let fixture: ComponentFixture<ConfigManager>;
  let currentConfig: WeddingConfigResponseDto;

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ConfigManager],
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
        {
          provide: WeddingUsersService,
          useValue: { usersControllerListV1: () => of({ items: [] }) },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    fixture = TestBed.createComponent(ConfigManager);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders the es/en/fr language chips in that order (es-first, hub ADR-0009)', async () => {
    currentConfig = {
      ...BASE_CONFIG,
      agenda: { status: 'final', items: [agendaItem()] },
    };
    await create();

    const railItems = Array.from(
      fixture.nativeElement.querySelectorAll('.rail-item'),
    ) as HTMLButtonElement[];
    railItems[3].click();
    fixture.detectChanges();

    const chips = Array.from(
      fixture.nativeElement.querySelectorAll('.ml-stack-group')[0].querySelectorAll('.lang-tag'),
    ) as HTMLElement[];
    expect(chips.map((c) => c.textContent?.trim())).toEqual(['ES', 'EN', 'FR']);
  });
});
