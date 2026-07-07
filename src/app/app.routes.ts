import { Routes } from '@angular/router';
import { coupleGuard } from './core/couple.guard';

// Route data drives the shell chrome:
//   tab    — active entry in tab bar / top nav
//   tabBar — bottom tab bar on mobile (<900px)
//   topNav — top nav on desktop (≥900px)
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'welcome' },
  {
    path: 'welcome',
    loadComponent: () => import('./screens/welcome/welcome').then((m) => m.Welcome),
    title: 'Sara & Christophe · Save the date',
  },
  {
    path: 'rsvp',
    loadComponent: () => import('./screens/rsvp/rsvp').then((m) => m.Rsvp),
    title: 'RSVP · Sara & Christophe',
    data: { tab: 'rsvp', topNav: true },
  },
  {
    path: 'schedule',
    loadComponent: () => import('./screens/schedule/schedule').then((m) => m.Schedule),
    title: 'The day · Sara & Christophe',
    data: { tab: 'schedule', tabBar: true, topNav: true },
  },
  {
    path: 'travel',
    loadComponent: () => import('./screens/travel/travel').then((m) => m.Travel),
    title: 'Getting there · Sara & Christophe',
    data: { tab: 'travel', tabBar: true, topNav: true },
  },
  {
    path: 'album',
    loadComponent: () => import('./screens/album/album').then((m) => m.Album),
    title: 'Our album · Sara & Christophe',
    data: { tab: 'album', tabBar: true, topNav: true },
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./screens/dashboard/dashboard').then((m) => m.Dashboard),
    title: 'Dashboard · Sara & Christophe',
    canActivate: [coupleGuard],
  },
  {
    path: 'me',
    loadComponent: () => import('./screens/invitee/invitee').then((m) => m.Invitee),
    title: 'Your day · Sara & Christophe',
    data: { tab: 'home', tabBar: true, topNav: true },
  },
  { path: '**', redirectTo: 'welcome' },
];
