import type { Page, Route } from '@playwright/test';

import { installExternalAssetStubs } from './external-assets';

/**
 * Network stubs for the Playwright suite (T263). The suite must not depend on
 * a live `wedding-api` (task acceptance) — every endpoint the app calls while
 * booting, signing in, or rendering `/guests` is intercepted here via
 * `page.route`, never a real HTTP call to `environment.apiBaseUrl`
 * (`http://localhost:3000`, unreachable in this suite by design).
 *
 * Response shapes are hand-built against the generated DTOs in
 * `src/app/core/api/model/` (never re-declared) so a contract change that
 * breaks the real API would also change what these fixtures need to satisfy
 * the app's own TypeScript — the models are not imported directly here only
 * because Playwright specs compile outside the Angular `tsconfig` project;
 * shapes are kept in lockstep by hand and every field is named after its DTO.
 */

/** A minimal, unsigned JWT carrying the two claims `AppJwtClaimsDto` reads
 *  (`sub`, `role`) — this app never verifies the signature client-side
 *  (`LoginService.decodeRole`/`currentUserClaims` just parse the payload). */
function fakeJwt(sub: string, role: 'bride' | 'groom' | 'guest' | 'provider'): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const header = b64url({ alg: 'none', typ: 'JWT' });
  const payload = b64url({ sub, role });
  return `${header}.${payload}.e2e-signature`;
}

export const COUPLE_ID = 'e2e-bride-1';
export const COUPLE_TOKEN = fakeJwt(COUPLE_ID, 'bride');

const COUPLE_PROFILE = {
  id: COUPLE_ID,
  firstName: 'Sara',
  lastName: 'Bride',
  phoneNumber: '+34 655 012 118',
  preferredLang: 'en',
  role: 'bride',
};

/** A single signed-in guest (hub ADR-0045 §2's guest primary surface —
 *  Home · Schedule · RSVP · People) — the counterpart to {@link COUPLE_ID}
 *  above, for specs that need the guest role rather than the couple's. */
export const GUEST_ID = 'e2e-guest-self-1';
export const GUEST_TOKEN = fakeJwt(GUEST_ID, 'guest');

const GUEST_PROFILE = {
  id: GUEST_ID,
  firstName: 'Gina',
  lastName: 'Guestson',
  preferredLang: 'en',
  role: 'guest',
};

/**
 * `WeddingConfigPublicResponseDto` — loaded unconditionally by
 * `ConfigurationService` on app bootstrap, before anything else renders.
 *
 * Exported so `public-surface.spec.ts` (T378) can build a deliberately
 * poisoned variant of the REAL shape rather than a hand-made stand-in: a leak
 * test that starts from a different document proves less than one that starts
 * from this one and adds the forbidden field.
 */
export const CONFIG_PUBLIC = {
  id: 'e2e-config-1',
  version: 1,
  brideName: 'Sara',
  groomName: 'Christophe',
  tagline: 'Como la trucha al trucho',
  date: '2026-10-10T00:00:00.000Z',
  language: { en: 'English', es: 'Español', fr: 'Français' },
  themeId: 'terracotta',
  city: 'welcome.location',
  country: '',
  rsvpDeadline: '2026-09-01T00:00:00.000Z',
  mainVenue: {
    id: 'e2e-venue-1',
    name: 'Palacio de los Córdova',
    country: 'ES',
    city: 'Granada',
    postalCode: '18001',
    address: 'Cuesta del Chapiz',
    mapUrl: 'https://maps.example/venue',
    type: 'reception',
  },
};

/** One `UserProfileDto` per row — enough to guarantee the list overflows the
 *  smallest target viewport (`iPhone SE`, 320×568) so the pinned-region
 *  layout spec has something real to scroll. */
function guestProfiles(count: number): unknown[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `e2e-guest-${i}`,
    firstName: `Guest${i}`,
    lastName: `Fixture${i}`,
    preferredLang: 'en',
    role: 'guest',
  }));
}

/**
 * `CreateWeddingConfigDtoAgendaItemsInner[]` (T369) — mirrors the DS kit's
 * own `schedule.data.js` `WEDDING_SCHEDULE.items` (same times/titles/
 * statuses) so `/schedule`'s timeline and its "N confirmed · M planned"
 * note render real, comparable content instead of the prior empty list
 * (no spec depended on the empty array — grepped `e2e/` for `agenda`
 * before adding this). Per-locale `title`/`desc` repeat the same English
 * copy across `es`/`en`/`fr`: this is API *fixture* data standing in for
 * translated content already returned by the real backend, not
 * user-facing app copy — CLAUDE.md hard rule 8 governs the latter, not a
 * network stub.
 */
