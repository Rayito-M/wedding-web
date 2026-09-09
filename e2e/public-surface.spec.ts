import { readFileSync } from 'node:fs';
import path from 'node:path';

import { test, expect } from '@playwright/test';

import { CONFIG_PUBLIC, installApiMocks } from './support/api-mocks';

/**
 * T378 — nothing from *Good to know* reaches an unauthenticated visitor (hub
 * ADR-0046 §7; `GLOSSARY.md` → *Public wedding info*).
 *
 * The API side of this is `wedding-api` T244/T245: `goodToKnow` is omitted
 * from `WeddingConfigPublicResponseSchema`, which is built by omission rather
 * than allow-list, so any new CONFIG attribute is public **by default** and an
 * omission that lands one deploy late is an IBAN served unauthenticated in
 * between. This file is the client-side half, and it is cheap.
 *
 * Two tests, because "no leak" has two halves and only one of them is about
 * the fixture:
 *
 * 1. The response the app actually consumes carries no such field — measured
 *    off the wire (`page.on('response')`), not asserted against the constant
 *    this suite happens to serve, so it also catches the fixture itself
 *    drifting into a shape the real endpoint must never have.
 * 2. **Even if the endpoint leaked one**, the app renders none of it. That is
 *    the half that is genuinely this repo's: the public route is fed a
 *    deliberately poisoned payload carrying an IBAN, a Bizum number and a
 *    contact phone, and the landing page must still contain none of them.
 *    Without this, a future API regression would be a silent leak on a page
 *    that needs no sign-in at all.
 */

/** The three identifiers a leak would expose, and the shape that would carry
 *  them — a full `goodToKnow` array on the PUBLIC response, which the contract
 *  forbids and this test pretends has happened anyway. */
const LEAKED_IBAN = 'ES91 2100 0418 4502 0005 1332';
const LEAKED_BIZUM = '+34 655 012 118';
const LEAKED_CONTACT_PHONE = '+34 691 776 402';

const POISONED_BLOCKS = [
  {
    id: '01JDDDDDDDDDDDDDDDDDDDDDD1',
    type: 'gift',
    title: { es: 'Regalos', en: 'Gifts', fr: 'Cadeaux' },
    accountHolder: 'Sara Moreno & Christophe Lefèvre',
    iban: LEAKED_IBAN,
    bic: 'CAIXESBBXXX',
    bizumPhone: LEAKED_BIZUM,
  },
  {
    id: '01JDDDDDDDDDDDDDDDDDDDDDD2',
    type: 'contacts',
    title: { es: 'Contactos', en: 'Contacts', fr: 'Contacts' },
    entries: [
      {
        userId: '01JEEEEEEEEEEEEEEEEEEEEEEE',
        purpose: { es: 'Dama de honor', en: 'Maid of honour', fr: "Demoiselle d'honneur" },
        // Not part of the contract at all — the pre-`0dc09db` shape, included
        // deliberately: a leak does not have to arrive in a shape we expect.
        name: 'Lucía Ferrer',
        phone: LEAKED_CONTACT_PHONE,
      },
    ],
  },
];

