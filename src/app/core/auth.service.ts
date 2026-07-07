import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'sc-couple';
/** Stand-in for real authentication: /dashboard?code=trucha unlocks. */
const COUPLE_CODE = 'trucha';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly isCouple = signal(this.restore());

  tryUnlock(code: string | null): boolean {
    if (code === COUPLE_CODE) {
      this.isCouple.set(true);
      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        // storage unavailable — auth lasts for the session only
      }
    }
    return this.isCouple();
  }

  private restore(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }
}
