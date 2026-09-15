import { readFileSync } from 'node:fs';
import path from 'node:path';

import { test, expect } from '@playwright/test';

import { CONFIG_PUBLIC, installApiMocks } from './support/api-mocks';

/**
 * Nothing from *Good to know* reaches an unauthenticated visitor — T378 (hub
 * ADR-0046 §7; `GLOSSARY.md` → *Public wedding info*), re-pointed by **T385**
 * at the attribute that now carries the content: **`generalInfo`**
 * (hub ADR-0047 §1/§5).
 *
 * The API side is `wedding-api` T244/T245 and **T247**:
 * `WeddingConfigPublicResponseSchema` is built by **omission** — it
 * destructures a fixed list off the document and spreads the rest — so any
 * new CONFIG attribute is public **by default**, and ADR-0047 §5 widens that
 * from "a field that arrives with code" to *"any attribute added to the
 * stored row, including one written straight into DynamoDB with no deploy at
 * all"*. This file is the client-side half, and it is cheap.
 *
 * Four tests, because "no leak" has four halves and only one of them is
 * about the fixture:
 *
 * 1. The response the app actually consumes carries neither `generalInfo`
 *    nor `couple` — measured off the wire (`page.on('response')`), not
 *    asserted against the constant this suite happens to serve, so it also
 *    catches the fixture itself drifting into a shape the real endpoint must
 *    never have.
 * 2. **Even if the endpoint leaked them**, the app renders none of it. That
 *    is the half that is genuinely this repo's: the public route is fed a
 *    deliberately poisoned payload carrying an IBAN, a Bizum number and the
 *    email and phone of four listed people, and no unauthenticated page may
 *    contain any of it.
 * 3. No `couple`, no email address and no phone number reaches **any**
 *    unauthenticated route — asserted over every `/v1/` body the app reads
 *    while signed out, and over the rendered DOM of each public page. The
 *    client half of `wedding-api` T247.
 * 4. The privacy notice describes **what actually ships** (T385, ADR-0047
 *    §3) — in the browser, and then per locale off disk.
 *
 * **Why the poison is `generalInfo` and not `goodToKnow` (T385).** Until this
 * task the two leak tests named `goodToKnow` — ADR-0046 §2's ordered block
 * array. ADR-0047 replaced it, so those tests passed while naming an
 * attribute the API can no longer return: a leak guard aimed at a field that
 * does not exist proves strictly nothing. `goodToKnow` is still asserted
 * absent below — a name that must never come back — but the poison itself is
 * now the shape that really carries the PII.
 */

/** Localized value, all three languages required (ADR-0031). */
const L = (text: string): Record<string, string> => ({ es: text, en: text, fr: text });

/** Every identifier a leak would expose. The bank details are the couple's
 *  own (ADR-0046 §5 — transcribed, never translated); the rest is what
 *  ADR-0047 §3 newly puts in front of a *signed-in* guest and which must
 *  therefore never reach a signed-out one. */
const LEAKED_IBAN = 'ES91 2100 0418 4502 0005 1332';
const LEAKED_BIC = 'CAIXESBBXXX';
const LEAKED_BIZUM = '+34 655 012 118';
const LEAKED_BRIDE_EMAIL = 'sara@example.com';
const LEAKED_BRIDE_PHONE = '+34 600 112 233';
const LEAKED_GROOM_EMAIL = 'christophe@example.com';
const LEAKED_PLANNER_EMAIL = 'lucia@ferrerbodas.es';
const LEAKED_PLANNER_PHONE = '+34 691 776 402';
const LEAKED_GUEST_EMAIL = 'rosa@example.com';
const LEAKED_GUEST_PHONE = '+34 677 004 118';

/**
 * A full `generalInfo` object on the PUBLIC response — the shape ADR-0047 §1
 * defines and §5/ADR-0046 §7 forbid on this endpoint, which these tests
 * pretend has happened anyway. Deliberately complete rather than minimal: a
 * leak does not arrive only in the fields we thought to check.
 */
