import { Injectable, TemplateRef, signal, type Signal } from '@angular/core';

/**
 * Signals-based home for a screen's pinned "head" and "foot" regions (hub
 * ADR-0042 §2, `wedding-web` T341). A screen declares a pinned template with
 * `*appScreenHead` / `*appScreenFoot` (`core/directive/`); `PrivateLayout`
 * renders whichever templates are registered, in its own view, via
 * `NgTemplateOutlet`. This is the CDK Portal shape: the `TemplateRef`
 * executes in the screen's injector while it lives in the layout's
 * change-detection tree. Proven to hold zoneless — no `ChangeDetectorRef`,
 * no `markForCheck()`, anywhere in this file or the two directives — by the
 * T341 prototype gate (ADR-0042 §Gate outcome); `screen-chrome-prototype.spec
 * .ts` is that evidence and is not re-run here.
 *
 * **Also carries the "control" half of scroll ownership** (`wedding-web`
 * T348, ADR-0042 §Consequences): {@link scrollResetRequest} /
 * {@link requestScrollReset}, below. A screen that gives up its scroller
 * loses the ability to zero its own `scrollTop`; the layout owns the
 * scroller, so a screen asking it to be scrolled back to the top is the same
 * shape as a screen handing over a head/foot template — a request the layout
 * carries out, not a DOM node the screen reaches into.
 *
 * **No NgRx slice** (ADR-0042 §3). The state carried here — which
 * `TemplateRef`, if any, the active route registered — is known only at
 * runtime, per navigation, and is not the kind of shared/async/time-travel
 * state a store exists for. A store write also lands a frame after the
 * screen activates, which is exactly the render-then-reflow ADR-0042 rejects.
 *
 * **Registration and teardown are co-located** in `AppScreenHead` /
 * `AppScreenFoot`, never split across two files or two commits — the
 * substantive claim of ADR-0042 §2, and the reason this is a service with
 * narrow register/clear methods per slot instead of a public writable
 * signal. Each `clear*` method is guarded: Angular constructs the incoming
 * route's component tree (and so its own `*appScreenHead`/`*appScreenFoot`,
 * if it has one) *before* destroying the outgoing route's component tree.
 * Without the guard, the outgoing screen's `DestroyRef.onDestroy` would run
 * after the incoming screen has already registered, and an unconditional
 * `clear()` would wipe the incoming screen's registration — see
 * `screen-chrome-prototype.spec.ts` (c) for the head case and
 * `screen-chrome.spec.ts` for the foot case, same reproduction.
 */
@Injectable({ providedIn: 'root' })
export class ScreenChromeService {
  private readonly _head = signal<TemplateRef<unknown> | undefined>(undefined);
  private readonly _foot = signal<TemplateRef<unknown> | undefined>(undefined);

  /** The active route's pinned head template, or `undefined` when the
   *  active route registers none. */
  readonly head: Signal<TemplateRef<unknown> | undefined> = this._head.asReadonly();

  /** The active route's pinned foot template, or `undefined` when the
   *  active route registers none. */
  readonly foot: Signal<TemplateRef<unknown> | undefined> = this._foot.asReadonly();

  /**
   * Called from `AppScreenHead`'s constructor. Unconditional: the incoming
   * screen's registration always wins, because it always runs before the
   * outgoing screen's teardown (see the guard in {@link clearHead}).
   */
  registerHead(template: TemplateRef<unknown>): void {
    this._head.set(template);
  }

  /**
   * Called from `AppScreenHead`'s `DestroyRef.onDestroy`. Clears the slot
   * only if `template` is still the one currently registered — i.e. only if
   * no other screen registered a replacement in between. This is the guard
   * ADR-0042 §2 requires: without it, navigating screen A -> screen B (both
   * registering a head) would let B's `constructor()` register first, then
   * A's teardown clear what B just set, leaving the slot blank until the
   * next unrelated signal write happened to re-run the layout's view.
   */
  clearHead(template: TemplateRef<unknown>): void {
    if (this._head() === template) {
      this._head.set(undefined);
    }
  }

  /** Called from `AppScreenFoot`'s constructor. Same unconditional-write
   *  reasoning as {@link registerHead}. */
  registerFoot(template: TemplateRef<unknown>): void {
    this._foot.set(template);
  }

  /** Called from `AppScreenFoot`'s `DestroyRef.onDestroy`. Same guard as
   *  {@link clearHead}, on the independent `_foot` slot. */
  clearFoot(template: TemplateRef<unknown>): void {
    if (this._foot() === template) {
      this._foot.set(undefined);
    }
  }

  /**
   * The "control" half of hub ADR-0042 §Consequences / `wedding-web` T348: a
   * screen that hands its scroller to the layout can no longer set its own
   * `scrollTop`, so asking to be scrolled back to the top has to be a request
   * the layout carries out. A bare counter, not a boolean or a `TemplateRef`
   * — the layout only needs to notice a *new* request, and a signal write to
   * the same value (`true`, or a repeated flag) is not guaranteed to
   * re-trigger anything downstream, whereas every call to
   * {@link requestScrollReset} strictly increments this.
   */
  private readonly _scrollResetRequest = signal(0);

  /** Bumped once per {@link requestScrollReset} call. `PrivateLayout` reads
   *  this and scrolls whichever element currently owns scrolling — `main`
   *  for a flow screen, `.screen-scroll` for a pinned one — back to the top;
   *  see its own class doc for which. */
  readonly scrollResetRequest: Signal<number> = this._scrollResetRequest.asReadonly();

  /**
   * Called by a screen (e.g. `GuestManager.resetWindow`) after a filter,
   * search or sort change replaces the row set out from under the reader —
   * the same "jump back to the top" gesture the screen used to perform
   * itself by zeroing its own scroll container's `scrollTop` before it gave
   * that container to the layout (ADR-0042 §2).
   */
  requestScrollReset(): void {
    this._scrollResetRequest.update((n) => n + 1);
  }
}
