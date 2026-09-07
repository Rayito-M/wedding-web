import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  Signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EntityCollectionService, EntityServices } from '@ngrx/data';
import { map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  EntityNamesEnum,
  HeaderService,
  MilestoneDto,
  PluralTranslatePipe,
  RouteChromeData,
  RouteConfigService,
  StatisticService,
  TranslateLanguageService,
} from '../../core';
import { DashboardService } from '../../core/dashboard.service';
import { DecorFish } from '../../shared/decor/fish';
import {
  DEFAULT_HOME_SECTION,
  HOME_SECTION_PARAM,
  isHomeSection,
  type HomeSection,
} from '@app/shared/home-section';
import { GoodToKnow } from '@app/shared/good-to-know/good-to-know';
import { HomeSubnav } from '@app/shared/home-subnav/home-subnav';
import { HomeToday } from '@app/shared/home-today/home-today';
import { ProgressBar } from '../../shared/progress-bar/progress-bar';
import { StatTile } from '../../shared/stat-tile/stat-tile';
import { StatusPill } from '@app/shared/status-pill/status-pill';
import { Travel } from '../travel/travel';
// import { TaskRow } from '../../shared/task-row/task-row';

/** Mirrors `screens/milestones/milestones.ts`'s own `milestoneStatus()`
 *  (reached / at-risk / not-reached precedence) for the "plan so far" card's
 *  next-3 list (T370) — three lines, kept local rather than extracting a
 *  shared helper for one more call site. */
type MilestoneStatus = 'reached' | 'at-risk' | 'not-reached';
function milestoneStatus(m: MilestoneDto): MilestoneStatus {
  if (m.reached) return 'reached';
  if (m.atRisk) return 'at-risk';
  return 'not-reached';
}

