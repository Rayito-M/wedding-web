import { Injectable, signal, type Signal } from '@angular/core';

/**
 * Signals-based, in-memory home for the "My profile" overlay's open/close
 * state (Phase T, T304 — DS `76aa9fa`'s `ProfileModal.jsx`, replacing the old
 * `/profile` route). Mirrors {@link ToastCenterService}'s structural
 * precedent (T285): a shell-level overlay with no shared ancestor component
 * to wire through `@Output`/`@ViewChild`, so producers (`ScreenHeader`'s
 * account dropdown, `People`'s "isMine" card) and the mount point
 * (`PrivateLayout`) share this service instead.
 *
 * This service owns only *whether the modal is open* — never the profile
 * data it displays or the save call it makes (T305's job).
 */
@Injectable({ providedIn: 'root' })
export class ProfileModalService {
  private readonly _isOpen = signal(false);
  /** Whether the "My profile" modal should be mounted/open. */
  readonly isOpen: Signal<boolean> = this._isOpen.asReadonly();

  /** Open the modal — called from the account dropdown's "My profile" row
   *  and the People screen's "isMine" card. */
  open(): void {
    this._isOpen.set(true);
  }

  /** Close the modal — called on `(close)` from `app-profile-modal`. */
  close(): void {
    this._isOpen.set(false);
  }
}
