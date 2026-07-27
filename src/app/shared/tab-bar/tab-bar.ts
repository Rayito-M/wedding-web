import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoginService } from '../../core';
import { NAV_TABS } from '../nav-tabs';

/** Bottom tab bar, mobile (DS navigation/TabBar): role-filtered nav entries. */
@Component({
  selector: 'app-tab-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './tab-bar.html',
  styleUrl: './tab-bar.scss',
})
export class TabBar {
  private readonly login = inject(LoginService);

  readonly active = input('');
  protected readonly tabs = computed(() =>
    NAV_TABS.filter((tab) => !tab.roles || tab.roles.includes(this.login.role())),
  );
}
