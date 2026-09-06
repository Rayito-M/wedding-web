import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  Signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  HeaderService,
  PluralTranslatePipe,
  RouteChromeData,
  RouteConfigService,
  StatisticService,
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
import { ProgressBar } from '../../shared/progress-bar/progress-bar';
import { StatTile } from '../../shared/stat-tile/stat-tile';
import { Travel } from '../travel/travel';
// import { TaskRow } from '../../shared/task-row/task-row';

/**
 * The couple's dashboard — mounted at **two** routes, matching DS
 * `ScreenHome`'s own `overview` flag (hub ADR-0045 §3, T364): one component,
 * two modes, rather than two components sharing this content by copy-paste.
 *
 * - `/dashboard` (`id: 'home'`) — the couple's Home, ADR-0045 §2/§4's
 *   umbrella: a pill row (Today · Getting there · Good to know) over this
 *   same planning content as "Today", the former top-level Travel screen
 *   embedded as "Getting there", and a new "Good to know" placeholder (see
 *   `GoodToKnow`'s own doc for why it has no real content yet).
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
    DecorFish,
    ProgressBar,
    TranslatePipe,
    PluralTranslatePipe,
    RouterLink,
    StatTile,
    NgTemplateOutlet,
    HomeSubnav,
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

  constructor() {
    inject(HeaderService).set(inject(TranslateService).instant('shared.couple'));
    this.statistics.load();
  }

  daysTranslationKey() {
    return this.dash.daysToGo() === 1 ? 'dashboard.daysToGo_singular' : 'dashboard.daysToGo_plural';
  }

  protected selectSection(section: HomeSection): void {
    this.section.set(section);
  }
}
