import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';

/**
 * Reusable design-system-parity harness (T368) — the template the task asks
 * for future screen-parity specs to reuse rather than re-deriving.
 *
 * Serves the sibling `wedding-ui-design` checkout's own click-through kit
 * (`ui_kits/wedding-app/index.html`) over real HTTP — `file://` breaks a few
 * things the kit itself relies on (relative `fetch`s of its own `*.data.js`
 * fixtures behave differently under `file://` in some engines) — and drives
 * its own on-page toggles exactly as a human reviewer would: never a
 * fabricated URL/query param the kit doesn't read, since the kit keeps all
 * of its state in `React.useState`, not the URL.
 */

const DS_REPO_ROOT = path.resolve(__dirname, '../../../wedding-ui-design');

export interface DsKitServer {
  readonly baseUrl: string;
  stop(): Promise<void>;
}

/**
 * Starts `python3 -m http.server` against `DS_REPO_ROOT`. Port `0` asks the
 * OS for a free ephemeral port — this suite may run in parallel workers, or
 * back-to-back before a previous run's server has fully released its port,
 * so a hardcoded port would be a flaky collision waiting to happen. The
 * assigned port is read back off the server's own startup banner ("Serving
 * HTTP on 127.0.0.1 port NNNNN"). `-u` (unbuffered stdio) is required, not
 * cosmetic: verified empirically — with Python's default buffering, stdout
 * is a pipe rather than a TTY here, so the banner sits in Python's own
 * buffer and never reaches Node until the process later flushes for an
 * unrelated reason (in practice: never, for a server that only logs on
 * request), and this would hang for the full timeout on every run.
 */
export async function startDsKitServer(): Promise<DsKitServer> {
  const proc: ChildProcessWithoutNullStreams = spawn(
    'python3',
    ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1'],
    { cwd: DS_REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  const port = await new Promise<number>((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`ds-kit static server did not start within 10s (saw: ${buffer || '<nothing>'})`));
    }, 10_000);
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const match = /Serving HTTP on \S+ port (\d+)/.exec(buffer);
      if (match) {
        cleanup();
        resolve(Number(match[1]));
      }
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    function cleanup() {
      clearTimeout(timer);
      proc.stdout.off('data', onData);
      proc.stderr.off('data', onData);
      proc.off('error', onError);
    }
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.once('error', onError);
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    stop: () =>
      new Promise<void>((resolve) => {
        proc.once('close', () => resolve());
        proc.kill();
      }),
  };
}

export type DsDevice = 'Mobile' | 'Desktop';
export type DsRole = 'Guest' | 'Provider' | 'Couple';

/**
 * Opens the kit and drives it to the given device/role/view using its own
 * `.controls`/`.viewsel` toggle buttons (`ui_kits/wedding-app/index.html`).
 * `viewLabel` must be one of `APP_VIEWS`'/`COUPLE_VIEWS`' exact labels
 * (e.g. `"Home"`) — matched with `exact: true` because several labels share
 * a "Home" prefix (`"Home · Getting there"`, `"Home · Good to know"`).
 *
 * Order matters: device, then role, then view — the kit resets `view` back
 * to `"home"` in a `useEffect` keyed on `role` (leaving Manage, or leaving
 * the couple-only `"tasks"` view), so selecting the view last is the only
 * order that survives.
 */
export async function openDsKitScreen(
  kitPage: Page,
  baseUrl: string,
  opts: { device: DsDevice; role: DsRole; viewLabel: string },
): Promise<void> {
  // `kitPage` is a second page opened on the SAME `BrowserContext` as the
  // app page (`context.newPage()`), so on the suite's four mobile-emulation
  // projects (iPhone SE/12/14, Pixel 7 — `playwright.config.ts`) it inherits
  // that project's small default viewport, not a real desktop size. The
  // kit's own `.frame-wrap.wide` (`index.html`) is `width: 1200px; max-width:
  // calc(100vw - 32px)` — on a ~375-390px real viewport that caps the
  // rendered frame at ~350-360px regardless of which device TOGGLE
  // (`opts.device`) is clicked, silently shrinking every "Desktop" kit
  // measurement (found via T369's own content-column-width metric: a
  // `1200px`-wide desktop frame measured `372px` under `iPhone SE`'s
  // emulated viewport). Force a real desktop viewport before requesting the
  // "Desktop" device so the frame renders at its intended width regardless
  // of which project this page's context belongs to; "Mobile" needs no such
  // fix (`.frame-wrap`'s non-wide branch is a fixed `400px`, no `calc`).
  if (opts.device === 'Desktop') {
    await kitPage.setViewportSize({ width: 1280, height: 900 });
  }
  await kitPage.goto(`${baseUrl}/ui_kits/wedding-app/index.html`);
  await kitPage.locator('.controls').getByRole('button', { name: opts.device, exact: true }).click();
  await kitPage.locator('.controls').getByRole('button', { name: opts.role, exact: true }).click();
  await kitPage.locator('.viewsel').getByRole('button', { name: opts.viewLabel, exact: true }).click();
  // Babel-standalone compiles every `type="text/babel"` script in-browser on
  // first paint; wait for the rendered screen itself rather than a fixed
  // delay.
  await kitPage.locator('[data-overlay-host]').waitFor();
}