const POISONED_GENERAL_INFO = {
  dressCode: {
    headline: L('Elegant, garden-ready'),
    body: L('Cocktail dress or a light suit, no black tie.'),
  },
  gift: {
    intro: L('If you would like to give something, the account is below.'),
    accountHolder: 'Sara Moreno & Christophe Lefèvre',
    iban: LEAKED_IBAN,
    bic: LEAKED_BIC,
    reference: L('Your name'),
    bizumPhone: LEAKED_BIZUM,
    bizumNote: L('Put your name in the message.'),
  },
  // Hub ADR-0047 §2 — a contact is a person with an account here, stored as
  // a full USER digest: id, role, both names, email and phone number.
  contact: {
    couple: {
      bride: {
        id: '01JCCCCCCCCCCCCCCCCCCCCCC1',
        firstName: 'Sara',
        lastName: 'Moreno',
        email: LEAKED_BRIDE_EMAIL,
        phoneNumber: LEAKED_BRIDE_PHONE,
      },
      groom: {
        id: '01JCCCCCCCCCCCCCCCCCCCCCC2',
        firstName: 'Christophe',
        lastName: 'Lefèvre',
        email: LEAKED_GROOM_EMAIL,
      },
    },
    weddingPlanner: [
      {
        id: '01JEEEEEEEEEEEEEEEEEEEEEE1',
        role: 'wedding-planner',
        firstName: 'Lucía',
        lastName: 'Ferrer',
        email: LEAKED_PLANNER_EMAIL,
        phoneNumber: LEAKED_PLANNER_PHONE,
      },
    ],
    guest: [
      {
        id: '01JEEEEEEEEEEEEEEEEEEEEEE2',
        role: 'guest',
        firstName: 'Rosa',
        lastName: 'Gil',
        email: LEAKED_GUEST_EMAIL,
        phoneNumber: LEAKED_GUEST_PHONE,
        purpose: L('Travel, transfers, logistics'),
      },
    ],
  },
  faq: [
    {
      id: '01JBBBBBBBBBBBBBBBBBBBBBB0',
      question: L('Where do we park?'),
      answer: L('There is a public car park five minutes uphill.'),
    },
  ],
  dayLine: {
    rsvpOpen: L('The church at 16:30, then the party. Please reply by 1 May.'),
    rsvpClosed: L('The church at 16:30, then the party. Replies are closed.'),
    afterWedding: L('Thank you for celebrating with us.'),
  },
  note: [
    {
      id: '01JDDDDDDDDDDDDDDDDDDDDDD1',
      title: L('One last thing'),
      body: L('The palacio gate closes at 03:00.'),
    },
  ],
};

/** The `couple` attribute ADR-0047 §5 uses as its worked example: it carries
 *  the bride's and groom's email and phone, and writing it to the production
 *  row before its omission deploys publishes both. */
const POISONED_COUPLE = {
  bride: {
    id: '01JCCCCCCCCCCCCCCCCCCCCCC1',
    firstName: 'Sara',
    lastName: 'Moreno',
    email: LEAKED_BRIDE_EMAIL,
    phoneNumber: LEAKED_BRIDE_PHONE,
  },
  groom: {
    id: '01JCCCCCCCCCCCCCCCCCCCCCC2',
    firstName: 'Christophe',
    lastName: 'Lefèvre',
    email: LEAKED_GROOM_EMAIL,
  },
};

/** Every string a signed-out visitor must never read, whichever page they
 *  are on and whichever of the two poisoned attributes carried it. */
const SECRETS = [
  LEAKED_IBAN,
  LEAKED_BIC,
  LEAKED_BIZUM,
  LEAKED_BRIDE_EMAIL,
  LEAKED_BRIDE_PHONE,
  LEAKED_GROOM_EMAIL,
  LEAKED_PLANNER_EMAIL,
  LEAKED_PLANNER_PHONE,
  LEAKED_GUEST_EMAIL,
  LEAKED_GUEST_PHONE,
  'Lucía Ferrer',
  'Rosa Gil',
];

