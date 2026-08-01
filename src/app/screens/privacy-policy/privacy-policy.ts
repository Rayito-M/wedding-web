import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { Btn } from '../../shared/button/button';
import { Monogram } from '../../shared/monogram/monogram';

/**
 * Public, unguarded informational screen (`/privacy-policy`) disclosing the
 * app's use of Google Analytics per hub ADR-0027: aggregate traffic
 * visibility only (no custom event tracking), cookies set, IP addresses
 * anonymized, a link to Google's own privacy policy, and how the guest's
 * Accept/Decline consent choice (T250) can be changed. Reachable whether
 * the visitor is signed in or not — no auth guard — since the consent
 * banner's note line (T250) links here before any sign-in exists.
 *
 * Out of scope (T251 acceptance): a full legal privacy policy covering
 * guest data (phone/email/dietary/etc.) beyond the GA disclosure.
 */
@Component({
  selector: 'app-privacy-policy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, Btn, Monogram],
  templateUrl: './privacy-policy.html',
  styleUrl: './privacy-policy.scss',
})
export class PrivacyPolicy {}
