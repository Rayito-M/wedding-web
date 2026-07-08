import { Component, inject, signal, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TranslateLanguageService } from '../../core';
import { Language } from '../../../environments';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './language-selector.html',
  styleUrl: './language-selector.scss',
})
export class LanguageSelector {
  private readonly translateService = inject(TranslateLanguageService);
  private readonly elementRef = inject(ElementRef);

  readonly languages: Language[] = ['es', 'fr', 'en'];
  readonly isOpen = signal(false);

  get currentLanguage(): Language {
    return this.translateService.getLanguage();
  }

  toggleDropdown(): void {
    this.isOpen.update((open) => !open);
  }

  selectLanguage(lang: Language): void {
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
