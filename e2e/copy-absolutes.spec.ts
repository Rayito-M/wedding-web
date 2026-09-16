import { readFileSync } from 'node:fs';
import path from 'node:path';

import { test, expect } from '@playwright/test';

/**
 * Absolute quantifiers in guest-facing copy need a justification — T397.
 *
 * T394's triage found that the false claims in this app's copy cluster in two
 * shapes, and this file guards the second: **an absolute — "only", "everyone",
 * "never", "any time" — that was true the day it was written and was falsified
 * later by a decision that widened who sees or who acts.**
 * `profileModal.visibility.suffix` said email and phone were shared with the
 * couple *only*; ADR-0047 §3 then put a listed contact's email and phone in
 * front of every signed-in guest, and nothing re-read the modal. Same
 * mechanism as ADR-0015 falsifying "only you can reply", and as the 410
 * deadline falsifying "any time". Nothing can lint truth — but a suite CAN
 * refuse a new absolute until a person has read it.
 *
 * So: every locale value matching a small per-language absolutes lexicon must
 * have an entry in INVENTORY below, marked either
 *
 * - `ASSERTED:` — a test somewhere pins the claim to what the code does
 *   (named in the reason), or
 * - `ALLOWED:` — a person read it and wrote down why it is true or why it is
 *   not a behavioural claim (a filter chip's "All", an address to the party).
 *
 * Writing a new absolute now fails this suite until it is consciously
 * classified — the reading moves to authoring time, which is where this whole
 * phase shows it is cheapest. Deleting an absolute fails the suite too, until
 * its stale entry is removed: the inventory never drifts from the copy.
 *
 * **What this deliberately does not catch**, so nobody mistakes the guard for
 * the truth: (a) numbers — "expires in 10 minutes" carries no lexicon word
 * (that cluster's guard is `login-ttl` / T396); (b) time-bound phrasings with
 * no absolute in them — "right up to the day" was false in
 * `rsvp.editor.attending.hint.declined` and only reading its siblings found
 * it. The lexicon is deliberately small: every widening buys coverage at the
 * price of allowlist churn, and a suite that fails on every copy edit gets
 * its assertions deleted (T391's warning).
 *
 * The second half pins the T397 rewordings themselves — the four strings
 * T394 confirmed false (plus the deadline-bound hints found alongside them),
 * positively and negatively per locale, so restoring any of the false
 * versions fails loudly. `profileModal.visibility.suffix`'s agreement with
 * the privacy notice is pinned next door in `copy-claims.spec.ts`, where the
 * cross-audience pattern lives.
 */

const LOCALES = ['es', 'en', 'fr'] as const;
type Locale = (typeof LOCALES)[number];

/**
 * The absolutes lexicon. Word-boundary and accent-aware (`\b` breaks on
 * accented letters, so the es/fr patterns bound on "not a letter" instead).
 * fr "personne" is matched only as the negative pronoun ("personne ne …") —
 * as a noun it means *person* and would put every headcount string in the
 * inventory, which is exactly the churn that kills suites like this.
 */
