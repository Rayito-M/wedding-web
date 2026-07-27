import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { LoginService } from '../../core';
import { AppLoadingComponent } from '../../shared';

/**
 * Magic link redirect landing (`/login/magic-link/verify`). Reads the token from
 * the URL query parameter, exchanges it with the backend, then routes on:
 *  - success → the user's role-based landing page (private zone)
 *  - failure/invalid → back to `/login` with `?error=magic-link` so the login screen
 *    shows the shared error modal.
 */
@Component({
  selector: 'app-magic-link-callback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppLoadingComponent],
  template: '<app-loading />',
})
export class MagicLinkCallback {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly login = inject(LoginService);

  constructor() {
    void this.handleCallback();
  }

  private async handleCallback(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      await this.failToLogin();
      return;
    }

    const ok = await this.login.verifyMagicLink(token);
    if (ok) {
      await this.router.navigateByUrl(this.login.landingUrl());
    } else {
      await this.failToLogin();
    }
  }

  private failToLogin(): Promise<boolean> {
    return this.router.navigate(['/login'], { queryParams: { error: 'magic-link' } });
  }
}
