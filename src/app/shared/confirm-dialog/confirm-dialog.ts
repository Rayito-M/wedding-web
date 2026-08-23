import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  output,
  viewChild,
} from '@angular/core';

import { Btn } from '@app/shared/button/button';
import { Modal } from '@app/shared/modal/modal';

let nextMessageId = 0;

/**
 * Shared blocking confirmation dialog (DS `components/overlays/ConfirmDialog`,
 * commit `ccea99a`). Thin composition of `app-modal` + two `app-btn`s — see
 * TASKS.md Phase M decision 2 for why this owns no backdrop/panel of its own.
 * The host owns `open`; this component wires nothing to any call site yet
 * (T277) — that is T278's job.
 *
 * All three dismissal paths — Escape, a scrim/backdrop click and the cancel
 * button — emit `cancel` only, never discriminating "how did it close" (DS
 * prompt: "the host must treat it as a real dismissal").
 */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
  imports: [Modal, Btn],
  host: {
    // Scoped to this component's own host, not `window` (unlike the DS
    // reference): it only fires while focus is inside the dialog — which
    // the focus-on-open effect below guarantees — and stopPropagation keeps
    // it from also reaching an ancestor `app-modal` or a screen-level
    // `(keydown.escape)` binding when this dialog is nested inside one
    // (Phase M decision 5/6). `app-modal` itself is not taught Escape.
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class ConfirmDialog {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly message = input<string>('');
  readonly confirmLabel = input.required<string>();
  readonly cancelLabel = input.required<string>();
  /** 'accent' (default) is for benign confirmations; 'danger' fills the
   *  confirm button with `--danger`/`--on-danger`. Opt-in — do not flip the
   *  default (matches `ConfirmDialog.d.ts`, Phase M decision 4). */
  readonly tone = input<'accent' | 'danger'>('accent');

  readonly confirm = output<void>();
  /** Fired by Escape, a backdrop click and the cancel button alike. */
  // reason: named `cancel` to match the DS contract (`ConfirmDialog.d.ts`)
  // name for name, per T277. `no-output-native` guards against shadowing a
  // native DOM event, and `app-confirm-dialog` is a custom element with no
  // native `cancel` to shadow — the same situation as `Modal`'s `close`.
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly cancel = output<void>();

  /** Stable per-instance id for the message paragraph. `app-modal` owns the
   *  `role="dialog"` element, so the description can't attach there without
   *  a third new input on `Modal`; wiring it to both buttons'
   *  `aria-describedby` instead guarantees a keyboard/SR user hears the
   *  consequence regardless of which of the two focusable elements they're
   *  on. Do not "simplify" this onto the dialog element. */
  protected readonly messageId = `confirm-dialog-message-${nextMessageId++}`;

  private readonly confirmBtnRef = viewChild<unknown, ElementRef<HTMLButtonElement>>('confirmBtn', {
    read: ElementRef,
  });
  private readonly cancelBtnRef = viewChild<unknown, ElementRef<HTMLButtonElement>>('cancelBtn', {
    read: ElementRef,
  });

  /** Captured on open, restored on cancel only — never on confirm, whose
   *  trigger the confirmed action usually destroys (Phase M decision 8);
   *  the host decides where focus goes after a confirm. */
  private restoreFocusTo: HTMLElement | null = null;

  /** Set for the duration of a held-Enter auto-repeat that landed on the
   *  freshly-focused confirm button; cleared on the matching `keyup`. See
   *  `onConfirmKeydown` for the hazard this guards against. */
  private suppressNextConfirmClick = false;

  constructor() {
    // Focus the confirm button on mount, per the DS prompt ("The confirm
    // button takes focus on mount") and `ConfirmDialog.jsx:10`. A
    // `viewChild` + a render effect rather than a lifecycle hook +
    // `setTimeout`. `afterRenderEffect` (not the plain `effect()`) because
    // this reads/writes the DOM: the confirm button is projected into
    // `app-modal`'s own `@if`-gated template, so a plain `effect()` can run
    // before that child has actually attached it, focusing a detached node
    // — `afterRenderEffect` guarantees the whole tree has rendered first.
    afterRenderEffect(() => {
      if (this.open()) {
        this.restoreFocusTo = document.activeElement as HTMLElement | null;
        this.confirmBtnRef()?.nativeElement.focus();
      }
    });
  }

  protected onEscape(event: Event): void {
    if (!this.open()) return;
    event.stopPropagation();
    this.emitCancel();
  }

  /**
   * Accidental-activation guard (Phase M decision 8, this repo's addition —
   * not in the DS reference). Focusing the destructive confirm button on
   * mount opens a hazard the prototype cannot hit: a keyboard user who
   * activates the *trigger* with Enter fires `click` on that same
   * `keydown`; if the physical key is still down once focus lands here, the
   * browser's next auto-repeat `keydown` would activate *this* button next
   * — one held key, participant gone, no dialog seen.
   *
   * `KeyboardEvent.repeat` is true precisely for that auto-repeat (it only
   * clears once a genuine `keyup` for the key has fired), so it is exactly
   * the "was this key already down" signal decision 8 asks for — no timer
   * needed. `preventDefault()` stops a real browser from synthesizing the
   * click at all; `suppressNextConfirmClick` additionally gates the click
   * handler itself so the guard is deterministic in tests that dispatch the
   * two events independently.
   */
  protected onConfirmKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && event.repeat) {
      event.preventDefault();
      this.suppressNextConfirmClick = true;
      return;
    }
    // Focus trap: with `showClose` false, confirm and cancel are the only
    // two focusable elements. Confirm is last in DOM order, so a plain Tab
    // would otherwise leave the dialog for whatever is behind it.
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      this.cancelBtnRef()?.nativeElement.focus();
    }
  }

  /** Clears the guard once the held key is actually released — a fresh
   *  Enter press after this is a deliberate confirmation, not a repeat. */
  protected onConfirmKeyup(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.suppressNextConfirmClick = false;
    }
  }

  /** Focus-trap half two: Shift+Tab from cancel (first in DOM order) wraps
   *  back to confirm, closing the loop the other way. */
  protected onCancelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault();
      this.confirmBtnRef()?.nativeElement.focus();
    }
  }

  protected onConfirm(): void {
    if (this.suppressNextConfirmClick) {
      this.suppressNextConfirmClick = false;
      return;
    }
    this.confirm.emit();
  }

  protected onCancel(): void {
    this.emitCancel();
  }

  private emitCancel(): void {
    this.restoreFocusTo?.focus();
    this.cancel.emit();
  }
}
