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
    this.translateService.use(this.currentLang());
  }

  setLanguage(lang: LangCode): void {
    this.storeLanguage(lang);
    this.translateService.use(lang);
    this._currentLang.set(lang);
  }
}
