import { Component, inject, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

import {
  ConfigurationService,
  LoginService,
  mediaSignal,
  TranslateLanguageService,
} from '../../core';

import { Btn } from '../../shared/button/button';
import { AlhambraScene } from '../../shared/decor/alhambra-scene/alhambra-scene';
import { DecorFishPair } from '../../shared/decor/fish-pair';
import { DecorSun } from '../../shared/decor/sun';
import { Pill } from '../../shared/pill/pill';
import { LanguageSelector } from '../../shared/language-selector/language-selector';

@Component({
  selector: 'app-welcome',
  imports: [
    Btn,
    AlhambraScene,
    Pill,
    DecorSun,
    DecorFishPair,
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
  private readonly loginService = inject(LoginService);

  protected readonly weddingConfig = computed(() => this.configuration.weddingConfigPublic());
  protected readonly desktop = mediaSignal('(min-width: 1024px)');

  open(): void {
    if (!this.loginService.currentUserClaims()) {
      this.router.navigateByUrl('/login');
      return;
    }

    if (this.loginService.currentUserClaims()?.role === 'guest') {
      this.router.navigateByUrl('/me');
      return;
    }

    this.router.navigateByUrl('/dashboard');
  }

  protected readonly currentLang = this.translate.currentLang;
}
