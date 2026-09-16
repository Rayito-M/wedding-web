import { readFileSync } from 'node:fs';
import path from 'node:path';

import { test, expect } from '@playwright/test';

import { signInAsCouple } from './support/auth';

/**
 * Copy that carries a **factual claim about how the system behaves** — T391.
 *
 * The same false claim, *contact details update themselves*, shipped in four
 * places before anyone caught it: hub ADR-0047 §2, `SPEC.md`/`GLOSSARY.md`,
 * `wedding-api`'s `wedding-config.ts:199-202`, and finally
 * `configManager.goodToKnow.contact.hint` — the only one of the four a **user
 * reads**, and the only one a user would *act* on. T390 corrected the string
 * and its report ended on the point that matters: the hint is covered by no
 * test at all, so the next false claim in it ships exactly the way that one
 * did.
 *
 * The pattern that works already exists. T381 added a **negative** assertion
 * to `public-surface.spec.ts` — the notice must not promise the unbuilt
 * third-party case — and it did its job: it failed loudly when ADR-0047 made
 * the opposite true, forcing T385 to invert it deliberately instead of
 * drifting. This file is that pattern applied to the copy the **couple**
 * reads, in the same shape: a live render, then the claims pinned per locale
 * off disk.
 *
 * **Asserted for MEANING, never for prose.** Every regex below matches the
 * load-bearing clause and nothing around it, so the wording stays free to be
 * improved and these fail only when a FACT changes. That is not a style
 * preference: a test that breaks when someone tightens a sentence gets
 * deleted by the third person who hits it, and then there is no test at all.
 *
 * **Where the other claim-bearing copy is asserted, so this file does not
 * duplicate it:** `privacyPolicy.goodToKnow.body` (T385) and
 * `privacyPolicy.delegation.body` (T380) are both pinned per locale,
 * positively and negatively, in `public-surface.spec.ts` — that file owns the
 * public surface and those two strings live on it. What is *not* asserted
 * anywhere is the agreement **between** the two audiences, which is the exact
 * gap T390's defect fell through: the hint told the couple one thing and the
 * notice told the guest the opposite, about the same stored data, in the same
 * release. The last test here closes that.
 *
 * `T391`'s survey of every other user-facing string carrying an unasserted
 * behavioural claim is deliberately **not** turned into tests here — it is
 * reported in `tasks/33-general-information/reports/T391.json`, because its
 * size is the finding and fixing it silently would hide that.
 */

const LOCALES = ['es', 'en', 'fr'] as const;

function locale(name: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.resolve(__dirname, `../public/i18n/${name}.json`), 'utf8'),
  ) as Record<string, unknown>;
}

/** `configManager.goodToKnow.contact.hint` — the string T390 corrected. */
function contactHint(name: string): string {
  const file = locale(name) as {
    configManager: { goodToKnow: { contact: { hint: string } } };
  };
  return file.configManager.goodToKnow.contact.hint;
}

/** `privacyPolicy.goodToKnow.body` — the guest-facing half of the same facts. */
function guestNotice(name: string): string {
  const file = locale(name) as { privacyPolicy: { goodToKnow: { body: string } } };
  return file.privacyPolicy.goodToKnow.body;
}

/**
 * The claims, per locale. Four the hint must make, one it must never make
 * again, and — separately — the two the guest-facing notice has to agree with
 * it on.
 *
 * `forbiddenSelfUpdate` is the literal shape of the pre-T390 sentence in each
 * language, because that is the claim that actually shipped and the one a
 * later edit is most likely to reintroduce (it is the *intuitive* behaviour,
 * and three other documents in the system still describe it — see the report's
 * risks). Matching the clause rather than the sentence keeps it from being a
 * prose lock: any rewording that still promises a self-updating card trips it.
 */
const CLAIMS = {
  es: {
    accountHoldersOnly: /personas con cuenta en este sitio/i,
    copiedWhenAdded: /se copian de esa cuenta cuando añadís a la persona/i,
    noSelfUpdate: /no actualiza la ficha/i,
    rePick: /volver a elegir a esa persona/i,
    addedAsGuestFirst: /se añade antes como invitado/i,
    forbiddenSelfUpdate: /su ficha cambia también|cambia su perfil, su ficha/i,
    noticeCopiedWhenAdded: /se copian de la cuenta de esa persona en el momento en que los novios la añaden/i,
    noticeNoSelfUpdate: /no actualiza la sección/i,
  },
  en: {
    accountHoldersOnly: /hold an account on this site/i,
    copiedWhenAdded: /copied from that account the moment you add the person/i,
    noSelfUpdate: /does not update the card/i,
    rePick: /pick them again/i,
    addedAsGuestFirst: /added as a guest first/i,
    forbiddenSelfUpdate: /their card changes too|change their profile, their card/i,
    noticeCopiedWhenAdded: /copied from that person's account at the moment the couple adds them/i,
    noticeNoSelfUpdate: /does not update the section/i,
  },
  fr: {
    accountHoldersOnly: /possédant un compte sur ce site/i,
    copiedWhenAdded: /copiés depuis ce compte au moment où vous ajoutez la personne/i,
    noSelfUpdate: /ne met pas la fiche à jour/i,
    rePick: /choisir cette personne à nouveau/i,
    addedAsGuestFirst: /est d'abord ajoutée comme invitée/i,
    forbiddenSelfUpdate: /leur fiche change aussi|changent leur profil, leur fiche/i,
    noticeCopiedWhenAdded: /copiées depuis le compte de cette personne au moment où les mariés l'ajoutent/i,
    noticeNoSelfUpdate: /ne met pas la section à jour/i,
  },
} as const;

