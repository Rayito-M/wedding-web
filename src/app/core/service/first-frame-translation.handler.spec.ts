import { TranslateService } from '@ngx-translate/core';

import { FirstFrameMissingTranslationHandler } from './first-frame-translation.handler';
import { FIRST_FRAME_TRANSLATIONS } from './first-frame-translations';

describe('FirstFrameMissingTranslationHandler', () => {
  /**
   * The handler only reads two members of the service, both public:
   * `getCurrentLang()` and `getTranslations(lang)`. A minimal stub keeps the
   * spec independent of ngx-translate's loader machinery.
   */
  function stubService(
    lang: string | null,
    loaded: boolean,
  ): Pick<TranslateService, 'getCurrentLang' | 'getTranslations'> {
    return {
      getCurrentLang: () => lang,
      // A loaded language has a non-empty store entry; `{}` is what the
      // http-loader stores after a FAILED fetch, so it must count as
      // not-loaded (covered by its own test below).
      getTranslations: () => (loaded ? { shared: { back: 'Back' } } : undefined) as never,
    };
  }

  function handle(key: string, lang: string | null, loaded: boolean): string {
    const handler = new FirstFrameMissingTranslationHandler();
    return handler.handle({
      key,
      translateService: stubService(lang, loaded) as TranslateService,
    });
  }

  it('answers a first-frame key with its real copy in the active language, before any file loads', () => {
    expect(handle('consentBanner.accept', 'es', false)).toBe('Aceptar');
    expect(handle('consentBanner.accept', 'en', false)).toBe('Accept');
    expect(handle('consentBanner.accept', 'fr', false)).toBe('Accepter');
  });

  it('covers every tab title, so TranslatedTitleStrategy.instant() never sets a raw key', () => {
    for (const lang of ['es', 'en', 'fr'] as const) {
      for (const key of Object.keys(FIRST_FRAME_TRANSLATIONS[lang])) {
        const value = handle(key, lang, false);
        expect(value).toBe(FIRST_FRAME_TRANSLATIONS[lang][key]);
        expect(value).not.toBe('');
        expect(value).not.toBe(key);
      }
    }
  });

  it('falls back to the default language when the current one is not yet known', () => {
    expect(handle('consentBanner.accept', null, false)).toBe('Accept');
  });

  it('never returns a raw key while the locale file is still in flight', () => {
    expect(handle('rsvp.step-1.title', 'es', false)).toBe('');
    expect(handle('privacyPolicy.title', 'en', false)).toBe('');
  });

  it('keeps the raw key visible once the locale file has loaded — a missing key is then a defect', () => {
    expect(handle('some.genuinely.missing-key', 'en', true)).toBe('some.genuinely.missing-key');
  });

  it('treats an empty store entry as not-loaded — the http-loader stores {} for a failed fetch', () => {
    const handler = new FirstFrameMissingTranslationHandler();
    const emptyStore: Pick<TranslateService, 'getCurrentLang' | 'getTranslations'> = {
      getCurrentLang: () => 'en',
      getTranslations: () => ({}) as never,
    };
    const result = handler.handle({
      key: 'privacyPolicy.title',
      translateService: emptyStore as TranslateService,
    });
    expect(result).toBe('');
  });

  it('the inlined set carries no interpolation placeholders — values are returned verbatim', () => {
    for (const lang of ['es', 'en', 'fr'] as const) {
      for (const value of Object.values(FIRST_FRAME_TRANSLATIONS[lang])) {
        expect(value).not.toMatch(/\{\{/);
      }
    }
  });
});