/** A rendered element's border-box geometry — `getBoundingClientRect()`'s
 *  four fields this suite actually needs, nothing more. */
export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Reusable metric primitive (T369 — the parity harness extended to every
 * implemented screen): the border-box rect of the FIRST element matching
 * `selector`, or `null` if none exists — callers decide whether an absent
 * element is a defect (screen-specific parity specs) or an expected
 * structural difference (documented as a finding, never silently skipped).
 */
export async function boxOf(page: Page, selector: string): Promise<Box | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }, selector);
}

/**
 * The computed values of the given CSS properties on the FIRST element
 * matching `selector`, or `null` if none exists. Property names are the
 * camelCase `CSSStyleDeclaration` keys (e.g. `backgroundColor`, not
 * `background-color`) — same convention `design-parity-home.spec.ts`
 * already uses for its own inline `style()` helper, generalized here so
 * every later parity spec reads computed style the same way.
 */
export async function stylesOf(
  page: Page,
  selector: string,
  props: string[],
): Promise<Record<string, string> | null> {
  return page.evaluate(
    ({ sel, props }) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return null;
      const cs = getComputedStyle(el);
      const out: Record<string, string> = {};
      for (const p of props) out[p] = cs.getPropertyValue(p) || (cs as unknown as Record<string, string>)[p];
      return out;
    },
    { sel: selector, props },
  );
}

export function expectClose(actual: number, expected: number, tolerance: number, label: string): void {
  expect(actual, `${label}: expected ${expected} ±${tolerance}, got ${actual}`).toBeGreaterThanOrEqual(
    expected - tolerance,
  );
  expect(actual, `${label}: expected ${expected} ±${tolerance}, got ${actual}`).toBeLessThanOrEqual(
    expected + tolerance,
  );
}

export interface PillStyle {
  background: string;
  borderColor: string;
  fontSize: string;
  fontWeight: string;
  padding: string;
}

export interface HomeSubnavMetrics {
  /** The boundary content clears the fixed/normal-flow header from — see
   *  each measurer for what element stands in for it and why. */
  contentTop: number;
  /** The rendered edges of the FIRST (selected) pill button itself — never
   *  the row container's own box (a padding change on the row never moves
   *  its own border-box start — see `design-parity-home.spec.ts`'s original
   *  T368 doc for the false-positive this avoided). */
  pillTop: number;
  pillBottom: number;
  pillLeft: number;
  greetingTop: number;
  greetingLeft: number;
  selected: PillStyle;
  unselected: PillStyle;
}

/**
 * Measures the DS kit's own Home screen (T368; reused by T369 for the
 * couple's Home, `role: 'Couple'` — `ScreenHome.jsx`'s `content` branch
 * renders the identical "Hola, {name}." greeting and Today/Getting-there
 * pills for both roles, only `overviewContent` differs). `active: 'home'`
 * is the default on load, so "Today" is the selected pill and "Getting
 * there" is unselected.
 *
 * `contentTop` is `AppHeader`'s own real bottom edge: unlike the app,
 * the kit's header is normal-flow, not `position: fixed`, so its rendered
 * bottom edge *is* the boundary the row's own top padding measures from —
 * no separate clearance mechanism to account for. `AppShell.jsx`'s own
 * structure puts `AppHeader` as the shell's first child when `wide`; the
 * non-wide branch prepends a 32px status-bar mock (the "9:41" row) the real
 * app has no equivalent of, so there `AppHeader` is the second child
 * instead.
 */