function agendaItems(): unknown[] {
  const mk = (
    id: string,
    time: string,
    title: string,
    desc: string,
    status: 'planned' | 'confirmed' | 'cancelled',
    highlight = false,
  ) => ({
    id,
    status,
    highlight,
    time,
    title: { es: title, en: title, fr: title },
    desc: { es: desc, en: desc, fr: desc },
    venueId: null,
  });
  return [
    mk('a1', '15:30', 'Welcome', 'Drinks under the olive trees', 'confirmed', true),
    mk('a2', '16:30', 'Ceremony', 'Religious ceremony', 'confirmed', true),
    mk('a3', '17:30', 'Aperitivo', 'Vermouth & jamón · Patio', 'confirmed'),
    mk('a4', '19:00', 'Dinner', 'Long table, candlelit · Salón', 'planned', true),
    mk('a5', '22:00', 'Dancing', 'Until the morning · Jardín', 'planned'),
    mk('a6', '03:00', 'Late bites', 'Tortilla & coffee · Patio', 'cancelled'),
  ];
}

/** The ULID prefix every `faq` entry id in this fixture shares — the render
 *  keys its rows by the stored id, never by the array index (hub ADR-0047
 *  §1), and `design-parity-info.spec.ts` asserts the rendered id carries
 *  this, which an index-keyed render could not produce. */
export const FAQ_ULID_PREFIX = '01JBBBBBBBBBBBBBBBBBBBBBB';

/** The single `note` entry's ULID — same reason as {@link FAQ_ULID_PREFIX}. */
export const NOTE_ULID = '01JDDDDDDDDDDDDDDDDDDDDDD1';

/**
 * The couple's own `generalInfo` sections (T388, hub **ADR-0047 §1/§2**) —
 * the fixed-shape object that replaced ADR-0046's ordered array of typed
 * blocks. There is no `type`, no block `id` and no stored order here: each
 * section is its own named field and the client renders the design system's
 * fixed arrangement.
 *
 * Copy mirrors the DS kit's own `info.data.js` seed (the same dress-code
 * headline, the same six FAQ questions, the same bank identifiers) so
 * `design-parity-info.spec.ts` compares like with like — a difference it
 * measures is then a *design* difference, never a content one.
 *
 * Same standing as `agendaItems()` above: this is API *fixture* data standing
 * in for content the real backend returns, not user-facing app copy — hard
 * rule 19 forbids this text in a locale file or a component template, which
 * is exactly where it is NOT. Per-locale prose repeats the same English
 * string for the same reason `agendaItems()` does.
 *
 * The fixture deliberately covers what the renderer BRANCHES on rather than
 * a happy path (T388): a `note` section the kit never drew, ULID-keyed `faq`
 * and `note` entries, all three `dayLine` variants, and — see
 * {@link GENERAL_INFORMATION} — a contact with no `phoneNumber`.
 *
 * Shape: `CreateWeddingConfigDtoGeneralInfo`, i.e. what `GET /v1/config`
 * carries. The couple digest is NOT part of it — it belongs to the read
 * route alone (ADR-0047 §4), which is why {@link GENERAL_INFORMATION} adds it
 * rather than this function.
 */
