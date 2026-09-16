import { readFileSync } from 'node:fs';
import path from 'node:path';

import { test, expect, Page } from '@playwright/test';

import { FIRST_FRAME_TRANSLATIONS } from '../src/app/core/service/first-frame-translations';

import { installApiMocks } from './support/api-mocks';

/**
 * A raw translation key must never reach a screen — T395.
 *
 * T389 measured the defect this file guards against: the app painted its
 * first frame at ~150ms with `consentBanner.message` et al. as literal text,
 * and the real copy arrived only when `/i18n/<lang>.json` did — 3.1s behind
 * on a locale fetch delayed by 3s. The window IS the fetch, and the consent
 * banner is mounted at the app root, so it was every route and every guest.
 *
 * The fix under test (same task): a minimal first-frame set (consent banner
 * + tab titles) is inlined per locale and served by
 * `FirstFrameMissingTranslationHandler`, route content waits for the locale
 * file alongside the config it already waits for, and an unresolved key
 * renders as empty text — never as itself.
 *
 * The delay harness is T389's: intercept `/i18n/*.json` and hold it. Samples
 * are taken continuously from the first paint, so a raw key visible for even
 * one frame fails the test — this is exactly the assertion that fails when
 * the fix is reverted (proven in T395's report).
 */

/** Every top-level namespace of the locale files. A raw key on screen is
 *  `<namespace>.<rest>`, so this regex recognises one without having to
 *  enumerate keys — and follows the file as namespaces are added. */
const NAMESPACES = Object.keys(
  JSON.parse(readFileSync(path.resolve(__dirname, '../public/i18n/en.json'), 'utf8')) as Record<
    string,
    unknown
  >,
);
const RAW_KEY_RE = new RegExp(`\\b(${NAMESPACES.join('|')})\\.[A-Za-z0-9_.-]+`);

/** Real copy markers, active locale `en` (Playwright's default en-US). */
const BANNER_COPY = FIRST_FRAME_TRANSLATIONS.en['consentBanner.message'];
const ROUTE_COPY = 'This page explains what you can see';

async function sampleBodyAndTitle(page: Page): Promise<{ text: string; title: string }> {
  return page.evaluate(() => ({
    text: document.body?.innerText ?? '',
    title: document.title,
  }));
}

/** The consent banner only shows while no decision is stored; api-mocks
 *  seeds 'declined' to keep it out of unrelated specs. A first visit — the
 *  frame this file is about — has no decision. */
async function clearConsentSeed(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.removeItem('sc-analytics-consent'));
}

test('no frame shows a raw key while the locale file is delayed (T395, T389 harness)', async ({
  page,
}) => {
  const DELAY_MS = 2500;
  await installApiMocks(page);
  await clearConsentSeed(page);
  await page.route('**/i18n/*.json', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    await route.continue();
  });

  await page.goto('/privacy-policy', { waitUntil: 'commit' });

  // Sample continuously across the delay window and past it, until the
  // route's real copy has arrived (or the deadline damns the gate).
  const deadline = Date.now() + DELAY_MS + 15_000;
  let bannerSeenDuringWindow = false;
  let routeCopySeen = false;
  const windowEnd = Date.now() + DELAY_MS;
  while (Date.now() < deadline && !routeCopySeen) {
    const s = await sampleBodyAndTitle(page);
    expect(s.text, 'a raw i18n key reached the rendered page').not.toMatch(RAW_KEY_RE);
    expect(s.title, 'a raw i18n key reached the tab title').not.toMatch(RAW_KEY_RE);
    if (Date.now() < windowEnd && s.text.includes(BANNER_COPY)) bannerSeenDuringWindow = true;
    if (s.text.includes(ROUTE_COPY)) routeCopySeen = true;
  }

  // The strategy must not degrade into a blank banner: the inlined copy is
  // on screen while the locale file is still in flight.
  expect(
    bannerSeenDuringWindow,
    'the consent banner did not show its inlined real copy during the locale delay',
  ).toBe(true);
  // And the gate must lift: the route's own copy renders once the file lands.
  expect(routeCopySeen, 'route copy never arrived after the locale file resolved').toBe(true);
});

test('no frame shows a raw key even when the locale fetch fails outright (T395)', async ({
  page,
}) => {
  await installApiMocks(page);
  await clearConsentSeed(page);
  await page.route('**/i18n/*.json', (route) => route.abort());

  await page.goto('/privacy-policy', { waitUntil: 'commit' });

  // Degraded mode: no locale file will ever arrive. The app may render
  // fallback or empty strings — never the key itself — and the inlined
  // banner copy still stands.
  const deadline = Date.now() + 2_000;
  let bannerSeen = false;
  while (Date.now() < deadline) {
    const s = await sampleBodyAndTitle(page);
    expect(s.text, 'a raw i18n key reached the page in locale-failure mode').not.toMatch(
      RAW_KEY_RE,
    );
    expect(s.title, 'a raw i18n key reached the tab title in locale-failure mode').not.toMatch(
      RAW_KEY_RE,
    );
    if (s.text.includes(BANNER_COPY)) bannerSeen = true;
  }
  expect(bannerSeen, 'the inlined banner copy is the floor even with no locale file').toBe(true);
});

test('the inlined first-frame set is byte-identical to the locale files (T395 drift guard)', () => {
  // The locale files stay the source of truth (hub ADR-0009): the bundle
  // carries a copy for the first frame, and a copy that drifts would ship
  // two versions of the same sentence. Byte-identical, all three locales,
  // both directions (key present + value equal).
  for (const locale of ['es', 'en', 'fr'] as const) {
    const file = JSON.parse(
      readFileSync(path.resolve(__dirname, `../public/i18n/${locale}.json`), 'utf8'),
    ) as Record<string, Record<string, string>>;
    for (const [key, value] of Object.entries(FIRST_FRAME_TRANSLATIONS[locale])) {
      const [ns, leaf] = key.split('.');
      expect(
        file[ns]?.[leaf],
        `${locale}.json ${key} must exist and match the inlined first-frame copy`,
      ).toBe(value);
    }
  }
});
