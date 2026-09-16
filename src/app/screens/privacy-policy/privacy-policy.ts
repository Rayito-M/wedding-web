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
 * **Delegation** per hub ADR-0039 and `SPEC.md`'s Non-functional clause
 * (T380, and the gap T378 recorded rather than widened its own scope to
 * cover): a delegate reads the *whole* of someone else's reply — named
 * children with their ages, dietary preferences and **allergies** — which is
 * the one permission a guest holds over another guest's data and the only
 * health-adjacent one in the product. The notice had never mentioned it,
 * from the day ADR-0039 shipped; it was not a disclosure failure already in
 * effect only because no delegation exists in production yet, and that is
 * precisely what expires the moment the couple grants the first one.
 *
 * Like the section above it, that copy is written for **what ships**. Two
 * things it must therefore say and does: **nobody is notified** of being made
 * a delegate (ADR-0039 §8 Q6 — a notification would be a new ADR-0019 type,
 * and it is explicitly not an announcement), and **neither party can refuse
 * or resign one through this site** (§8 Q9 — the couple's guest manager is
 * the only write surface). The three bounds it does assert all exist: only
 * the couple grants or removes, the subject sees who holds it read-only on
 * their own profile, and the subject keeps their own reply either way.
 *
 * Out of scope (T251 acceptance): a full legal privacy policy covering
 * guest data (phone/email/dietary/etc.) beyond the disclosures above.
 */
@Component({
  selector: 'app-privacy-policy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, Btn, Monogram],
  templateUrl: './privacy-policy.html',
  styleUrl: './privacy-policy.scss',
})
export class PrivacyPolicy {}