export async function measureKitHomeSubnav(kitPage: Page, wide: boolean): Promise<HomeSubnavMetrics> {
  return kitPage.evaluate((wide) => {
    const host = document.querySelector('[data-overlay-host]');
    if (!host) throw new Error('DS kit: AppShell root ([data-overlay-host]) not found');
    const header = (wide ? host.children[0] : host.children[1]) as HTMLElement | undefined;
    if (!header) throw new Error('DS kit: AppHeader element not found');

    const buttons = Array.from(document.querySelectorAll('button'));
    const selectedBtn = buttons.find((b) => b.textContent?.trim() === 'Today');
    const unselectedBtn = buttons.find((b) => b.textContent?.trim() === 'Getting there');
    if (!selectedBtn || !unselectedBtn) throw new Error('DS kit: Home subnav pills not found');

    const greetingLine = Array.from(document.querySelectorAll('div')).find(
      (el) => el.children.length === 0 && (el.textContent ?? '').trim().startsWith('Hola,'),
    ) as HTMLElement | undefined;
    if (!greetingLine) throw new Error('DS kit: greeting line not found');

    const style = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      return {
        background: cs.backgroundColor,
        borderColor: cs.borderColor,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        padding: cs.padding,
      };
    };

    const headerRect = header.getBoundingClientRect();
    const pillRect = selectedBtn.getBoundingClientRect();
    const greetingRect = greetingLine.getBoundingClientRect();

    return {
      contentTop: headerRect.bottom,
      pillTop: pillRect.top,
      pillBottom: pillRect.bottom,
      pillLeft: pillRect.left,
      greetingTop: greetingRect.top,
      greetingLeft: greetingRect.left,
      selected: style(selectedBtn),
      unselected: style(unselectedBtn),
    };
  }, wide);
}

/**
 * Measures the app's own Home umbrella — `/me` (guest) or `/dashboard`
 * (couple, T369): both render `app-home-subnav` and `.greeting .hello`
 * from the same shared markup (`dashboard.html`'s `#plan` template is
 * reused by `invitee.html`'s guest render, per each screen's own class
 * doc), so one measurer covers both roles.
 *
 * `contentTop` is the ONE element that embodies "cleared the fixed
 * header" at each breakpoint by construction (hub ADR-0043 §1, T367):
 * `.body` at ≥900px, `main` below it. Deliberately NOT the real
 * `.header header` element itself: that clearance is calibrated as one
 * shared constant covering both roles' real (slightly different) header
 * heights — comparing against the header's own real height would fail this
 * guard on an unrelated, already-accepted few-pixel slack that has nothing
 * to do with this row's own spacing.
 */
export async function measureAppHomeSubnav(page: Page, wide: boolean): Promise<HomeSubnavMetrics> {
  return page.evaluate((wide) => {
    const contentTopEl = document.querySelector(wide ? '.body' : 'main') as HTMLElement | null;
    const selectedBtn = document.querySelector('app-home-subnav .pill.on') as HTMLElement | null;
    const unselectedBtn = document.querySelector(
      'app-home-subnav .pill:not(.on)',
    ) as HTMLElement | null;
    const greetingLine = document.querySelector('.greeting .hello') as HTMLElement | null;
    if (!contentTopEl || !selectedBtn || !unselectedBtn || !greetingLine) {
      throw new Error('App: Home subnav elements not found');
    }

    const style = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      return {
        background: cs.backgroundColor,
        borderColor: cs.borderColor,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        padding: cs.padding,
      };
    };

    const pillRect = selectedBtn.getBoundingClientRect();
    const greetingRect = greetingLine.getBoundingClientRect();

    return {
      contentTop: contentTopEl.getBoundingClientRect().top,
      pillTop: pillRect.top,
      pillBottom: pillRect.bottom,
      pillLeft: pillRect.left,
      greetingTop: greetingRect.top,
      greetingLeft: greetingRect.left,
      selected: style(selectedBtn),
      unselected: style(unselectedBtn),
    };
  }, wide);
}

/**
 * Full Home-subnav parity assertion (alignment, vertical rhythm, pill
 * colors/type) shared by the guest (`design-parity-home.spec.ts`) and
 * couple (`design-parity-dashboard.spec.ts`, T369) renders — both measured
 * via {@link measureKitHomeSubnav}/{@link measureAppHomeSubnav} above.
 */
