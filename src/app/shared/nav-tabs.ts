import type { Route } from '@angular/router';
import type { UserRole } from '@app/model';

import { routes } from '../app.routes';
import type { RouteChromeData } from '../core';

export interface NavTab {
  id: string;
  labelKey: string;
  link: string;
  /** Roles allowed to see this tab. Absent = any authenticated role. */
  roles?: UserRole[];
}

// Order mirrors the DS AppShell nav model (commit 90246bd): a route cannot
// know it is third, so this stays an explicit constant — but as a list of
// ids, not hand-copied objects (hub ADR-0042 §6). `home` appears once even
// though two routes carry it (`/dashboard`, `/me`): role filtering
// guarantees only one is ever rendered.
const NAV_ORDER: readonly string[] = [
  'home',
  'rsvp',
  'schedule',
  'album',
  'travel',
  'people',
  'guests',
  'seating',
  'milestones',
  'config',
];

/**
 * Walks the route tree once at module load, emitting one `NavTab` per route
 * whose `data` sets `tabBar` or `topNav` — `link` and `roles` come straight
 * off that route, so there is no separate lookup left to drift out of sync
 * with it (hub ADR-0042 §6). The previous `rolesForLink()` lookup failed
 * open on a path miss: it returned `undefined`, and `undefined` read as "no
 * role restriction" — a route rename that wasn't mirrored into a
 * hand-written `link` could put a couple-only screen in every guest's nav
 * (hub ADR-0029 §4.7).
 */
function collect(list: Route[]): NavTab[] {
  const tabs: NavTab[] = [];
  for (const route of list) {
    const data = route.data as RouteChromeData | undefined;
    if (route.path !== undefined && data?.navLabel !== undefined && (data.tabBar || data.topNav)) {
      tabs.push({
        id: data.id,
        labelKey: data.navLabel,
        link: `/${route.path}`,
        roles: data.roles,
      });
    }
    if (route.children) tabs.push(...collect(route.children));
  }
  return tabs;
}

export const NAV_TABS: NavTab[] = collect(routes).sort(
  (a, b) => NAV_ORDER.indexOf(a.id) - NAV_ORDER.indexOf(b.id),
);
