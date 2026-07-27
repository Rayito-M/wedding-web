import { Injectable, signal } from '@angular/core';

const TOKEN_KEY = 'sc-auth-token';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly tokenSignal = signal<string | undefined>(this.restore());

  readonly token = this.tokenSignal.asReadonly();

  set(token: string): void {
    this.tokenSignal.set(token);
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // storage unavailable
    }
  }

  clear(): void {
    this.tokenSignal.set(undefined);
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // storage unavailable
    }
  }

  private restore(): string | undefined {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  }
}
