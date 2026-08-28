import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { provideEffects } from '@ngrx/effects';
import { EntityServices, provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  AnnouncementDto,
  AudienceListResponseDtoItemsInner,
  AudiencesService,
  EntityNamesEnum,
  MilestoneDto,
  WeddingConfigResponseDto,
  WeddingConfigurationService,
  WeddingMilestonesService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { Milestones } from './milestones';

function milestone(overrides: Partial<MilestoneDto> = {}): MilestoneDto {
  return {
    id: 'm1',
    version: 1,
    title: { es: 'Título', en: 'Title', fr: 'Titre' },
    plannedDate: '2027-01-01',
    kind: MilestoneDto.KindEnum.INTERNAL,
    reached: false,
    atRisk: false,
    ...overrides,
  };
}

/** The four real audiences (hub ADR-0030 §8) with distinct, assertable
 *  counts — "Travelling from abroad" and "Table hosts" are not among them
 *  and cannot be, since `AudienceListResponseDtoItemsInner.IdEnum` has no
 *  such member (hard rule 15: the generated type is the whole guard here). */
const DEFAULT_AUDIENCES: AudienceListResponseDtoItemsInner[] = [
  { id: AudienceListResponseDtoItemsInner.IdEnum.ALL, size: 150, reachableSize: 140 },
  { id: AudienceListResponseDtoItemsInner.IdEnum.NOT_REPLIED, size: 40, reachableSize: 35 },
  { id: AudienceListResponseDtoItemsInner.IdEnum.ATTENDING, size: 90, reachableSize: 88 },
  { id: AudienceListResponseDtoItemsInner.IdEnum.ATTENDING_NO_MENU, size: 12, reachableSize: 10 },
];

/** A guest-facing milestone with a type and an audience already configured
 *  (PATCH-only per hub ADR-0030 §11c, so this always models the *saved*
 *  state, never something a create payload could carry). */
function configuredGuestFacingMilestone(overrides: Partial<MilestoneDto> = {}): MilestoneDto {
  return milestone({
    kind: MilestoneDto.KindEnum.GUEST_FACING,
    announcementType: MilestoneDto.AnnouncementTypeEnum.RSVP_REMINDER,
    audience: MilestoneDto.AudienceEnum.NOT_REPLIED,
    ...overrides,
  });
}

function sentAnnouncement(
  overrides: Partial<AnnouncementDto> = {},
): NonNullable<MilestoneDto['announcement']> {
  return {
    sentAt: '2027-01-05T10:00:00.000Z',
    sentBy: 'admin-1',
    announcementType: MilestoneDto.AnnouncementTypeEnum.RSVP_REMINDER,
    audience: MilestoneDto.AudienceEnum.NOT_REPLIED,
    recipientCount: 40,
    reachableCount: 35,
    ...overrides,
  };
}

const WEDDING_CONFIG_WITH_DATE: WeddingConfigResponseDto = {
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

const WEDDING_CONFIG_NO_DATE: WeddingConfigResponseDto = { ...WEDDING_CONFIG_WITH_DATE, date: '' };

function setInputValue(el: HTMLInputElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event('input'));
}

/** Triggers the detail form's `(ngSubmit)` — Angular's `ngSubmit` directive
 *  listens for the native `submit` event, which is what a `type="submit"`
 *  button click dispatches in a real browser. jsdom's `requestSubmit()`
 *  additionally runs constraint validation and silently no-ops on an
 *  invalid form, so dispatch the event directly instead. */
function submitDetailForm(root: HTMLElement): void {
  const form = root.querySelector('.detail-body') as HTMLFormElement;
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

/** Opens the create panel from an *empty* list. The header's `.new-btn` only
 *  renders once the list is non-empty (DS `ScreenMilestones.jsx:164/170`:
 *  `items.length > 0`), so with nothing yet created the only "create" entry
 *  point is the empty state's own manual button. */
function openCreateFromEmptyState(root: HTMLElement): void {
  const button = Array.from(
    root.querySelectorAll('.empty-state button') as NodeListOf<HTMLButtonElement>,
  ).find((b) => b.textContent?.includes('milestones.emptyNoMilestones.cta'))!;
  button.click();
}

describe('Milestones', () => {
  let fixture: ComponentFixture<Milestones>;
  let currentMilestones: MilestoneDto[];
  let currentConfig: WeddingConfigResponseDto;
  let createSpy: ReturnType<
    typeof vi.fn<(params: { createMilestoneDto: Partial<MilestoneDto> }) => Observable<MilestoneDto>>
  >;
  let updateSpy: ReturnType<
    typeof vi.fn<
      (params: { id: string; updateMilestoneDto: Partial<MilestoneDto> }) => Observable<MilestoneDto>
    >
  >;
  let removeSpy: ReturnType<typeof vi.fn<(params: { id: string }) => Observable<undefined>>>;
  let listSpy: ReturnType<typeof vi.fn<() => Observable<unknown>>>;
  let sendSpy: ReturnType<
    typeof vi.fn<
      (params: { id: string; sendAnnouncementDto: { version: number } }) => Observable<AnnouncementDto>
    >
  >;
  let clearAnnouncementSpy: ReturnType<typeof vi.fn<(params: { id: string }) => Observable<undefined>>>;
  let seedSpy: ReturnType<typeof vi.fn<() => Observable<{ seeded: number }>>>;
  /** Overridden per-test to simulate a failed write; `null` means "succeed
   *  with a sensible default response". */
  let createFailure: Observable<never> | null;
  let updateFailure: Observable<never> | null;
  let sendFailure: Observable<never> | null;
  let clearAnnouncementFailure: Observable<never> | null;
  let seedFailure: Observable<never> | null;
  /** `GET /v1/audiences` (hub ADR-0030 §11e) — the four real audiences by
   *  default; overridden per-test for the empty-audience disable condition. */
  let currentAudiences: AudienceListResponseDtoItemsInner[];

  /**
   * `@ngrx/data`'s `EntityEffects` delays every save/query success *and*
   * error action by `responseDelay` (10ms, real `asyncScheduler`, not tied
   * to Angular's zone) to simulate network latency — so settling the
   * fixture needs a real (or fake-timer-advanced) 10ms+ wait alongside the
   * usual microtask/CD flush, or a `.subscribe({ error })` callback never
   * fires and the Observable silently completes with nothing.
   */
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    if (vi.isFakeTimers()) {
      await vi.advanceTimersByTimeAsync(20);
    } else {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(Milestones);
    await settle();
  }

  beforeEach(async () => {
    currentMilestones = [];
    currentConfig = WEDDING_CONFIG_WITH_DATE;
    currentAudiences = DEFAULT_AUDIENCES;

    createFailure = null;
    updateFailure = null;
    sendFailure = null;
    clearAnnouncementFailure = null;
    seedFailure = null;

    createSpy = vi.fn((params: { createMilestoneDto: Partial<MilestoneDto> }) => {
      if (createFailure) return createFailure;
      const dto = params.createMilestoneDto;
      return of({ ...milestone(), ...dto, id: 'new-id', version: 1 });
    });
    updateSpy = vi.fn((params: { id: string; updateMilestoneDto: Partial<MilestoneDto> }) => {
      if (updateFailure) return updateFailure;
      const existing = currentMilestones.find((m) => m.id === params.id) ?? milestone({ id: params.id });
      // Real HTTP JSON serialization drops undefined-valued keys — a partial
      // update (e.g. `toggleReached`'s `{ reached }`-only payload leaves
      // `title`/`plannedDate` as `undefined` in `updateMilestoneDto`) must not
      // spread-overwrite the untouched fields on `existing` with `undefined`.
      const definedChanges = Object.fromEntries(
        Object.entries(params.updateMilestoneDto).filter(([, v]) => v !== undefined),
      );
      return of({ ...existing, ...definedChanges, id: params.id });
    });
    removeSpy = vi.fn(() => of(undefined));
    listSpy = vi.fn(() => of({ items: currentMilestones, count: currentMilestones.length }));
    sendSpy = vi.fn((params: { id: string; sendAnnouncementDto: { version: number } }) => {
      if (sendFailure) return sendFailure;
      const m = currentMilestones.find((item) => item.id === params.id);
      return of(
        sentAnnouncement({
          announcementType: m?.announcementType,
          audience: m?.audience,
        }),
      );
    });
    clearAnnouncementSpy = vi.fn(() => {
      if (clearAnnouncementFailure) return clearAnnouncementFailure;
      return of(undefined);
    });
    seedSpy = vi.fn(() => {
      if (seedFailure) return seedFailure;
      return of({ seeded: currentMilestones.length });
    });

    await TestBed.configureTestingModule({
      imports: [Milestones],
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
          provide: WeddingMilestonesService,
          useValue: {
            milestonesControllerListV1: () => listSpy(),
            milestonesControllerCreateV1: (params: { createMilestoneDto: Partial<MilestoneDto> }) =>
              createSpy(params),
            milestonesControllerUpdateV1: (params: {
              id: string;
              updateMilestoneDto: Partial<MilestoneDto>;
            }) => updateSpy(params),
            milestonesControllerRemoveV1: (params: { id: string }) => removeSpy(params),
            milestonesControllerSendV1: (params: {
              id: string;
              sendAnnouncementDto: { version: number };
            }) => sendSpy(params),
            milestonesControllerClearAnnouncementV1: (params: { id: string }) =>
              clearAnnouncementSpy(params),
            milestonesControllerSeedV1: () => seedSpy(),
          },
        },
        {
          provide: WeddingConfigurationService,
          useValue: { weddingConfigControllerGetV1: () => of(currentConfig) },
        },
        {
          provide: AudiencesService,
          useValue: { audiencesControllerListV1: () => of({ items: currentAudiences }) },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);
    // Only the two keys below need real interpolation for the new specs to
    // assert on rendered numbers — every other key stays untranslated
    // (echoed back literally) so the existing raw-key assertions above stay
    // untouched.
    TestBed.inject(TranslateService).setTranslation(
      'en',
      {
        milestones: {
          announcement: {
            audienceCounts: '{{size}}/{{reachable}}',
            sendConfirm: {
              message:
                'Send {{title}} ({{type}}) to {{audience}} — {{recipientCount}} recipients, {{reachableCount}} reachable. Immediately.',
            },
          },
        },
      },
      true,
    );
    TestBed.inject(EntityServices)
      .getEntityCollectionService<MilestoneDto>(EntityNamesEnum.MILESTONE)
      .clearCache();
    TestBed.inject(EntityServices)
      .getEntityCollectionService<WeddingConfigResponseDto>(EntityNamesEnum.WEDDING_CONFIG)
      .clearCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function cardTitles(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.card-title')).map(
      (el) => (el as HTMLElement).textContent?.trim() ?? '',
    );
  }

  it('renders the list date-ascending regardless of API order', async () => {
    currentMilestones = [
      milestone({ id: 'm-jun', title: { es: '', en: 'June', fr: '' }, plannedDate: '2027-06-01' }),
      milestone({ id: 'm-jan', title: { es: '', en: 'January', fr: '' }, plannedDate: '2027-01-01' }),
      milestone({ id: 'm-mar', title: { es: '', en: 'March', fr: '' }, plannedDate: '2027-03-01' }),
    ];
    await create();

    expect(cardTitles()).toEqual(['January', 'March', 'June']);
  });

  it('places the Today marker before the first future milestone', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-03-15T10:00:00Z')); // Madrid CET, still "2027-03-15" there

    currentMilestones = [
      milestone({ id: 'm-past', title: { es: '', en: 'Past', fr: '' }, plannedDate: '2027-01-01' }),
      milestone({ id: 'm-future', title: { es: '', en: 'Future', fr: '' }, plannedDate: '2027-06-01' }),
    ];
    await create();

    const nodes = Array.from(
      fixture.nativeElement.querySelectorAll('.row .card-title, .today-marker'),
    );
    const labels = nodes.map((n) =>
      (n as HTMLElement).classList.contains('today-marker')
        ? 'TODAY'
        : (n as HTMLElement).textContent?.trim(),
    );
    expect(labels).toEqual(['Past', 'TODAY', 'Future']);
  });

  it('places the Today marker at the end when every milestone is in the past', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-08-01T10:00:00Z'));

    currentMilestones = [
      milestone({ id: 'm-jan', title: { es: '', en: 'January', fr: '' }, plannedDate: '2027-01-01' }),
      milestone({ id: 'm-jun', title: { es: '', en: 'June', fr: '' }, plannedDate: '2027-06-01' }),
    ];
    await create();

    const nodes = Array.from(
      fixture.nativeElement.querySelectorAll('.row .card-title, .today-marker'),
    );
    const labels = nodes.map((n) =>
      (n as HTMLElement).classList.contains('today-marker')
        ? 'TODAY'
        : (n as HTMLElement).textContent?.trim(),
    );
    expect(labels).toEqual(['January', 'June', 'TODAY']);
  });

  // Defect #2 (DS parity pass): the "Today" text belongs in the date column
  // (column 1, same as `.row-date`), and the accent divider + "N days to go"
  // countdown (column 3) was entirely absent before this fix.
  it('renders "Today" in the date column and a days-to-go countdown against the wedding date in the third column', async () => {
    vi.useFakeTimers();
    // Madrid, 10 days before `WEDDING_CONFIG_WITH_DATE`'s `date: '2027-06-05'`.
    vi.setSystemTime(new Date('2027-05-26T10:00:00Z'));

    currentMilestones = [
      milestone({ id: 'm-past', title: { es: '', en: 'Past', fr: '' }, plannedDate: '2027-01-01' }),
    ];
    currentConfig = WEDDING_CONFIG_WITH_DATE;
    await create();

    const marker = fixture.nativeElement.querySelector('.today-marker') as HTMLElement;
    expect(marker.querySelector('.today-date')?.textContent?.trim()).toBe('milestones.today');
    // Untranslated in this suite (only two keys carry real interpolation),
    // so the raw plural key — with the correct count baked into it by
    // `pluralTranslate` — is what actually renders.
    expect(marker.querySelector('.today-countdown-text')?.textContent).toContain(
      'milestones.daysToGo.plural',
    );
  });

  it('omits the days-to-go countdown text (but keeps the rest of the marker) when the config carries no wedding date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-05-26T10:00:00Z'));

    currentMilestones = [milestone({ id: 'm-past', plannedDate: '2027-01-01' })];
    currentConfig = WEDDING_CONFIG_NO_DATE;
    await create();

    const marker = fixture.nativeElement.querySelector('.today-marker') as HTMLElement;
    expect(marker.querySelector('.today-date')?.textContent?.trim()).toBe('milestones.today');
    expect(marker.querySelector('.today-countdown-text')).toBeNull();
    // The rail itself is still there — only the countdown text is omitted.
    expect(marker.querySelector('.today-rail')).not.toBeNull();
  });

  it('caps the milestone card at 560px so it never stretches full-bleed on a wide screen', async () => {
    currentMilestones = [milestone({ id: 'm1' })];
    await create();

    const card = fixture.nativeElement.querySelector('.card') as HTMLElement;
    expect(getComputedStyle(card).maxWidth).toBe('560px');
  });

  it('shows the "no wedding date" empty state (with a link to config) when the list is empty and no wedding date is set', async () => {
    currentMilestones = [];
    currentConfig = WEDDING_CONFIG_NO_DATE;
    await create();

    const html = fixture.nativeElement.textContent as string;
    expect(html).toContain('milestones.emptyNoDate.title');
    expect(html).not.toContain('milestones.emptyNoMilestones.title');

    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate');
    const configButton = Array.from(
      fixture.nativeElement.querySelectorAll('.empty-state button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.includes('milestones.emptyNoDate.cta'));
    configButton?.click();
    expect(navigateSpy).toHaveBeenCalledWith(['/config']);
  });

  it('shows the ordinary "create one" empty state, with a "start from the usual plan" seed button, when the couple deleted everything (a wedding date exists)', async () => {
    currentMilestones = [];
    currentConfig = WEDDING_CONFIG_WITH_DATE;
    await create();

    const html = fixture.nativeElement.textContent as string;
    expect(html).toContain('milestones.emptyNoMilestones.title');
    expect(html).not.toContain('milestones.emptyNoDate.title');
    // The header's "New milestone" button only renders once the list is
    // non-empty (DS `ScreenMilestones.jsx:164/170`: `items.length > 0`) — with
    // nothing to show, the empty state's own affordances below are the only
    // way to create one, so a second header button would be redundant here.
    expect(fixture.nativeElement.querySelector('.new-btn')).toBeNull();

    // T281 supersedes T279's "no re-seed offer": the seed button is now
    // present and wired, alongside the manual "create one" affordance —
    // neither replaces the other.
    const emptyStateButtons = Array.from(
      fixture.nativeElement.querySelectorAll('.empty-state button') as NodeListOf<HTMLButtonElement>,
    );
    expect(
      emptyStateButtons.some((b) => b.textContent?.includes('milestones.emptyNoMilestones.cta')),
    ).toBe(true);
    const seedButton = emptyStateButtons.find((b) =>
      b.textContent?.includes('milestones.emptyNoMilestones.seedCta'),
    );
    expect(seedButton).toBeTruthy();

    seedButton?.click();
    await settle();
    expect(seedSpy).toHaveBeenCalledTimes(1);
  });

  it('does not show the seed button in the "no wedding date" empty state (seeding would 400 without one)', async () => {
    currentMilestones = [];
    currentConfig = WEDDING_CONFIG_NO_DATE;
    await create();

    const html = fixture.nativeElement.textContent as string;
    expect(html).not.toContain('milestones.emptyNoMilestones.seedCta');
  });

  it('a successful seed refetches the collection and renders the server-returned rows', async () => {
    currentMilestones = [];
    currentConfig = WEDDING_CONFIG_WITH_DATE;
    await create();
    listSpy.mockClear();

    const seedButton = Array.from(
      fixture.nativeElement.querySelectorAll('.empty-state button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.includes('milestones.emptyNoMilestones.seedCta'))!;

    currentMilestones = [milestone({ id: 'seeded-1', title: { es: '', en: 'Seeded', fr: '' } })];
    seedButton.click();
    await settle();

    expect(seedSpy).toHaveBeenCalledTimes(1);
    expect(listSpy).toHaveBeenCalled();
    expect(cardTitles()).toContain('Seeded');
  });

  it('disables the seed button while the call is in flight (no double-submit)', async () => {
    currentMilestones = [];
    currentConfig = WEDDING_CONFIG_WITH_DATE;
    let resolveSeed!: (value: { seeded: number }) => void;
    seedFailure = null;
    seedSpy.mockImplementationOnce(
      () => new Observable((subscriber) => {
        resolveSeed = (value) => {
          subscriber.next(value);
          subscriber.complete();
        };
      }),
    );
    await create();

    const seedButton = Array.from(
      fixture.nativeElement.querySelectorAll('.empty-state button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.includes('milestones.emptyNoMilestones.seedCta'))!;

    seedButton.click();
    fixture.detectChanges();
    expect(seedButton.disabled).toBe(true);

    seedButton.click(); // No-op while in flight — no double-submit.
    resolveSeed({ seeded: 0 });
    await settle();

    expect(seedSpy).toHaveBeenCalledTimes(1);
  });

  it('a 409 on seed shows the "already has milestones" message, distinct from the generic error, and keeps the manual "create one" button usable', async () => {
    currentMilestones = [];
    currentConfig = WEDDING_CONFIG_WITH_DATE;
    seedFailure = throwError(() => new HttpErrorResponse({ status: 409 }));
    await create();

    const seedButton = Array.from(
      fixture.nativeElement.querySelectorAll('.empty-state button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.includes('milestones.emptyNoMilestones.seedCta'))!;

    seedButton.click();
    await settle();

    const html = fixture.nativeElement.textContent as string;
    expect(html).toContain('milestones.seed.conflict');
    expect(html).not.toContain('milestones.error.generic');

    // The manual "create one" button remains present and clickable — never
    // hidden or replaced by the (failed) seed attempt.
    const createButton = Array.from(
      fixture.nativeElement.querySelectorAll('.empty-state button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.includes('milestones.emptyNoMilestones.cta'))!;
    expect(createButton.disabled).toBe(false);
    createButton.click();
    await settle();
    expect(fixture.nativeElement.querySelector('.detail')).not.toBeNull();
  });

  it('never sends atRisk on create', async () => {
    currentMilestones = [];
    await create();

    openCreateFromEmptyState(fixture.nativeElement);
    await settle();

    const titleInput = fixture.nativeElement.querySelector(
      '.detail-body input[type="text"]',
    ) as HTMLInputElement;
    setInputValue(titleInput, 'Book the photographer');
    const dateInput = fixture.nativeElement.querySelector(
      '.detail-body input[type="date"]',
    ) as HTMLInputElement;
    setInputValue(dateInput, '2027-02-01');
    await settle();

    submitDetailForm(fixture.nativeElement);
    await settle();

    expect(createSpy).toHaveBeenCalledTimes(1);
    const dto = createSpy.mock.calls[0][0].createMilestoneDto;
    expect('atRisk' in dto).toBe(false);
  });

  it('never sends atRisk on update (rename/re-date)', async () => {
    currentMilestones = [
      milestone({ id: 'm1', title: { es: '', en: 'Original', fr: '' }, plannedDate: '2027-01-01' }),
    ];
    await create();

    fixture.nativeElement.querySelector('.card').click();
    await settle();

    const titleInput = fixture.nativeElement.querySelector(
      '.detail-body input[type="text"]',
    ) as HTMLInputElement;
    setInputValue(titleInput, 'Renamed');
    await settle();

    submitDetailForm(fixture.nativeElement);
    await settle();

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const dto = updateSpy.mock.calls[0][0].updateMilestoneDto;
    expect('atRisk' in dto).toBe(false);
  });

  // Defect #2 (DS compliance pass): the dedicated check-mark control is gone
  // — tick/untick now lives on the row's status-pill toggle button, but the
  // underlying persist-immediately behaviour it used to cover must still be
  // exercised somewhere.
  it('ticking the status pill toggles reached, persists immediately, and fills the rail dot', async () => {
    currentMilestones = [
      milestone({ id: 'm1', title: { es: '', en: 'Book venue', fr: '' }, reached: false }),
    ];
    await create();

    const dot = fixture.nativeElement.querySelector('.row .rail-dot') as HTMLElement;
    expect(dot.classList.contains('filled')).toBe(false);

    const toggle = fixture.nativeElement.querySelector('.row .pill-toggle') as HTMLButtonElement;
    toggle.click();
    await settle();

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const dto = updateSpy.mock.calls[0][0].updateMilestoneDto;
    expect(dto.reached).toBe(true);
    expect(dot.classList.contains('filled')).toBe(true);
  });

  // DS parity (third report on this screen): DS `ScreenMilestones.jsx`'s
  // `Row` puts the primary action on the card's own second line, not only
  // in the detail panel — a row-level "Send now" / "Mark done" pill,
  // `stopPropagation`-guarded so it never also opens (or, for the
  // guest-facing case, doesn't fight the confirm dialog it just opened via)
  // the card's own click handler.
  describe('row-level action button (DS `Row`: lives on the card, not only the detail panel)', () => {
    it('a guest-facing "Send now" row button opens the same send-confirm dialog the detail panel button uses, without the card\'s own click handler interfering', async () => {
      currentMilestones = [
        configuredGuestFacingMilestone({ id: 'm1', title: { es: '', en: 'Chase the stragglers', fr: '' } }),
      ];
      await create();

      const rowSendBtn = fixture.nativeElement.querySelector(
        '.row .row-action-send',
      ) as HTMLButtonElement;
      expect(rowSendBtn).toBeTruthy();
      expect(rowSendBtn.disabled).toBe(false);

      rowSendBtn.click();
      await settle();

      const message = fixture.nativeElement.querySelector('app-confirm-dialog .message')?.textContent;
      expect(message).toContain('Chase the stragglers');
      // Nothing sent yet — opening the confirmation is not sending.
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('the "Send now" row button is disabled under the same conditions as the detail panel button', async () => {
      currentMilestones = [configuredGuestFacingMilestone({ id: 'm1', audience: undefined })];
      await create();

      const rowSendBtn = fixture.nativeElement.querySelector(
        '.row .row-action-send',
      ) as HTMLButtonElement;
      expect(rowSendBtn.disabled).toBe(true);
    });

    it('renders no action button on the row once the guest-facing milestone is already sent — the metadata text alone communicates it', async () => {
      currentMilestones = [
        configuredGuestFacingMilestone({ id: 'm1', announcement: sentAnnouncement() }),
      ];
      await create();

      expect(fixture.nativeElement.querySelector('.row .row-action-send')).toBeNull();
      expect(fixture.nativeElement.querySelector('.row .row-action-mark-done')).toBeNull();
    });

    // Defect: a guest-facing milestone manually ticked `reached` (hub
    // ADR-0030 §4 — `reached` is settable independently of a send) kept
    // showing "Send now" on the row, merely disabled. Sending an
    // announcement for something already reached makes no sense — hide the
    // button outright rather than leave it clickable-looking-but-not.
    it('renders no "Send now" row button once a guest-facing milestone is manually marked reached, even though it was never sent', async () => {
      currentMilestones = [configuredGuestFacingMilestone({ id: 'm1', reached: true })];
      await create();

      expect(fixture.nativeElement.querySelector('.row .row-action-send')).toBeNull();
    });

    it('an internal "Mark done" row button calls the same reached-toggle as the pill-toggle, without opening the detail panel', async () => {
      currentMilestones = [
        milestone({ id: 'm1', kind: MilestoneDto.KindEnum.INTERNAL, reached: false }),
      ];
      await create();

      const rowMarkDoneBtn = fixture.nativeElement.querySelector(
        '.row .row-action-mark-done',
      ) as HTMLButtonElement;
      expect(rowMarkDoneBtn).toBeTruthy();

      rowMarkDoneBtn.click();
      await settle();

      expect(updateSpy).toHaveBeenCalledTimes(1);
      const dto = updateSpy.mock.calls[0][0].updateMilestoneDto;
      expect(dto.reached).toBe(true);
      // `stopPropagation()` keeps the card's own `(click)="openView(m.id)"`
      // from also firing — the detail panel never opens off this click.
      expect(fixture.nativeElement.querySelector('.detail')).toBeNull();
    });

    it('renders no action button on the row once the internal milestone is already reached — the metadata text alone communicates it', async () => {
      currentMilestones = [
        milestone({ id: 'm1', kind: MilestoneDto.KindEnum.INTERNAL, reached: true }),
      ];
      await create();

      expect(fixture.nativeElement.querySelector('.row .row-action-mark-done')).toBeNull();
      expect(fixture.nativeElement.querySelector('.row .row-action-send')).toBeNull();
    });
  });

  // Defect #3: an internal milestone's detail panel body had no visible,
  // labeled action at all — only the small, unlabeled header pill-toggle.
  // Both branches call the same `toggleReached()` path already covered by
  // the pill-toggle test above, so these only exercise the new control.
  describe('internal milestone "mark done" control (detail panel body)', () => {
    it('shows a hint and a "Mark as reached" button when not yet reached, which persists the toggle', async () => {
      currentMilestones = [
        milestone({ id: 'm1', kind: MilestoneDto.KindEnum.INTERNAL, reached: false }),
      ];
      await create();

      fixture.nativeElement.querySelector('.card').click();
      await settle();

      const body = fixture.nativeElement.querySelector('.detail-body') as HTMLElement;
      expect(body.textContent).toContain('milestones.internal.hint');
      const button = Array.from(body.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('milestones.markReached'),
      ) as HTMLButtonElement | undefined;
      expect(button).toBeTruthy();

      button?.click();
      await settle();

      expect(updateSpy).toHaveBeenCalledTimes(1);
      const dto = updateSpy.mock.calls[0][0].updateMilestoneDto;
      expect(dto.reached).toBe(true);
    });

    it('shows a plain "already reached" hint and an undo control when reached, which persists the toggle back', async () => {
      currentMilestones = [
        milestone({ id: 'm1', kind: MilestoneDto.KindEnum.INTERNAL, reached: true }),
      ];
      await create();

      fixture.nativeElement.querySelector('.card').click();
      await settle();

      const body = fixture.nativeElement.querySelector('.detail-body') as HTMLElement;
      expect(body.textContent).toContain('milestones.internal.reachedHint');
      const undoButton = Array.from(body.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('milestones.markNotReached'),
      ) as HTMLButtonElement | undefined;
      expect(undoButton).toBeTruthy();

      undoButton?.click();
      await settle();

      expect(updateSpy).toHaveBeenCalledTimes(1);
      const dto = updateSpy.mock.calls[0][0].updateMilestoneDto;
      expect(dto.reached).toBe(false);
    });
  });

  it('surfaces a failed rename/re-date as an error rather than showing it as saved', async () => {
    currentMilestones = [
      milestone({ id: 'm1', title: { es: '', en: 'Original', fr: '' }, plannedDate: '2027-01-01' }),
    ];
    updateFailure = throwError(() => new Error('boom'));
    await create();

    fixture.nativeElement.querySelector('.card').click();
    await settle();

    const titleInput = fixture.nativeElement.querySelector(
      '.detail-body input[type="text"]',
    ) as HTMLInputElement;
    setInputValue(titleInput, 'Renamed');
    await settle();

    submitDetailForm(fixture.nativeElement);
    await settle();

    expect((fixture.nativeElement.textContent as string)).toContain('milestones.error.generic');
    // The list still shows the original title — the failed rename never
    // appeared to save.
    expect(cardTitles()).toEqual(['Original']);
  });

  it('asks for confirmation before deleting, and dismissing keeps the milestone', async () => {
    currentMilestones = [milestone({ id: 'm1', title: { es: '', en: 'Keep me', fr: '' } })];
    await create();

    fixture.nativeElement.querySelector('.card').click();
    await settle();

    fixture.nativeElement.querySelector('.delete-btn').click();
    await settle();

    const actionButtons = fixture.nativeElement.querySelectorAll('app-confirm-dialog button.action');
    expect(actionButtons.length).toBe(2);

    // First action button is Cancel/Keep (T277: cancel always first, never toned).
    (actionButtons[0] as HTMLButtonElement).click();
    await settle();

    expect(removeSpy).not.toHaveBeenCalled();
    expect(cardTitles()).toEqual(['Keep me']);
  });

  it('actually deletes on confirm', async () => {
    currentMilestones = [milestone({ id: 'm1', title: { es: '', en: 'Bye', fr: '' } })];
    await create();

    fixture.nativeElement.querySelector('.card').click();
    await settle();
    fixture.nativeElement.querySelector('.delete-btn').click();
    await settle();

    const actionButtons = fixture.nativeElement.querySelectorAll('app-confirm-dialog button.action');
    (actionButtons[1] as HTMLButtonElement).click(); // Confirm (Remove)
    await settle();

    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed create as an error rather than showing it as saved', async () => {
    currentMilestones = [];
    createFailure = throwError(() => new Error('boom'));
    await create();

    openCreateFromEmptyState(fixture.nativeElement);
    await settle();

    const titleInput = fixture.nativeElement.querySelector(
      '.detail-body input[type="text"]',
    ) as HTMLInputElement;
    setInputValue(titleInput, 'Will fail');
    const dateInput = fixture.nativeElement.querySelector(
      '.detail-body input[type="date"]',
    ) as HTMLInputElement;
    setInputValue(dateInput, '2027-02-01');
    await settle();

    submitDetailForm(fixture.nativeElement);
    await settle();

    // The form stays open in create mode (never silently switches to "view"
    // as if a milestone had been created) and shows the error text.
    expect(fixture.nativeElement.querySelector('.detail-body')).not.toBeNull();
    expect((fixture.nativeElement.textContent as string)).toContain('milestones.error.generic');
    expect(cardTitles()).toEqual([]);
  });

  // ── T280: kind, announcement config, and the send button (hub ADR-0030) ──

  function chipByText(text: string): HTMLButtonElement | undefined {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.chip') as NodeListOf<HTMLButtonElement>,
    ).find((btn) => btn.textContent?.includes(text));
  }

  function saveButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      '.detail-actions button[type="submit"]',
    ) as HTMLButtonElement;
  }

  it('sends the chosen kind on create, and never sends announcement config at create time', async () => {
    currentMilestones = [];
    await create();

    openCreateFromEmptyState(fixture.nativeElement);
    await settle();

    chipByText('milestones.form.kind.guestFacing')?.click();
    await settle();

    setInputValue(
      fixture.nativeElement.querySelector('.detail-body input[type="text"]') as HTMLInputElement,
      'Chase the stragglers',
    );
    setInputValue(
      fixture.nativeElement.querySelector('.detail-body input[type="date"]') as HTMLInputElement,
      '2027-02-01',
    );
    await settle();

    submitDetailForm(fixture.nativeElement);
    await settle();

    expect(createSpy).toHaveBeenCalledTimes(1);
    const dto = createSpy.mock.calls[0][0].createMilestoneDto;
    expect(dto.kind).toBe(MilestoneDto.KindEnum.GUEST_FACING);
    // hub ADR-0030 §11c: a new guest-facing milestone always starts
    // unconfigured — creation and configuration are separate steps.
    expect('announcementType' in dto).toBe(false);
    expect('audience' in dto).toBe(false);
  });

  it('sends the chosen announcement type and audience via PATCH, not at creation', async () => {
    currentMilestones = [
      milestone({ id: 'm1', kind: MilestoneDto.KindEnum.GUEST_FACING, title: { es: '', en: 'Reminder', fr: '' } }),
    ];
    await create();

    fixture.nativeElement.querySelector('.card').click();
    await settle();

    chipByText('milestones.announcementType.rsvp-reminder')?.click();
    chipByText('milestones.audience.not-replied')?.click();
    await settle();

    saveButton().click();
    await settle();

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const dto = updateSpy.mock.calls[0][0].updateMilestoneDto;
    expect(dto.announcementType).toBe(MilestoneDto.AnnouncementTypeEnum.RSVP_REMINDER);
    expect(dto.audience).toBe(MilestoneDto.AudienceEnum.NOT_REPLIED);
  });

  it('shows both the recipient count and the reachable count on an audience chip', async () => {
    currentMilestones = [
      milestone({ id: 'm1', kind: MilestoneDto.KindEnum.GUEST_FACING, title: { es: '', en: 'Reminder', fr: '' } }),
    ];
    await create();

    fixture.nativeElement.querySelector('.card').click();
    await settle();

    const chip = chipByText('milestones.audience.not-replied');
    // DEFAULT_AUDIENCES: not-replied → size 40, reachableSize 35 — both
    // numbers, not just one.
    expect(chip?.textContent).toContain('40/35');
  });

  it('the confirmation states the milestone name, type, audience, recipient count, reachable count, and immediacy', async () => {
    currentMilestones = [
      configuredGuestFacingMilestone({ id: 'm1', title: { es: '', en: 'Chase the stragglers', fr: '' } }),
    ];
    await create();

    fixture.nativeElement.querySelector('.card').click();
    await settle();

    (fixture.nativeElement.querySelector('.send-btn') as HTMLButtonElement).click();
    await settle();

    const message = fixture.nativeElement.querySelector('app-confirm-dialog .message')?.textContent;
    expect(message).toContain('Chase the stragglers');
    // recipientCount / reachableCount for `not-replied` (DEFAULT_AUDIENCES).
    expect(message).toContain('40 recipients');
    expect(message).toContain('35 reachable');
    expect(message).toContain('Immediately');
    // Nothing sent yet — opening the confirmation is not sending.
    expect(sendSpy).not.toHaveBeenCalled();
  });

  describe('send button disabled conditions', () => {
    it('is not rendered at all for an internal milestone (not guest-facing)', async () => {
      currentMilestones = [milestone({ id: 'm1', kind: MilestoneDto.KindEnum.INTERNAL })];
      await create();

      fixture.nativeElement.querySelector('.card').click();
      await settle();

      expect(fixture.nativeElement.querySelector('.send-btn')).toBeNull();
      expect(fixture.nativeElement.querySelector('.announcement-config')).toBeNull();
    });

    it('is disabled with no announcement type set', async () => {
      currentMilestones = [
        configuredGuestFacingMilestone({ id: 'm1', announcementType: undefined }),
      ];
      await create();

      fixture.nativeElement.querySelector('.card').click();
      await settle();

      expect(
        (fixture.nativeElement.querySelector('.send-btn') as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it('is disabled with no audience set', async () => {
      currentMilestones = [configuredGuestFacingMilestone({ id: 'm1', audience: undefined })];
      await create();

      fixture.nativeElement.querySelector('.card').click();
      await settle();

      expect(
        (fixture.nativeElement.querySelector('.send-btn') as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it('is disabled when the audience evaluates empty', async () => {
      currentAudiences = DEFAULT_AUDIENCES.map((a) =>
        a.id === AudienceListResponseDtoItemsInner.IdEnum.NOT_REPLIED
          ? { ...a, size: 0, reachableSize: 0 }
          : a,
      );
      currentMilestones = [configuredGuestFacingMilestone({ id: 'm1' })];
      await create();

      fixture.nativeElement.querySelector('.card').click();
      await settle();

      expect(
        (fixture.nativeElement.querySelector('.send-btn') as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it('has no button at all once already sent — no "Send again"', async () => {
      currentMilestones = [
        configuredGuestFacingMilestone({ id: 'm1', announcement: sentAnnouncement() }),
      ];
      await create();

      fixture.nativeElement.querySelector('.card').click();
      await settle();

      expect(fixture.nativeElement.querySelector('.send-btn')).toBeNull();
      expect(fixture.nativeElement.querySelector('.mark-not-sent-btn')).not.toBeNull();
    });

    it('is enabled once guest-facing with a type, an audience, a non-empty audience, and no prior send', async () => {
      currentMilestones = [configuredGuestFacingMilestone({ id: 'm1' })];
      await create();

      fixture.nativeElement.querySelector('.card').click();
      await settle();

      expect(
        (fixture.nativeElement.querySelector('.send-btn') as HTMLButtonElement).disabled,
      ).toBe(false);
    });

    // Same defect as the row-level test above, exercised on the detail
    // panel: otherwise-sendable (type, audience, non-empty audience, no
    // prior announcement) but manually marked reached — no send button/hint
    // pair at all, just the reached-specific hint.
    it('renders no send button, only a reached hint, once an otherwise-sendable milestone is manually marked reached', async () => {
      currentMilestones = [configuredGuestFacingMilestone({ id: 'm1', reached: true })];
      await create();

      fixture.nativeElement.querySelector('.card').click();
      await settle();

      expect(fixture.nativeElement.querySelector('.send-btn')).toBeNull();
      const body = fixture.nativeElement.querySelector('.detail-body') as HTMLElement;
      expect(body.textContent).toContain('milestones.announcement.reachedHint');
      expect(body.textContent).not.toContain('milestones.announcement.sendHint');
      expect(body.textContent).not.toContain('milestones.announcement.sendDisabledHint');
    });
  });

  it('sends on confirm, and refreshes the list afterwards (the send response carries no updated version)', async () => {
    currentMilestones = [configuredGuestFacingMilestone({ id: 'm1', version: 3 })];
    await create();
    listSpy.mockClear();

    fixture.nativeElement.querySelector('.card').click();
    await settle();
    (fixture.nativeElement.querySelector('.send-btn') as HTMLButtonElement).click();
    await settle();

    const actionButtons = fixture.nativeElement.querySelectorAll('app-confirm-dialog button.action');
    (actionButtons[1] as HTMLButtonElement).click(); // Confirm (Yes, send now)
    await settle();

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][0]).toEqual({ id: 'm1', sendAnnouncementDto: { version: 3 } });
    expect(listSpy).toHaveBeenCalled();
  });

  it('a 409 on send surfaces information to the couple rather than retrying', async () => {
    currentMilestones = [configuredGuestFacingMilestone({ id: 'm1' })];
    sendFailure = throwError(() => new HttpErrorResponse({ status: 409 }));
    await create();
    listSpy.mockClear();

    fixture.nativeElement.querySelector('.card').click();
    await settle();
    (fixture.nativeElement.querySelector('.send-btn') as HTMLButtonElement).click();
    await settle();

    const actionButtons = fixture.nativeElement.querySelectorAll('app-confirm-dialog button.action');
    (actionButtons[1] as HTMLButtonElement).click(); // Confirm
    await settle();

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect((fixture.nativeElement.textContent as string)).toContain(
      'milestones.announcement.sendConflict',
    );
    // Re-read, not a silent swallow and not a retry.
    expect(listSpy).toHaveBeenCalled();
  });

  it('"mark as not sent" requires confirmation, and dismissing it changes nothing', async () => {
    currentMilestones = [
      configuredGuestFacingMilestone({ id: 'm1', announcement: sentAnnouncement() }),
    ];
    await create();

    fixture.nativeElement.querySelector('.card').click();
    await settle();

    (fixture.nativeElement.querySelector('.mark-not-sent-btn') as HTMLButtonElement).click();
    await settle();

    const actionButtons = fixture.nativeElement.querySelectorAll('app-confirm-dialog button.action');
    expect(actionButtons.length).toBe(2);

    // First action button is Cancel/Keep (T277: cancel always first, never toned).
    (actionButtons[0] as HTMLButtonElement).click();
    await settle();

    expect(clearAnnouncementSpy).not.toHaveBeenCalled();
    // The milestone is still shown as sent — nothing changed.
    expect(fixture.nativeElement.querySelector('.mark-not-sent-btn')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.send-btn')).toBeNull();
  });

  it('confirming "mark as not sent" clears the send record so the milestone becomes sendable again', async () => {
    currentMilestones = [
      configuredGuestFacingMilestone({ id: 'm1', announcement: sentAnnouncement() }),
    ];
    await create();

    fixture.nativeElement.querySelector('.card').click();
    await settle();
    (fixture.nativeElement.querySelector('.mark-not-sent-btn') as HTMLButtonElement).click();
    await settle();

    const actionButtons = fixture.nativeElement.querySelectorAll('app-confirm-dialog button.action');
    (actionButtons[1] as HTMLButtonElement).click(); // Confirm (Mark as not sent)
    await settle();

    expect(clearAnnouncementSpy).toHaveBeenCalledWith({ id: 'm1' });
  });

  it('never renders the two audiences the design kit shows but the API does not have', async () => {
    currentMilestones = [
      milestone({ id: 'm1', kind: MilestoneDto.KindEnum.GUEST_FACING, title: { es: '', en: 'Reminder', fr: '' } }),
    ];
    await create();

    fixture.nativeElement.querySelector('.card').click();
    await settle();

    // Exactly the four real audiences render, generically off the API
    // response — not a hand-listed five-item set.
    const chips = Array.from(
      fixture.nativeElement.querySelectorAll('.audience-chip') as NodeListOf<HTMLButtonElement>,
    );
    expect(chips.length).toBe(DEFAULT_AUDIENCES.length);

    const pageText = fixture.nativeElement.textContent as string;
    expect(pageText).not.toContain('Travelling from abroad');
    expect(pageText).not.toContain('Table hosts');
  });
});
