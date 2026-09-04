import type { Page, Route } from '@playwright/test';

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
  preferredLang: 'en',
  role: 'bride',
};

/** `WeddingConfigPublicResponseDto` — loaded unconditionally by
 *  `ConfigurationService` on app bootstrap, before anything else renders. */
const CONFIG_PUBLIC = {
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
  opts: { guestCount?: number; pageSize?: number } = {},
): Promise<void> {
  const guestCount = opts.guestCount ?? 40;
  const pageSize = opts.pageSize;

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

  await page.route('**/v1/auth/otp/request', (route) => json(route, { ok: true }));

  await page.route('**/v1/auth/otp/verify', (route) =>
    json(route, { accessToken: COUPLE_TOKEN }),
  );

  await page.route(`**/v1/profile/${COUPLE_ID}`, (route) => json(route, COUPLE_PROFILE));

  await page.route('**/v1/profile?*', (route) => handleProfileList(route, guestCount, pageSize));
  await page.route('**/v1/profile', (route) => handleProfileList(route, guestCount, pageSize));

  await page.route('**/v1/rsvp?*', (route) => json(route, { items: [], nextCursor: null }));
  await page.route('**/v1/rsvp', (route) => json(route, { items: [], nextCursor: null }));

  await page.route('**/v1/notifications/unread-count', (route) => json(route, { count: 0 }));
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