export async function assertHomeSubnavParity(
  kitPage: Page,
  appPage: Page,
  wide: boolean,
  breakpoint: 'desktop' | 'mobile',
): Promise<void> {
  const kit = await measureKitHomeSubnav(kitPage, wide);
  const app = await measureAppHomeSubnav(appPage, wide);

  // 1. Alignment — the row must be flush with the greeting below it, in
  // BOTH renderings independently (the two pages have different frame/
  // viewport widths, so their absolute `left` coordinates are not
  // comparable to each other — only each page's own internal delta is).
  expectClose(kit.pillLeft - kit.greetingLeft, 0, 1, `${breakpoint} kit: pill row not flush with greeting`);
  expectClose(app.pillLeft - app.greetingLeft, 0, 1, `${breakpoint} app: pill row not flush with greeting`);

  // 2. Vertical rhythm — header -> gap -> row -> gap -> greeting. These
  // ARE comparable in absolute px across the two pages: both are built
  // from the same DS token values, so the app must match the kit's own
  // measured gap, not a number hand-copied into this spec.
  const kitHeaderGap = kit.pillTop - kit.contentTop;
  const appHeaderGap = app.pillTop - app.contentTop;
  expectClose(appHeaderGap, kitHeaderGap, 1, `${breakpoint}: header-to-pill-row gap`);

  const kitGreetingGap = kit.greetingTop - kit.pillBottom;
  const appGreetingGap = app.greetingTop - app.pillBottom;
  expectClose(appGreetingGap, kitGreetingGap, 1, `${breakpoint}: pill-row-to-greeting gap`);

  // 3. Pill colors/type — exact computed-style equality, not a tolerance.
  expect(app.unselected.background, `${breakpoint}: unselected pill background`).toBe(
    kit.unselected.background,
  );
  expect(app.unselected.borderColor, `${breakpoint}: unselected pill border`).toBe(
    kit.unselected.borderColor,
  );
  expect(app.unselected.fontWeight, `${breakpoint}: unselected pill font-weight`).toBe(
    kit.unselected.fontWeight,
  );
  expect(app.selected.background, `${breakpoint}: selected pill background`).toBe(kit.selected.background);
  expect(app.selected.borderColor, `${breakpoint}: selected pill border`).toBe(kit.selected.borderColor);
  expect(app.selected.fontWeight, `${breakpoint}: selected pill font-weight`).toBe(kit.selected.fontWeight);
  expect(app.unselected.fontSize, `${breakpoint}: unselected pill font-size`).toBe(kit.unselected.fontSize);
  expect(app.selected.fontSize, `${breakpoint}: selected pill font-size`).toBe(kit.selected.fontSize);

  // Padding: exact parity at desktop, where the DS and the app both render
  // the shared `pill-interactive` recipe's `6px 14px`. At mobile the DS
  // shrinks to `5px 11px` (`AppShell.jsx`'s non-wide branch) — neither
  // number sits on the app's spacing token grid, and the app's own
  // `config-manager` mobile pill row already renders the shared recipe's
  // padding uniformly rather than chasing it (`home-subnav.scss`'s own
  // banner comment) — so this is a documented, flagged deviation, not
  // asserted equal here; the app's own value is still checked against
  // what it is meant to be.
  if (wide) {
    expect(app.selected.padding, `${breakpoint}: selected pill padding`).toBe(kit.selected.padding);
    expect(app.unselected.padding, `${breakpoint}: unselected pill padding`).toBe(kit.unselected.padding);
  } else {
    expect(
      app.selected.padding,
      'mobile app pill padding: flagged DS gap (AppShell.jsx 5px 11px has no token) — app intentionally keeps the shared recipe default',
    ).toBe('6px 14px');
  }
}

/**
 * The DS kit's own centered content column (`AppShell.jsx` L76's
 * `maxWidth`/`margin: 0 auto` wrapper) — present only on the desktop,
 * non-`fullBleed` branch; `null` on `fullBleed` screens (Guests/
 * Milestones/Settings, hub ADR-0045 §3 — Manage's own rail replaces the
 * centered column) and on mobile (no equivalent wrapper there, `AppShell.jsx`
 * L88-93 flows children directly). Structural, not a fixed selector: the
 * wrapper carries no class or id in the DS source, so it is found the same
 * way `design-parity-home.spec.ts` finds `AppHeader` — by its known position
 * in `[data-overlay-host]`'s own children.
 */
export async function kitContentColumnBox(kitPage: Page): Promise<Box | null> {
  return kitPage.evaluate(() => {
    const host = document.querySelector('[data-overlay-host]');
    if (!host) return null;
    const bodyRow = host.children[1] as HTMLElement | undefined; // header is children[0]
    const body = bodyRow?.lastElementChild as HTMLElement | null; // {rail}{body}, rail optional
    const col = body?.firstElementChild as HTMLElement | null;
    if (!col) return null;
    if (getComputedStyle(col).maxWidth === 'none') return null; // fullBleed: no column wrapper
    const r = col.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  });
}
