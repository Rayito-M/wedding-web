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
import { NAV_TABS } from '../nav-tabs';
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

  protected readonly overflows = computed(() => this.visibleTabs().length > this.maxTabs + 1);
  protected readonly primaryTabs = computed(() =>
    this.overflows() ? this.visibleTabs().slice(0, this.maxTabs) : this.visibleTabs(),
  );
  protected readonly restTabs = computed(() =>
    this.overflows() ? this.visibleTabs().slice(this.maxTabs) : [],
  );
  protected readonly inRest = computed(() =>
    this.restTabs().some((tab) => tab.id === this.active()),
  );
  protected readonly activeRestTab = computed(() =>
    this.restTabs().find((tab) => tab.id === this.active()),
  );

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
