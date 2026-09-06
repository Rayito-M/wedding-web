import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { type HomeSection } from '@app/shared/home-section';

interface HomeSubnavItem {
  readonly id: HomeSection;
  readonly labelKey: string;
}

const HOME_SUBNAV_ITEMS: readonly HomeSubnavItem[] = [
  { id: 'today', labelKey: 'home.today' },
  { id: 'travel', labelKey: 'home.gettingThere' },
  { id: 'info', labelKey: 'home.goodToKnow' },
];

/**
 * Home's pill row (DS `AppShell.subnav`, hub ADR-0045 §4) — Today · Getting
 * there · Good to know. Shared by both role-specific Home screens
 * (`dashboard`, `invitee`) rather than declared twice: the row itself carries
 * no role-specific behaviour, only which section id is active does, and each
 * screen owns that as its own local state (mirrors `travel.ts`'s own
 * `?place=` pattern — a screen-local `linkedSignal` seeded from the route's
 * query param, not lifted into a service).
 *
 * Visually reuses the same `pill-interactive`/`pill-interactive-selected`
 * recipes as `config-manager`'s own mobile section pills
 * (`configManager.scss`'s `.pills`/`.pill`) rather than re-typing the same
 * values a third time — CLAUDE.md's "use the generated style layers".
 */
@Component({
  selector: 'app-home-subnav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './home-subnav.html',
  styleUrl: './home-subnav.scss',
})
export class HomeSubnav {
  readonly active = input.required<HomeSection>();
  /** Sections to omit — hub ADR-0045 §6: "the nav shows only enabled
   *  destinations". "Getting there" is the former `/travel` screen, still
   *  gated by `enabledRoutes` (`RouteConfigService`); the caller passes
   *  `['travel']` here when that check fails, so the pill row can't offer a
   *  destination the guard would then block. */
  readonly hiddenSections = input<readonly HomeSection[]>([]);
  readonly sectionChange = output<HomeSection>();
  protected readonly items = computed(() =>
    HOME_SUBNAV_ITEMS.filter((item) => !this.hiddenSections().includes(item.id)),
  );
}
