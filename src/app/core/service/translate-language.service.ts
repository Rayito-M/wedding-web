import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { Language } from '../../../environments';

import { ConfigurationService } from './configuration.service';

@Injectable({ providedIn: 'root' })
export class TranslateLanguageService {
  private STORAGE_KEY = 'language';

  private readonly configService = inject(ConfigurationService);
  private readonly translateService = inject(TranslateService);

  private detectBrowserLanguage(): Language {
    const browserLang = navigator.language.split('-')[0];
    return (['en', 'fr', 'es'].includes(browserLang) ? browserLang : 'en') as Language;
  }

  private readLanguage(): Language | null {
    return localStorage.getItem(this.STORAGE_KEY) as Language | null;
  }

  private storeLanguage(lang: Language) {
    localStorage.setItem(this.STORAGE_KEY, lang);
  }

  init(): void {
    this.translateService.addLangs(this.configService.getLanguages());
    this.translateService.use(this.getLanguage());
  }

  getLanguage(): Language {
    const storedLanguage = this.readLanguage();
    console.log('[I18n] Stored language:', storedLanguage);
    return this.readLanguage() || this.detectBrowserLanguage();
  }

  setLanguage(lang: Language): void {
    console.log('[I18n] Setting language to:', lang);
    this.storeLanguage(lang);
    this.translateService.use(lang);
    console.log('[I18n] TranslateService.use() called for:', lang);
  }
}
