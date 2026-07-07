import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';

export type ThemeId = 'd' | 'e' | 'f';

const STORAGE_KEY = 'sc-theme';

/**
 * Holds the active theme (d · Mauve, e · Terracotta, f · Verde Agua) and
 * applies it as a `data-theme` attribute on <html>. All colors are CSS
 * custom properties (see styles/_tokens.scss), so switching is attribute-only.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly theme = signal<ThemeId>(this.restore());

  constructor() {
    effect(() => {
      const id = this.theme();
      this.document.documentElement.setAttribute('data-theme', id);
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        // storage unavailable (private mode) — theme just won't persist
      }
    });
  }

  set(id: ThemeId): void {
    this.theme.set(id);
  }

  private restore(): ThemeId {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'd' || stored === 'e' || stored === 'f') return stored;
    } catch {
      // ignore
    }
    return 'd';
  }
}
