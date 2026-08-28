import type { Route } from '@angular/router';
import type { UserRole } from '@app/model';

import { routes } from '../app.routes';
import type { RouteChromeData } from '../core';

export interface NavTab {
  id: string;
  labelKey: string;
  link: string;
}

// Order mirrors the DS AppShell nav model (commit 90246bd):
//   base (all roles): home · rsvp · schedule · album · travel · people
//   couple-only:      guests · seating · config
// `home` is a single destination for both roles — it just resolves to the
// role-appropriate screen (guest → /me, couple → /dashboard); role filtering
// guarantees only one `home` entry is ever present in a rendered list.
export const NAV_TABS: NavTab[] = [
  { id: 'home', labelKey: 'nav.home', link: '/me' },
  { id: 'home', labelKey: 'nav.home', link: '/dashboard' },
  { id: 'rsvp', labelKey: 'nav.rsvp', link: '/rsvp' },
  { id: 'schedule', labelKey: 'nav.schedule', link: '/schedule' },
  { id: 'album', labelKey: 'nav.album', link: '/album' },
  { id: 'travel', labelKey: 'nav.travel', link: '/travel' },
  { id: 'people', labelKey: 'nav.people', link: '/people' },
  { id: 'guests', labelKey: 'nav.guests', link: '/guests' },
  { id: 'seating', labelKey: 'nav.seating', link: '/seating' },
  // Couple-only preparation timeline (hub ADR-0029, T279). `roles` on the
  // matching route (app.routes.ts) keeps this entry — and therefore any
  // knowledge that the timeline exists — out of a guest's nav entirely
  // (hub ADR-0029 §4.7).
  { id: 'milestones', labelKey: 'nav.milestones', link: '/milestones' },
  { id: 'config', labelKey: 'nav.config', link: '/config' },
];

// `roles` lives once, on the route (app.routes.ts `data`), keyed by path —
// not by `id`, since `home` deliberately labels two different routes/roles.
// Built once at module load by flattening the route tree.
const chromeDataByPath = new Map<string, RouteChromeData>();
(function collect(list: Route[]): void {
  for (const route of list) {
    if (route.path !== undefined && route.data) {
      chromeDataByPath.set(`/${route.path}`, route.data as RouteChromeData);
    }
    if (route.children) collect(route.children);
  }
})(routes);

/** Roles allowed to see the nav tab pointing at `link`, per its route's `data.roles`. */
export function rolesForLink(link: string): UserRole[] | undefined {
  return chromeDataByPath.get(link)?.roles;
}
