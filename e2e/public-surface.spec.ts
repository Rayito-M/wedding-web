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

    // Mounted is not the same as translated (T389). `app.config.ts:44-51`
    // installs no initializer that waits for `/i18n/<lang>.json`, so the app
    // paints its first frame with raw keys in it and swaps in the copy when
    // the fetch lands — measured at 31ms locally and, with the locale file
    // delayed by 1s and 3s, at 987ms and 2988ms, i.e. the window IS the
    // fetch. Everything below takes a one-shot `innerText()` snapshot, so
    // without this gate the file intermittently asserts against the keys
    // rather than the notice. That is exactly how this test failed on
    // 2026-09-15 (T390's "eighth flake") and again on 2026-09-16.
    //
    // Auto-retrying and specific: it waits for the locale and for nothing
    // else, and it cannot paper over wrong copy — every claim below is
    // unchanged. The APP-side question this raises (a guest on a slow
    // connection sees the same raw keys) is answered and filed in T389's
    // report; it is a defect in its own right and is not fixed from a spec.
    await expect(page.locator('h1')).not.toHaveText('privacyPolicy.title');

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

    // Delegation (T380, hub ADR-0039 §4/§6/§8; `SPEC.md` Non-functional).
    // A pre-existing gap: the notice had said nothing about delegation since
    // the day the feature shipped, on the one category of data the SPEC
    // itself calls health-adjacent. Asserted here for MEANING, not phrasing —
    // the four facts a guest needs, each of which is a claim about how the
    // system behaves and not a turn of phrase.
    expect(notice, 'the notice must have a delegation section').toContain(
      'When someone else answers for you',
    );
    expect(notice, 'who the couple may name — ADR-0039 §4-§5, parent or sibling only').toMatch(
      /your mother, your father, your brother or your sister/i,
    );
    expect(notice, 'the delegate reads the WHOLE reply, not their own part of it').toMatch(
      /sees the whole reply/i,
    );
    expect(notice, 'the health-adjacent data must be named, not summarised away').toMatch(
      /children you have named with their ages, and the dietary preferences and allergies/i,
    );
    expect(notice, 'the subject can always see who holds it — ADR-0039 §6').toMatch(
      /shown on your own profile, read-only/i,
    );
    // The two capabilities the system does NOT have. T378's rule, and the
    // trap T381 fell into pointing the other way: a notice describing a
    // notification that does not exist, or an in-app refusal that does not
    // exist, is worse than no notice.
    expect(notice, 'ADR-0039 §8 Q6 — a grant notifies nobody, and must not be said to').toMatch(
      /Nobody is told they have been made a delegate/i,
    );
    expect(notice, 'ADR-0039 §8 Q9 — neither side can refuse or resign in-app').toMatch(
      /Neither of you can refuse the arrangement or hand it back through this site/i,
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

  test('the delegation disclosure states what ships, per locale (T380, hub ADR-0039)', async () => {
    // A section beside the one above rather than inside it (T380's own
    // wording allows either): the two disclosures cover different data, were
    // written years apart in task time, and a failure in one should not read
    // as a failure in the other.
    //
    // `SPEC.md`'s Non-functional clause has required this since ADR-0039
    // shipped and the notice never carried it. What makes it worth pinning
    // per locale rather than trusting to the copy is the shape of the risk:
    // the true statements here are all NEGATIVE — nobody is notified, nobody
    // can refuse — and negative facts are exactly what a later well-meaning
    // edit "improves" into a reassurance the system cannot honour.
    //
    // Asserted for MEANING. Each regex matches the load-bearing clause only,
    // never a whole sentence, so the copy stays free to be reworded and these
    // fail only when a FACT changes.
    const body = (locale: string): string =>
      (
        JSON.parse(
          readFileSync(path.resolve(__dirname, `../public/i18n/${locale}.json`), 'utf8'),
        ) as { privacyPolicy: { delegation: { body: string } } }
      ).privacyPolicy.delegation.body;

    const claims = {
      es: {
        // ADR-0039 §4/§5 — the closed four-value vocabulary, read from the
        // subject's side, which is the only side it is renderable from (§6).
        kindsClaim: /tu madre, tu padre, tu hermano o tu hermana/i,
        wholeReplyClaim: /ve la respuesta entera/i,
        healthDataClaim: /los niños que hayas indicado con su edad.*alergias/is,
        visibleToSubjectClaim: /aparece en tu propio perfil, solo para consultarlo/i,
        coupleOnlyClaim: /únicamente los novios pueden añadir o quitar/i,
        immediateClaim: /surte efecto de inmediato/i,
        keepsOwnReplyClaim: /nunca te quita tu propia respuesta/i,
        // The two capabilities the product does not have.
        noNotificationClaim: /a nadie se le avisa de que se le ha nombrado/i,
        noRefusalClaim: /ni devolverlo desde este sitio/i,
        // …and the promises a later edit must not make instead.
        forbiddenNotification: /te avisaremos|se te avisará|recibirás un aviso|te notificaremos/i,
        forbiddenRefusal: /puedes quitarlo|puedes quitarla|quítalo tú|desde tu perfil puedes/i,
      },
      en: {
        kindsClaim: /your mother, your father, your brother or your sister/i,
        wholeReplyClaim: /sees the whole reply/i,
        healthDataClaim: /children you have named with their ages.*allergies/is,
        visibleToSubjectClaim: /shown on your own profile, read-only/i,
        coupleOnlyClaim: /only the couple can add or remove/i,
        immediateClaim: /takes effect immediately/i,
        keepsOwnReplyClaim: /never takes away your own/i,
        noNotificationClaim: /nobody is told they have been made a delegate/i,
        noRefusalClaim: /hand it back through this site/i,
        forbiddenNotification: /you will be (told|notified)|we will let you know|you'll be notified/i,
        forbiddenRefusal: /remove (it|them) yourself|you can remove|decline it here|turn it off/i,
      },
      fr: {
        kindsClaim: /votre mère, votre père, votre frère ou votre sœur/i,
        wholeReplyClaim: /voit la réponse entière/i,
        healthDataClaim: /les enfants que vous avez indiqués avec leur âge.*allergies/is,
        visibleToSubjectClaim: /figure sur votre propre profil, en lecture seule/i,
        coupleOnlyClaim: /seuls les mariés peuvent y ajouter ou en retirer/i,
        immediateClaim: /prend effet immédiatement/i,
        keepsOwnReplyClaim: /ne vous retire jamais votre propre réponse/i,
        noNotificationClaim: /personne n'est prévenu d'avoir été désigné/i,
        noRefusalClaim: /le rendre depuis ce site/i,
        forbiddenNotification: /vous serez prévenu|nous vous préviendrons|vous recevrez un avis/i,
        forbiddenRefusal: /vous pouvez le retirer|retirez-le vous-même|depuis votre profil vous/i,
      },
    } as const;

    for (const [locale, claim] of Object.entries(claims)) {
      const notice = body(locale);

      expect(notice, `${locale}: only a parent or a sibling (ADR-0039 §4/§5)`).toMatch(
        claim.kindsClaim,
      );
      expect(notice, `${locale}: the delegate reads the WHOLE reply`).toMatch(claim.wholeReplyClaim);
      expect(
        notice,
        `${locale}: children, ages, dietary preferences and allergies are named — SPEC.md calls this health-adjacent, and summarising it away is the disclosure failure`,
      ).toMatch(claim.healthDataClaim);
      expect(notice, `${locale}: the subject can always see who holds it`).toMatch(
        claim.visibleToSubjectClaim,
      );
      expect(notice, `${locale}: only the couple grants or removes (ADR-0039 §8)`).toMatch(
        claim.coupleOnlyClaim,
      );
      expect(notice, `${locale}: removal is immediate (ADR-0039 §8)`).toMatch(claim.immediateClaim);
      expect(notice, `${locale}: delegation adds a writer, it never removes one (§8 Q8)`).toMatch(
        claim.keepsOwnReplyClaim,
      );

      expect(
        notice,
        `${locale}: the notice must say nobody is notified of a grant (ADR-0039 §8 Q6)`,
      ).toMatch(claim.noNotificationClaim);
      expect(
        notice,
        `${locale}: the notice must say the arrangement cannot be refused or handed back in-app (ADR-0039 §8 Q9)`,
      ).toMatch(claim.noRefusalClaim);

      expect(
        notice,
        `${locale}: the notice must not promise a notification — none exists, and building one would be a new ADR-0019 type`,
      ).not.toMatch(claim.forbiddenNotification);
      expect(
        notice,
        `${locale}: the notice must not offer the guest an in-app way out — the couple's guest manager is the only write surface`,
      ).not.toMatch(claim.forbiddenRefusal);
    }
  });
});
