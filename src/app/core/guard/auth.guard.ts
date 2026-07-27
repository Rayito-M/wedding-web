import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { LoginService } from '../service';

/**
 * Protected routes: require an authenticated user. Unauthenticated visitors are
 * sent to the login screen. Only `welcome` and `login` are public (guarded by
 * {@link publicOnlyGuard}).
 */
export const authGuard: CanActivateFn = () => {
  const login = inject(LoginService);
  const router = inject(Router);
  return login.isAuthenticated() || router.parseUrl('/login');
};

/**
 * Public-only routes (`welcome`, `login`): accessible solely when signed out.
 * Authenticated users are redirected to their role-based landing page.
 */
export const publicOnlyGuard: CanActivateFn = () => {
  const login = inject(LoginService);
  const router = inject(Router);
  return !login.isAuthenticated() || router.parseUrl(login.landingUrl());
};

/**
 * Couple/admin-only routes (`dashboard`): require `role: admin` (ADR-0013).
 * Signed-in guests are sent to their own landing page; anonymous users to login.
 */
export const adminGuard: CanActivateFn = () => {
  const login = inject(LoginService);
  const router = inject(Router);
  if (!login.isAuthenticated()) return router.parseUrl('/login');
  return login.role() === 'admin' || router.parseUrl('/me');
};
