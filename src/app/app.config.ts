import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  FactoryProvider,
  APP_INITIALIZER,
} from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideEntityData, withEffects } from '@ngrx/data';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { environment } from '../environments';
import { routes } from './app.routes';

import {
  TranslatedTitleStrategy,
  entityConfig,
  provideEntityDataServices,
  TokenStorageService,
  Configuration,
  RouteConfigService,
  unauthorizedInterceptor,
} from '@app/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
    {
      provide: APP_INITIALIZER,
      useFactory: (routeConfig: RouteConfigService) => () => {
        routeConfig.setRouteConfig(environment.enabledRoutes);
      },
      deps: [RouteConfigService],
      multi: true,
    },
    provideHttpClient(withInterceptors([unauthorizedInterceptor])),
    provideTranslateService({
      lang: 'en',
      fallbackLang: 'en',
    }),
    provideTranslateHttpLoader({
      prefix: '/i18n/',
      suffix: '.json',
    }),
    // Generated API client with bearer token from TokenStorageService.
    {
      provide: Configuration,
      useFactory: (tokenStorage: TokenStorageService) =>
        new Configuration({
          basePath: environment.apiBaseUrl,
          credentials: {
            bearer: () => tokenStorage.token(),
          },
        }),
      deps: [TokenStorageService],
    } as FactoryProvider,
    provideStore(),
    provideEffects(),
    // Entity metadata (ADR W-0001 decision 3); currently the WeddingConfigPublic
    // slice only — the remaining entities land with T210/T211.
    provideEntityData(entityConfig, withEffects()),
    provideEntityDataServices(),
    // Devtools only outside production builds — gated on isDevMode(), not an
    // environment.ts flag (Hard Rule #7).
    ...(isDevMode() ? [provideStoreDevtools()] : []),
  ],
};
