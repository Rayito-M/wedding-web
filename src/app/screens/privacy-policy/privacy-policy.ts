import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { Btn } from '../../shared/button/button';
import { Monogram } from '../../shared/monogram/monogram';

/**
 * Public, unguarded informational screen (`/privacy-policy`) disclosing what
 * the site shows about people and its use of Google services.
 *
 * **Contacts and bank details** per hub ADR-0046 §7 (T378): the couple can
 * put contact details for people they name, and their own bank details, in
 * front of every signed-in guest — personal data made visible to others by
 * an act of the couple's, which is exactly what a notice is for. The copy is
 * worded for **what ships** (ADR-0046 Amendment 1 §B): a Good-to-know
 * contact is today a reference to a user of this system, so the notice does
 * **not** say "including people who are not guests" — that mechanism is
 * intended and unbuilt, and it widens on the day it ships, not before. The
 * open question of whether the API populates a referenced contact's
 * `phoneNumber` for a guest owes its own line here too, and does not have
 * one yet (Amendment 1 §B).
 *
 * Google Analytics per hub ADR-0027: aggregate
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
 * guest data (phone/email/dietary/etc.) beyond the disclosures above. One
 * known gap inherited rather than introduced here — `SPEC.md`'s
 * Non-functional clause also requires this notice to say that a **delegate**
 * reads someone else's whole reply, including children's ages and allergies
 * (hub ADR-0039); no section says so yet, and T378's scope was Good to know.
 */
@Component({
  selector: 'app-privacy-policy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, Btn, Monogram],
  templateUrl: './privacy-policy.html',
  styleUrl: './privacy-policy.scss',
})
export class PrivacyPolicy {}
