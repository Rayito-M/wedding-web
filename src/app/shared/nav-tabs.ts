import type { UserRole } from '@app/model';

export interface NavTab {
  id: string;
  labelKey: string;
  link: string;
  /** Roles this tab is shown to. Absent means every authenticated user. */
  roles?: UserRole[];
}

// Order mirrors the DS AppShell nav model (commit 90246bd):
//   base (all roles): home · rsvp · schedule · album · travel · people
//   couple-only:      guests · seating · config
// `home` is a single destination for both roles — it just resolves to the
// role-appropriate screen (guest → /me, couple → /dashboard); role filtering
// guarantees only one `home` entry is ever present in a rendered list.
// `people` is intentionally omitted for now: its screen/route doesn't exist yet
// (T237). Add it here once built.
export const NAV_TABS: NavTab[] = [
  { id: 'home', labelKey: 'nav.home', link: '/me', roles: ['guest'] },
  { id: 'home', labelKey: 'nav.home', link: '/dashboard', roles: ['groom', 'bride'] },
  { id: 'rsvp', labelKey: 'nav.rsvp', link: '/rsvp', roles: ['guest'] },
  { id: 'schedule', labelKey: 'nav.schedule', link: '/schedule' },
  { id: 'album', labelKey: 'nav.album', link: '/album' },
  { id: 'travel', labelKey: 'nav.travel', link: '/travel' },
  { id: 'people', labelKey: 'nav.people', link: '/people' },
  { id: 'guests', labelKey: 'nav.guests', link: '/guests', roles: ['groom', 'bride'] },
  { id: 'seating', labelKey: 'nav.seating', link: '/seating', roles: ['groom', 'bride'] },
  { id: 'config', labelKey: 'nav.config', link: '/config', roles: ['groom', 'bride'] },
];
