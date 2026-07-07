export interface NavTab {
  id: string;
  label: string;
  link: string;
}

export const NAV_TABS: NavTab[] = [
  { id: 'home', label: 'Home', link: '/me' },
  { id: 'rsvp', label: 'RSVP', link: '/rsvp' },
  { id: 'schedule', label: 'Schedule', link: '/schedule' },
  { id: 'album', label: 'Album', link: '/album' },
  { id: 'travel', label: 'Travel', link: '/travel' },
];
