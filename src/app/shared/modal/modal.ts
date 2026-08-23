import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

let nextModalId = 0;

/**
 * Shared modal dialog. Presentational only: the parent owns `open` and reacts
 * to `(close)`. Body content is projected; optional footer actions project into
 * the `[modal-actions]` slot.
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
  /** Whether clicking the backdrop / close button dismisses the dialog. */
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
  readonly close = output<void>();

  /** Stable per-instance id, wired to `[attr.aria-labelledby]` on the
   *  `role="dialog"` element in the template so the dialog gets an
   *  accessible name whenever `title` is set. Module-level counter so two
   *  modals open at once (e.g. a nested `app-confirm-dialog`) never collide. */
  protected readonly titleId = `modal-title-${nextModalId++}`;

  protected onBackdrop(): void {
    if (this.dismissable()) this.close.emit();
  }
}
