import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

import { ConfigurationService, mediaSignal, TranslateLanguageService } from '../../core';

import { DecorAlhambra } from '../../shared/decor/alhambra';
import { DecorFishPair } from '../../shared/decor/fish-pair';
import { DecorSun } from '../../shared/decor/sun';
import { Pill } from '../../shared/pill/pill';
import { DatePipe } from '@angular/common';
import { LanguageSelector } from '../../shared/language-selector/language-selector';

@Component({
  selector: 'app-welcome',
  imports: [
    Pill,
    DecorSun,
    DecorFishPair,
    DecorAlhambra,
    TranslatePipe,
    DatePipe,
    LanguageSelector,
  ],
  templateUrl: './welcome.html',
  styleUrl: './welcome.scss',
})
export class Welcome {
  private readonly router = inject(Router);
  private readonly configuration = inject(ConfigurationService);
  private readonly translate = inject(TranslateLanguageService);

  protected readonly weddingConfig = this.configuration.weddingConfiguration;
  protected readonly desktop = mediaSignal('(min-width: 1024px)');

  open(): void {
    this.router.navigateByUrl('/schedule');
  }

  get currentLang(): string {
    return this.translate.currentLang;
  }
}
