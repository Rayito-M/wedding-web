import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  model,
  signal,
} from '@angular/core';

import { PHONE_COUNTRIES, PhoneCountry } from '../../model';

/**
 * Country dial-code dropdown for phone entry. Mirrors the LanguageSelector
 * pattern: self-contained open/close with document click-outside. The selected
 * country is a two-way `model` so the host can read its `dialCode`.
 */
@Component({
  selector: 'app-country-code-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  templateUrl: './country-code-select.html',
  styleUrl: './country-code-select.scss',
})
export class CountryCodeSelect {
  private readonly elementRef = inject(ElementRef);

  readonly country = model.required<PhoneCountry>();

  protected readonly countries = PHONE_COUNTRIES;
  protected readonly isOpen = signal(false);

  protected toggleDropdown(): void {
    this.isOpen.update((open) => !open);
  }

  protected select(country: PhoneCountry): void {
    this.country.set(country);
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }
}
