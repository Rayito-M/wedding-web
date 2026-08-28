import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { LoginService } from '../service';

/**
 * Public-only routes (`welcome`, `login`): accessible solely when signed out.
 * Authenticated users are redirected to their role-based landing page.
 */
export const publicOnlyGuard: CanActivateFn = () => {
  const login = inject(LoginService);
  const router = inject(Router);
  return !login.isAuthenticated() || router.parseUrl(login.landingUrl());
};
