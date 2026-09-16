import { Injectable } from '@angular/core';
import { MissingTranslationHandler, MissingTranslationHandlerParams } from '@ngx-translate/core';

import { LangCode } from '../../model';

import { FIRST_FRAME_TRANSLATIONS } from './first-frame-translations';

const DEFAULT_LANG: LangCode = 'en';

/**
 * A raw i18n key must never reach a screen (T395). This handler fires for
 * every key ngx-translate cannot resolve, which before `/i18n/<lang>.json`
 * arrives is every key on the page. It answers in two tiers:
 *
 * 1. Keys in {@link FIRST_FRAME_TRANSLATIONS} — the consent banner and the
 *    tab titles, the only translatable surfaces that can paint before the
 *    locale resolves — get their real copy, in the active language,
 *    synchronously from the bundle.
 * 2. Anything else resolves to an empty string **only while the active
 *    language has nothing in the store** (the fetch is still in flight, or
 *    failed outright). Once the locale file has loaded, a missing key is a
 *    genuine defect and keeps the default behaviour — the raw key — so tests
 *    and readers still see it.
 *
 * Tier 2 is a terminal fallback, not the working path: `app.html` holds
 * route content behind the locale fetch (alongside the config fetch it
 * already waits for), so in normal operation nothing outside tier 1 renders
 * before its copy exists.
 */
@Injectable()
export class FirstFrameMissingTranslationHandler implements MissingTranslationHandler {
  handle(params: MissingTranslationHandlerParams): string {
    const lang = (params.translateService.getCurrentLang() ?? DEFAULT_LANG) as LangCode;
    const inlined =
      FIRST_FRAME_TRANSLATIONS[lang]?.[params.key] ??
      FIRST_FRAME_TRANSLATIONS[DEFAULT_LANG][params.key];
    if (inlined !== undefined) return inlined;

    // "Loaded" must mean a real file: `@ngx-translate/http-loader` swallows
    // a failed fetch and emits `{}` (with a console.warn), so an empty store
    // entry is a FAILED load wearing a success — and a genuine locale file is
    // never empty. Only a non-empty entry restores default raw-key behaviour.
    const translations = params.translateService.getTranslations(lang);
    const langLoaded = translations !== undefined && Object.keys(translations).length > 0;
    return langLoaded ? params.key : '';
  }
}