const LEXICON: Record<Locale, RegExp[]> = {
  en: [
    /\bonly\b/i,
    /\beveryone\b/i,
    /\bnever\b/i,
    /\balways\b/i,
    /\bany ?time\b/i,
    /\bnobody\b/i,
    /\bno one\b/i,
  ],
  es: [
    /(^|[^\p{L}])s[oó]lo($|[^\p{L}])/iu,
    /(^|[^\p{L}])solamente($|[^\p{L}])/iu,
    /(^|[^\p{L}])[uú]nicamente($|[^\p{L}])/iu,
    /(^|[^\p{L}])tod[oa]s($|[^\p{L}])/iu,
    /(^|[^\p{L}])nunca($|[^\p{L}])/iu,
    /(^|[^\p{L}])jam[aá]s($|[^\p{L}])/iu,
    /(^|[^\p{L}])siempre($|[^\p{L}])/iu,
    /cuando quieras?($|[^\p{L}])/iu,
    /en cualquier momento/iu,
    /(^|[^\p{L}])nadie($|[^\p{L}])/iu,
  ],
  fr: [
    /(^|[^\p{L}])seule?s?($|[^\p{L}])/iu,
    /(^|[^\p{L}])seulement($|[^\p{L}])/iu,
    /(^|[^\p{L}])uniquement($|[^\p{L}])/iu,
    /(^|[^\p{L}])jamais($|[^\p{L}])/iu,
    /(^|[^\p{L}])toujours($|[^\p{L}])/iu,
    /[àa] tout moment/iu,
    /n['’]importe quand/iu,
    /quand vous voulez/iu,
    /(^|[^\p{L}])tou(s|tes)($|[^\p{L}])/iu,
    /tout le monde/iu,
    // The pronoun ("Personne ne répond" — nobody), not the noun with a
    // determiner ("cette personne ne peut pas venir" — a person who can't).
    /(?<!cette |une |la |chaque |toute |autre )personne ne(?=$|[^\p{L}])/iu,
  ],
};

/**
 * Every key whose value carries an absolute, in any locale, and why that is
 * fine. `ASSERTED:` names the test that pins the claim; `ALLOWED:` records
 * the reading. When this test fails on a key you just wrote: read your
 * string against the code that honours it, then add it here — or take the
 * absolute out. Do not add it unread; that is the defect this file exists
 * to stop (T390, T394).
 */
const INVENTORY: Record<string, string> = {
  'album.subtitle':
    "ALLOWED: 'Shared by all of you' addresses the party — no behaviour claimed.",
  'configManager.agenda.descAllLangs':
    'ALLOWED: "all languages" is a form-field label; the form does edit all three.',
  'configManager.agenda.filter.all': 'ALLOWED: "All moments" is a filter chip label, not a claim.',
  'configManager.agenda.titleAllLangs':
    'ALLOWED: "all languages" is a form-field label; the form does edit all three.',
  'configManager.appearance.languagesHint':
    'ALLOWED: es/en/fr is the fixed locale set (hard rule: i18n runtime-switchable); the switcher labels are all the form edits.',
  'configManager.couple.deleteNote':
    'ALLOWED: verified by T394 — deleting the account kills the next magic-link lookup immediately; recreation is couple-side, no deadline applies to admins.',
  'configManager.couple.lastSeen.neverSignedIn':
    'ALLOWED: empty state for the couple-only lastSeen field (hard rule 16) — describes absent data, promises nothing.',
  'configManager.goodToKnow.contact.hint':
    'ASSERTED: e2e/copy-claims.spec.ts pins its claims per locale, positively and negatively (T390/T391).',
  'configManager.goodToKnow.dayLine.datesHint':
    'ALLOWED: fr "toutes seules" — the hint WARNS that these sentences do not update themselves, which is true by design and the lesson of T390.',
  'configManager.goodToKnow.dressCode.swatchesHint':
    "ALLOWED: 'can never disagree' — the swatches are read off the active theme (config-manager reads PALETTES[theme()]), not stored.",
  'configManager.goodToKnow.gift.identifiersHint':
    'ALLOWED: "never translated" restates ADR-0047 §5 / hard rule 19a — identifiers render byte-identical in all three locales.',
  'consentBanner.note':
    'ALLOWED: consent is re-asked after clearing site data (privacyPolicy.changeChoice.body agrees); no server-side gate on changing it.',
  'delegation.field.emptyCouple':
    'ALLOWED: couple-facing empty state — "yet" scopes it to the delegation record, which is genuinely absent.',
  'delegation.field.emptyGuest':
    'ASSERTED: reworded by T397 and pinned below — the old "only you can reply" was false since ADR-0015 (the couple edits any RSVP).',
  'guest_manager.filter.all': 'ALLOWED: "All" is a filter chip label, not a claim.',
  'guest_manager.lastSeen.never':
    'ALLOWED: empty state for the couple-only lastSeen field (hard rule 16) — describes absent data, promises nothing.',
  'login.magicLink.sub':
    "ASSERTED: fr 'une seule fois' — single-use verified against wedding-api magic-link.service.ts (T394); the TTL numeral is interpolated from auth-ttl.ts and cross-checked against the API's constant by login-ttl.spec.ts (T396).",
  'milestones.announcement.clearConfirm.message':
    'ALLOWED: verified by T394 against milestones.service — clear removes only the resend block, recalls nothing.',
  'milestones.audience.all': 'ALLOWED: "Everyone" is an audience option label, not a claim.',
  'milestones.form.kind.hint':
    'ALLOWED: verified by T394 — internal milestones have no notifier path, on any channel.',
  'milestones.subtitle':
    "ALLOWED: 'never seen by guests' — the route is role-gated to bride/groom (app.routes.ts, rbacGuard, ADR-0029 §4.7).",
  'notifications.template.invitation.body':
    'ALLOWED: es/fr "todos los detalles"/"tous les détails" — an invitation to look, not a behaviour claim.',
  'notifications.template.menu-selection-reminder.body':
    "ALLOWED: 'everyone' is the guest's own party, not a visibility claim.",
  'people.empty': 'ALLOWED: search empty state — factually no card matches.',
  'people.emptyFilter': 'ALLOWED: filter empty state — factually no card matches.',
  'people.filter.all': 'ALLOWED: "Everyone" is a filter chip label, not a claim.',
  'people.subtitle':
    'ASSERTED: reworded by T397 and pinned below — the directory lists every account (GET /v1/profile has no signed-in filter), not "everyone who has signed in".',
  'privacyPolicy.changeChoice.body':
    'ALLOWED: the mechanism is browser-side (clear site data → re-ask); verified by T394 alongside the analytics claims.',
  'privacyPolicy.cookies.body':
    "ALLOWED: verified by T394 — the app's only gtag load is gated on an 'accepted' decision.",
  'privacyPolicy.delegation.body':
    "ASSERTED: pinned per locale in e2e/public-surface.spec.ts (T380). Its 'answer yourself at any time' clause overclaims past the RSVP deadline (410) — flagged in T397's decisions_needed; the notice's wording is the Product Owner's to change.",
  'privacyPolicy.goodToKnow.body':
    'ASSERTED: pinned per locale in e2e/public-surface.spec.ts (T385) — and it is the reference the profile modal is pinned against in copy-claims.spec.ts.',
  'profileModal.visibility.prefix':
    'ALLOWED: name, role and relation are the directory card fields, shown for every account — the same scope people.subtitle now states.',
  'profileModal.visibility.suffix':
    'ASSERTED: reworded by T397, pinned below and against privacyPolicy.goodToKnow.body in copy-claims.spec.ts — the old "couple only" was false since ADR-0047 §3.',
  'rsvp.create.confirm.yesMessage':
    "ASSERTED: reworded by T397 — 'any time' became 'until {{deadline}}' (the API 410s writes after it); interpolation pinned here and in rsvp-deadline.spec.ts. 'everyone' is the guest's party.",
  'rsvp.create.party.subtitle': "ALLOWED: 'everyone' is the guest's own party, not a visibility claim.",
  'schedule.note.final':
    'ALLOWED: "so nobody turns up" states the purpose; the behaviour under it (cancelled items stay listed) verified by T394 against schedule.ts.',
};

function flatten(node: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const dotted = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) Object.assign(out, flatten(value, dotted));
    else out[dotted] = String(value);
  }
  return out;
}

