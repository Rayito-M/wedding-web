import { inject } from '@angular/core';
import type { ActivatedRouteSnapshot, CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';

import { HOME_SECTION_PARAM, type HomeSection } from '@app/shared/home-section';

import { LoginService } from '../service';

/**
 * Redirects a former top-level screen into Home with the matching umbrella
 * section active (hub ADR-0045 §4: "old deep links redirect into Home …
 * no 404, no dual nav state"). A `CanActivateFn`, not `Route.redirectTo`:
 * Angular rejects `redirectTo` combined with `canActivate` at bootstrap
 * (`NG04014` — "redirects happen before guards are executed"), and this
 * route still needs `routeEnabledGuard` to run first so a `travel` disabled
 * via `enabledRoutes` blocks the redirect exactly as it blocked the old
 * screen. Guards returning a `UrlTree` are the router's own redirect
 * mechanism (same shape as `rbacGuard`/`publicOnlyGuard`), so composing
 * `[routeEnabledGuard, redirectToHomeSection('travel')]` gets both behaviours
 * without a second declaration site for "is this route on".
 *
 * The signed-in user's role decides *where* Home is — the couple's lives at
 * `/dashboard`, a guest's at `/me` (`LoginService.landingUrl()`, already the
 * single source of that mapping for `rbacGuard`/`publicOnlyGuard`). Every
 * other query param the old URL carried is preserved, in particular
 * `travel-link.ts`'s `?place=<id>`, so an agenda row's existing
 * `routerLink="/travel"` link keeps landing on the same preselected
 * venue/hotel once it is Home's own "Getting there" section doing the
 * rendering (`Travel`'s `embedded` mode).
 */
export function redirectToHomeSection(section: HomeSection): CanActivateFn {
  return (route: ActivatedRouteSnapshot) => {
    const login = inject(LoginService);
    const router = inject(Router);
    return router.createUrlTree([login.landingUrl()], {
      queryParams: { ...route.queryParams, [HOME_SECTION_PARAM]: section },
    });
  };
}