/** Shape-level guards, so a leak in a field nobody thought to name still
 *  fails. Neither matches anything in the legitimate `CONFIG_PUBLIC`. */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /\+\d[\d ()-]{7,}\d/;

/** The routes a visitor can reach with no session at all: the landing page,
 *  the sign-in screen, and the GA disclosure the consent banner links to
 *  before any sign-in exists (`app.routes.ts`). */
const PUBLIC_ROUTES = [
  { url: '/', mounted: 'app-welcome' },
  { url: '/login', mounted: 'app-login' },
  { url: '/privacy-policy', mounted: 'app-privacy-policy' },
] as const;

test.describe('the public surface carries no Good to know content (T378/T385, hub ADR-0046 §7, ADR-0047 §5)', () => {
  test('GET /v1/config/public — the response the app consumes has no generalInfo and no couple', async ({
    page,
  }) => {
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
      expect(keys, 'public config keys').not.toContain('generalInfo');
      // The pre-ADR-0047 name. Asserted absent too, so a revert cannot
      // reopen the hole under the old spelling.
      expect(keys, 'public config keys').not.toContain('goodToKnow');
      // ADR-0047 §5's worked example — `wedding-api` T247's omission.
      expect(keys, 'public config keys').not.toContain('couple');
      // Nothing else smuggling the same content under another name.
      expect(JSON.stringify(body)).not.toMatch(/iban|bizum|dress-?code|day-?line|generalInfo/i);
    }
  });

  test('a leaked generalInfo still renders nothing before sign-in', async ({ page }) => {
    await installApiMocks(page);

    // Registered AFTER `installApiMocks`, so it wins (Playwright runs routes
    // in reverse registration order) — the public endpoint now answers with a
    // payload the contract forbids.
    await page.route('**/v1/config/public', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        // The real fixture plus the two attributes the contract omits — never
        // `route.fetch()`, which would try to reach the unreachable backend
        // this suite exists to avoid.
        body: JSON.stringify({
          ...CONFIG_PUBLIC,
          generalInfo: POISONED_GENERAL_INFO,
          couple: POISONED_COUPLE,
        }),
      }),
    );

    for (const route of PUBLIC_ROUTES) {
      await page.goto(route.url);
      await expect(page.locator(route.mounted)).toBeVisible();
      await page.waitForLoadState('networkidle');

      const rendered = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      for (const secret of SECRETS) {
        expect(
          rendered,
          `"${secret}" must not reach an unauthenticated visitor on ${route.url}`,
        ).not.toContain(secret);
      }
      // And the section itself is not mounted anywhere on a public route.
      await expect(page.locator('app-good-to-know')).toHaveCount(0);
    }
  });

  test('no couple, no email and no phone number reaches any unauthenticated route (wedding-api T247)', async ({
    page,
  }) => {
    await installApiMocks(page);

    // Bodies are collected as PROMISES and awaited after the walk, not
    // pushed from an async handler: an `async` listener that awaits
    // `response.text()` can still be in flight when the assertions run, and
    // a leak guard that silently inspected nothing is worse than none.
    const seen: Promise<{ url: string; body: string }>[] = [];
    const requested: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/v1/')) requested.push(request.url());
    });
    page.on('response', (response) => {
      if (!response.url().includes('/v1/')) return;
      seen.push(
        response
          .text()
          .catch(() => '')
          .then((body) => ({ url: response.url(), body })),
      );
    });

    for (const route of PUBLIC_ROUTES) {
      await page.goto(route.url);
      await expect(page.locator(route.mounted)).toBeVisible();
      await page.waitForLoadState('networkidle');

      const rendered = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      expect(rendered, `an email address rendered on ${route.url}`).not.toMatch(EMAIL_RE);
      expect(rendered, `a phone number rendered on ${route.url}`).not.toMatch(PHONE_RE);
    }

    const responses = await Promise.all(seen);
    expect(
      responses.length,
      'the app read at least one API endpoint while signed out',
    ).toBeGreaterThan(0);
    for (const { url, body } of responses) {
      expect(body, `${url} carried an email address to a signed-out visitor`).not.toMatch(EMAIL_RE);
      expect(body, `${url} carried a phone number to a signed-out visitor`).not.toMatch(PHONE_RE);
      const parsed: unknown = JSON.parse(body);
      expect(Object.keys(parsed as Record<string, unknown>), `${url} response keys`).not.toContain(
        'couple',
      );
    }

    // The authenticated read route (ADR-0047 §4) is never even asked for
    // while signed out — the section it feeds is mounted behind `rbacGuard`.
    expect(
      requested.filter((url) => url.includes('/v1/config/general-information')),
      'the authenticated general-information route was requested while signed out',
    ).toEqual([]);
  });

  test('the privacy notice discloses what a signed-in guest can see (T385, ADR-0047 §3)', async ({
    page,
  }) => {
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

    // ADR-0047 §3 — the four things the notice must now say. T381 asserted
    // the OPPOSITE of the first one (the third-party, no-account case of
    // ADR-0046 Amendment 2 §C), and that case was dropped by decision: a
    // contact is a person with an account here (§2), and someone without one
    // is added as a guest first. The guard is inverted with the copy in the
    // same commit — a green suite would otherwise be asserting the previous
    // requirement.
    expect(notice, 'the notice must say the listed people hold accounts').toMatch(
      /holds an account on this site/i,
    );
    expect(notice, 'the notice must state the kind of account').toMatch(
      /the couple themselves, the wedding planner, or another guest/i,
    );
    expect(notice, 'the notice must disclose the new exposure: name, email AND phone').toMatch(
      /their name, their email address and their phone number/i,
    );
    // ADR-0035 §7/§8 is untouched: Good to know is a separate surface with
    // its own rule, not a hole in the profile's couple-gated phone number.
    expect(notice, 'the notice must say the number is not shown on a profile').toMatch(
      /never appears on anyone's profile/i,
    );
    expect(notice).toMatch(/visible to the couple alone/i);

    // The permission is obtained offline, and NOTHING here records or checks
    // it (§3, and the `contactConsent` flag the ADR rejected). A notice
    // describing a capability the system lacks is the defect T381 existed to
    // fix; this is the same trap pointing the other way.
    expect(notice, 'the notice must say the agreement is obtained away from the site').toMatch(
      /away from this site/i,
    );
    expect(notice, 'the notice must not claim the site enforces the authorization').toMatch(
      /does not ask for that agreement, record it or check it/i,
    );
  });

  test('the notice claims, per locale, what the system actually does (T385, ADR-0047 §3 + Amendment 3 §A)', async () => {
    // Read off disk rather than out of the DOM so all three locales are
    // pinned, not just the one the app boots in. Two families of claim, and
    // they are asserted separately rather than as one regex because they
    // fail for different reasons:
    //
    //   `retired*` — true when written, false now. T381's third-party
    //     sentence (a contact with no account: dropped by ADR-0047 §2) and
    //     T382's provenance sentence (the couple typing the name and number
    //     in: the couple now PICKS an account and the digest is copied off
    //     it — `config-manager.ts`'s `contactDigest`). Each must be gone.
    //
    //   the rest — what ships. Including the one Amendment 3 §A forced:
    //     digests are stored VERBATIM on the CONFIG row and nothing resolves
    //     them at read time, so a profile edit does not update the card and
    //     **deactivating an account does not remove that person**. §3's
    //     disclosure says the couple lists people *with their agreement*, in
    //     the present tense; the notice therefore has to say plainly that
    //     only the couple can end that. `wedding-api` T251 carries the fix —
    //     when it lands, `staleClaim` is the assertion that must be revisited
    //     in the same commit.
    const body = (locale: string): string =>
      (
        JSON.parse(
          readFileSync(path.resolve(__dirname, `../public/i18n/${locale}.json`), 'utf8'),
        ) as { privacyPolicy: { goodToKnow: { body: string } } }
      ).privacyPolicy.goodToKnow.body;

    const claims = {
      es: {
        retiredNoAccount: /no tienen ninguna cuenta en este sitio|que no son invitadas/i,
        retiredCoupleTypes: /escriben directamente su nombre y su número/i,
        accountClaim: /tienen una cuenta en este sitio/i,
        kindsClaim: /los propios novios, la persona que ejerce de wedding planner o alguien invitado/i,
        detailsClaim: /su nombre, su correo electrónico y su número de teléfono/i,
        notOnProfileClaim: /nunca aparece en el perfil de nadie/i,
        coupleOnlyClaim: /visible únicamente para los novios/i,
        agreementClaim: /fuera de este sitio/i,
        unenforcedClaim: /no pide ese permiso, no lo registra ni lo comprueba/i,
        staleClaim: /cerrar una cuenta no la quita de ahí/i,
      },
      en: {
        retiredNoAccount: /no account on this site|not guests/i,
        retiredCoupleTypes: /types their name and number in directly/i,
        accountClaim: /holds an account on this site/i,
        kindsClaim: /the couple themselves, the wedding planner, or another guest/i,
        detailsClaim: /their name, their email address and their phone number/i,
        notOnProfileClaim: /never appears on anyone's profile/i,
        coupleOnlyClaim: /visible to the couple alone/i,
        agreementClaim: /away from this site/i,
        unenforcedClaim: /does not ask for that agreement, record it or check it/i,
        staleClaim: /closing an account does not remove them from it/i,
      },
      fr: {
        retiredNoAccount: /n'ont aucun compte sur ce site|qui ne sont pas invitées/i,
        retiredCoupleTypes: /saisissent directement son nom et son numéro/i,
        accountClaim: /possèdent un compte sur ce site/i,
        kindsClaim:
          /les mariés eux-mêmes, la personne qui assure le rôle de wedding planner, ou une autre personne invitée/i,
        detailsClaim: /son nom, son adresse e-mail et son numéro de téléphone/i,
        notOnProfileClaim: /n'apparaît jamais sur le profil de qui que ce soit/i,
        coupleOnlyClaim: /visible des seuls mariés/i,
        agreementClaim: /en dehors de ce site/i,
        unenforcedClaim: /ne demande pas cet accord, ne l'enregistre pas et ne le vérifie pas/i,
        staleClaim: /la fermeture d'un compte ne l'en retire pas/i,
      },
    } as const;

    for (const [locale, claim] of Object.entries(claims)) {
      const notice = body(locale);
      expect(
        notice,
        `${locale}: the notice must not promise a listed person with no account (ADR-0047 §2)`,
      ).not.toMatch(claim.retiredNoAccount);
      expect(
        notice,
        `${locale}: the notice must not say the couple types the name and number in`,
      ).not.toMatch(claim.retiredCoupleTypes);

      expect(notice, `${locale}: everyone listed holds an account here`).toMatch(
        claim.accountClaim,
      );
      expect(notice, `${locale}: the kind of account is stated`).toMatch(claim.kindsClaim);
      expect(notice, `${locale}: name, email and phone number are disclosed`).toMatch(
        claim.detailsClaim,
      );
      expect(notice, `${locale}: the number is not shown on a profile`).toMatch(
        claim.notOnProfileClaim,
      );
      expect(notice, `${locale}: on a profile it stays couple-only (ADR-0035 §7/§8)`).toMatch(
        claim.coupleOnlyClaim,
      );
      expect(notice, `${locale}: the agreement is obtained off-site`).toMatch(claim.agreementClaim);
      expect(
        notice,
        `${locale}: the site must not be described as recording or checking that agreement`,
      ).toMatch(claim.unenforcedClaim);
      expect(
        notice,
        `${locale}: the stored copy outlives the account (Amendment 3 §A)`,
      ).toMatch(claim.staleClaim);
    }
  });
});
