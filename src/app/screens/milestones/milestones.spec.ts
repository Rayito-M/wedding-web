import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { provideEffects } from '@ngrx/effects';
import { EntityServices, provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
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
  /** Overridden per-test to simulate a failed write; `null` means "succeed
   *  with a sensible default response". */
  let createFailure: Observable<never> | null;
  let updateFailure: Observable<never> | null;

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

    createFailure = null;
    updateFailure = null;

    createSpy = vi.fn((params: { createMilestoneDto: Partial<MilestoneDto> }) => {
      if (createFailure) return createFailure;
      const dto = params.createMilestoneDto;
      return of({ ...milestone(), ...dto, id: 'new-id', version: 1 });
    });
    updateSpy = vi.fn((params: { id: string; updateMilestoneDto: Partial<MilestoneDto> }) => {
      if (updateFailure) return updateFailure;
      const existing = currentMilestones.find((m) => m.id === params.id) ?? milestone({ id: params.id });
      return of({ ...existing, ...params.updateMilestoneDto, id: params.id });
    });
    removeSpy = vi.fn(() => of(undefined));

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
            milestonesControllerListV1: () =>
              of({ items: currentMilestones, count: currentMilestones.length }),
            milestonesControllerCreateV1: (params: { createMilestoneDto: Partial<MilestoneDto> }) =>
              createSpy(params),
            milestonesControllerUpdateV1: (params: {
              id: string;
              updateMilestoneDto: Partial<MilestoneDto>;
            }) => updateSpy(params),
            milestonesControllerRemoveV1: (params: { id: string }) => removeSpy(params),
          },
        },
        {
          provide: WeddingConfigurationService,
          useValue: { weddingConfigControllerGetV1: () => of(currentConfig) },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);
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

  it('shows the ordinary "create one" empty state (no config link, no re-seed offer) when the couple deleted everything (a wedding date exists)', async () => {
    currentMilestones = [];
    currentConfig = WEDDING_CONFIG_WITH_DATE;
    await create();

    const html = fixture.nativeElement.textContent as string;
    expect(html).toContain('milestones.emptyNoMilestones.title');
    expect(html).not.toContain('milestones.emptyNoDate.title');
    expect(fixture.nativeElement.querySelector('.new-btn')).not.toBeNull();
  });

  it('never sends atRisk on create', async () => {
    currentMilestones = [];
    await create();

    fixture.nativeElement.querySelector('.new-btn').click();
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

    fixture.nativeElement.querySelector('.new-btn').click();
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
});
