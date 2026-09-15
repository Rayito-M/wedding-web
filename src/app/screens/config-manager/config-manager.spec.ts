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
  CreateWeddingConfigDtoCouple,
  CreateWeddingConfigDtoGeneralInfo,
  TranslateLanguageService,
  UserDto,
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
 * T384 (hub ADR-0047 §1/§2) — the eighth Settings section is a **fixed-shape
 * editor**, not a block builder: one editor per named section, in the design
 * system's order, with nothing to add, reorder or remove at the section level
 * and no block ids, no singleton enforcement and no ceiling. `faq` and `note`
 * stay add/remove arrays (1–10, ULID ids minted here), `contact` is a picker
 * over people who already hold accounts, one typed value pre-fills all three
 * locales (ADR-0031), and Save sends the whole `generalInfo` object through
 * the existing `PATCH /v1/config` path.
 */
describe('ConfigManager — Good to know authoring (T384)', () => {
  let fixture: ComponentFixture<ConfigManager>;
  let currentConfig: WeddingConfigResponseDto;
  let queryParamMap: BehaviorSubject<ParamMap>;
  let lastUpdate: UpdateWeddingConfigDto | undefined;
  let accounts: UserDto[];

  const localized = (stem: string): LangDescriptionType => ({
    es: `${stem} es`,
    en: `${stem} en`,
    fr: `${stem} fr`,
  });

  const account = (overrides: Partial<UserDto>): UserDto => ({
    id: 'u-1',
    version: 1,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    phoneNumber: '+34 600 11 22 33',
    role: UserDto.RoleEnum.GUEST,
    preferredLang: UserDto.PreferredLangEnum.ES,
    ...overrides,
  });

  const filledGeneralInfo = (): CreateWeddingConfigDtoGeneralInfo => ({
    dressCode: { headline: localized('headline'), body: localized('body') },
    faq: [{ id: 'f-1', question: localized('q1'), answer: localized('a1') }],
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
          useValue: { usersControllerListV1: () => of({ items: accounts }) },
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

  beforeEach(() => {
    accounts = [];
  });

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

  /** The one card of a singleton section, or the nth card of an array one. */
  function card(section: string, index = 0): HTMLElement {
    return queryAll<HTMLElement>(`.card[data-section="${section}"]`)[index];
  }

  /** A card's localized field, by the order the template writes them out. */
  function fieldInputs(host: HTMLElement, index: number): HTMLInputElement[] {
    const field = host.querySelectorAll<HTMLElement>('.field')[index];
    return Array.from(field.querySelectorAll('input'));
  }

  function save(): void {
    queryAll<HTMLButtonElement>('.mobile-bar button')[0].click();
    fixture.detectChanges();
  }

  it('renders one editor per named section and offers nothing to add, reorder or remove', async () => {
    currentConfig = { ...BASE_CONFIG };
    await create();

    const rail = queryAll<HTMLButtonElement>('.rail-item');
    expect(rail.length).toBe(8);
    expect(rail[7].textContent).toContain('08');

    openSection();

    // The four singleton sections are always present — a section exists
    // because it has content, so there is no control that creates one.
    expect(queryAll('.card[data-section="dress-code"]').length).toBe(1);
    expect(queryAll('.card[data-section="gift"]').length).toBe(1);
    expect(queryAll('.card[data-section="contact"]').length).toBe(1);
    expect(queryAll('.card[data-section="day-line"]').length).toBe(1);
    // …in the design system's order, which nothing here authors.
    expect(queryAll<HTMLElement>('.card-list > .card').map((el) => el.dataset['section'])).toEqual([
      'dress-code',
      'gift',
      'contact',
      'day-line',
    ]);

    // The two arrays start empty and each offers exactly one add button.
    expect(queryAll('.card[data-section="faq"]').length).toBe(0);
    expect(queryAll('.card[data-section="note"]').length).toBe(0);
    expect(
      queryAll<HTMLElement>('.card-list > .add-btn').map((b) => b.textContent!.trim()),
    ).toEqual(['configManager.goodToKnow.faq.addEntry', 'configManager.goodToKnow.note.addEntry']);

    // Nothing left of the block array: no move buttons, no per-block remove,
    // no add row of block types (the four singleton cards carry only their
    // language disclosure).
    expect(card('dress-code').querySelectorAll('.card-top button').length).toBe(0);
    expect(card('gift').querySelectorAll('.card-top button').length).toBe(0);
    expect(card('day-line').querySelectorAll('.card-top button').length).toBe(0);
  });

  it('adds and removes FAQ entries between 1 and 10, minting a ULID for each', async () => {
    currentConfig = { ...BASE_CONFIG };
    await create();
    openSection();

    const addFaq = (): HTMLButtonElement | undefined =>
      queryAll<HTMLButtonElement>('.card-list > .add-btn').find((b) =>
        b.textContent!.includes('faq.addEntry'),
      );

    for (let i = 0; i < 10; i++) {
      addFaq()!.click();
      fixture.detectChanges();
    }
    expect(queryAll('.card[data-section="faq"]').length).toBe(10);
    // At the ceiling the control is withheld rather than letting the API 400.
    expect(addFaq()).toBeUndefined();

    for (let i = 0; i < 9; i++) {
      card('faq', 0).querySelector<HTMLButtonElement>('.card-top button')!.click();
      fixture.detectChanges();
    }
    expect(queryAll('.card[data-section="faq"]').length).toBe(1);
    expect(addFaq()).toBeDefined();

    // The id is minted here and is a ULID: `PATCH /v1/config` replaces the
    // whole array, so it is the only thing that tracks a row across a
    // re-render (ADR-0047 §1).
    setValue(fieldInputs(card('faq'), 0)[0], 'Is there parking?');
    setValue(fieldInputs(card('faq'), 1)[0], 'Yes, behind the church.');
    save();
    const entries = lastUpdate!.generalInfo!.faq!;
    expect(entries.length).toBe(1);
    expect(entries[0].id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(entries[0].question).toEqual({
      es: 'Is there parking?',
      en: 'Is there parking?',
      fr: 'Is there parking?',
    });
  });

  it('notes are a 1–10 array too, each with the title guests read above its prose', async () => {
    currentConfig = { ...BASE_CONFIG };
    await create();
    openSection();

    queryAll<HTMLButtonElement>('.card-list > .add-btn')
      .find((b) => b.textContent!.includes('note.addEntry'))!
      .click();
    fixture.detectChanges();

    const noteCard = card('note');
    expect(noteCard.querySelectorAll('.field-label')[0].textContent).toContain(
      'configManager.goodToKnow.note.label',
    );
    expect(noteCard.querySelectorAll('.field-label')[1].textContent).toContain(
      'configManager.goodToKnow.note.body',
    );

    // Half-built: the title is typed, the body is not — Save stays withheld
    // and the message names the section rather than a block number.
    setValue(fieldInputs(noteCard, 0)[0], 'One more thing');
    expect(queryAll<HTMLElement>('.error-message')[0].textContent).toContain(
      'configManager.goodToKnow.issue.incomplete',
    );
    expect(queryAll<HTMLButtonElement>('.mobile-bar button')[0].disabled).toBe(true);

    setValue(fieldInputs(noteCard, 1)[0], 'Free-form prose');
    expect(queryAll('.error-message').length).toBe(0);
    expect(queryAll<HTMLButtonElement>('.mobile-bar button')[0].disabled).toBe(false);
  });

  it('pre-fills all three locales from the primary language and lets a customized locale stick', async () => {
    currentConfig = { ...BASE_CONFIG };
    await create();
    openSection();

    const dressCode = (): HTMLElement => card('dress-code');
    // Closed disclosure: one row (the primary language, pinned to `en`).
    expect(fieldInputs(dressCode(), 0).length).toBe(1);

    setValue(fieldInputs(dressCode(), 0)[0], 'Garden formal');

    dressCode().querySelector<HTMLButtonElement>('.couple-actions .couple-action-btn')!.click();
    fixture.detectChanges();

    const rows = (): HTMLInputElement[] => fieldInputs(dressCode(), 0);
    expect(rows().length).toBe(3);
    expect(rows().map((input) => input.value)).toEqual([
      'Garden formal',
      'Garden formal',
      'Garden formal',
    ]);

    // Customize FR (row order is es/en/fr), then retype the primary: the
    // customized locale sticks, the still-mirroring one follows.
    setValue(rows()[2], 'Tenue de jardin');
    setValue(rows()[1], 'Garden formal!');
    expect(rows().map((input) => input.value)).toEqual([
      'Garden formal!',
      'Garden formal!',
      'Tenue de jardin',
    ]);
  });

  it('contact is a picker: details come from the account and are not editable here', async () => {
    accounts = [
      account({
        id: 'u-planner',
        firstName: 'Eva',
        lastName: 'Ruiz',
        email: 'eva@example.com',
        role: UserDto.RoleEnum.WEDDING_PLANNER,
      }),
      account({ id: 'u-guest', firstName: 'Ada', lastName: 'Lovelace' }),
    ];
    currentConfig = { ...BASE_CONFIG };
    await create();
    openSection();

    const contact = (): HTMLElement => card('contact');
    const picks = (): HTMLSelectElement[] =>
      Array.from(contact().querySelectorAll<HTMLSelectElement>('select'));

    // Two pickers, each offering only accounts of its own kind — this screen
    // never creates an account, and there is no free-text alternative.
    expect(picks().length).toBe(2);
    expect(Array.from(picks()[0].options).map((o) => o.value)).toEqual(['', 'u-planner']);
    expect(Array.from(picks()[1].options).map((o) => o.value)).toEqual(['', 'u-guest']);

    picks()[0].value = 'u-planner';
    picks()[0].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    contact().querySelectorAll<HTMLButtonElement>('.add-btn')[0].click();
    fixture.detectChanges();

    // The planner's own details render as text, with no input to edit them,
    // and no `purpose` — the role is its own purpose (ADR-0047 §2).
    expect(contact().querySelector('.couple-name')!.textContent).toContain('Eva Ruiz');
    expect(contact().querySelector('.couple-meta')!.textContent).toContain('+34 600 11 22 33');
    expect(contact().querySelector('.couple-meta')!.textContent).toContain('eva@example.com');
    expect(contact().querySelectorAll('input').length).toBe(0);
    // Picked, so no longer on offer — one picker remains for the guests.
    expect(picks().length).toBe(1);
  });

  it('a picked guest needs a purpose in all three locales before Save', async () => {
    accounts = [account({ id: 'u-guest' })];
    currentConfig = { ...BASE_CONFIG };
    await create();
    openSection();

    const contact = (): HTMLElement => card('contact');
    const pick = contact().querySelector<HTMLSelectElement>('select')!;
    pick.value = 'u-guest';
    pick.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    contact().querySelector<HTMLButtonElement>('.add-btn')!.click();
    fixture.detectChanges();

    // One input on a guest row, and it is the purpose line.
    const purposeInputs = Array.from(contact().querySelectorAll<HTMLInputElement>('input'));
    expect(purposeInputs.length).toBe(1);
    expect(queryAll<HTMLElement>('.error-message')[0].textContent).toContain(
      'configManager.goodToKnow.issue.purposeMissing',
    );
    expect(queryAll<HTMLButtonElement>('.mobile-bar button')[0].disabled).toBe(true);

    setValue(purposeInputs[0], 'Anything about the ceremony');
    expect(queryAll('.error-message').length).toBe(0);

    save();
    const contactPayload = lastUpdate!.generalInfo!.contact!;
    expect(contactPayload.weddingPlanner).toBeUndefined();
    expect(contactPayload.guest).toEqual([
      {
        id: 'u-guest',
        role: 'guest',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        // Byte-identical to the account, spacing and all (hard rule 19a).
        phoneNumber: '+34 600 11 22 33',
        purpose: {
          es: 'Anything about the ceremony',
          en: 'Anything about the ceremony',
          fr: 'Anything about the ceremony',
        },
      },
    ]);
  });

  it('PATCHes the whole generalInfo object, dropping sections and fields the couple never wrote', async () => {
    currentConfig = {
      ...BASE_CONFIG,
      generalInfo: {
        ...filledGeneralInfo(),
        gift: { intro: { es: '', en: '', fr: '' }, iban: 'ES91 2100 0418 4502 0005 1332' },
      },
    };
    await create();
    openSection();

    // Make it dirty without touching the identifier.
    setValue(fieldInputs(card('dress-code'), 0)[0], 'Garden formal');
    save();

    expect(lastUpdate).toBeDefined();
    const info = lastUpdate!.generalInfo!;
    // Written sections travel; the ones the couple never wrote are absent
    // rather than sent as empty objects.
    expect(Object.keys(info).sort()).toEqual(['dressCode', 'faq', 'gift']);
    expect(info.dressCode!.note).toBeUndefined();
    expect(info.faq!.map((entry) => entry.id)).toEqual(['f-1']);
    expect(info.gift!.intro).toBeUndefined();
    expect(info.gift!.bizumPhone).toBeUndefined();
    // Never reformatted on the way out (hard rule 19a).
    expect(info.gift!.iban).toBe('ES91 2100 0418 4502 0005 1332');
    // The payload rides the ordinary config PATCH: the rest of the document
    // travels with it, version included.
    expect(lastUpdate!.version).toBe(BASE_CONFIG.version);
    expect(lastUpdate!.brideName).toBe(BASE_CONFIG.brideName);
  });

  it('drops a section the couple has emptied rather than sending it blank', async () => {
    currentConfig = { ...BASE_CONFIG, generalInfo: filledGeneralInfo() };
    await create();
    openSection();

    // Clear every locale of both required dress-code fields: the section is
    // not half-built, it is a section the couple no longer has — no message,
    // and Save is allowed.
    card('dress-code')
      .querySelector<HTMLButtonElement>('.couple-actions .couple-action-btn')!
      .click();
    fixture.detectChanges();
    for (const field of [0, 1]) {
      for (const row of [0, 1, 2]) {
        setValue(fieldInputs(card('dress-code'), field)[row], '');
      }
    }
    expect(queryAll('.error-message').length).toBe(0);

    save();
    expect(lastUpdate!.generalInfo!.dressCode).toBeUndefined();
    expect(lastUpdate!.generalInfo!.faq).toBeDefined();
  });
});

/**
 * T392 — Settings → Basics owns the couple's *displayed* names, and since
 * `wedding-api` T252 those are read from `couple.<role>.firstName` whenever
 * the config row has a `couple`. Writing only the deprecated
 * `brideName`/`groomName` pair changes nothing any surface shows.
 *
 * The two assertions that matter are about the **payload**, not the field:
 * the PATCH carries the *whole* `couple` object (`updateWeddingConfig` merges
 * shallowly, so a partial one replaces the stored digest and drops `id`,
 * `lastName`, `email` and `phoneNumber`), and it carries **no** `couple` at
 * all when the row has none (`coupleSchema` requires `id`, `lastName` and
 * `phoneNumber` — an invented digest would 400 the whole document).
 */
describe('ConfigManager — Basics writes couple.*.firstName (T392)', () => {
  let fixture: ComponentFixture<ConfigManager>;
  let currentConfig: WeddingConfigResponseDto;
  let queryParamMap: BehaviorSubject<ParamMap>;
  let lastUpdate: UpdateWeddingConfigDto | undefined;

  /** A stored digest with every field `coupleSchema` requires, so dropping
   *  one on the way out is visible. */
  const COUPLE: CreateWeddingConfigDtoCouple = {
    bride: {
      id: '01J0BRIDE0000000000000000',
      firstName: 'Sara',
      lastName: 'García',
      email: 'sara@example.com',
      phoneNumber: '+34 600 11 22 33',
    },
    groom: {
      id: '01J0GROOM0000000000000000',
      firstName: 'Christophe',
      lastName: 'Cubat',
      email: 'christophe@example.com',
      phoneNumber: '+34 600 44 55 66',
    },
  };

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

  /** Basics is the first section and the default one; its first `.grid-2`
   *  holds the bride's name then the groom's. */
  function nameInput(role: 'bride' | 'groom'): HTMLInputElement {
    return queryAll<HTMLInputElement>('.grid-2 input')[role === 'bride' ? 0 : 1];
  }

  function setValue(el: HTMLInputElement, value: string): void {
    el.value = value;
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function save(): void {
    queryAll<HTMLButtonElement>('.mobile-bar button')[0].click();
    fixture.detectChanges();
  }

  it('sends the complete couple and the deprecated field when the bride is renamed', async () => {
    currentConfig = { ...BASE_CONFIG, couple: COUPLE };
    await create();

    setValue(nameInput('bride'), 'Sarah');
    save();

    expect(lastUpdate).toBeDefined();
    // The deprecated pair keeps travelling until ADR-0037's contract phase.
    expect(lastUpdate!.brideName).toBe('Sarah');
    // …and the digest travels whole: a partial `couple` would *replace* the
    // stored one, since `updateWeddingConfig` merges shallowly.
    expect(lastUpdate!.couple).toEqual({
      bride: { ...COUPLE.bride, firstName: 'Sarah' },
      groom: COUPLE.groom,
    });
    // The invariant `check-config-row.sh` asserts.
    expect(lastUpdate!.couple!.bride.firstName).toBe(lastUpdate!.brideName);
  });

  it('renames the groom without touching the bride', async () => {
    currentConfig = { ...BASE_CONFIG, couple: COUPLE };
    await create();

    setValue(nameInput('groom'), 'Chris');
    save();

    expect(lastUpdate!.groomName).toBe('Chris');
    expect(lastUpdate!.couple).toEqual({
      bride: COUPLE.bride,
      groom: { ...COUPLE.groom, firstName: 'Chris' },
    });
    expect(lastUpdate!.brideName).toBe(BASE_CONFIG.brideName);
  });

  it('sends only the deprecated field when the config row has no couple', async () => {
    currentConfig = { ...BASE_CONFIG };
    await create();

    setValue(nameInput('bride'), 'Sarah');
    save();

    expect(lastUpdate!.brideName).toBe('Sarah');
    // No digest can be built from a first name — `coupleSchema` requires
    // `id`, `lastName` and `phoneNumber` — so none is sent, and the API's
    // fallback keeps serving the deprecated pair.
    expect(lastUpdate!.couple).toBeUndefined();
  });
});
