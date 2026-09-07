import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Observable, of } from 'rxjs';
import { provideEffects } from '@ngrx/effects';
import { provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  MilestoneDto,
  MilestoneListResponseDto,
  RsvpDto,
  RsvpListResponseDto,
  UserProfileDto,
  UserProfileListResponseDto,
  WeddingMilestonesService,
  WeddingRsvpService,
  WeddingUserProfileService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { Dashboard } from './dashboard';

/** Same fixture shape as `milestones.spec.ts`'s own `milestone()` helper —
 *  kept local rather than shared, matching that file's own precedent
 *  (`config-manager.spec.ts` / `milestones.spec.ts` each keep their own). */
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

/** A guest-list row, matching `statistic.service.spec.ts`'s own fixtures —
 *  `guestInfo.rsvp.id` is the join key `StatisticService.guestStatistics`
 *  reads against the separate `Rsvp` collection below. */
function guestProfile(overrides: Partial<UserProfileDto> = {}): UserProfileDto {
  return {
    id: 'g1',
    role: 'guest',
    firstName: 'Guest',
    lastName: 'One',
    ...overrides,
  } as UserProfileDto;
}

/** `.stats-card`'s four values, in template order: total, attending, pending,
 *  declined (`dashboard.html`'s `pendingRsvpLabels`). */
function rsvpStatValues(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll('.stats-card .stats .value')).map(
    (el) => (el as HTMLElement).textContent?.trim() ?? '',
  );
}

/** `.plan-card`'s three values, in template order: done, left, overdue
 *  (T370's milestone-progress computeds). */
function planStatValues(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll('.plan-card .stats .value')).map(
    (el) => (el as HTMLElement).textContent?.trim() ?? '',
  );
}

function planProgressPercent(root: HTMLElement): string | null {
  return root.querySelector('.plan-card .progress')?.getAttribute('aria-valuenow') ?? null;
}

/** `upcomingMilestones()`'s rendered rows, in DOM order (already soonest-first,
 *  capped at 3 — see `dashboard.ts`'s own doc comment). */
function planRowTitles(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll('.plan-row .plan-row-title')).map(
    (el) => (el as HTMLElement).textContent?.trim() ?? '',
  );
}

