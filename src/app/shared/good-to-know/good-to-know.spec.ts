import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideEffects } from '@ngrx/effects';
import { provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  TranslateLanguageService,
  WeddingConfigResponseDto,
  WeddingConfigurationService,
  WeddingGeneralInformationDto,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';
import { ThemeService } from '@app/core/theme.service';
import { ThemeId } from '@app/model';

import { GoodToKnow } from './good-to-know';

/**
 * T383 — Home's "Good to know" renders the couple's own `generalInfo`
 * sections (hub **ADR-0047 §1/§2**).
 *
 * Every string a guest reads *inside* a section comes from the fixture below,
 * never from a locale file: that is the point of the feature and of hard rule
 * 19, and these tests would still pass with the translations stripped. The
 * section **labels** are the deliberate exception — the fixed shape stores no
 * per-section title, so they are UI chrome and are asserted as keys.
 */

/** Localized triple — the `{es,en,fr}` shape every prose field stores. */
const L = (text: string) => ({ es: `${text} ES`, en: `${text} EN`, fr: `${text} FR` });

/**
 * The whole shape, every section filled. ULIDs are abbreviated for legibility;
 * what matters is that `faq` and `note` rows are keyed by **that value** and
 * never by their index (ADR-0047 §1).
 */
const FULL: WeddingGeneralInformationDto = {
  dressCode: {
    headline: L('Elegant'),
    body: L('Cocktail dress or a light suit'),
    note: L('Leave white to the bride'),
  },
  gift: {
    intro: L('You being there is the present'),
    accountHolder: 'Sara & Christophe',
    iban: 'ES91 2100 0418 4502 0005 1332',
    bic: 'CAIXESBBXXX',
    reference: L('Your name'),
    bizumPhone: '+34 655 012 118',
    bizumNote: L('Put your name in the message'),
  },
  contact: {
    couple: {
      bride: {
        id: 'u-sara',
        firstName: 'Sara',
        lastName: 'Bride',
        email: 'sara@example.com',
        phoneNumber: '+34 600 000 001',
      },
      groom: {
        id: 'u-christophe',
        firstName: 'Christophe',
        lastName: 'Groom',
        email: 'christophe@example.com',
        phoneNumber: '+34 600 000 002',
      },
    },
    weddingPlanner: [
      {
        id: 'u-marta',
        role: 'wedding-planner',
        firstName: 'Marta',
        lastName: 'Ruiz',
        email: 'marta@example.com',
        phoneNumber: '+34 600 333 444',
      },
    ],
    guest: [
      {
        id: 'u-lucia',
        role: 'guest',
        firstName: 'Lucía',
        lastName: 'Ferrer',
        email: 'lucia@example.com',
        phoneNumber: '+34 691 776 402',
        purpose: L('Anything about the ceremony'),
      },
    ],
  },
  faq: [
    { id: '01JQ0000000000000000000001', question: L('Can we bring the children?'), answer: L('Yes') },
    { id: '01JQ0000000000000000000002', question: L('Where do we park?'), answer: L('Uphill') },
  ],
  dayLine: {
    rsvpOpen: L('Please reply by 1 May'),
    rsvpClosed: L('Replies are closed, see you soon'),
    afterWedding: L('Thank you for coming'),
  },
  note: [
    { id: '01JQ000000000000000000000N', title: L('One more thing'), body: L('Free-form prose') },
  ],
};

/** The minimum the route can return: `contact` and `contact.couple` are the
 *  only required fields on the response (ADR-0047 §4, Amendment 2). */
const COUPLE_ONLY: WeddingGeneralInformationDto = {
  contact: FULL.contact,
};

/** Wedding date 2027-06-05, RSVP deadline 2027-05-01 — the two fields the
 *  `dayLine` variant is chosen against, and the only two this component reads
 *  off the wedding configuration (ADR-0046 §4). */
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

describe('GoodToKnow — the couple-authored sections (T383, hub ADR-0047)', () => {
  let fixture: ComponentFixture<GoodToKnow>;
  let lang: ReturnType<typeof signal<'es' | 'en' | 'fr'>>;
  let theme: ReturnType<typeof signal<ThemeId>>;

  async function create(
    info: WeddingGeneralInformationDto | 'fails',
    configOverrides: Partial<WeddingConfigResponseDto> = {},
    initialLang: 'es' | 'en' | 'fr' = 'en',
  ): Promise<void> {
    const config = { ...BASE_CONFIG, ...configOverrides };
    lang = signal<'es' | 'en' | 'fr'>(initialLang);
    theme = signal<ThemeId>('terracotta');

    await TestBed.configureTestingModule({
      imports: [GoodToKnow],
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
            weddingConfigControllerGetV1: () => of(config),
            weddingConfigControllerGetGeneralInformationV1: () =>
              info === 'fails' ? throwError(() => new Error('502')) : of(info),
          },
        },
        { provide: TranslateLanguageService, useValue: { currentLang: lang } },
        { provide: ThemeService, useValue: { theme } },
      ],
    }).compileComponents();

    // Keys resolve to themselves — so anything a test reads out of the DOM is
    // authored content unless it is visibly a key.
    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    fixture = TestBed.createComponent(GoodToKnow);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  function queryAll<T extends HTMLElement>(selector: string): T[] {
    return Array.from(fixture.nativeElement.querySelectorAll(selector)) as T[];
  }

  function text(selector: string): string {
    return (fixture.nativeElement.querySelector(selector)?.textContent ?? '').trim();
  }

  function slots(): (string | undefined)[] {
    return queryAll<HTMLElement>('.block').map((block) => block.dataset['slot']);
  }

  // ── ordering is structural ─────────────────────────────────────────────

  it("renders the design system's fixed order — nothing about it is authored", async () => {
    await create(FULL);

    // Left column then right, as `ScreenInfo.jsx:169-186` lays them out. There
    // is no stored order to honour and no sort to apply: each section has its
    // own field (ADR-0047 §1).
    expect(slots()).toEqual(['dress-code', 'contact', 'gift', 'faq', 'day-line', 'note']);
  });

  it('renders nothing for a section the couple did not write', async () => {
    await create(COUPLE_ONLY);

    // Presence of the field is the whole mechanism — no empty card, no
    // placeholder, no per-section toggle.
    expect(slots()).toEqual(['contact']);
    expect(fixture.nativeElement.querySelector('.dress-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.gift-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.faq-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.day-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.note-card')).toBeNull();
  });

  it('renders no section at all when the read route fails', async () => {
    await create('fails');

    // The HTTP error interceptor owns what the guest is told (hard rule 17b);
    // this section degrades to nothing rather than breaking Home around it.
    expect(queryAll('.block').length).toBe(0);
  });

  // ── contacts (ADR-0047 §2/§3) ──────────────────────────────────────────

  it('renders the couple, then the planners, then the guests', async () => {
    await create(FULL);

    expect(queryAll('.contact-name').map((el) => el.textContent?.trim())).toEqual([
      'Sara Bride',
      'Christophe Groom',
      'Marta Ruiz',
      'Lucía Ferrer',
    ]);
  });

  it('gives a guest their authored purpose line and a planner their role', async () => {
    await create(FULL);

    const meta = queryAll('.contact-meta').map((el) => el.textContent?.trim());
    // `purpose` is what makes the section "who to call **about what**"
    // (ADR-0047 §2) and it exists on guest entries only; a planner's role
    // already states what to ask them.
    expect(meta).toEqual([
      'roles.bride',
      'roles.groom',
      'roles.wedding-planner',
      'Anything about the ceremony EN',
    ]);
  });

  it('shows each listed person their email and number (ADR-0047 §3)', async () => {
    await create(FULL);

    const rows = queryAll('.contact-row');
    const ids = (i: number) =>
      Array.from(rows[i].querySelectorAll('.contact-id')).map((el) => el.textContent?.trim());

    expect(ids(0)).toEqual(['+34 600 000 001', 'sara@example.com']);
    expect(ids(3)).toEqual(['+34 691 776 402', 'lucia@example.com']);
  });

  it('renders no call button for a person with no phone number — absent, not disabled', async () => {
    await create({
      ...COUPLE_ONLY,
      contact: {
        ...FULL.contact,
        couple: {
          bride: { id: 'u-sara', firstName: 'Sara', lastName: 'Bride', email: 'sara@example.com' },
          groom: FULL.contact.couple.groom,
        },
        weddingPlanner: undefined,
        guest: undefined,
      },
    });

    const rows = queryAll('.contact-row');
    expect(rows.length).toBe(2);
    // Not a disabled button, not a `tel:` with an empty target: no element.
    expect(rows[0].querySelector('.call-btn')).toBeNull();
    expect(rows[0].querySelectorAll('button').length).toBe(0);
    // The row still renders — name, role and email are reason enough for it.
    expect(rows[0].querySelector('.contact-name')?.textContent?.trim()).toBe('Sara Bride');
    expect(rows[1].querySelector('.call-btn')?.getAttribute('href')).toBe('tel:+34600000002');
  });

  // ── faq and note: ULID-keyed, and note carries its own label ───────────

  it('keys the FAQ rows by their stored id, not by index', async () => {
    await create(FULL);

    // `aria-controls`/`id` are built from the ULID, so a reorder moves the
    // row's identity with it (ADR-0047 §1's reason for keeping ids).
    expect(queryAll('.faq-q').map((el) => el.getAttribute('aria-controls'))).toEqual([
      'gtk-faq-01JQ0000000000000000000001',
      'gtk-faq-01JQ0000000000000000000002',
    ]);
  });

  it("renders a note's authored title as its section label", async () => {
    await create(FULL);

    const note = queryAll('.block').find((block) => block.dataset['slot'] === 'note');
    // Never unlabelled prose (ADR-0047 §1): the title is the label, and it is
    // authored — not a locale key like every other section label here.
    expect(note?.querySelector('.label')?.textContent?.trim()).toBe('One more thing EN');
    expect(note?.querySelector('.note-card')?.textContent?.trim()).toBe('Free-form prose EN');
  });

  it('renders every note, each under its own title', async () => {
    await create({
      ...FULL,
      note: [
        FULL.note![0],
        { id: '01JQ000000000000000000000M', title: L('And another'), body: L('More prose') },
      ],
    });

    const labels = queryAll('.block')
      .filter((block) => block.dataset['slot'] === 'note')
      .map((block) => block.querySelector('.label')?.textContent?.trim());
    expect(labels).toEqual(['One more thing EN', 'And another EN']);
  });

  // ── dayLine: derived client-side, at the boundaries (ADR-0046 §4) ──────

  async function dayLineAt(instant: string): Promise<string> {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(instant));
    await create(FULL);
    return text('.day-line');
  }

  it('picks rsvpOpen on the deadline itself', async () => {
    // On or before `rsvpDeadline` (2027-05-01) — the boundary is inclusive.
    expect(await dayLineAt('2027-05-01T12:00:00Z')).toBe('Please reply by 1 May EN');
  });

  it('picks rsvpClosed the day after the deadline', async () => {
    expect(await dayLineAt('2027-05-02T12:00:00Z')).toBe('Replies are closed, see you soon EN');
  });

  it('picks rsvpClosed on the wedding day itself', async () => {
    // After the deadline and on or before `date` (2027-06-05).
    expect(await dayLineAt('2027-06-05T12:00:00Z')).toBe('Replies are closed, see you soon EN');
  });

  it('picks afterWedding the day after the wedding', async () => {
    expect(await dayLineAt('2027-06-06T12:00:00Z')).toBe('Thank you for coming EN');
  });

  it('crosses the boundary on the Europe/Madrid calendar day, not UTC', async () => {
    // 22:30 UTC on the deadline is already 00:30 on the 2nd in Madrid
    // (CEST, UTC+2), so the RSVP window has closed. Reckoning this in UTC
    // would still say "reply by 1 May" for two more hours.
    expect(await dayLineAt('2027-05-01T22:30:00Z')).toBe('Replies are closed, see you soon EN');
  });

  it('falls back to rsvpOpen when the configuration has not arrived', async () => {
    // Nothing renders a section the couple wrote away: `rsvpOpen` is the state
    // the document is in for most of its life.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-06-06T12:00:00Z'));
    await create(FULL, { rsvpDeadline: 'not-a-date', date: 'not-a-date' });
    expect(text('.day-line')).toBe('Please reply by 1 May EN');
  });

  // ── identifiers are transcribed, never formatted (hard rule 19a) ───────

  it('renders identifiers byte-identically in every locale', async () => {
    await create(FULL, {}, 'es');
    const esValues = queryAll('.value').map((el) => el.textContent?.trim());
    const esIds = queryAll('.contact-id').map((el) => el.textContent?.trim());

    lang.set('fr');
    fixture.detectChanges();
    const frValues = queryAll('.value').map((el) => el.textContent?.trim());
    const frIds = queryAll('.contact-id').map((el) => el.textContent?.trim());

    // `reference` is prose and *does* change; the IBAN, BIC, account holder
    // and Bizum number do not — no `Intl`, no grouping, no re-casing.
    expect(esValues).toContain('ES91 2100 0418 4502 0005 1332');
    expect(esValues).toContain('CAIXESBBXXX');
    expect(esValues).toContain('Sara & Christophe');
    expect(esValues).toContain('+34 655 012 118');
    expect(frValues.filter((v) => v !== 'Your name FR')).toEqual(
      esValues.filter((v) => v !== 'Your name ES'),
    );
    expect(frIds).toEqual(esIds);
  });

  it('picks the guest locale for authored prose', async () => {
    await create(FULL, {}, 'fr');
    expect(text('.headline')).toBe('Elegant FR');
    expect(text('.day-line')).toContain('FR');
  });

  // ── the clipboard confirmation is conditional (hard rule 19b) ──────────

  it('confirms a copy only when the clipboard call actually resolved', async () => {
    await create(FULL);
    const copyButtons = queryAll<HTMLButtonElement>('.copy-btn');
    // IBAN and BIC only — copyability is the DS's decision, not a stored one.
    expect(copyButtons.length).toBe(2);

    vi.stubGlobal('navigator', {
      clipboard: { writeText: () => Promise.reject(new Error('denied')) },
    });
    copyButtons[0].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(copyButtons[0].textContent?.trim()).toBe('home.goodToKnowSection.copyFailed');
    expect(copyButtons[0].classList.contains('ok')).toBe(false);
    vi.unstubAllGlobals();
  });

  // ── swatches stay derived (ADR-0046 Amendment 3 / ADR-0047 §6) ─────────

  it('derives the swatch row from the active theme, never from stored content', async () => {
    await create(FULL);
    expect(queryAll('.chip-name').map((el) => el.textContent?.trim())).toEqual([
      'home.goodToKnowSection.palette.terracotta.accent',
      'home.goodToKnowSection.palette.terracotta.accent2',
      'home.goodToKnowSection.palette.terracotta.accent3',
      'home.goodToKnowSection.palette.terracotta.chip',
      'home.goodToKnowSection.palette.terracotta.ink',
    ]);

    theme.set('verdeagua');
    fixture.detectChanges();
    expect(text('.chip-name')).toBe('home.goodToKnowSection.palette.verdeagua.accent');
  });
});
