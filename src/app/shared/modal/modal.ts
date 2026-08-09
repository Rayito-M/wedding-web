import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

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
  readonly close = output<void>();

  protected onBackdrop(): void {
    if (this.dismissable()) this.close.emit();
  }
}