function locale(name: Locale): Record<string, string> {
  return flatten(
    JSON.parse(readFileSync(path.resolve(__dirname, `../public/i18n/${name}.json`), 'utf8')),
  );
}

test('every absolute in the locale files is inventoried — asserted or allowlisted, never merely typed (T397)', () => {
  const matched = new Set<string>();
  for (const name of LOCALES) {
    for (const [key, value] of Object.entries(locale(name))) {
      if (LEXICON[name].some((pattern) => pattern.test(value))) matched.add(key);
    }
  }

  const inventoried = new Set(Object.keys(INVENTORY));

  const unjustified = [...matched].filter((key) => !inventoried.has(key)).sort();
  expect(
    unjustified,
    'New absolute claim(s) with no INVENTORY entry. Read each string against the code that honours it, then add it as ASSERTED (name the test) or ALLOWED (state why it is true) — or take the absolute out. See this file\'s header for why.',
  ).toEqual([]);

  const stale = [...inventoried].filter((key) => !matched.has(key)).sort();
  expect(
    stale,
    'INVENTORY entries whose key no longer carries an absolute in any locale — remove them so the inventory stays honest.',
  ).toEqual([]);
});

/**
 * The T397 rewordings, pinned per locale — meaning, not prose (the
 * copy-claims.spec.ts rule): each regex matches the load-bearing clause, so
 * wording can be polished but the FACT cannot silently flip back. `forbidden`
 * is the shape of each claim that actually shipped false; restoring any of
 * them fails here.
 */
const REWORDED: Record<
  string,
  Record<Locale, { required: RegExp[]; forbidden: RegExp[] }>