function generalInfoSections() {
  const L = (text: string) => ({ es: text, en: text, fr: text });
  return {
    dressCode: {
      headline: L('Elegant, garden-ready'),
      body: L(
        'Cocktail dress or a light suit, no black tie. Gravel gardens — bring a lower heel. Our colours, if you\u2019d like to match.',
      ),
      note: L('Please leave white and ivory to Sara — everything else is fair game.'),
    },
    gift: {
      intro: L(
        'You crossing a border to be there is already the present. If you would still like to give something, we are saving for three weeks in Japan — no list, no shop, just the account below.',
      ),
      // Identifiers: non-localized by decision (hub ADR-0046 §5, kept by
      // ADR-0047 §6) and rendered byte-identically in all three locales.
      accountHolder: 'Sara Moreno & Christophe Lef\u00e8vre',
      iban: 'ES91 2100 0418 4502 0005 1332',
      bic: 'CAIXESBBXXX',
      reference: L('Your name'),
      bizumPhone: '+34 655 012 118',
      bizumNote: L('Put your name in the message so we know who to thank.'),
    },
    // 1-10 entries, each carrying a ULID `id` the render keys its rows by,
    // never the array index (ADR-0047 §1). Six of them: the kit's own count.
    faq: [
      ['Can we bring the children?', 'Yes — tell us their names and ages in your RSVP.'],
      ['Where do we park?', 'There is a public car park five minutes uphill from the palacio.'],
      ['What will the weather be like?', 'Early June in Granada: 30\u00b0C in the afternoon.'],
      ['Which language is the ceremony in?', 'Spanish, with a French reading and an English one.'],
      ['May we bring someone?', 'Your invitation names everyone we have room for.'],
      ['When should we arrive?', 'The church doors open at 16:00 for a 16:30 ceremony.'],
    ].map(([question, answer], i) => ({
      id: `${FAQ_ULID_PREFIX}${i}`,
      question: L(question),
      answer: L(answer),
    })),
    // All three variants are stored and the client picks ONE, by today's
    // `Europe/Madrid` date against the config's `rsvpDeadline` and `date`
    // (hub ADR-0046 §4, unchanged by ADR-0047). Nothing stored says which
    // phase is current, so the three strings are deliberately distinct — a
    // spec can tell which branch ran only if they differ.
    dayLine: {
      rsvpOpen: L('5 June 2027 · the church at 16:30, then the party. Please reply by 1 May.'),
      rsvpClosed: L('5 June 2027 · the church at 16:30, then the party. Replies are closed.'),
      afterWedding: L('Thank you for celebrating with us.'),
    },
    // The one section the DS kit never drew: 1-10 free notes, each with a
    // ULID `id` and an authored `title` that IS its section label (ADR-0047
    // §1) — never unlabelled prose.
    note: [
      {
        id: NOTE_ULID,
        title: L('One last thing'),
        body: L('The palacio gate closes at 03:00 — the taxis know, and so do we.'),
      },
    ],
  };
}

/**
 * `WeddingGeneralInformationDto` — the authenticated read route
 * `GET /v1/config/general-information` (hub **ADR-0047 §4**), which is what
 * `app-good-to-know` actually reads (T383). Same sections as
 * {@link generalInfoSections}, plus the one thing only this route carries:
 *
 * **`contact.couple` is present, and required.** The route composes the
 * digest from the CONFIG document server-side (§4, resolved by Amendment 2),
 * so `contact` and `contact.couple` are both required on this response and
 * the renderer opens its card with the bride and the groom. A mock that
 * omitted it would be testing a response the API cannot produce.
 *
 * **A contact with no number, and contacts with one.** `phoneNumber` is
 * REQUIRED on a `weddingPlanner` and on a `guest` entry and OPTIONAL only on
 * the composed couple digest — so the groom is the one row that can have
 * none, and he has none here: no number line and **no call button, absent
 * rather than disabled** (T383). Three of the four rows carry a number, so
 * both branches render in the same fixture.
 *
 * The people are accounts (ADR-0047 §2 — a contact is a person with an
 * account here): the bride and groom of `COUPLE_USERS`, a wedding planner,
 * and the guest `e2e-guest-0` that `guestProfiles()` already serves. Only the
 * guest entry carries `purpose`, which is what makes the section "who to call
 * **about what**"; a planner's role already says it (§2).
 */
export const GENERAL_INFORMATION = {
  ...generalInfoSections(),
  contact: {
    couple: {
      bride: {
        id: COUPLE_ID,
        firstName: 'Sara',
        lastName: 'Moreno',
        email: 'sara@example.com',
        phoneNumber: '+34 600 112 233',
      },
      // No `phoneNumber`: the one row the contract lets go without one.
      groom: {
        id: 'e2e-groom-1',
        firstName: 'Christophe',
        lastName: 'Lef\u00e8vre',
        email: 'christophe@example.com',
      },
    },
    weddingPlanner: [
      {
        id: 'e2e-planner-1',
        role: 'wedding-planner',
        firstName: 'Elena',
        lastName: 'Vidal',
        email: 'elena@vidalbodas.es',
        phoneNumber: '+34 640 118 227',
      },
    ],
    guest: [
      {
        id: 'e2e-guest-0',
        role: 'guest',
        firstName: 'Guest0',
        lastName: 'Fixture0',
        email: 'guest0@example.com',
        phoneNumber: '+34 655 012 118',
        purpose: { es: 'Travel, transfers, logistics', en: 'Travel, transfers, logistics', fr: 'Travel, transfers, logistics' },
      },
    ],
  },
};

