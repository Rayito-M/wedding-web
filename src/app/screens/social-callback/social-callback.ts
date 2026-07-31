import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { LoginService, SocialLoginDto } from '../../core';
import { AuthHeading } from '../../shared/auth-heading/auth-heading';
import { Monogram } from '../../shared/monogram/monogram';
import { ProgressBar } from '../../shared/progress-bar/progress-bar';

/**
 * OAuth redirect landing (`/login/callback/:provider`). Reads the ID token from
 * the URL fragment, exchanges it with the backend, then routes on:
 *  - success → the user's role-based landing page (private zone)
 *  - failure/cancel → back to `/login` with `?error=social` so the login screen
 *    shows the shared error modal.
 * Shows a branded "signing you in" progress screen while the exchange is in
 * flight (DS `ScreenLogin.jsx` `callback` stage) instead of a generic spinner.
 */
@Component({
  selector: 'app-social-callback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthHeading, Monogram, ProgressBar, TranslatePipe],
  templateUrl: './social-callback.html',
  styleUrl: './social-callback.scss',
})
export class SocialCallback {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly login = inject(LoginService);
  private readonly destroyRef = inject(DestroyRef);

  /** Climbs toward 90% while the token exchange is in flight, then jumps to
   *  100% once the backend confirms — an honest indicator, not a fake timer. */
  protected readonly percent = signal(0);
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    this.timer = setInterval(() => this.percent.update((p) => Math.min(90, p + 5)), 70);
    this.destroyRef.onDestroy(() => clearInterval(this.timer));
    void this.handleCallback();
  }

  private async handleCallback(): Promise<void> {
    const provider = (this.route.snapshot.paramMap.get('provider') ??
      'google') as SocialLoginDto.ProviderEnum;

    // Implicit-flow responses arrive in the URL fragment (#id_token=…&state=…).
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const idToken = fragment.get('id_token');
    const state = fragment.get('state');
    const providerError = fragment.get('error');

    if (providerError || !idToken || !this.login.verifyOAuthState(state)) {
      await this.failToLogin();
      return;
    }

    const ok = await this.login.completeSocialLogin(provider, idToken);
    if (ok) {
      clearInterval(this.timer);
      this.percent.set(100);
      await this.router.navigateByUrl(await this.login.postLoginUrl());
    } else {
      await this.failToLogin();
    }
  }

  private failToLogin(): Promise<boolean> {
    clearInterval(this.timer);
    return this.router.navigate(['/login'], { queryParams: { error: 'social' } });
  }
}
