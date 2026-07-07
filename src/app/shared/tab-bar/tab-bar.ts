import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NAV_TABS } from '../nav-tabs';

/** Bottom tab bar (mobile): Home · RSVP · Schedule · Album · Travel. */
@Component({
  selector: 'app-tab-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @for (tab of tabs; track tab.id) {
      <a class="tab" [class.on]="tab.id === active()" [routerLink]="tab.link">
        <span class="dot"></span>
        {{ tab.label }}
      </a>
    }
  `,
  styles: `
    :host {
      flex: 0 0 auto;
      border-top: 1px solid var(--line);
      background: var(--surface);
      display: flex;
      padding: 10px 6px 14px;
      gap: 2px;
    }
    .tab {
      flex: 1;
      padding: 6px 0 2px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      text-decoration: none;
      color: var(--sub);
      font-size: 10px;
      letter-spacing: 0.04em;
      font-weight: 500;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: transparent;
      border: 1px solid var(--line);
    }
    .tab.on {
      color: var(--accent);
      font-weight: 600;
    }
    .tab.on .dot {
      background: var(--accent);
      border: none;
    }
  `,
})
export class TabBar {
  readonly active = input('');
  protected readonly tabs = NAV_TABS;
}
