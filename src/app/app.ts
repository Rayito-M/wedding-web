import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';

import { filter, map } from 'rxjs';

import { ConfigurationService, TranslateLanguageService } from './core';

import { ThemeService } from './core/theme.service';
import { TabBar } from './shared/tab-bar/tab-bar';
import { TopNav } from './shared/top-nav/top-nav';

interface RouteChrome {
  tab?: string;
  tabBar?: boolean;
  topNav?: boolean;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TabBar, TopNav],
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

  constructor() {
    // `lang` and `fallbackLang` from provideTranslateService() are already applied;
    // call addLangs() to register additional languages the user can switch to.
    this.translate.init();
    this.theme.set(this.configurationService.getThemeId());
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
