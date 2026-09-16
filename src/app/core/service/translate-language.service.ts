import { Injectable, effect, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { LangCode } from '../../model';

import { ConfigurationService } from './configuration.service';

@Injectable({ providedIn: 'root' })
export class TranslateLanguageService {
  private STORAGE_KEY = 'language';

  private readonly configService = inject(ConfigurationService);
  private readonly translateService = inject(TranslateService);

  private readonly _currentLang = signal<LangCode>(
    this.readLanguage() || this.detectBrowserLanguage(),
  );

  readonly currentLang = this._currentLang.asReadonly();

  private readonly _localeSettled = signal(false);

  /**
   * `true` once the first `use()` of the active locale has either loaded its
   * file or failed for good (T395). `app.html` holds route content behind
   * this alongside the config fetch it already waits for, so no screen can
   * paint keys whose copy has not arrived. Settled-on-error is deliberate:
   * if `/i18n/<lang>.json` is unreachable the app renders degraded (fallback
   * language or, per `FirstFrameMissingTranslationHandler`, empty strings)
   * rather than holding the loading screen forever.
   */
  readonly localeSettled = this._localeSettled.asReadonly();

  constructor() {
    // React to the wedding configuration (loaded asynchronously): register the
    // available languages and apply the current one once it arrives.
    effect(() => {
      const config = this.configService.weddingConfigPublic();

      if (!config) return;
      this.translateService.addLangs(Object.keys(config.language) ?? ['en']);
      this.translateService.use(this.currentLang());
    });
  }

  private detectBrowserLanguage(): LangCode {
    const browserLang = (globalThis.navigator?.language ?? 'en').split('-')[0];
    return (['en', 'fr', 'es'].includes(browserLang) ? browserLang : 'en') as LangCode;
  }

  private readLanguage(): LangCode | null {
    try {
      return globalThis.localStorage?.getItem(this.STORAGE_KEY) as LangCode | null;
    } catch {
      // storage unavailable (private mode / test env)
      return null;
    }
  }

  private storeLanguage(lang: LangCode) {
    try {
      globalThis.localStorage?.setItem(this.STORAGE_KEY, lang);
    } catch {
      // storage unavailable — language just won't persist
    }
  }

  init(): void {
    // Apply the current language immediately; the constructor effect re-applies
    // it (and registers all languages) once the configuration loads.
    this.translateService.use(this.currentLang()).subscribe({
      next: () => this._localeSettled.set(true),
      error: () => this._localeSettled.set(true),
    });
  }

  setLanguage(lang: LangCode): void {
    this.storeLanguage(lang);
    this.translateService.use(lang);
    this._currentLang.set(lang);
  }
}
