import { Injectable, signal } from '@angular/core';

/**
 * Holds the meta label of the per-screen header (the uppercase text right of
 * the monogram) that {@link PrivateLayout} renders once, above the router
 * outlet. Screens push their value here instead of each rendering their own
 * `<header>`. The avatar/account menu is owned by the header itself.
 */
@Injectable({ providedIn: 'root' })
export class HeaderService {
  /** Uppercase meta label shown right of the monogram (e.g. "RSVP · STEP 1/3"). */
  readonly meta = signal('');

  /** Set the header meta label for the active screen. */
  set(meta: string): void {
    this.meta.set(meta);
  }
}
