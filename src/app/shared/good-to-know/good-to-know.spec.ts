import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideEffects } from '@ngrx/effects';
import { provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  CreateWeddingConfigDtoGoodToKnowInner,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf1,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf2,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf3,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf4,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf5,
  TranslateLanguageService,
  UserProfileDto,
  WeddingConfigResponseDto,
  WeddingConfigurationService,
  WeddingUserProfileService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';
import { ThemeService } from '@app/core/theme.service';
import { ThemeId } from '@app/model';

import { GoodToKnow } from './good-to-know';

/**
 * T375 — Home's "Good to know" renders the couple's own `goodToKnow` blocks
 * (hub ADR-0046). Every string a guest reads inside a block comes from the
 * fixture below, never from a locale file: that is the whole point of the
 * feature and of hard rule 19, and these tests would still pass with the
 * translations stripped.
 */

/** Localized triple — the `{es,en,fr}` shape every prose field stores. */
const L = (text: string) => ({ es: `${text} ES`, en: `${text} EN`, fr: `${text} FR` });

const DRESS: CreateWeddingConfigDtoGoodToKnowInnerOneOf = {
  id: 'b-dress',
  type: 'dress-code',
  title: L('What to wear'),
  headline: L('Elegant'),
  body: L('Cocktail dress or a light suit'),
  note: L('Leave white to the bride'),
};

const GIFT: CreateWeddingConfigDtoGoodToKnowInnerOneOf1 = {
  id: 'b-gift',
  type: 'gift',
  title: L('Gifts'),
  intro: L('You being there is the present'),
  accountHolder: 'Sara & Christophe',
  iban: 'ES91 2100 0418 4502 0005 1332',
  bic: 'CAIXESBBXXX',
  reference: L('Your name'),
  bizumPhone: '+34 655 012 118',
  bizumNote: L('Put your name in the message'),
};

const FAQ: CreateWeddingConfigDtoGoodToKnowInnerOneOf2 = {
  id: 'b-faq',
  type: 'faq',
  title: L('Questions'),
  entries: [
    { id: 'q1', question: L('Can we bring the children?'), answer: L('Yes') },
    { id: 'q2', question: L('Where do we park?'), answer: L('Uphill') },
    { id: 'q3', question: L('When should we arrive?'), answer: L('16:00') },
  ],
};

/**
 * Since contract `0dc09db` a contacts entry is `{ userId, purpose }` — the
 * name and number are the referenced user's, resolved from `GET /v1/profile`.
 * `u-nobody` references an account this fixture's directory does not carry.
 */
const CONTACTS: CreateWeddingConfigDtoGoodToKnowInnerOneOf3 = {
  id: 'b-contacts',
  type: 'contacts',
  title: L('Ask us'),
  entries: [
    { userId: 'u-lucia', purpose: L('Maid of honour') },
    { userId: 'u-no-phone', purpose: L('Travel and transfers') },
    { userId: 'u-nobody', purpose: L('Dangling reference') },
  ],
};

/** The directory `GET /v1/profile` hands back. `u-no-phone` is the shape a
 *  guest sees for everyone: `phoneNumber` is couple-gated on the API side. */
const PROFILES: UserProfileDto[] = [
  {
    id: 'u-lucia',
    firstName: 'Lucía',
    lastName: 'Ferrer',
    preferredLang: 'es',
    role: 'guest',
    phoneNumber: '+34 691 776 402',
  },
  {
    id: 'u-no-phone',
    firstName: 'Christophe',
    lastName: 'Groom',
    preferredLang: 'fr',
    role: 'groom',
  },
];

const DAY_LINE: CreateWeddingConfigDtoGoodToKnowInnerOneOf4 = {
  id: 'b-day',
  type: 'day-line',
  title: L('The day in one line'),
  rsvpOpen: L('Please reply by 1 May'),
  rsvpClosed: L('Replies are closed, see you soon'),
  afterWedding: L('Thank you for coming'),
};

const NOTE: CreateWeddingConfigDtoGoodToKnowInnerOneOf5 = {
  id: 'b-note',
  type: 'note',
  title: L('One more thing'),
  body: L('Free-form prose'),
};

/** Wedding date 2027-06-05, RSVP deadline 2027-05-01 — the two dates the
 *  `day-line` variant is chosen against (hub ADR-0046 §4). */
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

describe('GoodToKnow — couple-authored blocks (T375, hub ADR-0046)', () => {
  let fixture: ComponentFixture<GoodToKnow>;
  let currentConfig: WeddingConfigResponseDto;
  let lang: ReturnType<typeof signal<'es' | 'en' | 'fr'>>;
  let theme: ReturnType<typeof signal<ThemeId>>;

  async function create(
    goodToKnow?: CreateWeddingConfigDtoGoodToKnowInner[],
    overrides: Partial<WeddingConfigResponseDto> = {},
  ): Promise<void> {
    currentConfig = { ...BASE_CONFIG, ...overrides, goodToKnow };
    lang = signal<'es' | 'en' | 'fr'>('en');
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
          useValue: { weddingConfigControllerGetV1: () => of(currentConfig) },
        },
        {
          provide: WeddingUserProfileService,
          useValue: {
            profileControllerGetAllV1: () => of({ items: PROFILES, nextCursor: null }),
          },
        },
        { provide: TranslateLanguageService, useValue: { currentLang: lang } },
        { provide: ThemeService, useValue: { theme } },
      ],
    }).compileComponents();

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

  /** The rendered blocks, in the order a reader scans them — the two column
   *  wrappers are read left-to-right, and below 900px they nest as one flow,
   *  so DOM order is reading order either way. */
  function renderedLabels(): string[] {
    return queryAll('.block').map((block) =>
      (block.querySelector('.label')?.textContent ?? '').trim(),
    );
  }

  it('renders the stored order, never a sort or a grouping by type', async () => {
    // Deliberately not the DS mock's own order: the couple's array is the
    // only ordering there is (hub ADR-0046 §3).
    await create([NOTE, CONTACTS, DRESS, FAQ, GIFT]);

    expect(renderedLabels()).toEqual([
      'One more thing EN',
      'Ask us EN',
      'What to wear EN',
      'Questions EN',
      'Gifts EN',
    ]);
  });

  it('renders nothing for a block type that is not in the array', async () => {
    await create([DRESS]);

    expect(queryAll('.block').length).toBe(1);
    // Presence is the entire mechanism: no empty card, no placeholder for
    // the five block types the couple did not write.
    expect(fixture.nativeElement.querySelector('.gift-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.faq-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.contacts-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.day-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.note-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeNull();
  });

  it('keeps the shipped empty state when the array is empty', async () => {
    await create([]);

    expect(fixture.nativeElement.querySelector('.empty-state')).not.toBeNull();
    expect(queryAll('.block').length).toBe(0);
  });

  it('keeps the shipped empty state when the field is absent altogether', async () => {
    await create(undefined);

    expect(fixture.nativeElement.querySelector('.empty-state')).not.toBeNull();
    expect(queryAll('.block').length).toBe(0);
  });

  describe('day-line — the variant is computed, never stored (§4)', () => {
    /** Each boundary is asserted in `Europe/Madrid`, the reference timezone:
     *  the instants below are chosen so UTC and Madrid agree on the calendar
     *  date, and the two that do not (the 23:30 UTC cases) are the point. */
    async function renderAt(instant: string): Promise<string> {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(instant));
      await create([DAY_LINE]);
      return text('.day-line');
    }

    it('shows rsvpOpen the day before the deadline', async () => {
      expect(await renderAt('2027-04-30T10:00:00Z')).toBe('Please reply by 1 May EN');
    });

    it('shows rsvpOpen ON the deadline itself (on or before)', async () => {
      expect(await renderAt('2027-05-01T21:00:00Z')).toBe('Please reply by 1 May EN');
    });

    it('shows rsvpClosed the day after the deadline', async () => {
      expect(await renderAt('2027-05-02T10:00:00Z')).toBe('Replies are closed, see you soon EN');
    });

    it('shows rsvpClosed ON the wedding day itself (through the wedding day)', async () => {
      expect(await renderAt('2027-06-05T15:00:00Z')).toBe('Replies are closed, see you soon EN');
    });

    it('shows afterWedding the day after the wedding', async () => {
      expect(await renderAt('2027-06-06T08:00:00Z')).toBe('Thank you for coming EN');
    });

    it('reckons the boundary in Europe/Madrid, not UTC', async () => {
      // 23:30 UTC on the deadline is already 01:30 the NEXT day in Madrid
      // (CEST, UTC+2) — the RSVP is closed there, which is the timezone the
      // whole system reckons in (`SPEC.md` Constants).
      expect(await renderAt('2027-05-01T23:30:00Z')).toBe('Replies are closed, see you soon EN');
    });
  });

  describe('gift — identifiers, and a copy button that cannot lie', () => {
    /** Replaces `navigator.clipboard` for one test; `configurable` so the
     *  next test can replace it again. */
    function stubClipboard(writeText: (value: string) => Promise<void>): void {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
    }

    it('renders only the fields the couple filled, and the value exactly as stored', async () => {
      await create([{ ...GIFT, bic: undefined, reference: undefined }]);

      const rows = queryAll('.gift-row');
      expect(rows.length).toBe(2); // accountHolder + iban; no BIC row, no reference row
      // Byte-identical: spacing preserved, no `Intl` grouping, no re-casing.
      expect(rows[1].querySelector('.value')?.textContent).toBe(
        'ES91 2100 0418 4502 0005 1332',
      );
    });

    it('renders identifiers byte-identically in every locale (§5)', async () => {
      await create([GIFT, CONTACTS]);

      const identifiers = () => ({
        iban: queryAll('.gift-row')[1].querySelector('.value')?.textContent,
        bizum: text('.bizum .value'),
        contact: text('.contact-name'),
        meta: text('.contact-meta'),
      });
      const inEnglish = identifiers();

      lang.set('fr');
      fixture.detectChanges();
      const inFrench = identifiers();

      expect(inFrench.iban).toBe(inEnglish.iban);
      expect(inFrench.bizum).toBe(inEnglish.bizum);
      expect(inFrench.contact).toBe('Lucía Ferrer');
      expect(inFrench.contact).toBe(inEnglish.contact);
      // The purpose line IS prose and does follow the locale — the phone in
      // it does not.
      expect(inFrench.meta).toContain('+34 691 776 402');
      expect(inFrench.meta).toContain('Maid of honour FR');
    });

    it('confirms a copy only when the clipboard call actually succeeded', async () => {
      const written: string[] = [];
      stubClipboard(async (value) => {
        written.push(value);
      });
      await create([GIFT]);

      const copyButton = queryAll<HTMLButtonElement>('.copy-btn')[0];
      copyButton.click();
      await fixture.whenStable();
      fixture.detectChanges();

      // Whitespace-stripped on the way to the clipboard; still spaced on screen.
      expect(written).toEqual(['ES9121000418450200051332']);
      expect(copyButton.classList.contains('ok')).toBe(true);
    });

    it('shows NO confirmation when the clipboard call fails or is refused', async () => {
      stubClipboard(() => Promise.reject(new Error('denied')));
      await create([GIFT]);

      const copyButton = queryAll<HTMLButtonElement>('.copy-btn')[0];
      copyButton.click();
      await fixture.whenStable();
      fixture.detectChanges();

      // The DS mock flips to "Copied ✓" either way (`ScreenInfo.jsx:50-52`);
      // a guest who believes a wrong IBAN is on their clipboard is worse off
      // than one told it failed (hard rule 19b).
      expect(copyButton.classList.contains('ok')).toBe(false);
      // The value stays on screen, selectable by hand.
      expect(queryAll('.gift-row')[1].querySelector('.value')?.textContent).toBe(
        'ES91 2100 0418 4502 0005 1332',
      );
    });
  });

  it('opens the FAQ with every entry closed, then one at a time', async () => {
    await create([FAQ]);

    const questions = queryAll<HTMLButtonElement>('.faq-q');
    expect(questions.length).toBe(3);
    expect(questions.every((q) => q.getAttribute('aria-expanded') === 'false')).toBe(true);
    expect(queryAll('.faq-a').length).toBe(0);

    questions[1].click();
    fixture.detectChanges();
    expect(questions[1].getAttribute('aria-expanded')).toBe('true');
    expect(queryAll('.faq-a').length).toBe(1);

    questions[2].click();
    fixture.detectChanges();
    expect(questions[1].getAttribute('aria-expanded')).toBe('false');
    expect(questions[2].getAttribute('aria-expanded')).toBe('true');
    expect(queryAll('.faq-a').length).toBe(1);
  });

  it('derives the dress-code swatches from the active theme, never from the block', async () => {
    await create([DRESS]);

    expect(queryAll('.swatch').length).toBe(5);
    const names = () => queryAll('.chip-name').map((n) => n.textContent?.trim());
    expect(names()).toEqual([
      'home.goodToKnowSection.palette.terracotta.accent',
      'home.goodToKnowSection.palette.terracotta.accent2',
      'home.goodToKnowSection.palette.terracotta.accent3',
      'home.goodToKnowSection.palette.terracotta.chip',
      'home.goodToKnowSection.palette.terracotta.ink',
    ]);

    theme.set('verdeagua');
    fixture.detectChanges();
    expect(names()[0]).toBe('home.goodToKnowSection.palette.verdeagua.accent');
  });

  it('offers exactly one contact affordance: a tel: link (hub ADR-0014)', async () => {
    await create([CONTACTS]);

    const call = fixture.nativeElement.querySelector('.call-btn') as HTMLAnchorElement;
    expect(call.getAttribute('href')).toBe('tel:+34691776402');
    expect(fixture.nativeElement.querySelectorAll('a[href^="mailto:"]').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('a[href*="wa.me"]').length).toBe(0);
  });

  it('resolves a contact name and number from the referenced user profile', async () => {
    await create([CONTACTS]);

    const names = queryAll('.contact-name').map((n) => n.textContent?.trim());
    // `u-nobody` resolves to no account and renders no row at all — never a
    // half-row saying "unknown".
    expect(names).toEqual(['Lucía Ferrer', 'Christophe Groom']);
    expect(text('.contact-row .contact-meta')).toBe('Maid of honour EN · +34 691 776 402');
  });

  it('renders no call button, and no number, for a profile carrying no phone', async () => {
    await create([CONTACTS]);

    const rows = queryAll('.contact-row');
    // `phoneNumber` is couple-gated on the API side, so for a guest it is
    // simply absent — the name and purpose still render, the button does not.
    expect(rows[1].querySelector('.call-btn')).toBeNull();
    expect(rows[1].querySelector('.contact-meta')?.textContent?.trim()).toBe(
      'Travel and transfers EN',
    );
  });

  it('renders no card at all when every contact reference is unresolvable', async () => {
    await create([{ ...CONTACTS, entries: [{ userId: 'u-nobody', purpose: L('Nobody') }] }]);

    expect(fixture.nativeElement.querySelector('.contacts-card')).toBeNull();
    expect(queryAll('.block').length).toBe(0);
  });

  it('renders prose as plain text, never as markup', async () => {
    await create([{ ...NOTE, body: L('<b>bold</b> & <script>x</script>') }]);

    const prose = fixture.nativeElement.querySelector('.note-card .prose') as HTMLElement;
    expect(prose.querySelector('b')).toBeNull();
    expect(prose.textContent).toBe('<b>bold</b> & <script>x</script> EN');
  });
});
