import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Monogram } from '../monogram/monogram';
import { NAV_TABS } from '../nav-tabs';

/** Desktop (≥900px) top nav: monogram left, text links right,
 *  same active-accent treatment as the tab bar. */
@Component({
  selector: 'app-top-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Monogram],
  templateUrl: './top-nav.html',
  styleUrl: './top-nav.scss',
})
export class TopNav {
  private readonly translateService = inject(TranslateService);

  readonly active = input('');
  protected readonly tabs = NAV_TABS;
  protected readonly languages = ['en', 'fr', 'es'];
  protected currentLanguage = this.translateService.currentLang;

  setLanguage(lang: string): void {
    this.translateService.use(lang);
  }
}
