import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Monogram } from '../monogram/monogram';
import { NAV_TABS } from '../nav-tabs';

/** Desktop (≥900px) top nav: monogram left, text links right,
 *  same active-accent treatment as the tab bar. */
@Component({
  selector: 'app-top-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Monogram],
  template: `
    <a class="brand" routerLink="/welcome"><app-monogram [size]="20" /></a>
    <nav>
      @for (tab of tabs; track tab.id) {
        <a class="link" [class.on]="tab.id === active()" [routerLink]="tab.link">
          <span class="dot"></span>
          {{ tab.label }}
        </a>
      }
    </nav>
  `,
  styles: `
    :host {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 32px;
      background: var(--surface);
      border-bottom: 1px solid var(--line);
    }
    .brand {
      text-decoration: none;
    }
    nav {
      display: flex;
      gap: 28px;
    }
    .link {
      display: flex;
      align-items: center;
      gap: 7px;
      text-decoration: none;
      color: var(--sub);
      font-size: 13px;
      letter-spacing: 0.04em;
      font-weight: 500;
      transition: opacity 0.15s;
    }
    .link:hover {
      opacity: 0.85;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: transparent;
      border: 1px solid var(--line);
    }
    .link.on {
      color: var(--accent);
      font-weight: 600;
    }
    .link.on .dot {
      background: var(--accent);
      border: none;
    }
  `,
})
export class TopNav {
  readonly active = input('');
  protected readonly tabs = NAV_TABS;
}
