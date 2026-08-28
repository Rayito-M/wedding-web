import { Injectable, signal, type Signal } from '@angular/core';

import type { IconName } from '@app/shared/icons/icon';
import type { ToastPlacement } from '@app/shared/toast-stack/toast-stack';

/**
 * The tone literal `app-toast`'s `tone` input accepts (`toast.ts`). Mirrored
 * here rather than imported because neither `toast.ts` nor the DS's
 * `Toast.d.ts` exports a standalone alias for it — this is a UI-only union
 * with no API counterpart, so hard rule 15 does not apply (same reasoning
 * `ToastPlacement` already documents in `toast-stack.ts`). Keep this in sync
 * if `toast.ts`'s `tone = input<...>()` literal ever changes.
 */
export type ToastTone = 'neutral' | 'accent' | 'provisional' | 'danger';
/** Mirrors `app-toast`'s `variant` input literal — see {@link ToastTone}. */
export type ToastVariant = 'surface' | 'filled';

/**
 * What a caller passes to {@link ToastCenterService.show}. The body is a
 * plain string on purpose: `app-toast`'s projected-content flexibility
 * (`<ng-content>`, a `ProgressBar`, a thumbnail row, …) stays available to
 * anyone rendering `<app-toast>` directly, but this convenience path does
 * not marshal templates.
 */
export interface ShowToastOptions {
  tone?: ToastTone;
  variant?: ToastVariant;
  icon?: IconName;
  title?: string;
  meta?: string;
  body?: string;
  actionLabel?: string;
  /**
   * Auto-hide after N ms. Ignored (forced to `undefined`) whenever the
   * resolved toast carries `actionLabel` or `tone: 'danger'` — see the class
   * doc comment. Omit to let the service pick a default from the DS's
   * timing band for anything else.
   */
  delay?: number;
  dismissible?: boolean;
}

/** One entry in the live stack — {@link ShowToastOptions} resolved to
 *  concrete values, plus the service-generated `id` `app-toast` binds
 *  `(close)`/`(action)` against. */
export interface ToastEntry {
  id: string;
  tone: ToastTone;
  variant: ToastVariant;
  icon?: IconName;
  title?: string;
  meta?: string;
  body?: string;
  actionLabel?: string;
  delay?: number;
  dismissible: boolean;
}

/** `Toast.prompt.md` §Stacking: pushing a fourth toast drops the oldest, the
 *  column never grows past this. */
const MAX_TOASTS = 3;

/**
 * `Toast.prompt.md` §Timing: "delay 4000–6000 for a one-line toast." The
 * mid-point, used whenever a `show()` call that is allowed a delay at all
 * omits one.
 */
const DEFAULT_DELAY_MS = 5000;

/**
 * The one stack this app mounts (`PrivateLayout`, `bottom-center`,
 * `clearsTabBar` — see `private-layout.html`). {@link ToastCenterService}
 * reads its ordering rule from this single named constant rather than
 * guessing per call, per T285's acceptance criteria. If a second stack at a
 * different placement is ever added, ordering becomes a per-stack concern —
 * out of scope today ("exactly one stack" is the whole point of this task).
 */
const STACK_PLACEMENT: ToastPlacement = 'bottom-center';

/**
 * Signals-based, in-memory home for the app's one toast stack
 * (`ToastStack.prompt.md`: "One stack per screen — mount it in the app
 * shell, not per route, so a toast survives navigation."). Producers call
 * {@link show}; `PrivateLayout` renders {@link toasts} through
 * `<app-toast-stack>`/`<app-toast>` and calls {@link dismiss} on `(close)`.
 *
 * **Ships inert.** Nothing calls {@link show} yet — T289 is the first real
 * producer (Phase O). No polling, no global error hook, no interceptor
 * wiring: this service does not subscribe to anything on its own.
 *
 * **The two timing rules `app-toast` deliberately does not enforce
 * (`toast.ts`'s doc comment) live here instead:**
 * - a toast carrying `actionLabel`, or with `tone: 'danger'`, never gets a
 *   `delay` — regardless of what the caller passed — because the user must
 *   be able to reach it (`Toast.prompt.md` §Timing);
 * - everything else defaults into the DS's 4000–6000ms band
 *   ({@link DEFAULT_DELAY_MS}) when the caller omits `delay`;
 * - `dismissible` stays `true` whenever no `delay` ends up set on the
 *   entry — a toast that neither auto-hides nor can be dismissed is a trap
 *   (`Toast.d.ts`: "Default true. Set false only when delay is set").
 */
@Injectable({ providedIn: 'root' })
export class ToastCenterService {
  private readonly _toasts = signal<ToastEntry[]>([]);
  /** The live stack, already ordered for {@link STACK_PLACEMENT}. */
  readonly toasts: Signal<ToastEntry[]> = this._toasts.asReadonly();

  private idCounter = 0;

  /** Enqueue a toast. Returns the service-generated id — callers never
   *  supply one — which is also what {@link dismiss} expects back. */
  show(options: ShowToastOptions): string {
    const id = `toast-${++this.idCounter}`;
    const tone = options.tone ?? 'neutral';
    const variant = options.variant ?? 'surface';

    const mustStayVisible = tone === 'danger' || !!options.actionLabel;
    const delay = mustStayVisible ? undefined : (options.delay ?? DEFAULT_DELAY_MS);
    const dismissible = delay === undefined ? true : (options.dismissible ?? true);

    const entry: ToastEntry = {
      id,
      tone,
      variant,
      icon: options.icon,
      title: options.title,
      meta: options.meta,
      body: options.body,
      actionLabel: options.actionLabel,
      delay,
      dismissible,
    };

    this._toasts.update((list) => {
      const insertedFirst = STACK_PLACEMENT.startsWith('top');
      const next = insertedFirst ? [entry, ...list] : [...list, entry];
      if (next.length <= MAX_TOASTS) return next;
      // Cap at three: drop the oldest, wherever it now sits — the tail for a
      // "newest first" top stack, the head for a "newest last" bottom one.
      return insertedFirst ? next.slice(0, MAX_TOASTS) : next.slice(next.length - MAX_TOASTS);
    });

    return id;
  }

  /** Remove one toast by id — a no-op if it is already gone (already
   *  dismissed, or dropped by the three-toast cap). */
  dismiss(id: string): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
