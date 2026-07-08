import { Component, inject, signal, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ThemeService, ThemeId } from '../../core/theme.service';

interface ThemeOption {
  id: ThemeId;
  label: string;
  // Accent hex from styles/_tokens.scss — swatches must show every theme's
  // color at once, so they can't rely on the active theme's CSS variables.
  accent: string;
}

@Component({
  selector: 'app-theme-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './theme-selector.html',
  styleUrl: './theme-selector.scss',
})
export class ThemeSelector {
  private readonly themeService = inject(ThemeService);
  private readonly elementRef = inject(ElementRef);

  readonly themes: ThemeOption[] = [
    { id: 'd', label: 'Mauve', accent: '#b08a92' },
    { id: 'e', label: 'Terracotta', accent: '#c97155' },
    { id: 'f', label: 'Verde Agua', accent: '#7aaea2' },
  ];
  readonly isOpen = signal(false);

  get currentTheme(): ThemeOption {
    const id = this.themeService.theme();
    return this.themes.find((theme) => theme.id === id) ?? this.themes[0];
  }

  toggleDropdown(): void {
    this.isOpen.update((open) => !open);
  }

  selectTheme(id: ThemeId): void {
    this.themeService.set(id);
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }
}