/**
 * The couple's dashboard — mounted at **two** routes, matching DS
 * `ScreenHome`'s own `overview` flag (hub ADR-0045 §3, T364): one component,
 * two modes, rather than two components sharing this content by copy-paste.
 *
 * - `/dashboard` (`id: 'home'`) — the couple's Home, ADR-0045 §2/§4's
 *   umbrella: the SAME pill row (Today · Getting there · Good to know) AND
 *   the same "Today" content the guest's `/me` renders (`app-home-today`,
 *   T372) — kit `ScreenHome.jsx`'s `content` branch is one render for both
 *   roles, only dropping the RSVP recap for the couple (`HomeToday`'s own
 *   `isCouple` gate). Getting-there/Good-to-know are the same shared,
 *   full-data-owning sections `invitee.ts` mounts.
 * - `/overview` (`id: 'overview'`) — Manage's Overview, the door T362 left
 *   pointing at `guests` as an interim choice. Renders exactly what this
 *   route used to show at `/dashboard` before Home became the umbrella:
 *   the RSVP reply stats, head count and manage shortcuts, unchanged.
 *
 * `overview` is read once, off the activated route's own chrome `id`
 * (`app.routes.ts` already gives the two mounts distinct ids for active-tab
 * highlighting) rather than a dedicated route-data key — it is an existing
 * fact about which route this is, not a new one, and Angular gives this
 * component a fresh instance per route change, so reading it once at
 * construction is enough.
 */
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecorFish,
    ProgressBar,
    TranslatePipe,
    PluralTranslatePipe,
    RouterLink,
    StatTile,
    StatusPill,
    NgTemplateOutlet,
    HomeSubnav,
    HomeToday,
    GoodToKnow,
    Travel,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly dash = inject(DashboardService);
  protected readonly translate = inject(TranslateService);

  /** Same RSVP aggregates the guest manager header shows. */
  protected readonly statistics = inject(StatisticService);

  private readonly routeConfig = inject(RouteConfigService);
  private readonly route = inject(ActivatedRoute);

  protected readonly overview: boolean =
    (this.route.snapshot.data as RouteChromeData).id === 'overview';

  /** Home's "Getting there" pill is the former `/travel` screen — still
   *  gated by `enabledRoutes` (hub ADR-0045 §6: only enabled destinations
   *  appear). Meaningless in overview mode, but cheap to compute either way. */
  protected readonly hiddenSections = computed<HomeSection[]>(() =>
    this.routeConfig.isRouteEnabled('travel') ? [] : ['travel'],
  );

  private readonly requestedSection: Signal<string | null> = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get(HOME_SECTION_PARAM))),
    { initialValue: null },
  );

  /** Home's active pill — seeded from `?section=`, so the `/travel` redirect
   *  (`core/guard/home-section-redirect.ts`) lands on "Getting there"
   *  directly, then owned locally exactly like `travel.ts`'s own `?place=`
   *  (`linkedSignal`, not reflected back to the URL on a manual click). */
  protected readonly section = linkedSignal<string | null, HomeSection>({
    source: this.requestedSection,
    computation: (requested) => (isHomeSection(requested) ? requested : DEFAULT_HOME_SECTION),
  });

  /** The four RSVP captions, in the order the settled card renders them — the
   *  skeleton state shows the real labels and only hides the counts. */
  protected readonly pendingRsvpLabels = [
    'dashboard.rsvp.total',
    'dashboard.rsvp.attending',
    'dashboard.rsvp.pending',
    'dashboard.rsvp.declined',
  ];

  // ── "The plan so far" milestone-progress card (kit `ScreenHome.jsx`'s own
  //    `overviewContent` branch, T369/T370) — reuses the SAME `Milestone`
  //    @ngrx/data entity collection the `/milestones` screen already reads
  //    (`MilestoneDataService`, same `GET /v1/milestones`); no new endpoint,
  //    no new service. ─────────────────────────────────────────────────────
  private readonly milestoneCollection: EntityCollectionService<MilestoneDto> = inject(
    EntityServices,
  ).getEntityCollectionService<MilestoneDto>(EntityNamesEnum.MILESTONE);

  protected readonly milestones: Signal<MilestoneDto[]> = toSignal(
    this.milestoneCollection.entities$,
    { initialValue: [] },
  );

  protected readonly primaryLang = inject(TranslateLanguageService).currentLang;

  protected readonly milestonesReachedCount = computed(
    () => this.milestones().filter((m) => m.reached).length,
  );
  protected readonly milestonesOpenCount = computed(
    () => this.milestones().length - this.milestonesReachedCount(),
  );
  protected readonly milestonesOverdueCount = computed(
    () => this.milestones().filter((m) => !m.reached && m.atRisk).length,
  );
  protected readonly milestonesPercent = computed(() => {
    const total = this.milestones().length;
    return total ? Math.round((this.milestonesReachedCount() / total) * 100) : 0;
  });

  /** Soonest-first, not-yet-reached, capped at 3 — DS `ScreenHome.jsx`'s own
   *  `msNext` (`msOpen` sorted ascending, sliced to 3). */
  protected readonly upcomingMilestones = computed<MilestoneDto[]>(() =>
    this.milestones()
      .filter((m) => !m.reached)
      .slice()
      .sort((a, b) => (a.plannedDate < b.plannedDate ? -1 : 1))
      .slice(0, 3),
  );

  protected planStatus(m: MilestoneDto): MilestoneStatus {
    return milestoneStatus(m);
  }

  protected milestoneStatusLabelKey(m: MilestoneDto): string {
    const status = milestoneStatus(m);
    return status === 'reached'
      ? 'milestones.status.reached'
      : status === 'at-risk'
        ? 'milestones.status.atRisk'
        : 'milestones.status.notReached';
  }

  protected milestoneTitle(m: MilestoneDto): string {
    return m.title[this.primaryLang()];
  }

  constructor() {
    inject(HeaderService).set(inject(TranslateService).instant('shared.couple'));

    // Overview-only data (T372): the plain Home route no longer renders the
    // RSVP-stats/milestone-progress cards this feeds, so neither read fires
    // on a couple's ordinary Home visit.
    if (this.overview) {
      this.statistics.load();

      // Same "load once, off `loaded$`" pattern as `milestones.ts`'s own
      // constructor — this route may be the first (and only) place a
      // session ever asks for `/v1/milestones`, so the collection cannot be
      // assumed warm from a prior visit to `/milestones`.
      this.milestoneCollection.loaded$.subscribe((loaded) => {
        if (!loaded) this.milestoneCollection.getAll().subscribe();
      });
    }
  }

  daysTranslationKey() {
    return this.dash.daysToGo() === 1 ? 'dashboard.daysToGo_singular' : 'dashboard.daysToGo_plural';
  }

  protected selectSection(section: HomeSection): void {
    this.section.set(section);
  }
}