test.describe('the public surface carries no Good to know content (T378, hub ADR-0046 §7)', () => {
  test('GET /v1/config/public — the response the app consumes has no goodToKnow', async ({ page }) => {
    await installApiMocks(page);

    const bodies: unknown[] = [];
    page.on('response', async (response) => {
      if (!response.url().includes('/v1/config/public')) return;
      bodies.push(await response.json().catch(() => null));
    });

    await page.goto('/');
    await expect(page.locator('app-welcome')).toBeVisible();
    await page.waitForLoadState('networkidle');

    expect(bodies.length, 'the app read the public config at least once').toBeGreaterThan(0);
    for (const body of bodies) {
      const keys = Object.keys((body ?? {}) as Record<string, unknown>);
      expect(keys, 'public config keys').not.toContain('goodToKnow');
      // Nothing else smuggling the same content under another name.
      expect(JSON.stringify(body)).not.toMatch(/iban|bizum|dress-code|day-line/i);
    }
  });

  test('a leaked block still renders nothing before sign-in', async ({ page }) => {
    await installApiMocks(page);

    // Registered AFTER `installApiMocks`, so it wins (Playwright runs routes
    // in reverse registration order) — the public endpoint now answers with a
    // payload the contract forbids.
    await page.route('**/v1/config/public', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        // The real fixture plus the one field the contract forbids — never
        // `route.fetch()`, which would try to reach the unreachable backend
        // this suite exists to avoid.
        body: JSON.stringify({ ...CONFIG_PUBLIC, goodToKnow: POISONED_BLOCKS }),
      }),
    );

    await page.goto('/');
    await expect(page.locator('app-welcome')).toBeVisible();
    await page.waitForLoadState('networkidle');

    const rendered = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    for (const secret of [LEAKED_IBAN, LEAKED_BIZUM, LEAKED_CONTACT_PHONE, 'CAIXESBBXXX', 'Lucía Ferrer']) {
      expect(rendered, `"${secret}" must not reach an unauthenticated visitor`).not.toContain(secret);
    }
    // And the section itself is not mounted anywhere on a public route.
    await expect(page.locator('app-good-to-know')).toHaveCount(0);

    // The privacy notice is the other unauthenticated page (no guard — the
    // consent banner links to it before any sign-in exists); same guarantee.
    await page.goto('/privacy-policy');
    await expect(page.locator('app-privacy-policy')).toBeVisible();
    const notice = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    for (const secret of [LEAKED_IBAN, LEAKED_BIZUM, LEAKED_CONTACT_PHONE]) {
      expect(notice, `"${secret}" must not reach the public privacy page`).not.toContain(secret);
    }
    await expect(page.locator('app-good-to-know')).toHaveCount(0);
  });

  test('the privacy notice discloses what a signed-in guest can see', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/privacy-policy');
    await expect(page.locator('app-privacy-policy')).toBeVisible();

    const notice = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    // Contact details the couple chooses, and the couple's own bank details —
    // the two things hub ADR-0046 §7 requires this notice to cover.
    expect(notice).toContain('Contacts and bank details');
    expect(notice).toMatch(/contact details for people the couple has chosen/i);
    expect(notice).toMatch(/bank details/i);
    expect(notice).toMatch(/IBAN/);
    // The third-party case now ships (ADR-0046 Amendment 2 §C, `wedding-api` T246):
    // a contacts entry needs no account, so the couple's own typing is what a guest
    // reads. The guard was negative here until T381 and had to be inverted with the
    // copy — under-disclosing is the worse direction to be wrong in.
    expect(
      notice,
      'the notice must disclose the third-party case (Amendment 2 §C)',
    ).toMatch(/not guests|no account on this site/i);
    expect(
      notice,
      'the notice must say the couple supplies that name and number itself',
    ).toMatch(/the couple types their name and number in directly/i);
  });

  test('the notice claims the provenance the renderer actually has (T382, Amendment 2 §D)', async () => {
    // The other half of this pin is a unit test:
    // `src/app/shared/good-to-know/good-to-know.spec.ts` proves the renderer
    // reads a contact's name and number off the block itself, against a
    // deliberately conflicting profile fixture. This half pins the notice to
    // that same truth in all three locales — so re-pointing the renderer at
    // profiles, or rewording the notice back to profile provenance, each
    // fails a test on its own. T381's report is explicit that until T382
    // nothing caught this drift; the clause it flagged ("those details come
    // from their own profile on this site") became false the commit the
    // renderer switched to the T246 block shape, which is why the false and
    // true claims are asserted separately rather than as one regex.
    const body = (locale: string): string =>
      (
        JSON.parse(
          readFileSync(path.resolve(__dirname, `../public/i18n/${locale}.json`), 'utf8'),
        ) as { privacyPolicy: { goodToKnow: { body: string } } }
      ).privacyPolicy.goodToKnow.body;

    const claims = {
      es: {
        profileClaim: /su propio perfil/i,
        coupleClaim: /son los novios quienes escriben directamente su nombre y su número/i,
      },
      en: {
        profileClaim: /their own profile/i,
        coupleClaim: /the couple types their name and number in directly/i,
      },
      fr: {
        profileClaim: /son propre profil/i,
        coupleClaim: /les mariés qui saisissent directement son nom et son numéro/i,
      },
    } as const;

    for (const [locale, claim] of Object.entries(claims)) {
      const notice = body(locale);
      expect(
        notice,
        `${locale}: the notice must not claim contact details come from a profile`,
      ).not.toMatch(claim.profileClaim);
      expect(
        notice,
        `${locale}: the notice must say the couple types the details in itself`,
      ).toMatch(claim.coupleClaim);
    }
  });
});
