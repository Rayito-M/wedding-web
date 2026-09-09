import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { provideEffects } from '@ngrx/effects';
import { provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  CreateWeddingConfigDtoAgendaItemsInner,
  CreateWeddingConfigDtoGoodToKnowInner,
  TranslateLanguageService,
  UpdateWeddingConfigDto,
  WeddingConfigResponseDto,
  WeddingConfigurationService,
  WeddingUsersService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';
import { LangDescriptionType } from '@app/model';

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
  // T364 — `section` is now driven by `?section=` rather than private state
  // (hub ADR-0045 §3, so Manage's desktop `PlanRail` can select a section
  // from outside this component). The `Router.navigate` stub mirrors that
  // one real effect a genuine router call has here — merging `queryParams`
  // into the current `ParamMap` — rather than a bare no-op spy, so
  // `selectSection()` (fired by both the rail buttons this suite already
  // clicks and the mobile pills) is exercised the same way a real
  // navigation would drive it.
  let queryParamMap: BehaviorSubject<ParamMap>;

  async function create(): Promise<void> {
    queryParamMap = new BehaviorSubject<ParamMap>(convertToParamMap({}));

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
        { provide: ActivatedRoute, useValue: { queryParamMap } },
        {
          provide: Router,
          useValue: {
            navigate: (_commands: unknown[], extras?: { queryParams?: Record<string, string> }) => {
              queryParamMap.next(convertToParamMap({ ...extras?.queryParams }));
              return Promise.resolve(true);
            },
          },
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
  let queryParamMap: BehaviorSubject<ParamMap>;

  async function create(): Promise<void> {
    queryParamMap = new BehaviorSubject<ParamMap>(convertToParamMap({}));

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
        { provide: ActivatedRoute, useValue: { queryParamMap } },
        {
          provide: Router,
          useValue: {
            navigate: (_commands: unknown[], extras?: { queryParams?: Record<string, string> }) => {
              queryParamMap.next(convertToParamMap({ ...extras?.queryParams }));
              return Promise.resolve(true);
            },
          },
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

/**
 * T376 (hub ADR-0046 §2/§3/§8) — the eighth Settings section authors the
 * `goodToKnow` blocks: stored order is the couple's (the move buttons are the
 * only ordering mechanism), singleton block types are withheld from the add
 * row rather than 400ing, the FAQ/contacts cardinality floors withhold Save
 * with a message, one typed value pre-fills all three locales (hub ADR-0031),
 * and Save PATCHes the whole array in order through the existing config path.
 */
describe('ConfigManager — Good to know authoring (T376)', () => {
  let fixture: ComponentFixture<ConfigManager>;
  let currentConfig: WeddingConfigResponseDto;
  let queryParamMap: BehaviorSubject<ParamMap>;
  let lastUpdate: UpdateWeddingConfigDto | undefined;

  const localized = (stem: string): LangDescriptionType => ({
    es: `${stem} es`,
    en: `${stem} en`,
    fr: `${stem} fr`,
  });

  const faqBlock = (): CreateWeddingConfigDtoGoodToKnowInner => ({
    id: 'b-faq',
    type: 'faq',
    title: localized('faq title'),
    entries: [1, 2, 3].map((n) => ({
      id: `q${n}`,
      question: localized(`q${n}`),
      answer: localized(`a${n}`),
    })),
  });

  const noteBlock = (): CreateWeddingConfigDtoGoodToKnowInner => ({
    id: 'b-note',
    type: 'note',
    title: localized('note title'),
    body: localized('note body'),
  });

  async function create(): Promise<void> {
    queryParamMap = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    lastUpdate = undefined;

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
          useValue: {
            weddingConfigControllerGetV1: () => of(currentConfig),
            weddingConfigControllerUpdateV1: (args: {
              updateWeddingConfigDto: UpdateWeddingConfigDto;
            }) => {
              lastUpdate = args.updateWeddingConfigDto;
              return of(currentConfig);
            },
          },
        },
        {
          provide: WeddingUsersService,
          useValue: { usersControllerListV1: () => of({ items: [] }) },
        },
        // Pinned so the "primary language" of the locale pre-fill is
        // deterministic, not the test browser's `navigator.language`.
        { provide: TranslateLanguageService, useValue: { currentLang: () => 'en' } },
        { provide: ActivatedRoute, useValue: { queryParamMap } },
        {
          provide: Router,
          useValue: {
            navigate: (_commands: unknown[], extras?: { queryParams?: Record<string, string> }) => {
              queryParamMap.next(convertToParamMap({ ...extras?.queryParams }));
              return Promise.resolve(true);
            },
          },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    fixture = TestBed.createComponent(ConfigManager);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function queryAll<T extends HTMLElement>(selector: string): T[] {
    return Array.from(fixture.nativeElement.querySelectorAll(selector)) as T[];
  }

  function openSection(): void {
    // `SECTIONS` order: index 7 is the eighth section, good-to-know.
    queryAll<HTMLButtonElement>('.rail-item')[7].click();
    fixture.detectChanges();
  }

  function setValue(el: HTMLInputElement, value: string): void {
    el.value = value;
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** The add row's block-type buttons, by the type key their label resolves
   *  from (translations are empty in this suite, so the key renders). */
  function addButton(type: string): HTMLButtonElement {
    const button = queryAll<HTMLButtonElement>('.add-btn').find((b) =>
      b.textContent!.includes(`configManager.goodToKnow.type.${type}`),
    );
    expect(button, `add button for ${type}`).toBeDefined();
    return button!;
  }

  /** Per-block header actions, in template order: move up · move down · remove. */
  function blockActions(cardIndex: number): HTMLButtonElement[] {
    const card = queryAll<HTMLElement>('.card-list > .card')[cardIndex];
    return Array.from(card.querySelectorAll<HTMLButtonElement>('.card-top .couple-action-btn'));
  }

  it('is the eighth rail section and starts as an empty editor offering all six types', async () => {
    currentConfig = { ...BASE_CONFIG };
    await create();

    const rail = queryAll<HTMLButtonElement>('.rail-item');
    expect(rail.length).toBe(8);
    expect(rail[7].textContent).toContain('08');

    openSection();
    expect(queryAll('.card-list > .card').length).toBe(0);
    expect(queryAll('.add-btn').length).toBe(6);
  });

  it('withholds a singleton type that already exists, and the add row at the 12-block cap', async () => {
    currentConfig = { ...BASE_CONFIG };
    await create();
    openSection();

    addButton('dress-code').click();
    fixture.detectChanges();

    expect(queryAll('.card-list > .card').length).toBe(1);
    // dress-code is at-most-once and no longer offered; faq stays repeatable.
    const remaining = queryAll<HTMLButtonElement>('.add-btn')
      .filter((b) => b.textContent!.includes('configManager.goodToKnow.type.'))
      .map((b) => b.textContent!.trim());
    expect(remaining.some((label) => label.includes('type.dress-code'))).toBe(false);
    expect(remaining.some((label) => label.includes('type.faq'))).toBe(true);
    expect(remaining.some((label) => label.includes('type.gift'))).toBe(true);

    // Fill to the 12-block cap with repeatable notes: the add row disappears.
    for (let i = 0; i < 11; i++) {
      addButton('note').click();
      fixture.detectChanges();
    }
    expect(queryAll('.card-list > .card').length).toBe(12);
    expect(queryAll('.add-btn').length).toBe(0);
  });

  it('enforces the FAQ 3-entry floor and the contacts 1-entry floor with a message, withholding Save', async () => {
    currentConfig = { ...BASE_CONFIG, goodToKnow: [faqBlock()] };
    await create();
    openSection();

    // Seeded valid: three complete entries, no message, Save only waits on dirty.
    expect(queryAll('.error-message').length).toBe(0);

    // Drop one entry below the floor — the message appears and Save is withheld.
    const card = queryAll<HTMLElement>('.card-list > .card')[0];
    card.querySelector<HTMLButtonElement>('.remove-btn')!.click();
    fixture.detectChanges();

    const message = queryAll<HTMLElement>('.error-message')[0];
    expect(message).toBeDefined();
    expect(message.textContent).toContain('configManager.goodToKnow.issue.faqTooFew');
    expect(queryAll<HTMLButtonElement>('.mobile-bar button')[0].disabled).toBe(true);

    // A fresh contacts block seeds one entry (the floor); removing it flags too.
    addButton('contacts').click();
    fixture.detectChanges();
    const contactsCard = queryAll<HTMLElement>('.card-list > .card')[1];
    contactsCard.querySelector<HTMLButtonElement>('.remove-btn')!.click();
    fixture.detectChanges();
    expect(queryAll<HTMLElement>('.error-message')[0].textContent).toContain(
      'configManager.goodToKnow.issue.contactsTooFew',
    );
  });

  it('pre-fills all three locales from the primary language and lets a customized locale stick', async () => {
    currentConfig = { ...BASE_CONFIG };
    await create();
    openSection();

    addButton('note').click();
    fixture.detectChanges();

    // Closed disclosure: one row (the primary language, pinned to `en`).
    const titleField = () =>
      queryAll<HTMLElement>('.card-list > .card')[0].querySelectorAll<HTMLElement>('.field')[0];
    expect(titleField().querySelectorAll('input').length).toBe(1);

    setValue(titleField().querySelector('input')!, 'Good to know');

    // Open the disclosure: all three locales carry the typed value.
    const disclosure = queryAll<HTMLElement>('.card-list > .card')[0].querySelector<
      HTMLButtonElement
    >('.couple-actions .couple-action-btn')!;
    disclosure.click();
    fixture.detectChanges();

    const rows = () => Array.from(titleField().querySelectorAll('input'));
    expect(rows().length).toBe(3);
    expect(rows().map((input) => input.value)).toEqual([
      'Good to know',
      'Good to know',
      'Good to know',
    ]);

    // Customize FR (row order is es/en/fr), then retype the primary: the
    // customized locale sticks, the still-mirroring one follows.
    setValue(rows()[2] as HTMLInputElement, 'Bon à savoir');
    const primary = rows()[1] as HTMLInputElement;
    setValue(primary, 'Good to know!');
    expect(rows().map((input) => input.value)).toEqual([
      'Good to know!',
      'Good to know!',
      'Bon à savoir',
    ]);
  });

  it('reorders blocks with the move buttons and PATCHes the whole array in the couple’s order', async () => {
    currentConfig = { ...BASE_CONFIG, goodToKnow: [faqBlock(), noteBlock()] };
    await create();
    openSection();

    // Second card's "move up" (actions are up · down · remove).
    blockActions(1)[0].click();
    fixture.detectChanges();

    const pills = queryAll<HTMLElement>('.card-list > .card .card-top app-pill');
    expect(pills[0].textContent).toContain('type.note');
    expect(pills[1].textContent).toContain('type.faq');

    queryAll<HTMLButtonElement>('.mobile-bar button')[0].click();
    fixture.detectChanges();

    expect(lastUpdate).toBeDefined();
    expect(lastUpdate!.goodToKnow?.map((block) => block.id)).toEqual(['b-note', 'b-faq']);
    // The payload rides the ordinary config PATCH: the rest of the document
    // travels with the array, version included.
    expect(lastUpdate!.version).toBe(BASE_CONFIG.version);
    expect(lastUpdate!.brideName).toBe(BASE_CONFIG.brideName);
  });

  it('drops never-written optional gift fields from the payload and keeps identifiers verbatim', async () => {
    currentConfig = {
      ...BASE_CONFIG,
      goodToKnow: [
        {
          id: 'b-gift',
          type: 'gift',
          title: localized('gift title'),
          intro: { es: '', en: '', fr: '' },
          iban: 'ES91 2100 0418 4502 0005 1332',
        },
      ],
    };
    await create();
    openSection();

    // Make it dirty without touching the identifier (edit the title).
    const titleInput = queryAll<HTMLElement>('.card-list > .card')[0]
      .querySelectorAll<HTMLElement>('.field')[0]
      .querySelector('input')!;
    setValue(titleInput as HTMLInputElement, 'Un detalle');

    queryAll<HTMLButtonElement>('.mobile-bar button')[0].click();
    fixture.detectChanges();

    expect(lastUpdate).toBeDefined();
    const gift = lastUpdate!.goodToKnow![0] as { intro?: unknown; iban?: string };
    expect(gift.intro).toBeUndefined();
    // Byte-identical, whitespace and all (hard rule 19a) — never reformatted.
    expect(gift.iban).toBe('ES91 2100 0418 4502 0005 1332');
  });
});
