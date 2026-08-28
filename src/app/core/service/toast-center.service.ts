import { computed, Injectable, signal, type Signal } from '@angular/core';

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
   * Auto-hide after N ms, or `undefined` for "stays until dismissed".
   *
   * **An explicit value always wins**, including on a `tone: 'danger'` or
   * `actionLabel` toast — the DS's "a failure or an action toast never
   * auto-hides" rule (`Toast.prompt.md` §Timing) is the *default* this
   * service applies when a caller says nothing, not a veto over one that
   * asked. Omit to get that default: no auto-hide for danger/action toasts,
   * {@link DEFAULT_DELAY_MS} for everything else. Passing a delay on a
   * failure toast is a deliberate call — the user loses the guarantee that
   * the message is still there when they look back at the screen.
   */
  delay?: number;
  dismissible?: boolean;
  /**
   * Which of the nine corners/edges of the app frame this toast appears at
   * (`top|middle|bottom` × `start|center|end`). Omit for
   * {@link DEFAULT_PLACEMENT}.
   *
   * Each placement is its own independent column: ordering
   * ({@link ToastCenterService.stacks}) and the three-toast cap are applied
   * per placement, never across the screen. `Toast.prompt.md` §Placement is
   * the convention — `top-center` for news that arrives on its own,
   * `bottom-center` for confirmation of something the user just did,
   * `bottom-end` on desktop, and `middle-center` reserved for a single
   * blocking-feeling failure.
   */
  placement?: ToastPlacement;
}

/** One entry in a live stack — {@link ShowToastOptions} resolved to
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
  placement: ToastPlacement;
}

/** One `app-toast-stack` worth of toasts: the placement to mount it at, and
 *  that column's entries already ordered for it. Only placements that
 *  currently hold at least one toast appear in
 *  {@link ToastCenterService.stacks}. */
export interface ToastStackGroup {
  placement: ToastPlacement;
  toasts: ToastEntry[];
}

/** `Toast.prompt.md` §Stacking: pushing a fourth toast drops the oldest, the
 *  column never grows past this. Applied **per placement** — the cap is a
 *  statement about one column's height, and two columns at opposite corners
 *  do not crowd each other. */
const MAX_TOASTS_PER_PLACEMENT = 3;

/**
 * `Toast.prompt.md` §Timing: "delay 4000–6000 for a one-line toast." The
 * mid-point, used whenever a `show()` call that is allowed a delay at all
 * omits one.
 */
const DEFAULT_DELAY_MS = 5000;

/**
 * Where a `show()` call that names no {@link ShowToastOptions.placement}
 * lands. `bottom-center` because the overwhelming majority of this app's
 * toasts confirm something the user just did (`Toast.prompt.md`
 * §Placement), and it is the placement the app shipped with before toasts
 * became placeable.
 */
const DEFAULT_PLACEMENT: ToastPlacement = 'bottom-center';

/**
 * The nine placements in a fixed order, so {@link ToastCenterService.stacks}
 * emits its groups deterministically (a `@for` over them keeps stable DOM
 * order regardless of which column was filled first).
 */
const PLACEMENT_ORDER: readonly ToastPlacement[] = [
  'top-start',
  'top-center',
  'top-end',
  'middle-start',
  'middle-center',
  'middle-end',
  'bottom-start',
  'bottom-center',
  'bottom-end',
];