describe('Dashboard', () => {
  let fixture: ComponentFixture<Dashboard>;
  let currentMilestones: MilestoneDto[];
  let currentProfiles: UserProfileDto[];
  let currentRsvps: RsvpDto[];
  let milestonesListSpy: ReturnType<typeof vi.fn<() => Observable<MilestoneListResponseDto>>>;

  /**
   * `@ngrx/data`'s `EntityEffects` delays every query success by
   * `responseDelay` (10ms) — same wait shape as `milestones.spec.ts`'s own
   * `settle()`, copied verbatim rather than extracted for one more call site.
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

  /**
   * Mounts at `id: 'overview'` (Manage's Overview route, hub ADR-0045 §3) for
   * every test in this file — it renders the RSVP-stats/milestone "plan so
   * far" content directly, with no `HomeSubnav`/`?section=` machinery to
   * stand up first, and is exactly the content T370 added the milestone
   * computeds to (`dashboard.ts`'s own class doc: one component, two modes,
   * both rendering this same `#plan` template).
   */
  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        provideStore(),
        provideEffects(),
        provideEntityData(entityConfig, withEffects()),
        provideEntityDataServices(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { id: 'overview' } },
            queryParamMap: of(convertToParamMap({})),
          },
        },
        {
          provide: WeddingMilestonesService,
          useValue: { milestonesControllerListV1: () => milestonesListSpy() },
        },
        {
          provide: WeddingUserProfileService,
          useValue: {
            profileControllerGetAllV1: () =>
              of({
                items: currentProfiles,
                nextCursor: null,
              } as UserProfileListResponseDto),
          },
        },
        {
          provide: WeddingRsvpService,
          useValue: {
            rsvpControllerGetAllV1: () => of({ items: currentRsvps } as RsvpListResponseDto),
          },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    fixture = TestBed.createComponent(Dashboard);
    await settle();
  }

  beforeEach(() => {
    currentMilestones = [];
    currentProfiles = [];
    currentRsvps = [];
    milestonesListSpy = vi.fn(() =>
      of({ items: currentMilestones, count: currentMilestones.length }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Countdown / daysToGo (DashboardService.daysToGo, wrapping the pure
  //    `daysUntilWedding()` helper against the hardcoded WEDDING_DATE) ──────

  describe('the countdown', () => {
    it('shows the correct day count and the plural key with more than one day to go', async () => {
      vi.useFakeTimers();
      // 10:00 UTC reads as the same calendar date under every real timezone
      // this suite runs in — the same discipline `milestones.spec.ts` uses
      // for its own `vi.setSystemTime` calls. 10 days before WEDDING_DATE
      // (5 June 2027).
      vi.setSystemTime(new Date('2027-05-26T10:00:00Z'));
      await create();

      const h1 = fixture.nativeElement.querySelector('h1') as HTMLElement;
      expect(h1.querySelector('.accent')?.textContent?.trim()).toBe('10');
      expect(h1.textContent).toContain('dashboard.daysToGo_plural');
    });

    it('switches to the singular key with exactly one day to go', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2027-06-04T10:00:00Z')); // 1 day before
      await create();

      const h1 = fixture.nativeElement.querySelector('h1') as HTMLElement;
      expect(h1.querySelector('.accent')?.textContent?.trim()).toBe('1');
      expect(h1.textContent).toContain('dashboard.daysToGo_singular');
    });
  });

  // ── RSVP statistics bindings (StatisticService.guestStatistics /
  //    repliedPercent, shared with the guest-manager table header) ─────────

  describe('RSVP statistics bindings', () => {
    it('renders the real guest-statistics aggregates and replied percent once the profile/RSVP collections load', async () => {
      // Mirrors `statistic.service.spec.ts`'s own fixtures: g1 attends alone
      // (no partner2), g2 declined, g3 has no RSVP record at all and lands
      // in "pending" — total 3, replied 2 of 3 -> 67%.
      currentProfiles = [
        guestProfile({
          id: 'g1',
          guestInfo: { rsvp: { id: 'g1' } } as UserProfileDto['guestInfo'],
        }),
        guestProfile({
          id: 'g2',
          guestInfo: { rsvp: { id: 'g2' } } as UserProfileDto['guestInfo'],
        }),
        guestProfile({ id: 'g3' }),
      ];
      currentRsvps = [
        {
          id: 'g1',
          status: 'attending',
          adults: { partner1: { id: 'g1', firstName: 'Ada', lastName: 'Vance', attending: true } },
        },
        {
          id: 'g2',
          status: 'declined',
          adults: { partner1: { id: 'g2', firstName: 'Dee', lastName: 'Roth', attending: false } },
        },
      ] as unknown as RsvpDto[];
      await create();

      // total, attending, pending, declined (dashboard.html's own order).
      expect(rsvpStatValues(fixture.nativeElement)).toEqual(['3', '1', '1', '1']);
      expect(fixture.nativeElement.querySelector('.stats-card .progress')?.getAttribute(
        'aria-valuenow',
      )).toBe('67');
      // Not the skeleton — the real card is what rendered.
      expect(fixture.nativeElement.querySelector('.stats-card .value.skeleton')).toBeNull();
    });
  });

  // ── T370's milestone-progress computeds (empty / all-reached / mixed /
  //    undated) — previously covered only by e2e (Phase O hygiene, T371) ───

  describe('milestone-progress computeds (T370)', () => {
    it('shows all zeros and no upcoming list with no milestones at all', async () => {
      currentMilestones = [];
      await create();

      expect(planStatValues(fixture.nativeElement)).toEqual(['0', '0', '0']);
      expect(planProgressPercent(fixture.nativeElement)).toBe('0');
      expect(fixture.nativeElement.querySelector('.plan-next')).toBeNull();
    });

    it('reads 100% done with no overdue and no upcoming list when every milestone is reached', async () => {
      currentMilestones = [
        milestone({ id: 'm1', reached: true, plannedDate: '2027-01-01' }),
        milestone({ id: 'm2', reached: true, plannedDate: '2027-02-01' }),
      ];
      await create();

      expect(planStatValues(fixture.nativeElement)).toEqual(['2', '0', '0']);
      expect(planProgressPercent(fixture.nativeElement)).toBe('100');
      // upcomingMilestones() filters to !reached — nothing left to show.
      expect(fixture.nativeElement.querySelector('.plan-next')).toBeNull();
    });

    it('counts done/left/overdue correctly on a mixed set, rounds the percent, and lists the next 3 soonest-first', async () => {
      currentMilestones = [
        milestone({ id: 'm-reached', title: { es: '', en: 'Book venue', fr: '' }, reached: true, plannedDate: '2027-01-01' }),
        milestone({ id: 'm-risk', title: { es: '', en: 'Send invites', fr: '' }, reached: false, atRisk: true, plannedDate: '2027-02-01' }),
        milestone({ id: 'm-open-1', title: { es: '', en: 'Order cake', fr: '' }, reached: false, plannedDate: '2027-04-01' }),
        milestone({ id: 'm-open-2', title: { es: '', en: 'Pick playlist', fr: '' }, reached: false, plannedDate: '2027-03-01' }),
      ];
      await create();

      // 1 of 4 reached -> 25%; 3 left (everything not reached); 1 overdue
      // (atRisk && !reached) — milestonesOpenCount and milestonesOverdueCount
      // are independent computeds, not nested.
      expect(planStatValues(fixture.nativeElement)).toEqual(['1', '3', '1']);
      expect(planProgressPercent(fixture.nativeElement)).toBe('25');

      const overdueValue = fixture.nativeElement.querySelectorAll(
        '.plan-card .stats .value',
      )[2] as HTMLElement;
      expect(overdueValue.classList.contains('overdue')).toBe(true);

      // Soonest-first among the 3 not-yet-reached, capped at 3 (all 3 fit
      // here): Feb < Mar < Apr.
      expect(planRowTitles(fixture.nativeElement)).toEqual([
        'Send invites',
        'Pick playlist',
        'Order cake',
      ]);
    });

    it('caps the upcoming list at 3 even when more than 3 milestones are still open', async () => {
      currentMilestones = [
        milestone({ id: 'm1', title: { es: '', en: 'First', fr: '' }, plannedDate: '2027-01-01' }),
        milestone({ id: 'm2', title: { es: '', en: 'Second', fr: '' }, plannedDate: '2027-02-01' }),
        milestone({ id: 'm3', title: { es: '', en: 'Third', fr: '' }, plannedDate: '2027-03-01' }),
        milestone({ id: 'm4', title: { es: '', en: 'Fourth', fr: '' }, plannedDate: '2027-04-01' }),
      ];
      await create();

      expect(planStatValues(fixture.nativeElement)).toEqual(['0', '4', '0']);
      expect(planRowTitles(fixture.nativeElement)).toEqual(['First', 'Second', 'Third']);
    });

    it('an undated milestone (empty plannedDate) sorts first and renders no date, rather than crashing the date pipe', async () => {
      // `MilestoneDto.plannedDate` is a required `string` at the API level,
      // but nothing in this component's own computeds assumes it is
      // non-empty — `DatePipe.transform('')` returns `null` (Angular's own
      // `value === ''` short-circuit), not a thrown `InvalidPipeArgument`.
      currentMilestones = [
        milestone({ id: 'm-undated', title: { es: '', en: 'Mystery task', fr: '' }, plannedDate: '' }),
        milestone({ id: 'm-dated', title: { es: '', en: 'Confirm menu', fr: '' }, plannedDate: '2027-03-01' }),
      ];
      await create();

      // '' sorts before any real ISO date string.
      expect(planRowTitles(fixture.nativeElement)).toEqual(['Mystery task', 'Confirm menu']);
      const undatedRow = fixture.nativeElement.querySelector(
        '.plan-row .plan-row-date',
      ) as HTMLElement;
      expect(undatedRow.textContent?.trim()).toBe('');
    });
  });
});
