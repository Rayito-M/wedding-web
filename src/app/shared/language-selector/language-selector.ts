import { Component, inject, signal, computed, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ConfigurationService, TranslateLanguageService } from '../../core';
import { LangCode, langDescription } from '../../model';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './language-selector.html',
  styleUrl: './language-selector.scss',
})
export class LanguageSelector {
  private readonly configService = inject(ConfigurationService);
  private readonly translateService = inject(TranslateLanguageService);
  private readonly elementRef = inject(ElementRef);

  readonly languages = computed(
    () => (this.configService.weddingConfiguration()?.language as LangCode[]) ?? [],
  );
  readonly isOpen = signal(false);

  get currentLanguage(): LangCode {
    return this.translateService.currentLang;
  }

  toggleDropdown(): void {
    this.isOpen.update((open) => !open);
  }

  getLanguageDescription(lang: LangCode): string {
    return langDescription[lang];
  }

  selectLanguage(lang: LangCode): void {
    this.translateService.setLanguage(lang);
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }
}