/**
 * The two dates `app-good-to-know` picks its `dayLine` variant against (hub
 * ADR-0046 §4, unchanged by ADR-0047): today's `Europe/Madrid` calendar date
 * is compared to `rsvpDeadline`, then to the wedding `date`. Exported because
 * no stored field says which phase is current — a spec can only know which of
 * the three authored sentences must render by applying the same rule to the
 * same two dates.
 */
export const CONFIG_DATES = {
  date: '2026-10-10T00:00:00.000Z',
  rsvpDeadline: '2026-09-01T00:00:00.000Z',
};

/** `WeddingConfigResponseDto` (admin `GET /v1/config`, `ConfigManager`'s own
 *  read) — a different, larger document than `CONFIG_PUBLIC` above, which is
 *  the read-only public mirror. `dietaryPreferencesCount` seeds the
 *  `dietaryPreferences` tag list, the one section long enough to overflow
 *  `.content` at every target viewport (T343's `config-manager` layout spec)
 *  — each existing target width is comfortably taller than a handful of
 *  fields, so the section needs real length, not just a few rows. */
function weddingConfigAdmin(dietaryPreferencesCount: number): unknown {
  return {
    id: 'e2e-config-1',
    version: 3,
    brideName: 'Sara',
    groomName: 'Christophe',
    tagline: 'Como la trucha al trucho',
    date: CONFIG_DATES.date,
    language: { en: 'English', es: 'Español', fr: 'Français' },
    themeId: 'terracotta',
    city: 'Granada',
    country: 'ES',
    rsvpDeadline: CONFIG_DATES.rsvpDeadline,
    venues: [],
    agenda: { status: 'provisional', items: agendaItems() },
    hotels: [],
    dietaryPreferences: Array.from({ length: dietaryPreferencesCount }, (_, i) => ({
      id: `e2e-dietary-${i}`,
      label: { es: `Preferencia ${i}`, en: `Preference ${i}`, fr: `Préférence ${i}` },
    })),
    allergies: [],
    menus: [],
    generalInfo: generalInfoSections(),
  };
}

/** `UserListResponseDto` (`GET /v1/users`, `ConfigManager`'s "the couple"
 *  section) — the bride/groom pair `coupleProfiles` resolves from. */
const COUPLE_USERS = {
  items: [
    {
      id: COUPLE_ID,
      version: 1,
      firstName: 'Sara',
      lastName: 'Bride',
      phoneNumber: '+34600000001',
      role: 'bride',
      preferredLang: 'en',
    },
    {
      id: 'e2e-groom-1',
      version: 1,
      firstName: 'Christophe',
      lastName: 'Groom',
      phoneNumber: '+34600000002',
      role: 'groom',
      preferredLang: 'en',
    },
  ],
  nextCursor: null,
  count: 2,
};

/** `MilestoneListResponseDto.items` (`GET /v1/milestones`, the `/milestones`
 *  screen's own `EntityCollectionService.getAll()` read) — spread across two
 *  years so the timeline overflows `.list` at every target viewport (mobile
 *  flow via `main`, and `.list`'s own `overflow-y: auto` at `≥900px`,
 *  T343's `milestones` slice, hub ADR-0043 §5). Alternates internal/
 *  guest-facing and reached/not so both dot styles and both status pills
 *  render at least once. */
function milestoneItems(count: number): unknown[] {
  return Array.from({ length: count }, (_, i) => {
    const internal = i % 3 === 0;
    const plannedDate = new Date(Date.UTC(2025, 0, 1) + i * 21 * 24 * 60 * 60 * 1000).toISOString();
    return {
      id: `e2e-milestone-${i}`,
      title: {
        es: `Hito ${i}`,
        en: `Milestone ${i}`,
        fr: `Étape ${i}`,
      },
      plannedDate,
      kind: internal ? 'internal' : 'guest-facing',
      reached: i % 4 === 0,
      version: 1,
      atRisk: false,
    };
  });
}

