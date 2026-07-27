import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { LoginService, SocialLoginDto } from '../../core';
import { AppLoadingComponent } from '../../shared';

/**
 * OAuth redirect landing (`/auth/callback/:provider`). Reads the ID token from
 * the URL fragment, exchanges it with the backend, then routes on:
 *  - success → the user's role-based landing page (private zone)
 *  - failure/cancel → back to `/login` with `?error=social` so the login screen
 *    shows the shared error modal.
 */
@Component({
  selector: 'app-social-callback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppLoadingComponent],
  template: '<app-loading />',
})
export class SocialCallback {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly login = inject(LoginService);

  constructor() {
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
      await this.router.navigateByUrl(this.login.landingUrl());
    } else {
      await this.failToLogin();
    }
  }

  private failToLogin(): Promise<boolean> {
    return this.router.navigate(['/login'], { queryParams: { error: 'social' } });
  }
}
