import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError } from 'rxjs';
import { TokenStorageService } from '../service/token-storage.service';

export const unauthorizedInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip interceptor for translation files to avoid circular dependency during init
  if (req.url.includes('/i18n/')) {
    return next(req);
  }

  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error) => {
      if (error.status === 401) {
        tokenStorage.clear();
        router.navigate(['/login']);
      }
      throw error;
    })
  );
};
