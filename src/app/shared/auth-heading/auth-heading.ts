import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** i18n interpolation params for the `translate` pipe. */
export type AuthHeadingSubParams = Record<string, string | number>;

/**
 * Centered eyebrow + serif title + sub-copy heading shared by every stage of
 * the sign-in flow (request/verify forms, social + magic-link "signing you
 * in" screens) — mirrors the DS `ScreenLogin.jsx` local `H` helper, reused
 * as an Angular component so it isn't duplicated per screen.
 */
@Component({
  selector: 'app-auth-heading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './auth-heading.html',
  styleUrl: './auth-heading.scss',
})
export class AuthHeading {
  readonly eyebrowKey = input.required<string>();
  readonly titleKey = input.required<string>();
  readonly subKey = input<string>();
  readonly subParams = input<AuthHeadingSubParams>();
}
