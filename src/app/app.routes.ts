import { Routes } from '@angular/router';
import { adminGuard, authGuard, publicOnlyGuard, routeEnabledGuard } from './core';

// Two zones:
//   Public       — welcome + login, reachable only when signed out (publicOnlyGuard).
//   Private       — everything under PrivateLayout, gated by authGuard; the layout
//                   renders the shared screen header / tab-bar around each child screen.
//
// Child route `data` drives the layout chrome:
//   tab    — active entry in the header nav / tab bar
//   tabBar — bottom tab bar on mobile (<900px)
//   topNav — desktop nav, shown in the screen header (≥900px)
//   moto   — decorative motorcycle-rider crossing above the mobile tab bar
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
    // GA disclosure (ADR-0027) linked from the consent banner's note line
    // (T250). Reachable whether the visitor is signed in or not — no guard.
    path: 'privacy-policy',
    loadComponent: () =>
      import('./screens/privacy-policy/privacy-policy').then((m) => m.PrivacyPolicy),
    title: 'titles.privacyPolicy',
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
        canActivate: [routeEnabledGuard],
        data: { tab: 'rsvp', tabBar: true, topNav: true },
      },
      {
        path: 'schedule',
        loadComponent: () => import('./screens/schedule/schedule').then((m) => m.Schedule),
        title: 'titles.schedule',
        canActivate: [routeEnabledGuard],
        data: { tab: 'schedule', tabBar: true, topNav: true, moto: true },
      },
      {
        path: 'travel',
        loadComponent: () => import('./screens/travel/travel').then((m) => m.Travel),
        title: 'titles.travel',
        canActivate: [routeEnabledGuard],
        data: { tab: 'travel', tabBar: true, topNav: true, moto: true },
      },
      {
        path: 'album',
        loadComponent: () => import('./screens/album/album').then((m) => m.Album),
        title: 'titles.album',
        canActivate: [routeEnabledGuard],
        data: { tab: 'album', tabBar: true, topNav: true, moto: true },
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./screens/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'titles.dashboard',
        canActivate: [adminGuard, routeEnabledGuard],
        // Unified "Home" nav destination for the couple role (guest home is /me).
        data: { tab: 'home', tabBar: true, topNav: true },
      },
      {
        path: 'people',
        loadComponent: () => import('./screens/people/people').then((m) => m.People),
        title: 'titles.people',
        canActivate: [routeEnabledGuard],
        data: { tab: 'people', tabBar: true, topNav: true },
      },
      {
        path: 'config',
        loadComponent: () =>
          import('./screens/config-manager/config-manager').then((m) => m.ConfigManager),
        title: 'titles.config',
        canActivate: [adminGuard, routeEnabledGuard],
        data: { tab: 'config', tabBar: true, topNav: true },
      },
      {
        path: 'guests',
        loadComponent: () =>
          import('./screens/guest-manager/guest-manager').then((m) => m.GuestManager),
        title: 'titles.guestManager',
        canActivate: [adminGuard, routeEnabledGuard],
        data: { tab: 'guests', tabBar: true, topNav: true },
      },
      {
        path: 'seating',
        loadComponent: () =>
          import('./screens/seating-plan/seating-plan').then((m) => m.SeatingPlan),
        title: 'titles.seating',
        canActivate: [adminGuard, routeEnabledGuard],
        data: { tab: 'seating', tabBar: true, topNav: true },
      },
      {
        // Couple-only preparation timeline (hub ADR-0029, T279). Admin-gated
        // like `config`/`guests`/`seating` — a guest must never reach this
        // route (hub ADR-0029 §4.7).
        path: 'milestones',
        loadComponent: () =>
          import('./screens/milestones/milestones').then((m) => m.Milestones),
        title: 'titles.milestones',
        canActivate: [adminGuard, routeEnabledGuard],
        data: { tab: 'milestones', tabBar: true, topNav: true },
      },
      {
        path: 'me',
        loadComponent: () => import('./screens/invitee/invitee').then((m) => m.Invitee),
        title: 'titles.invitee',
        canActivate: [routeEnabledGuard],
        data: { tab: 'home', tabBar: true, topNav: true },
      },
      {
        // Reached only from the account dropdown (ScreenHeader), never the tab
        // bar / desktop nav — `tab: 'profile'` deliberately matches no
        // `NAV_TABS` entry, so nothing highlights, but the full chrome still
        // renders around it.
        path: 'profile',
        loadComponent: () => import('./screens/profile/profile').then((m) => m.Profile),
        title: 'titles.profile',
        canActivate: [routeEnabledGuard],
        data: { tab: 'profile', tabBar: true, topNav: true },
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
