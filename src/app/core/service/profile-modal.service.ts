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

  private readonly _targetUserId = signal<string | null>(null);
  /** Whose profile is being edited — `null` means "the signed-in user's own
   *  profile" (ADR W-0006 Decision 1). Set by {@link open}, reset by
   *  {@link close}. */
  readonly targetUserId: Signal<string | null> = this._targetUserId.asReadonly();

  /** Open the modal — called from the account dropdown's "My profile" row,
   *  the People screen's "isMine" card (both omit `targetUserId`, meaning
   *  "self"), and the RSVP editor's "Open their profile" link for a linked
   *  partner (passes the partner's user id, ADR W-0006 Decision 3). */
  open(targetUserId?: string): void {
    this._targetUserId.set(targetUserId ?? null);
    this._isOpen.set(true);
  }

  /** Close the modal — called on `(close)` from `app-profile-modal`. Resets
   *  the target so a stale partner id can't leak into the next self open. */
  close(): void {
    this._isOpen.set(false);
    this._targetUserId.set(null);
  }
}
