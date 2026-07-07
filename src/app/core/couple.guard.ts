import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Gates /dashboard to the couple; others land on the welcome screen. */
export const coupleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.tryUnlock(route.queryParamMap.get('code')) || router.parseUrl('/welcome');
};
