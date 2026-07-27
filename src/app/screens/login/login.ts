import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import {
  LoginService,
  SocialLoginDto,
  TranslateLanguageService,
  ConfigurationService,
} from '../../core';
import { PhoneCountry, defaultCountryForLang } from '../../model';
import { Btn } from '../../shared/button/button';
import { TextInput } from '../../shared/input/input';
import { Monogram } from '../../shared/monogram/monogram';
import { LanguageSelector } from '../../shared/language-selector/language-selector';
import { CountryCodeSelect } from '../../shared/country-code-select/country-code-select';
import { GoogleIcon } from '../../shared/icons/google-icon';
import { AppleIcon } from '../../shared/icons/apple-icon';
import { Modal } from '../../shared/modal/modal';

type AuthMethod = 'phone' | 'email';
type Step = 'request' | 'verify';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    ReactiveFormsModule,
    Btn,
    TextInput,
    Monogram,
    TranslatePipe,
    LanguageSelector,
    CountryCodeSelect,
    GoogleIcon,
    AppleIcon,
    Modal,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly login = inject(LoginService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly langService = inject(TranslateLanguageService);
  private readonly configuration = inject(ConfigurationService);

  protected readonly providers = computed(
    () => this.configuration.weddingConfigPublic()?.socialProviders,
  );

  /** Shows the error modal when a callback (social or magic link) failed. */
  protected readonly showCallbackError = signal(
    this.route.snapshot.queryParamMap.get('error') !== null,
  );

  /** Which authentication method: phone (OTP) or email (magic link). */
  protected readonly authMethod = signal<AuthMethod>('phone');

  /** Current step within the selected auth method: request or verify. */
  protected readonly step = signal<Step>('request');

  protected readonly pending = this.login.pending;
  protected readonly error = this.login.error;

  /** Country dial code, preselected from the current UI language. */
  protected readonly country = signal<PhoneCountry>(
    defaultCountryForLang(this.langService.currentLang),
  );

  protected readonly phoneForm = this.fb.group({
    // Local number only (no country code); the dial code comes from `country`.
    phoneNumber: ['', [Validators.required, Validators.pattern(/^[0-9\s]{4,15}$/)]],
  });

  protected readonly codeForm = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^[0-9]{4,8}$/)]],
  });

  protected readonly emailForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  /** The E.164 number submitted in step 1 (phone), shown back to the user in step 2. */
  protected readonly submittedPhone = signal('');

  /** The email submitted in step 1 (magic link), shown back to the user in step 2. */
  protected readonly submittedEmail = signal('');

  private fullPhoneNumber(): string {
    return this.country().dialCode + this.phoneForm.controls.phoneNumber.value.replace(/\s/g, '');
  }

  protected async requestCode(): Promise<void> {
    if (this.authMethod() === 'phone') {
      await this.requestPhoneCode();
    } else {
      await this.requestMagicLink();
    }
  }

  private async requestPhoneCode(): Promise<void> {
    if (this.phoneForm.invalid) {
      this.phoneForm.markAllAsTouched();
      return;
    }
    const phone = this.fullPhoneNumber();
    const ok = await this.login.requestOtp(phone);
    if (ok) {
      this.submittedPhone.set(phone);
      this.step.set('verify');
    }
  }

  private async requestMagicLink(): Promise<void> {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }
    const email = this.emailForm.controls.email.value;
    const ok = await this.login.requestMagicLink(email);
    if (ok) {
      this.submittedEmail.set(email);
      this.step.set('verify');
    }
  }

  protected async verifyCode(): Promise<void> {
    if (this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      return;
    }
    const ok = await this.login.verifyOtp(
      this.submittedPhone(),
      this.codeForm.controls.code.value.trim(),
    );
    if (ok) {
      await this.router.navigateByUrl(this.login.landingUrl());
    }
  }

  protected editPhone(): void {
    this.codeForm.reset();
    this.step.set('request');
  }

  protected editEmail(): void {
    this.emailForm.reset();
    this.step.set('request');
  }

  protected switchAuthMethod(method: AuthMethod): void {
    this.authMethod.set(method);
    this.step.set('request');
    this.phoneForm.reset();
    this.emailForm.reset();
    this.codeForm.reset();
  }

  protected social(provider: SocialLoginDto.ProviderEnum): void {
    // Redirects the browser to the provider; the SocialCallback screen handles
    // the return and routes on success/failure.
    this.login.startSocialLogin(provider);
  }

  protected dismissCallbackError(): void {
    this.showCallbackError.set(false);
    // Drop the `?error=` param so a refresh doesn't reopen the modal.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }
}
