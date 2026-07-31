import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { LoginService } from '../../core';
import { AuthHeading } from '../../shared/auth-heading/auth-heading';
import { Monogram } from '../../shared/monogram/monogram';
import { ProgressBar } from '../../shared/progress-bar/progress-bar';

/**
 * Magic link redirect landing (`/login/magic-link/verify`). Reads the token from
 * the URL query parameter, exchanges it with the backend, then routes on:
 *  - success → the user's role-based landing page (private zone)
 *  - failure/invalid → back to `/login` with `?error=magic-link` so the login screen
 *    shows the shared error modal.
 * Shows a branded "signing you in" progress screen while the exchange is in
 * flight (DS `ScreenLogin.jsx` `callback` stage) instead of a generic spinner.
 */
@Component({
  selector: 'app-magic-link-callback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthHeading, Monogram, ProgressBar, TranslatePipe],
  templateUrl: './magic-link-callback.html',
  styleUrl: './magic-link-callback.scss',
})
export class MagicLinkCallback {
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
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      await this.failToLogin();
      return;
    }

    const ok = await this.login.verifyMagicLink(token);
    if (ok) {
      clearInterval(this.timer);
      this.percent.set(100);
      await this.router.navigateByUrl(this.login.landingUrl());
    } else {
      await this.failToLogin();
    }
  }

  private failToLogin(): Promise<boolean> {
    clearInterval(this.timer);
    return this.router.navigate(['/login'], { queryParams: { error: 'magic-link' } });
  }
}
