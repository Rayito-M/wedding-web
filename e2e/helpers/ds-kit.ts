import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import type { Page } from '@playwright/test';

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
  await kitPage.goto(`${baseUrl}/ui_kits/wedding-app/index.html`);
  await kitPage.locator('.controls').getByRole('button', { name: opts.device, exact: true }).click();
  await kitPage.locator('.controls').getByRole('button', { name: opts.role, exact: true }).click();
  await kitPage.locator('.viewsel').getByRole('button', { name: opts.viewLabel, exact: true }).click();
  // Babel-standalone compiles every `type="text/babel"` script in-browser on
  // first paint; wait for the rendered screen itself rather than a fixed
  // delay.
  await kitPage.locator('[data-overlay-host]').waitFor();
}
