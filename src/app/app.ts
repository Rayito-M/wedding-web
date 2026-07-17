import { Component, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';

import { filter, map } from 'rxjs';

import { ConfigurationService, TranslateLanguageService } from './core';

import { ThemeService } from './core/theme.service';
import { TabBar } from './shared/tab-bar/tab-bar';
import { TopNav } from './shared/top-nav/top-nav';
import { AppLoadingComponent, AppErrorComponent } from './shared';

interface RouteChrome {
  tab?: string;
  tabBar?: boolean;
  topNav?: boolean;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TabBar, TopNav, AppLoadingComponent, AppErrorComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);
  private readonly configurationService = inject(ConfigurationService);

  // Instantiated here so the data-theme attribute is applied on startup.
  protected readonly theme = inject(ThemeService);
  // Instantiated here to initialize translations on startup
  // private readonly i18n = inject(I18nService);
  private translate = inject(TranslateLanguageService);

  protected readonly weddingConfigPublicLoading = computed(() =>
    this.configurationService.weddingConfigPublicLoading(),
  );

  protected readonly weddingConfigPublicError = computed(() =>
    this.configurationService.weddingConfigPublicError(),
  );

  protected retryLoadConfig(): void {
    this.configurationService.loadWeddingConfigPublic();
  }

  constructor() {
    // `lang` and `fallbackLang` from provideTranslateService() are already applied;
    // call addLangs() to register additional languages the user can switch to.
    this.translate.init();
    // Publish the wedding configuration; ThemeService subscribes to it to apply the theme.
  }

  protected readonly chrome = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((): RouteChrome => {
        let route = this.router.routerState.snapshot.root;
        while (route.firstChild) route = route.firstChild;
        return route.data;
      }),
    ),
    { initialValue: {} as RouteChrome },
  );
}
