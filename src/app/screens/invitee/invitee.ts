import { Component, computed, inject, linkedSignal, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { map } from 'rxjs';

import { RouteConfigService } from '@app/core';

import {
  DEFAULT_HOME_SECTION,
  HOME_SECTION_PARAM,
  isHomeSection,
  type HomeSection,
} from '@app/shared/home-section';
import { GoodToKnow } from '@app/shared/good-to-know/good-to-know';
import { HomeSubnav } from '@app/shared/home-subnav/home-subnav';
import { HomeToday } from '@app/shared/home-today/home-today';
import { Travel } from '../travel/travel';

/**
 * The guest's Home (`/me`) — Home's umbrella pill row (Today · Getting there
 * · Good to know, hub ADR-0045 §4) over the default "Today" section
 * (`app-home-today`, T372's extraction of what used to be this screen's own
 * inline greeting/countdown/RSVP/highlights markup into a component shared
 * with `dashboard.ts`'s couple Home) and the two other sections, each its
 * own shared, full-data-owning component exactly like "Today":
 * `app-travel[embedded]` and `app-good-to-know`. This screen now owns only
 * the pill-row wiring — which section is active, and the `enabledRoutes`
 * gate on "Getting there" — matching `dashboard.ts`'s own Home-mode branch
 * (hub ADR-0045 §2/§3, T372: one shell shape, two roles).
 */
@Component({
  selector: 'app-invitee',
  imports: [HomeSubnav, GoodToKnow, HomeToday, Travel],
  templateUrl: './invitee.html',
  styleUrl: './invitee.scss',
})
export class Invitee {
  private readonly routeConfig = inject(RouteConfigService);

  /** Home's "Getting there" pill is the former `/travel` screen — still
   *  gated by `enabledRoutes` (hub ADR-0045 §6). */
  protected readonly hiddenSections = computed<HomeSection[]>(() =>
    this.routeConfig.isRouteEnabled('travel') ? [] : ['travel'],
  );

  private readonly requestedSection: Signal<string | null> = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => params.get(HOME_SECTION_PARAM))),
    { initialValue: null },
  );

  /** Home's active pill (hub ADR-0045 §4) — seeded from `?section=` so the
   *  `/travel` redirect (`core/guard/home-section-redirect.ts`) lands on
   *  "Getting there" directly, then owned locally exactly like this
   *  screen's own `?place=`-free `rsvp`/`schedule` links: a plain
   *  `linkedSignal`, never reflected back to the URL on a manual click. */
  protected readonly section = linkedSignal<string | null, HomeSection>({
    source: this.requestedSection,
    computation: (requested) => (isHomeSection(requested) ? requested : DEFAULT_HOME_SECTION),
  });

  protected selectSection(section: HomeSection): void {
    this.section.set(section);
  }
}
