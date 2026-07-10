import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NAV_TABS } from '../nav-tabs';

/** Bottom tab bar, mobile (DS navigation/TabBar): Home · RSVP · Schedule · Album · Travel. */
@Component({
  selector: 'app-tab-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './tab-bar.html',
  styleUrl: './tab-bar.scss',
})
export class TabBar {
  readonly active = input('');
  protected readonly tabs = NAV_TABS;
}
