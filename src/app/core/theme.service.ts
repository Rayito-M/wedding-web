import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';
import { ThemeId, defaultThemeId } from '../model';
import { ConfigurationService } from './service';

const STORAGE_KEY = 'sc-theme';

/**
 * Holds the active theme (Mauve, Terracotta, Verde Agua) and
 * applies it as a `data-theme` attribute on <html>. All colors are CSS
 * custom properties (see styles/_tokens.scss), so switching is attribute-only.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly configService = inject(ConfigurationService);

  readonly theme = signal<ThemeId>(this.getStored() ?? defaultThemeId);

  constructor() {
    effect(() => {
      const id = this.theme();
      this.document.documentElement.setAttribute('data-theme', id);
    });

    // Apply the theme published by the wedding configuration, unless the
    // user has already chosen one (stored preference wins).
    effect(() => {
      const config = this.configService.weddingConfiguration();
      if (config?.themeId && !this.getStored()) {
        this.theme.set(config.themeId);
      }
    });
  }

  set(id: ThemeId): void {
    this.theme.set(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // storage unavailable (private mode) — theme just won't persist
    }
  }

  private getStored(): ThemeId | undefined {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'mauve' || stored === 'terracotta' || stored === 'verdeagua') return stored;
    } catch {
      // storage unavailable (private mode) — fall back to default
    }
    return undefined;
  }
}
