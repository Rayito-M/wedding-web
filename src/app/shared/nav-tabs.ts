import { UserRole } from '../core';

export interface NavTab {
  id: string;
  label: string;
  link: string;
  /** Roles this tab is shown to. Absent means every authenticated user. */
  roles?: UserRole[];
}

export const NAV_TABS: NavTab[] = [
  { id: 'home', label: 'Home', link: '/me', roles: ['guest'] },
  { id: 'dashboard', label: 'Dashboard', link: '/dashboard', roles: ['admin'] },
  { id: 'config', label: 'Config', link: '/config', roles: ['admin'] },
  { id: 'rsvp', label: 'RSVP', link: '/rsvp', roles: ['guest'] },
  { id: 'schedule', label: 'Schedule', link: '/schedule' },
  { id: 'travel', label: 'Travel', link: '/travel' },
];
