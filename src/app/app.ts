import { Component, inject, computed } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ConfigurationService, TranslateLanguageService } from './core';

import { ThemeService } from './core/theme.service';
import { AppLoadingComponent, AppErrorComponent } from './shared';
import { ConsentBanner } from './shared/consent-banner/consent-banner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppLoadingComponent, AppErrorComponent, ConsentBanner],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly configurationService = inject(ConfigurationService);

  // Instantiated here so the data-theme attribute is applied on startup.
  protected readonly theme = inject(ThemeService);
  // Instantiated here to initialize translations on startup
  private translate = inject(TranslateLanguageService);

  // Route content waits for the locale file as well as the config (T395):
  // the loading frame and the consent banner carry inlined first-frame copy,
  // but a screen's own strings only exist once /i18n/<lang>.json resolves.
  protected readonly localeSettled = this.translate.localeSettled;

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
  }
}
