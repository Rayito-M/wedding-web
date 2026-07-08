import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfigurationService, mediaSignal } from '../../core';

import { DecorAlhambra } from '../../shared/decor/alhambra';
import { DecorFishPair } from '../../shared/decor/fish-pair';
import { DecorSun } from '../../shared/decor/sun';
import { Pill } from '../../shared/pill/pill';
import { DatePipe } from '@angular/common';
import { LanguageSelector } from '../../shared/language-selector/language-selector';
import { ThemeSelector } from '../../shared/theme-selector/theme-selector';

@Component({
  selector: 'app-welcome',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Pill,
    DecorSun,
    DecorFishPair,
    DecorAlhambra,
    TranslatePipe,
    DatePipe,
    LanguageSelector,
    ThemeSelector,
  ],
  templateUrl: './welcome.html',
  styleUrl: './welcome.scss',
})
export class Welcome {
  private readonly router = inject(Router);
  private readonly configuration = inject(ConfigurationService);
  private readonly translate = inject(TranslateService);

  protected readonly desktop = mediaSignal('(min-width: 1024px)');

  open(): void {
    this.router.navigateByUrl('/schedule');
  }

  get language(): string {
    return this.translate.getCurrentLang() || this.translate.getFallbackLang() || 'es';
  }

  get brideName(): string {
    return this.configuration.weddingConfiguration.brideName;
  }

  get groomName(): string {
    return this.configuration.weddingConfiguration.groomName;
  }

  get city(): string {
    return this.configuration.weddingConfiguration.location.city;
  }

  get country(): string {
    return this.configuration.weddingConfiguration.location.country;
  }

  get date(): string {
    return this.configuration.weddingConfiguration.date;
  }

  get tagline(): string {
    return this.configuration.weddingConfiguration.tagline;
  }
}
