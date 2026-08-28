import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';

import { LoginService } from '../service';
import type { RouteChromeData } from './route-chrome-data';

/**
 * Single data-driven replacement for the old `authGuard`/`adminGuard` pair.
 * Unauthenticated visitors are sent to `/login`. Authenticated visitors whose
 * role isn't listed in `route.data.roles` are sent to their own landing page
 * (`LoginService.landingUrl()`), so a mismatch always lands somewhere valid
 * for that role instead of a hardcoded `/me`. A route with no `roles` in
 * `data` just requires authentication — the same behaviour the old
 * `authGuard` had — so this guard also covers the `PrivateLayout` wrapper.
 */
export const rbacGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const login = inject(LoginService);
  const router = inject(Router);

  if (!login.isAuthenticated()) return router.parseUrl('/login');

  const roles = (route.data as RouteChromeData | undefined)?.roles;
  return !roles || roles.includes(login.role()) || router.parseUrl(login.landingUrl());
};
