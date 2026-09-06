import { Routes } from '@angular/router';
import {
  publicOnlyGuard,
  rbacGuard,
  redirectToHomeSection,
  routeEnabledGuard,
  RouteChromeData,
} from './core';

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
//   group    — 'manage' marks a couple tool route as a Manage group member (hub
//              ADR-0045 §2/§3); grouped routes are excluded from the primary nav —
//              only the group's `standout` member represents it there
//   standout — this route is the single visible face of its `group` in the primary
//              nav, synthesized by `nav-tabs.ts` under the group's own id/label
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
        // Hub ADR-0045 §4 — Travel is no longer a top-level destination or
        // its own route: it is Home's "Getting there" section
        // (`app-travel[embedded]`, mounted by `dashboard`/`invitee`). A
        // bookmark or an agenda row's existing `routerLink="/travel"`
        // (`travel-link.ts`) must still land somewhere real rather than
        // 404ing, so this path stays in the tree, redirecting into the
        // signed-in user's own Home (`LoginService.landingUrl()` — `/dashboard`
        // for the couple, `/me` for a guest) with `?section=travel`, carrying
        // forward every other query param the old URL had (in particular
        // `?place=<id>`) so the preselected venue/hotel survives the hop.
        // The redirect is a `canActivate` guard, not `Route.redirectTo`:
        // Angular rejects the two together (`NG04014`, "redirects happen
        // before guards are executed"), and `routeEnabledGuard` must still
        // run first so a `travel` disabled via `enabledRoutes` blocks the
        // redirect exactly as it blocked the old screen, rather than
        // silently landing on Home's travel section anyway
        // (`home-section-redirect.ts`). `loadComponent` stays only to
        // satisfy the router's "every route needs one of component /
        // loadComponent / redirectTo / children" validation — a guard
        // always resolves first, so `Travel` never actually mounts here.
        path: 'travel',
        loadComponent: () => import('./screens/travel/travel').then((m) => m.Travel),
        canActivate: [routeEnabledGuard, redirectToHomeSection('travel')],
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
        // Unified "Home" nav destination for the couple role (guest home is
        // /me). Hub ADR-0045 §2/§4 — stays intact as the couple's ungrouped
        // Home entry; `Dashboard` now renders the umbrella (Today · Getting
        // there · Good to know) instead of the planning dashboard it used to
        // — that content moved to `overview` below, same component, reused
        // rather than duplicated (`id !== 'overview'` is how it tells which
        // mode it's in — see `dashboard.ts`).
        path: 'dashboard',
        loadComponent: () => import('./screens/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'titles.dashboard',
        canActivate: [rbacGuard, routeEnabledGuard],
        data: {
          id: 'home',
          roles: ['groom', 'bride'],
          tabBar: true,
          topNav: true,
          navLabel: 'nav.home',
        } satisfies RouteChromeData,
      },
      {
        // Manage's Overview (hub ADR-0045 §3 — Overview is a listed Manage
        // member) — the Manage door's real landing page, settled on T364
        // (superseding T362's interim choice of pointing the door straight
        // at `guests`, see that route's own comment below). Reuses `Dashboard`
        // unchanged rather than a second component: it is the exact same
        // planning-stats content (RSVP replies, head count, manage
        // shortcuts) this route used to serve at `/dashboard` before Home
        // became the umbrella, mirrors DS `ScreenHome`'s own `overview` mode
        // (one component, two modes) — see `dashboard.ts` for how the
        // component tells the two apart.
        path: 'overview',
        loadComponent: () => import('./screens/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'titles.dashboard',
        canActivate: [rbacGuard, routeEnabledGuard],
        data: {
          id: 'overview',
          roles: ['groom', 'bride'],
          tabBar: true,
          topNav: true,
          navLabel: 'nav.overview',
          group: 'manage',
          standout: true,
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
          // Hub ADR-0045 §2/§3/§6 — a Manage tool member, not the group's
          // door. T362 had this route carry `standout: true` as an interim
          // placeholder (no Overview screen existed yet — that was flagged
          // `decisions_needed` on its report); T364 builds the real
          // Overview (`overview` route above, reusing `Dashboard`) and moves
          // `standout` there per ADR-0045 §3, which lists Overview as a
          // Manage member. This route's own `navLabel` still names the
          // screen for Manage's rail/tab set.
          group: 'manage',
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
          // Hub ADR-0045 §2/§3/§6 — one of the couple's Manage tools; see
          // the `config` route's own comment below for why this route
          // keeps its own `navLabel` rather than the group's.
          group: 'manage',
        } satisfies RouteChromeData,
      },
      {
        // Declared last among the Manage group's members — not `config`'s
        // original position — so `MANAGE_GROUP_TABS`' declaration order
        // (`nav-tabs.ts`'s `collect()` walks routes in file order, hub
        // ADR-0042 §6) puts Settings last, matching DS `MANAGE_TABS`'s own
        // order (Overview · Guests · … · Settings) and `PlanRail` pinning
        // Settings to the rail foot rather than the mid-list item order it
        // used to keep. Content unchanged from the route this used to be.
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
          // Hub ADR-0045 §2/§3/§6 — one of the couple's Manage tools
          // ("Settings" in Manage's rail/tab set, T364). Grouped routes
          // never reach the primary nav themselves; `overview` above is the
          // group's `standout` door, so this route's own `navLabel` stays
          // `nav.config` for Manage's own rail/tab set (T364).
          group: 'manage',
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
