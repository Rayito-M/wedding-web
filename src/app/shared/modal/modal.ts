import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  output,
  viewChild,
} from '@angular/core';

let nextModalId = 0;

/** What the trap counts as reachable inside the card. Disabled controls and
 *  `tabindex="-1"` sinks (including the card itself) are excluded — the trap
 *  wraps between the first and last element a real Tab press could land on. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Shared modal dialog. Presentational only: the parent owns `open` and reacts
 * to `(close)`. Body content is projected; optional footer actions project into
 * the `[modal-actions]` slot.
 *
 * T359: this component now honours the `aria-modal="true"` it declares —
 * Escape closes it (gated on `dismissable`, like the backdrop), focus moves
 * onto the card when it opens and is restored on close, and Tab is trapped
 * inside the card. All four behaviours are deliberately deferential so the
 * consumers that predate them and roll their own (`app-confirm-dialog`,
 * `app-notification-dialog` — both with specs) keep winning:
 * - the Escape handler lives on the backdrop *element*, not `window`, and
 *   calls `stopPropagation()` — the same Phase M decision 5 scoping those
 *   consumers use, so their own host-level `(keydown.escape)` (an ancestor in
 *   the bubble path) never double-fires and document-level listeners
 *   (`notification-bell`, `tab-bar`) stay unaware, exactly as today;
 * - focus-on-open skips when focus is already inside the card (a consumer's
 *   own `afterRenderEffect` focused its preferred button first), and restore
 *   only fires when focus actually fell to `body` — never when the consumer
 *   or host has already placed it somewhere deliberate (`ConfirmDialog`'s
 *   restore-on-cancel-only contract, Phase M decision 8);
 * - the trap ignores any Tab keydown a projected handler already
 *   `preventDefault()`ed, so a consumer's own wrap logic runs unopposed.
 */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
})
export class Modal {
  readonly open = input(false);
  readonly title = input<string>();
  /** Whether clicking the backdrop / close button / pressing Escape dismisses
   *  the dialog. */
  readonly dismissable = input(true);
  /**
   * `sm` (default) — compact ~360px confirm dialog, unchanged legacy behaviour.
   * `lg` — ~520px dialog with a bordered header/scrollable body/bordered footer;
   * becomes a full-width bottom sheet with a drag handle on mobile.
   * `xl` — same layout as `lg` but ~580px wide (DS `ScreenGuestManager` guest
   * profile overlay, which is wider than the `lg` dialogs elsewhere).
   */
  readonly size = input<'sm' | 'lg' | 'xl'>('sm');
  /** Whether the × close button renders — only meaningful alongside
   *  `dismissable`. `app-confirm-dialog` sets this `false` so the backdrop,
   *  Escape and its own cancel button stay the only ways out (its DS spec:
   *  "never dim or hide" cancel, and no × at all). */
  readonly showClose = input(true);
  // reason: named `close` to match this repo's `NotificationDialog`/
  // `ProfileModal` precedent for a custom element with no native `close`
  // event to shadow — both cite this very output as the precedent.
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly close = output<void>();

  /** Stable per-instance id, wired to `[attr.aria-labelledby]` on the
   *  `role="dialog"` element in the template so the dialog gets an
   *  accessible name whenever `title` is set. Module-level counter so two
   *  modals open at once (e.g. a nested `app-confirm-dialog`) never collide. */
  protected readonly titleId = `modal-title-${nextModalId++}`;

  private readonly cardRef = viewChild<ElementRef<HTMLElement>>('card');

  /** Element focus is returned to on close — captured only when this
   *  component (not a consumer) performed the focus-on-open. */
  private restoreFocusTo: HTMLElement | null = null;

  /** Previous `open()` value, so the effect below acts on edges only — a
   *  re-render while open must never yank focus back to the card. Same plain
   *  instance-state edge-detection as `profile-modal.ts`'s `wasSaving`. */
  private wasOpen = false;

  constructor() {
    // `afterRenderEffect`, not `effect()`: the card lives in this component's
    // own `@if`-gated template, and consumers' focus effects have the same
    // shape for the same reason (`confirm-dialog.ts`'s constructor comment).
    afterRenderEffect(() => {
      const open = this.open();
      const card = this.cardRef()?.nativeElement;
      if (open && !this.wasOpen && card) {
        // A consumer that focuses its own preferred element on open
        // (`ConfirmDialog`'s confirm button, `NotificationDialog`'s Close)
        // registered its effect first (parent before child) — if focus is
        // already inside the card, this instance owns neither focus nor its
        // restoration.
        if (!card.contains(document.activeElement)) {
          this.restoreFocusTo = document.activeElement as HTMLElement | null;
          card.focus();
        }
      } else if (!open && this.wasOpen) {
        // Restore only when focus was actually orphaned by the card's
        // teardown (it falls to `body`). If a consumer or host already moved
        // it — `ConfirmDialog` restoring to its trigger on cancel, a host
        // placing it after a confirm — leave it alone.
        if (this.restoreFocusTo && document.activeElement === document.body) {
          this.restoreFocusTo.focus();
        }
        this.restoreFocusTo = null;
      }
      this.wasOpen = open;
    });
  }

  protected onBackdrop(): void {
    if (this.dismissable()) this.close.emit();
  }

  /** Bound on the backdrop element, so it hears every key pressed while focus
   *  is anywhere inside the dialog — and nothing when focus is outside it
   *  (deliberate: focus-on-open guarantees it is inside). Scoped this way,
   *  not on `window`, per Phase M decision 5. */
  protected onEscape(event: Event): void {
    if (!this.dismissable()) return;
    // Stop here so an ancestor consumer's own host-level Escape handler
    // (`ConfirmDialog`, `NotificationDialog`, `ProfileModal`) doesn't emit a
    // second close/cancel for the same keypress, and so document-level
    // listeners (`notification-bell`, `tab-bar`) stay unreached — the same
    // containment those consumers' own handlers enforce today.
    event.stopPropagation();
    this.close.emit();
  }

  /** Focus trap. Wraps Tab at the card's edges; every mid-card Tab is left to
   *  the browser. A keydown a projected element's own handler already
   *  `preventDefault()`ed (e.g. `ConfirmDialog`'s two-button wrap) is
   *  respected as handled. */
  protected onCardKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || event.defaultPrevented) return;
    const card = this.cardRef()?.nativeElement;
    if (!card) return;
    const focusables = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusables.length === 0) {
      // Nothing tabbable inside: keep focus on the card rather than letting
      // Tab walk out behind the dialog.
      event.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === card)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