> = {
  // False since ADR-0047 §3 showed a listed contact's email and phone to
  // every signed-in guest. Must carry both halves of the notice's facts.
  'profileModal.visibility.suffix': {
    en: {
      required: [/visible to the couple alone/i, /every signed-in guest/i],
      forbidden: [/shared with the couple only/i],
    },
    es: {
      required: [/solo los ven los novios/i, /iniciado sesión/i],
      forbidden: [/solo se comparten con la pareja/i],
    },
    fr: {
      required: [/visibles que des mariés/i, /connectée/i],
      forbidden: [/ne sont partagés qu['’]avec le couple/i],
    },
  },
  // GET /v1/profile returns every provisioned account, signed in or never.
  'people.subtitle': {
    en: { required: [/holds an account/i], forbidden: [/who (has|have) signed in/i] },
    es: { required: [/tienen cuenta/i], forbidden: [/han iniciado sesión/i] },
    fr: { required: [/poss[ée]dant un compte/i], forbidden: [/personnes connectées/i] },
  },
  // False since ADR-0015: the couple can edit any RSVP by role.
  'delegation.field.emptyGuest': {
    en: { required: [/nobody answers for you/i], forbidden: [/only you can reply/i] },
    es: { required: [/nadie responde por ti/i], forbidden: [/solo tú puedes responder/i] },
    fr: { required: [/personne ne répond pour vous/i], forbidden: [/vous seul/i] },
  },
  // The API answers 410 Gone after the configured deadline (rsvp.service.ts
  // assertDeadlineOpen) — "any time" is the deadline cluster's overclaim.
  'rsvp.create.confirm.yesMessage': {
    en: { required: [/until \{\{deadline\}\}/], forbidden: [/any ?time/i] },
    es: { required: [/hasta el \{\{deadline\}\}/], forbidden: [/cuando quieras/i] },
    fr: { required: [/jusqu['’]au \{\{deadline\}\}/], forbidden: [/à tout moment/i] },
  },
  'rsvp.create.attending.hint': {
    en: { required: [/until \{\{deadline\}\}/], forbidden: [/any ?time/i] },
    es: { required: [/hasta el \{\{deadline\}\}/], forbidden: [/cuando quieras/i] },
    fr: { required: [/jusqu['’]au \{\{deadline\}\}/], forbidden: [/à tout moment/i] },
  },
  // The editor hints promised unbounded switch-back; the data-preservation
  // half is true and kept, the time half is gone (a guest's write 410s after
  // the deadline; only the couple bypasses it).
  'rsvp.editor.attending.hint.coming': {
    en: { required: [/details stay/i], forbidden: [/any ?time/i] },
    es: { required: [/se conservan/i], forbidden: [/en cualquier momento|cuando quier/i] },
    fr: { required: [/restent enregistrés/i], forbidden: [/à tout moment|quand vous voulez/i] },
  },
  'rsvp.editor.attending.hint.comingPlusOne': {
    en: { required: [/details stay/i], forbidden: [/any ?time/i] },
    es: { required: [/se conservan/i], forbidden: [/en cualquier momento|cuando quier/i] },
    fr: { required: [/restent enregistrés/i], forbidden: [/à tout moment|quand vous voulez/i] },
  },
  'rsvp.editor.attending.hint.declined': {
    en: { required: [/switched back/i], forbidden: [/right up to the day/i] },
    es: { required: [/volver a marcarse/i], forbidden: [/hasta el mismo día/i] },
    fr: { required: [/redevenir présente/i], forbidden: [/jusqu['’]au jour j/i] },
  },
  'rsvp.editor.perspective.delegate.declinedHint': {
    en: { required: [/details are kept/i], forbidden: [/any ?time/i] },
    es: { required: [/se conservan/i], forbidden: [/en cualquier momento|cuando quier/i] },
    fr: { required: [/sont conservés/i], forbidden: [/à tout moment|quand vous voulez/i] },
  },
  'rsvp.editor.perspective.owner.declinedHint': {
    en: { required: [/details are kept/i], forbidden: [/any ?time/i] },
    es: { required: [/se conservan/i], forbidden: [/en cualquier momento|cuando quier/i] },
    fr: { required: [/sont conservés/i], forbidden: [/à tout moment|quand vous voulez/i] },
  },
};

test('the T397 rewordings state what is true now, per locale — and the false versions cannot come back', () => {
  for (const name of LOCALES) {
    const values = locale(name);
    for (const [key, claims] of Object.entries(REWORDED)) {
      const value = values[key];
      expect(value, `${name}.json is missing ${key}`).toBeDefined();
      for (const pattern of claims[name].forbidden) {
        expect(
          value,
          `${name}.json ${key} restores a claim T394 confirmed false (${pattern}) — see this file's header and T397's report`,
        ).not.toMatch(pattern);
      }
      for (const pattern of claims[name].required) {
        expect(
          value,
          `${name}.json ${key} must still carry the true clause (${pattern}) — "not false" is also satisfied by saying nothing`,
        ).toMatch(pattern);
      }
    }
  }
});