test.describe('user-facing copy that makes a factual claim (T391)', () => {
  test('the contact hint reaches the couple on a live screen, saying what is true (hub ADR-0047 Amendment 3 §A)', async ({
    page,
  }) => {
    await signInAsCouple(page);
    // Settings section 08 (ADR-0046 Amendment 4 §A), reachable directly —
    // `/config` already carries `group: 'manage'`, so no click-through.
    await page.goto('/config?section=good-to-know');

    // `.first()`: the card has three `.field-hint`s — this one, and the two
    // empty-list lines under Wedding planner and Guests. The hint is the
    // card's own lead paragraph and is the first in DOM order.
    const hint = page.locator('[data-section="contact"] .field-hint').first();
    // Auto-retrying, and it doubles as the locale gate T389 added next door:
    // mounted is not translated, and a one-shot read here would race the
    // `/i18n/<lang>.json` fetch exactly as `public-surface.spec.ts` did.
    await expect(hint, 'the hint must be rendered, not an orphaned key').not.toHaveText(
      'configManager.goodToKnow.contact.hint',
    );
    await expect(hint).toBeVisible();

    const text = (await hint.innerText()).replace(/\s+/g, ' ');
    const claim = CLAIMS.en;

    // The claim T390 removed. This is the assertion whose absence let the
    // false version ship, and it is the one that must fail if it comes back.
    expect(
      text,
      'the hint must not promise that a contact card updates itself — digests are stored verbatim (ADR-0047 Amendment 3 §A)',
    ).not.toMatch(claim.forbiddenSelfUpdate);
    // …and the two halves of what is actually true, because "does not say the
    // false thing" is also satisfied by saying nothing at all.
    expect(text, 'the hint must say the details are copied when the person is added').toMatch(
      claim.copiedWhenAdded,
    );
    expect(text, 'the hint must say a later account edit does not update the card').toMatch(
      claim.noSelfUpdate,
    );
  });

  test('the contact hint states what ships, per locale (T390, hub ADR-0047 Amendment 3 §A)', async () => {
    for (const name of LOCALES) {
      const hint = contactHint(name);
      const claim = CLAIMS[name];

      expect(
        hint,
        `${name}: the hint must not promise a self-updating contact card — the claim T390 removed, and the one three other documents in the system still make`,
      ).not.toMatch(claim.forbiddenSelfUpdate);

      expect(hint, `${name}: the details are copied when the couple adds the person`).toMatch(
        claim.copiedWhenAdded,
      );
      expect(hint, `${name}: a later edit to the account does not update the card`).toMatch(
        claim.noSelfUpdate,
      );
      expect(
        hint,
        `${name}: so a changed number means picking the person again — the instruction that makes the two clauses above actionable`,
      ).toMatch(claim.rePick);

      // The true parts T390 deliberately kept, pinned so a later rewrite does
      // not quietly drop them: ADR-0047 §2 dropped the no-account case, and
      // someone without an account is added as a guest first.
      expect(hint, `${name}: only people who hold an account here (ADR-0047 §2)`).toMatch(
        claim.accountHoldersOnly,
      );
      expect(hint, `${name}: someone without an account is added as a guest first`).toMatch(
        claim.addedAsGuestFirst,
      );
    }
  });

  test('the couple and the guest are told the same thing about the same data (T390 was the gap between them)', async () => {
    // The defect T390 fixed was not that either string was badly written. It
    // was that `configManager.goodToKnow.contact.hint` and
    // `privacyPolicy.goodToKnow.body` shipped in the SAME release saying
    // opposite things about whether a stored contact digest goes stale — one
    // read by the couple, one by the guest, neither aware of the other.
    //
    // Nothing asserted the pair, so nothing could catch it. This does: both
    // strings must carry both halves of the Amendment 3 §A behaviour, in
    // every locale. When `wedding-api` T251 makes details resolve at read
    // time, this test is the one that fails first and correctly — BOTH
    // strings change in that task's commit, and this is the reminder.
    for (const name of LOCALES) {
      const hint = contactHint(name);
      const notice = guestNotice(name);
      const claim = CLAIMS[name];

      expect(hint, `${name}: couple-facing — copied on add`).toMatch(claim.copiedWhenAdded);
      expect(notice, `${name}: guest-facing — copied on add`).toMatch(claim.noticeCopiedWhenAdded);

      expect(hint, `${name}: couple-facing — no self-update`).toMatch(claim.noSelfUpdate);
      expect(notice, `${name}: guest-facing — no self-update`).toMatch(claim.noticeNoSelfUpdate);

      expect(
        notice,
        `${name}: neither string may promise a self-updating card, and the guest-facing one is the half that was already right`,
      ).not.toMatch(claim.forbiddenSelfUpdate);
    }
  });
});
