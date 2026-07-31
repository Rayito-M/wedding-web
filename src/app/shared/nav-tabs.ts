import type { UserRole } from '@app/model';

export interface NavTab {
  id: string;
  labelKey: string;
  link: string;
  /** Roles this tab is shown to. Absent means every authenticated user. */
  roles?: UserRole[];
}

export const NAV_TABS: NavTab[] = [
  { id: 'home', labelKey: 'nav.home', link: '/me', roles: ['guest'] },
  { id: 'dashboard', labelKey: 'nav.dashboard', link: '/dashboard', roles: ['groom', 'bride'] },
  { id: 'guests', labelKey: 'nav.guests', link: '/guests', roles: ['groom', 'bride'] },
  { id: 'config', labelKey: 'nav.config', link: '/config', roles: ['groom', 'bride'] },
  { id: 'rsvp', labelKey: 'nav.rsvp', link: '/rsvp', roles: ['guest'] },
  { id: 'schedule', labelKey: 'nav.schedule', link: '/schedule' },
  { id: 'album', labelKey: 'nav.album', link: '/album' },
  { id: 'travel', labelKey: 'nav.travel', link: '/travel' },
];
