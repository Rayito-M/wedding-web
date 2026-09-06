import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { LoginService, RouteConfigService } from '../../core';
import { MANAGE_GROUP_TABS, NAV_TABS, type NavTab } from '../nav-tabs';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Bottom tab bar, mobile (DS navigation/TabBar): role-filtered nav entries.
 * Beyond `MAX_TABS` visible destinations, the rest move into a "More" sheet
 * that rises from behind the bar.
 */
@Component({
  selector: 'app-tab-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './tab-bar.html',
  styleUrl: './tab-bar.scss',
})
export class TabBar {
  private readonly login = inject(LoginService);
  private readonly routeConfig = inject(RouteConfigService);

  /** Most tabs that stay legible in a single row before overflowing to the sheet. */
  private readonly maxTabs = 4;

  readonly active = input('');
  readonly open = signal(false);

  // Filtered once (role + enabled-route) before slicing into primary/rest, so
  // a disabled route can't eat a "primary slot" and desync the overflow math.
  protected readonly visibleTabs = computed(() =>
    NAV_TABS.filter(
      (tab) =>
        (!tab.roles || tab.roles.includes(this.login.role())) &&
        this.routeConfig.isRouteEnabled(tab.link),
    ),
  );

  // DS `TabBar.jsx`: a standout tab buys the row one extra slot before
  // overflow, because it is a door rather than a sixth peer competing for
  // the same room as the other five (`hasStandout ? maxTabs + 2 : maxTabs + 1`).
  private readonly hasStandout = computed(() => this.visibleTabs().some((tab) => tab.standout));
  protected readonly overflows = computed(
    () => this.visibleTabs().length > this.maxTabs + (this.hasStandout() ? 2 : 1),
  );
  protected readonly primaryTabs = computed(() =>
    this.overflows() ? this.visibleTabs().slice(0, this.maxTabs) : this.visibleTabs(),
  );
  protected readonly restTabs = computed(() =>
    this.overflows() ? this.visibleTabs().slice(this.maxTabs) : [],
  );
  protected readonly inRest = computed(() => this.restTabs().some((tab) => this.isOn(tab)));
  protected readonly activeRestTab = computed(() =>
    this.restTabs().find((tab) => this.isOn(tab)),
  );

  /**
   * Whether `tab` reads as active — the group-aware check hub ADR-0045 §3
   * needs (the risk T362 carried forward). A plain tab is active only when
   * its own id matches the route; the standout (Manage) tab is also active
   * while the route is any *member* of its group — a couple on `/guests`,
   * `/milestones` or `/config` sees `active()` as that route's own chrome
   * id (`'milestones'`, `'config'`, …), never `'manage'` itself, since the
   * synthesized Manage tab's `id` never appears as a route's own chrome id.
   * Membership comes from {@link MANAGE_GROUP_TABS} — the same route-derived
   * list `nav-tabs.ts` exports — never a hand-copied set of paths.
   */
  protected isOn(tab: NavTab): boolean {
    if (!tab.standout) return tab.id === this.active();
    const activeId = this.active();
    return activeId === tab.id || MANAGE_GROUP_TABS.some((member) => member.id === activeId);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeSheet();
  }

  toggleSheet(): void {
    this.open.update((value) => !value);
  }

  closeSheet(): void {
    this.open.set(false);
  }
}
