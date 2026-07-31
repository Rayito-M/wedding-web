import { inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, Router } from '@angular/router';
import { RouteConfigService } from '@app/core';

export const routeEnabledGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const routeConfigService = inject(RouteConfigService);
  const router = inject(Router);

  const routePath = route.routeConfig?.path as string;

  if (!routePath || !routeConfigService.isRouteEnabled(routePath)) {
    router.navigate(['']);
    // return false;
    return true; // Allow navigation to proceed even if the route is not enabled
  }

  return true;
};
