import { Routes } from '@angular/router';
import { publicOnlyGuard, rbacGuard, routeEnabledGuard, RouteChromeData } from './core';

// Two zones:
//   Public       — welcome + login, reachable only when signed out (publicOnlyGuard).
//   Private       — everything under PrivateLayout, gated by rbacGuard; the layout
//                   renders the shared screen header / tab-bar around each child screen.
//
// Child route `data` (typed `RouteChromeData`) is the single source of truth for
// both RBAC and nav chrome — `rbacGuard` reads `roles` directly, and
// `shared/nav-tabs.ts` walks this tree once at module load, emitting a
// `NavTab` per route whose `tabBar`/`topNav` is set and carrying `roles` and
// `navLabel` straight off it (hub ADR-0042 §6). There is no separate lookup
// by path — the previous one failed open on a miss (hub ADR-0029 §4.7):
//   id       — joins this route to its NavTab entry, for active-tab highlighting
//              (not unique: `home` deliberately labels both `/dashboard` and `/me`)
//   roles    — roles allowed to activate the route; absent = any authenticated role
//   tabBar   — bottom tab bar on mobile (<900px)
//   topNav   — desktop nav, shown in the screen header (≥900px)
//   navLabel — i18n key for the nav entry; required whenever tabBar or topNav is
//              true (hub ADR-0042 §7 — a missing label must not compile)
//   moto     — decorative motorcycle-rider crossing above the mobile tab bar
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./screens/welcome/welcome').then((m) => m.Welcome),
    title: 'titles.welcome',
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
    canActivate: [rbacGuard],
    children: [
      {
        path: 'rsvp',
        loadComponent: () => import('./screens/rsvp/rsvp').then((m) => m.Rsvp),
        title: 'titles.rsvp',
        canActivate: [rbacGuard, routeEnabledGuard],
        data: {
          id: 'rsvp',
          roles: ['guest'],
          tabBar: true,
          topNav: true,
          navLabel: 'nav.rsvp',
        } satisfies RouteChromeData,
      },
      {
        path: 'schedule',
        loadComponent: () => import('./screens/schedule/schedule').then((m) => m.Schedule),
        title: 'titles.schedule',
        canActivate: [routeEnabledGuard],
        data: {
          id: 'schedule',
          tabBar: true,
          topNav: true,
          moto: true,
          navLabel: 'nav.schedule',
        } satisfies RouteChromeData,
      },
      {
        path: 'travel',
        loadComponent: () => import('./screens/travel/travel').then((m) => m.Travel),
        title: 'titles.travel',
        canActivate: [routeEnabledGuard],
        data: {
          id: 'travel',
          tabBar: true,
          topNav: true,
          moto: true,
          navLabel: 'nav.travel',
        } satisfies RouteChromeData,
      },
      {
        path: 'album',
        loadComponent: () => import('./screens/album/album').then((m) => m.Album),
        title: 'titles.album',
        canActivate: [routeEnabledGuard],
        data: {
          id: 'album',
          tabBar: true,
          topNav: true,
          moto: true,
          navLabel: 'nav.album',
        } satisfies RouteChromeData,
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./screens/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'titles.dashboard',
        canActivate: [rbacGuard, routeEnabledGuard],
        // Unified "Home" nav destination for the couple role (guest home is /me).
        data: {
          id: 'home',
          roles: ['groom', 'bride'],
          tabBar: true,
          topNav: true,
          navLabel: 'nav.home',
        } satisfies RouteChromeData,
      },
      {
        path: 'people',
        loadComponent: () => import('./screens/people/people').then((m) => m.People),
        title: 'titles.people',
        canActivate: [rbacGuard, routeEnabledGuard],
        data: {
          id: 'people',
          tabBar: true,
          topNav: true,
          navLabel: 'nav.people',
        } satisfies RouteChromeData,
      },
      {
        path: 'config',
        loadComponent: () =>
          import('./screens/config-manager/config-manager').then((m) => m.ConfigManager),
        title: 'titles.config',
        canActivate: [rbacGuard, routeEnabledGuard],
        data: {
          id: 'config',
          roles: ['groom', 'bride'],
          tabBar: true,
          topNav: true,
          // Hub ADR-0043 §1/§5, T352 — shell at every breakpoint (ADR-0042
          // §Context ¶2, corrected 2026-09-04), the same shape as
          // `seating-plan`. This screen registers no `*appScreenHead` /
          // `*appScreenFoot` of its own — nothing leaves its template to be
          // pinned by `PrivateLayout` — so it declares neither pin flag,
          // matching what `:host`'s local shell (`config-manager.scss`)
          // already assumes. `screenScroll: true` is the only key that makes
          // `main` yield (`overflow-y: clip`) to `PrivateLayout`'s own
          // `.screen-scroll`; scroll ownership and pinning are independent
          // route keys (hub ADR-0043 §1/§2), so a screen that pins nothing
          // never has to declare a pin flag "to make main yield" the way
          // `footPinned: true` did here before this task corrected it.
          screenScroll: true,
          navLabel: 'nav.config',
        } satisfies RouteChromeData,
      },
      {
        path: 'guests',
        loadComponent: () =>
          import('./screens/guest-manager/guest-manager').then((m) => m.GuestManager),
        title: 'titles.guestManager',
        canActivate: [rbacGuard, routeEnabledGuard],
        data: {
          id: 'guests',
          roles: ['groom', 'bride'],
          tabBar: true,
          topNav: true,
          // Hub ADR-0042 §1/§2, T341, corrected by ADR-0043 §5 (T355) — the
          // title/stat header and the list footer are pinned via
          // `*appScreenHead` / `*appScreenFoot` (`guest-manager.html`); that
          // is all these two flags declare. Scroll ownership is not among
          // their effects (ADR-0043 §1/§2): this route sets no
          // `screenScroll`, so it is flow and `main` is its scroller —
          // correct, because the screen shed its own scroll container in
          // T341 and `.screen-head`/`.screen-foot` are flex siblings of
          // `main`, never descendants, so pinning is unaffected by which box
          // below them scrolls.
          headPinned: true,
          footPinned: true,
          navLabel: 'nav.guests',
        } satisfies RouteChromeData,
      },
      {
        path: 'seating',
        loadComponent: () =>
          import('./screens/seating-plan/seating-plan').then((m) => m.SeatingPlan),
        title: 'titles.seating',
        canActivate: [rbacGuard, routeEnabledGuard],
        data: {
          id: 'seating',
          roles: ['groom', 'bride'],
          tabBar: true,
          topNav: true,
          // Hub ADR-0043 §1/§5 — shell at every breakpoint, the same shape
          // as `config-manager`, not `milestones`' per-breakpoint case
          // (`seating-plan.scss`'s own header comment / T347). This screen
          // registers no `*appScreenHead` / `*appScreenFoot` — nothing of
          // its own is pinned by `PrivateLayout` — so it declares neither
          // pin flag. `screenScroll: true` is the only key that makes
          // `main` yield (`overflow-y: clip`) to `PrivateLayout`'s own
          // `.screen-scroll`; per hub ADR-0043 §4a that box never scrolls
          // itself — it only gives `:host`'s `height: 100%` a resolved
          // height to size against. `.unassigned-body` and `.tables` keep
          // their own, independent scrollers exactly as before this flag
          // existed; the two-pane split stays this screen's to own.
          screenScroll: true,
          navLabel: 'nav.seating',
        } satisfies RouteChromeData,
      },
      {
        // Couple-only preparation timeline (hub ADR-0029, T279). Role-gated
        // like `config`/`guests`/`seating` — a guest must never reach this
        // route (hub ADR-0029 §4.7).
        path: 'milestones',
        loadComponent: () => import('./screens/milestones/milestones').then((m) => m.Milestones),
        title: 'titles.milestones',
        canActivate: [rbacGuard, routeEnabledGuard],
        data: {
          id: 'milestones',
          roles: ['groom', 'bride'],
          tabBar: true,
          topNav: true,
          // Hub ADR-0043 §1/§5 — the per-breakpoint case the ADR was written
          // to make expressible: flow below `$bp-lg` (900px, `main`
          // scrolls), shell from it up (`main` yields, `.screen-scroll`
          // bounds `:host`'s `height: 100%`). No pin flags: this screen
          // projects neither a head nor a foot. Per hub ADR-0043 §4a,
          // `.screen-scroll` itself never scrolls — `.list` and
          // `.detail-body` keep their own independent scrollers, exactly as
          // before this flag existed; the master-detail split stays this
          // screen's to own.
          screenScroll: 'lg',
          navLabel: 'nav.milestones',
        } satisfies RouteChromeData,
      },
      {
        path: 'me',
        loadComponent: () => import('./screens/invitee/invitee').then((m) => m.Invitee),
        title: 'titles.invitee',
        canActivate: [rbacGuard, routeEnabledGuard],
        data: {
          id: 'home',
          roles: ['guest'],
          tabBar: true,
          topNav: true,
          navLabel: 'nav.home',
        } satisfies RouteChromeData,
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