/**
 * `RsvpDto` for the signed-in guest fixture (T369) — backs
 * `GET/POST /v1/rsvp/{guestId}`, the own-record read `Rsvp.ngOnInit` awaits
 * before deciding whether to auto-provision one. Without this route the
 * request fell through to the `**\/v1/**` catch-all (501), `rsvp()` stayed
 * `undefined`, and `/rsvp` rendered nothing — a known fixture gap (T367
 * `risks[]`). Only registered when `opts.rsvpStatus` is set (see
 * `installApiMocks`) — every existing caller (`signInAsGuest` included)
 * gets the prior, unchanged 501 behaviour, because `LoginService
 * .postLoginUrl()` reads this same endpoint right after sign-in and sends
 * a guest whose RSVP is missing/`pending` to `/rsvp` instead of their
 * normal `/me` landing page: turning this fixture on unconditionally would
 * have silently redirected every `signInAsGuest` caller in the suite.
 */
function guestRsvp(status: 'pending' | 'attending' | 'declined'): unknown {
  return {
    id: GUEST_ID,
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status,
    adults: {
      partner1: { id: GUEST_ID, firstName: 'Gina', lastName: 'Guestson', attending: true },
    },
    children: [],
    submittedBy: GUEST_ID,
  };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/**
 * Installs every stub the app needs to boot, sign a couple in via the real
 * OTP flow, and render `/guests` — registered before any navigation so
 * nothing races the app's own bootstrap requests.
 */
export async function installApiMocks(
  page: Page,
  opts: {
    guestCount?: number;
    pageSize?: number;
    dietaryPreferencesCount?: number;
    milestoneCount?: number;
    /** Which identity `**\/v1/auth/otp/verify` hands back — 'bride' (default,
     *  `signInAsCouple`) or 'guest' (`signInAsGuest`, hub ADR-0045 §2's
     *  guest primary surface). */
    role?: 'bride' | 'guest';
    /** T369: when set, registers `GET/POST /v1/rsvp/{guestId}` so the
     *  signed-in guest's own RSVP resolves to real content instead of the
     *  unmocked-501 catch-all — see `guestRsvp`'s own doc for why this is
     *  opt-in rather than always on. */
    rsvpStatus?: 'pending' | 'attending' | 'declined';
  } = {},
): Promise<void> {
  const guestCount = opts.guestCount ?? 40;
  const pageSize = opts.pageSize;
  const dietaryPreferencesCount = opts.dietaryPreferencesCount ?? 3;
  const milestoneCount = opts.milestoneCount ?? 3;
  const role = opts.role ?? 'bride';

  // Pre-seeds a GA consent decision (`ConsentService`, hub ADR-0027) so
  // `<app-consent-banner>` — fixed to the bottom of every page, mounted
  // eagerly at the app root — never renders and cannot intercept clicks
  // meant for the page underneath it. Equivalent to a returning visitor who
  // already decided; this suite has no interest in the banner itself.
  await page.addInitScript(() => {
    window.localStorage.setItem('sc-analytics-consent', 'declined');
  });

  // Registered FIRST, not last: Playwright runs routes in the order
  // *opposite* their registration ("the most recently registered route takes
  // precedence" — `page.route` API docs), so a catch-all registered after
  // the specific routes below would shadow every one of them. Registering it
  // first means every `page.route` call after this one takes priority, and
  // this only ever answers a request nothing more specific claimed.
  //
  // Anything reaching this handler is a gap in the fixture, not a real
  // backend call — fail loudly and distinctly rather than let Playwright
  // hang on a connection to `localhost:3000` that will never answer.
  await page.route('**/v1/**', (route) =>
    json(route, { message: `unmocked in e2e: ${route.request().method()} ${route.request().url()}` }, 501),
  );

  await page.route('**/v1/config/public', (route) => json(route, CONFIG_PUBLIC));

  // `ConfigManager`'s own reads (T343) — the admin document and the
  // bride/groom accounts its "the couple" section resolves.
  await page.route('**/v1/config', (route) =>
    json(route, weddingConfigAdmin(dietaryPreferencesCount)),
  );

  // The authenticated read route `app-good-to-know` reads (T383, hub
  // ADR-0047 §4). A separate stub from `**/v1/config` above, which does NOT
  // match this path and never did — before T388 nothing mocked it at all, so
  // every request fell through to the 501 catch-all and the section rendered
  // nothing.
  await page.route('**/v1/config/general-information', (route) =>
    json(route, GENERAL_INFORMATION),
  );
  await page.route('**/v1/users', (route) => json(route, COUPLE_USERS));

  await page.route('**/v1/auth/otp/request', (route) => json(route, { ok: true }));

  await page.route('**/v1/auth/otp/verify', (route) =>
    json(route, { accessToken: role === 'guest' ? GUEST_TOKEN : COUPLE_TOKEN }),
  );

  await page.route(`**/v1/profile/${COUPLE_ID}`, (route) => json(route, COUPLE_PROFILE));
  await page.route(`**/v1/profile/${GUEST_ID}`, (route) => json(route, GUEST_PROFILE));

  await page.route('**/v1/profile?*', (route) => handleProfileList(route, guestCount, pageSize));
  await page.route('**/v1/profile', (route) => handleProfileList(route, guestCount, pageSize));

  await page.route('**/v1/rsvp?*', (route) => json(route, { items: [], nextCursor: null }));
  await page.route('**/v1/rsvp', (route) => json(route, { items: [], nextCursor: null }));
  // Own-record read/create (T369, opt-in) — see `guestRsvp`'s own doc.
  if (opts.rsvpStatus) {
    const rsvp = guestRsvp(opts.rsvpStatus);
    await page.route(`**/v1/rsvp/${GUEST_ID}`, (route) => json(route, rsvp));
  }

  await page.route('**/v1/notifications/unread-count', (route) => json(route, { count: 0 }));

  // `/milestones` screen's own reads (T343). `audiences` is fed empty and
  // non-fatal (`fetchAudiences()`'s own comment, `milestones.ts`) — nothing
  // in this suite exercises the guest-facing send flow.
  await page.route('**/v1/milestones', (route) =>
    json(route, { items: milestoneItems(milestoneCount) }),
  );
  await page.route('**/v1/audiences', (route) => json(route, { items: [] }));

  // The THIRD-party half of "this suite stubs the network" (T389).
  // `src/index.html:40-45` pulls a render-blocking Google Fonts stylesheet and
  // `src/main.ts:40` initializes Sentry against the PRODUCTION DSN, so every page
  // load in this suite reached the public internet five times over — and a slow
  // answer stalled `page.goto`'s `load`, or `waitForLoadState('networkidle')`, for
  // the whole 30s test budget. That is the flake T389 was filed for; see
  // `external-assets.ts` for the measurement and the reproduction.
  //
  // Registered LAST, so it wins: routes run in the order *opposite* their
  // registration, and `**/v1/**` above is a glob, not a host match — it would
  // happily claim a third-party URL that carried that segment.
  await installExternalAssetStubs(page);
}

/**
 * `GET /v1/profile[?cursor=]`. Without `pageSize` (the default, and every
 * caller before T348) the whole collection comes back in one response and
 * `nextCursor` is always `null` — no "Load more", no auto-load, matching
 * `UserProfileDataService.getAll()`'s own real-API behaviour for an unpaged
 * read (`user-profile-data.service.ts`). With `pageSize` set, the cursor is
 * the offset into `guestProfiles(guestCount)` as a decimal string — real
 * cursors are opaque, but nothing here reads it as anything but "what
 * `nextCursor` last handed back", which is all `UserProfileDataService`
 * requires of it.
 */
async function handleProfileList(
  route: Route,
  guestCount: number,
  pageSize: number | undefined,
): Promise<void> {
  const allGuests = guestProfiles(guestCount);

  if (!pageSize || pageSize >= allGuests.length) {
    const items = [COUPLE_PROFILE, ...allGuests];
    await json(route, { items, profiles: items, nextCursor: null, count: items.length });
    return;
  }

  const url = new URL(route.request().url());
  const start = Number(url.searchParams.get('cursor') ?? '0');
  const page = allGuests.slice(start, start + pageSize);
  // The couple's own profile only ever arrives on the first page — a real
  // cursor-paged read has no reason to repeat it.
  const items = start === 0 ? [COUPLE_PROFILE, ...page] : page;
  const nextStart = start + pageSize;
  const nextCursor = nextStart < allGuests.length ? String(nextStart) : null;
  await json(route, { items, profiles: items, nextCursor, count: items.length });
}
