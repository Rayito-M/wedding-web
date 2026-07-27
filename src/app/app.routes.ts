import { Routes } from '@angular/router';
import { adminGuard, authGuard, publicOnlyGuard } from './core';

// Two zones:
//   Public       — welcome + login, reachable only when signed out (publicOnlyGuard).
//   Private       — everything under PrivateLayout, gated by authGuard; the layout
//                   renders the shared screen header / tab-bar around each child screen.
//
// Child route `data` drives the layout chrome:
//   tab    — active entry in the header nav / tab bar
//   tabBar — bottom tab bar on mobile (<900px)
//   topNav — desktop nav, shown in the screen header (≥900px)
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./screens/welcome/welcome').then((m) => m.Welcome),
    title: 'titles.welcome',
    canActivate: [publicOnlyGuard],
  },
  {
    path: 'login',
    loadComponent: () => import('./screens/login/login').then((m) => m.Login),
    title: 'titles.login',
    canActivate: [publicOnlyGuard],
  },
  {
    // OAuth redirect landing — runs unguarded while the user is mid-sign-in.
    path: 'login/callback/:provider',
    loadComponent: () =>
      import('./screens/social-callback/social-callback').then((m) => m.SocialCallback),
    title: 'titles.signingIn',
    canActivate: [publicOnlyGuard],
  },
  {
    // Magic link callback — runs unguarded while the user is mid-sign-in.
    path: 'login/magic-link/verify',
    loadComponent: () =>
      import('./screens/magic-link-callback/magic-link-callback').then((m) => m.MagicLinkCallback),
    title: 'titles.signingIn',
    canActivate: [publicOnlyGuard],
  },
  {
    path: '',
    loadComponent: () =>
      import('./layouts/private-layout/private-layout').then((m) => m.PrivateLayout),
    canActivate: [authGuard],
    children: [
      {
        path: 'rsvp',
        loadComponent: () => import('./screens/rsvp/rsvp').then((m) => m.Rsvp),
        title: 'titles.rsvp',
        data: { tab: 'rsvp', topNav: true },
      },
      {
        path: 'schedule',
        loadComponent: () => import('./screens/schedule/schedule').then((m) => m.Schedule),
        title: 'titles.schedule',
        data: { tab: 'schedule', tabBar: true, topNav: true },
      },
      {
        path: 'travel',
        loadComponent: () => import('./screens/travel/travel').then((m) => m.Travel),
        title: 'titles.travel',
        data: { tab: 'travel', tabBar: true, topNav: true },
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./screens/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'titles.dashboard',
        canActivate: [adminGuard],
        data: { tab: 'dashboard', tabBar: true, topNav: true },
      },
      {
        path: 'me',
        loadComponent: () => import('./screens/invitee/invitee').then((m) => m.Invitee),
        title: 'titles.invitee',
        data: { tab: 'home', tabBar: true, topNav: true },
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
