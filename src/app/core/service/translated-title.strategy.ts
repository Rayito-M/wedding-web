import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

/**
 * Resolves each route's `title` as an i18n key (see `titles.*` in the locale
 * files) rather than a literal string, and re-applies it whenever the language
 * changes — the browser tab title lives outside the component tree, so the
 * `| translate` pipe can't reach it. Wire it via
 * `{ provide: TitleStrategy, useClass: TranslatedTitleStrategy }`.
 */
@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly translate = inject(TranslateService);

  /** i18n key of the active route's title, kept so we can re-translate on lang change. */
  private currentKey?: string;
  private subscribed = false;

  constructor() {
    super();
  }

  private ensureSubscribed(): void {
    if (!this.subscribed) {
      this.subscribed = true;
      this.translate.onLangChange.subscribe(() => this.applyTitle());
    }
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.ensureSubscribed();
    this.currentKey = this.buildTitle(snapshot);
    this.applyTitle();
  }

  private applyTitle(): void {
    if (this.currentKey === undefined) return;
    this.title.setTitle(this.translate.instant(this.currentKey));
  }
}
