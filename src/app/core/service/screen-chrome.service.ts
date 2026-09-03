import { Injectable, TemplateRef, signal, type Signal } from '@angular/core';

/**
 * Prototype gate (hub ADR-0042 §2, `wedding-web` T341) — signals-based home
 * for a screen's pinned "head" region. A screen declares its head template
 * with `*appScreenHead` (`core/directive/screen-head.directive.ts`);
 * `private-layout` renders it in its own view via `NgTemplateOutlet`. This is
 * the CDK Portal shape: the `TemplateRef` executes in the screen's injector
 * while it lives in the layout's change-detection tree — the thing this
 * spike exists to prove holds zoneless (ADR-0042 §Consequences, Negative).
 *
 * **No NgRx slice** (ADR-0042 §3). The state carried here — which
 * `TemplateRef`, if any, the active route registered — is known only at
 * runtime, per navigation, and is not the kind of shared/async/time-travel
 * state a store exists for. A store write also lands a frame after the
 * screen activates, which is exactly the render-then-reflow ADR-0042 rejects.
 *
 * **Registration and teardown are co-located** in `AppScreenHead`, never
 * split across two files or two commits — the substantive claim of
 * ADR-0042 §2, and the reason this is a service with two narrow methods
 * instead of a public writable signal. {@link clearHead} is guarded: Angular
 * constructs the incoming route's component tree (and so its own
 * `*appScreenHead`, if it has one) *before* destroying the outgoing route's
 * component tree. Without the guard, the outgoing screen's
 * `DestroyRef.onDestroy` would run after the incoming screen has already
 * registered, and an unconditional `clear()` would wipe the incoming
 * screen's registration — see `screen-chrome-prototype.spec.ts` (c) for the
 * reproduction.
 */
@Injectable({ providedIn: 'root' })
export class ScreenChromeService {
  private readonly _head = signal<TemplateRef<unknown> | undefined>(undefined);

  /** The active route's pinned head template, or `undefined` when the
   *  active route registers none. */
  readonly head: Signal<TemplateRef<unknown> | undefined> = this._head.asReadonly();

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
}