/**
 * Signals-based, in-memory home for the app's toast stacks
 * (`ToastStack.prompt.md`: "One stack per screen — mount it in the app
 * shell, not per route, so a toast survives navigation."). Producers call
 * {@link show}; `PrivateLayout` renders {@link stacks} as one
 * `<app-toast-stack>` per occupied placement and calls {@link dismiss} on
 * `(close)`.
 *
 * **Placement is per toast, not per app.** A caller names one of the nine
 * placements (or takes {@link DEFAULT_PLACEMENT}); this service keeps every
 * live toast in one insertion-ordered list and slices it into columns on
 * read. Two consequences a caller can rely on:
 * - **ordering is per column** — newest nearest the edge the column hugs, so
 *   newest *first* for `top-*` and newest *last* everywhere else
 *   (`Toast.prompt.md` §Stacking states the rule for `top-*`/`bottom-*`;
 *   the rarely-used `middle-*` follows the non-top case);
 * - **the three-toast cap is per column** — a fourth toast at one placement
 *   drops the oldest *at that placement* and leaves the other columns alone.
 *
 * **The timing rules `app-toast` deliberately does not enforce (`toast.ts`'s
 * doc comment) live here instead — as defaults for a caller that passes no
 * `delay`, never as a veto over one that does:**
 * - a toast carrying `actionLabel`, or with `tone: 'danger'`, gets no
 *   `delay` unless the caller asked for one, because by default the user
 *   must be able to reach it (`Toast.prompt.md` §Timing);
 * - everything else defaults into the DS's 4000–6000ms band
 *   ({@link DEFAULT_DELAY_MS}) when the caller omits `delay`;
 * - `dismissible` stays `true` whenever no `delay` ends up set on the
 *   entry — a toast that neither auto-hides nor can be dismissed is a trap
 *   (`Toast.d.ts`: "Default true. Set false only when delay is set").
 */
@Injectable({ providedIn: 'root' })
export class ToastCenterService {
  private readonly _toasts = signal<ToastEntry[]>([]);
  /** Every live toast, across all placements, in insertion order (oldest
   *  first). Rendering goes through {@link stacks}, which is this list cut
   *  into per-placement columns and ordered for each. */
  readonly toasts: Signal<ToastEntry[]> = this._toasts.asReadonly();

  /** {@link toasts} grouped into the columns to render, one per placement
   *  that currently holds at least one toast, in {@link PLACEMENT_ORDER}. */
  readonly stacks: Signal<ToastStackGroup[]> = computed(() => {
    const live = this._toasts();
    const groups: ToastStackGroup[] = [];
    for (const placement of PLACEMENT_ORDER) {
      const column = live.filter((t) => t.placement === placement);
      if (column.length === 0) continue;
      // Newest nearest the edge the column hugs: reversed for a top stack,
      // insertion order (newest last) for middle and bottom ones.
      groups.push({ placement, toasts: isTop(placement) ? [...column].reverse() : column });
    }
    return groups;
  });

  private idCounter = 0;

  /** Enqueue a toast. Returns the service-generated id — callers never
   *  supply one — which is also what {@link dismiss} expects back. */
  show(options: ShowToastOptions): string {
    const id = `toast-${++this.idCounter}`;
    const tone = options.tone ?? 'neutral';
    const variant = options.variant ?? 'surface';
    const placement = options.placement ?? DEFAULT_PLACEMENT;

    // An explicit `delay` wins; the danger/action rule only decides what
    // "omitted" means (see {@link ShowToastOptions.delay}).
    const staysUntilDismissedByDefault = tone === 'danger' || !!options.actionLabel;
    const delay = options.delay ?? (staysUntilDismissedByDefault ? undefined : DEFAULT_DELAY_MS);
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
      placement,
    };

    this._toasts.update((list) => {
      const next = [...list, entry];
      const column = next.filter((t) => t.placement === placement);
      if (column.length <= MAX_TOASTS_PER_PLACEMENT) return next;
      // Cap this column at three by dropping its oldest entries only; the
      // other placements keep everything they hold.
      const dropped = new Set(column.slice(0, column.length - MAX_TOASTS_PER_PLACEMENT));
      return next.filter((t) => !dropped.has(t));
    });

    return id;
  }

  /** Remove one toast by id — a no-op if it is already gone (already
   *  dismissed, or dropped by its column's three-toast cap). */
  dismiss(id: string): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}

/** `top-start | top-center | top-end` — the one axis slice that reverses a
 *  column's order (`Toast.prompt.md` §Stacking). Mirrors the
 *  `[data-placement^='top']` selector `toast-stack.scss` positions with. */
function isTop(placement: ToastPlacement): boolean {
  return placement.startsWith('top');
}
