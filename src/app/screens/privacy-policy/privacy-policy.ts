import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { Btn } from '../../shared/button/button';
import { Monogram } from '../../shared/monogram/monogram';

/**
 * Public, unguarded informational screen (`/privacy-policy`) disclosing the
 * app's use of Google services. Google Analytics per hub ADR-0027: aggregate
 * traffic visibility only (no custom event tracking), cookies set, IP
 * addresses anonymized, a link to Google's own privacy policy, and how the
 * guest's Accept/Decline consent choice (T250) can be changed. Google Maps
 * per T296: the Travel screen embeds a map, so loading it exposes the
 * visitor's IP and device to Google directly — disclosed here because it is
 * a second Google data flow, on a screen every guest opens. Reachable
 * whether the visitor is signed in or not — no auth guard — since the
 * consent banner's note line (T250) links here before any sign-in exists.
 *
 * The Maps disclosure describes behaviour that only exists once T296 ships;
 * it must not reach production ahead of that screen.
 *
 * Out of scope (T251 acceptance): a full legal privacy policy covering
 * guest data (phone/email/dietary/etc.) beyond these Google disclosures.
 */
@Component({
  selector: 'app-privacy-policy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, Btn, Monogram],
  templateUrl: './privacy-policy.html',
  styleUrl: './privacy-policy.scss',
})
export class PrivacyPolicy {}
