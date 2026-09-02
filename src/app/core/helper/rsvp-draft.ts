import {
  RsvpDto,
  RsvpDtoAdultsPartner1,
  RsvpDtoAdultsPartner1Options,
  RsvpDtoAdultsPartner2,
  RsvpDtoChildrenInner,
} from '../api';
import { partnerHasAccount } from './partner-account';

/**
 * Editable in-memory shape of an RSVP. Its one editor is the shared
 * `app-rsvp-editor` (in-repo ADR W-0003), mounted by the guest's own
 * `app-rsvp-edit` screen and by the couple's `app-manage-rsvp-modal` in the
 * guest manager. Those two hosts own the draft signal and the `PATCH`; the
 * draft ⇄ DTO mapping lives here so it is written once for both.
 */

/** Addressable slot in a party — `partner1` is always the primary guest. */
export type PersonKey = 'partner1' | 'partner2' | `child:${number}`;

/**
 * One adult (partner1 or partner2). `id` is only ever known for `partner1`
 * (self) or a `partner2` who already has an account (server-linked on
 * `create`) — never edited, only carried forward so a save doesn't silently
 * drop an existing account link.
 */
export interface AdultDraft {
  readonly id?: string;
  firstName: string;
  lastName: string;
  /** Optional, max 30 characters client-side (DS `RSVPEditor.jsx`), shown in
   *  quotes beside the name — never in place of it. Locked read-only in the
   *  same case the name itself is (a `partner2` with their own account). */
  nickname?: string;
  options: RsvpDtoAdultsPartner1Options;
  /**
   * `partner2`'s discriminated-union tag on the wire — typed plain `string`,
   * the same type the generated `RsvpDtoAdultsPartner2OneOf`/`…OneOf1`
   * interfaces themselves give the field (the upstream Zod fix turned `kind`
   * into a per-variant `z.literal(...)`, which openapi-generator has no code
   * path to emit a type for; see ADR W-0004's amendment). Not a hand-written
   * union (CLAUDE.md Hard rule 15). Optional because this one type also
   * backs `partner1`, which never carries `kind`: `partner1` never has one
   * and `fromRsvpDraft` never emits one for it (ADR W-0004 §Decision.2).
   */
  kind?: string;
  /**
   * Independent decline flag — typed exactly as the generated
   * `RsvpDtoAdultsPartner1.attending` and **both** `partner2` variants'
   * `attending` already are (all three a plain required `boolean` since
   * `wedding-api` a97cbf2 / hub ADR-0040; CLAUDE.md Hard rule 15).
   * Meaningful on **either** adult slot whenever the party has two adults:
   * any adult, in a party of more than one, can decline independently of the
   * RSVP's own `status` (ADR W-0007 §Amendment, superseding the original
   * §Decision.1/.2 narrowing to `partner2`-only). That now includes a
   * `kind: 'plus-one'` `partner2`, which both carries the flag on the wire
   * like any other adult (`RsvpDtoAdultsPartner2OneOf1.attending`, no longer
   * omitted) and can have it set from the editor: a plus-one dropping out is a
   * decline that keeps the name, not a removal from the party (T339, closing
   * hub ADR-0040 §4). `partnerHasAccount()` no longer gates this; it still
   * gates whether the *name* is editable, which is a different question.
   * It does not exist at all for a **child**: the contract has no `attending`
   * on `RsvpDtoChildrenInner`, deliberately, because a child has no
   * independent answer to give (ADR-0040 §Decision). That is why
   * `canDeclineAlone()` below still gates structurally on which slot the key
   * names rather than deriving eligibility from the DTO shape alone.
   */
  attending: boolean;
}

/** Age is kept as free text while editing so an empty field reads as empty,
 *  not `0`; it is parsed to a number on save. */
export interface ChildDraft {
  firstName: string;
  age: string;
  /** Optional, max 30 characters client-side — see `AdultDraft.nickname`. */
  nickname?: string;
  options: RsvpDtoAdultsPartner1Options;
}

export interface RsvpDraft {
  status: RsvpDto.StatusEnum;
  readonly version: number;
  partner1: AdultDraft;
  partner2?: AdultDraft;
  children: ChildDraft[];
}

/** Placeholder for components that must initialise a draft signal before the
 *  real RSVP has landed (see `app-rsvp-edit`, `app-manage-rsvp-modal`). */
export const EMPTY_RSVP_DRAFT: RsvpDraft = {
  status: RsvpDto.StatusEnum.PENDING,
  version: 0,
  partner1: { id: '', firstName: '', lastName: '', options: {}, attending: false },
  children: [],
};

export function toRsvpDraft(rsvp: RsvpDto): RsvpDraft {
  const draft: RsvpDraft = {
    status: rsvp.status,
    version: rsvp.version,
    partner1: {
      id: rsvp.adults.partner1.id,
      firstName: rsvp.adults.partner1.firstName,
      lastName: rsvp.adults.partner1.lastName,
      nickname: rsvp.adults.partner1.nickname,
      options: rsvp.adults.partner1.options ?? {},
      // `RsvpDtoAdultsPartner1` is not a union and `attending` is a plain
      // required field, so no `in` check is needed (ADR W-0007 §Amendment;
      // required since hub ADR-0040).
      attending: rsvp.adults.partner1.attending,
    },
    partner2: rsvp.adults.partner2
      ? {
          id: 'id' in rsvp.adults.partner2 ? rsvp.adults.partner2.id : undefined,
          firstName: rsvp.adults.partner2.firstName,
          lastName: rsvp.adults.partner2.lastName,
          nickname: rsvp.adults.partner2.nickname,
          options: rsvp.adults.partner2.options ?? {},
          kind: rsvp.adults.partner2.kind,
          // Both arms of the union carry `attending` since hub ADR-0040 — the
          // plus-one `…OneOf1` no longer omits it — so this is plain access on
          // the union, no `in` check, same as partner1 above. (`id` above still
          // needs one: that field really does exist on only one arm.)
          attending: rsvp.adults.partner2.attending,
        }
      : undefined,
    children: (rsvp.children ?? []).map((c) => ({
      firstName: c.firstName,
      age: String(c.age),
      nickname: c.nickname,
      options: c.options ?? {},
    })),
  };

  return draft;
}

/**
 * Serialise a draft to the `Partial<RsvpDto>` the two save boundaries
 * (`app-rsvp-edit`, `app-manage-rsvp-modal`) `PATCH` to the API.
 *
 * This is **not** a plain serialiser: `status` is not carried through
 * verbatim from `draft.status`. It is passed through `impliedStatus` first,
 * which enforces the ADR W-0007 §Amendment2.5/§Amendment3 invariant
 * ("declined" only when every eligible adult has *explicitly* declined, and
 * absent flags are never treated as evidence) at the one seam both save
 * boundaries already go through, rather than trusting each caller to remember
 * to roll it up. See `impliedStatus`'s own doc comment for the rule itself.
 */
export function fromRsvpDraft(draft: RsvpDraft): Partial<RsvpDto> {
  const partner1: RsvpDtoAdultsPartner1 = {
    id: draft.partner1.id as string,
    firstName: draft.partner1.firstName.trim(),
    lastName: draft.partner1.lastName.trim(),
    nickname: draft.partner1.nickname?.trim() || undefined,
    options: draft.partner1.options,
    attending: draft.partner1.attending,
  };
  const partner2: RsvpDtoAdultsPartner2 | undefined = draft.partner2
    ? draft.partner2.id
      ? {
          id: draft.partner2.id,
          firstName: draft.partner2.firstName.trim(),
          lastName: draft.partner2.lastName.trim(),
          nickname: draft.partner2.nickname?.trim() || undefined,
          options: draft.partner2.options,
          kind: draft.partner2.kind as string,
          attending: draft.partner2.attending,
        }
      : {
          firstName: draft.partner2.firstName.trim(),
          lastName: draft.partner2.lastName.trim(),
          nickname: draft.partner2.nickname?.trim() || undefined,
          options: draft.partner2.options,
          kind: draft.partner2.kind as string,
          attending: draft.partner2.attending,
        }
    : undefined;
  const children: RsvpDtoChildrenInner[] = draft.children.map((c) => ({
    firstName: c.firstName.trim(),
    age: Number(c.age) || 0,
    nickname: c.nickname?.trim() || undefined,
    options: c.options,
  }));
  return {
    status: impliedStatus(draft),
    version: draft.version,
    adults: { partner1, partner2 },
    children,
  };
}

/** Apply `mutate` to one person's meal options, returning a new draft. */
export function withPersonOptions(
  draft: RsvpDraft,
  key: PersonKey,
  mutate: (options: RsvpDtoAdultsPartner1Options) => RsvpDtoAdultsPartner1Options,
): RsvpDraft {
  if (key === 'partner1') {
    return { ...draft, partner1: { ...draft.partner1, options: mutate(draft.partner1.options) } };
  }
  if (key === 'partner2' && draft.partner2) {
    return { ...draft, partner2: { ...draft.partner2, options: mutate(draft.partner2.options) } };
  }
  if (key.startsWith('child:')) {
    const index = Number(key.slice('child:'.length));
    return {
      ...draft,
      children: draft.children.map((c, i) =>
        i === index ? { ...c, options: mutate(c.options) } : c,
      ),
    };
  }
  return draft;
}

/**
 * The party label a delegate's RSVP hub card shows (hub ADR-0039 §7, T337):
 * derived from the RSVP's own `adults`, **never** from a relation to the
 * couple — this is what still names two people when a linked couple shares
 * one RSVP ("Ramón & Pilar Mendoza"), not a plural delegation. Takes either
 * `RsvpDto` or `RsvpListResponseDtoItemsInner`: both expose the identical
 * `adults` shape (`RsvpListResponseDtoItemsInnerAdults` is built from the
 * same `RsvpDtoAdultsPartner1`/`RsvpDtoAdultsPartner2` the plain `RsvpDto`
 * uses), so one function serves both the hub's own-reply card and its
 * per-delegation cards.
 */
export function partyLabel(rsvp: {
  adults: {
    partner1: { firstName: string; lastName: string };
    partner2?: { firstName: string; lastName: string };
  };
}): string {
  const p1 = `${rsvp.adults.partner1.firstName} ${rsvp.adults.partner1.lastName}`.trim();
  const partner2 = rsvp.adults.partner2;
  if (!partner2) return p1;
  const p2 = `${partner2.firstName} ${partner2.lastName}`.trim();
  return p2 ? `${p1} & ${p2}` : p1;
}

/** Toggle one catalog id inside a list-valued option field. */
export function toggleOptionId(
  options: RsvpDtoAdultsPartner1Options,
  field: 'dietaryPreferenceIds' | 'allergyIds',
  id: string,
): RsvpDtoAdultsPartner1Options {
  const current = options[field] ?? [];
  return {
    ...options,
    [field]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
  };
}

/**
 * How many adults in the party are still missing a first or last name?
 *
 * Every adult goes on the guest list under a full name, so both hosts of the
 * shared RSVP editor gate their save on this count (ADR W-0003 §Decision.7 —
 * one rule, replacing `RsvpEdit.unnamedCount` and `ManageRsvpModal.partnerNameOk`).
 * Children are never counted: they are listed by first name and age.
 *
 * A `partner2` whose name is owned by their own guest account is excluded —
 * that name is read-only in this UI (ADR W-0002 §Decision.3), so counting it
 * would leave the editor with a gate nobody can satisfy. `partner1` is always
 * counted: they are the signed-in guest themself, so they always carry an `id`
 * and the account-lock never applies to them (this mirrors `RsvpEdit`, which
 * hard-codes `hasAccount: false` for the primary card).
 */
export function unnamedAdultCount(draft: RsvpDraft): number {
  const adults: AdultDraft[] = [draft.partner1];
  if (draft.partner2 && !partnerHasAccount(draft.partner2)) adults.push(draft.partner2);
  return adults.filter((a) => !a.firstName.trim() || !a.lastName.trim()).length;
}

/**
 * Can this party member decline independently, leaving the RSVP's own
 * `status` and the rest of the party untouched?
 *
 * The design system's `rsvpCanDeclineAlone(p, people)` rule ("any adult with
 * their own account, in a party of more than one adult") applied literally to
 * this app's fixed two-adult-max shape (ADR W-0007 §Amendment, superseding
 * the original §Decision.1/.2 narrowing to `partner2`-only):
 * - `partner1` → `true` whenever `draft.partner2` exists. The primary always
 *   has an account, so there is no separate account check for this branch —
 *   **deliberately not** also requiring `partnerHasAccount(draft.partner2)`.
 *   This means `partner1` is eligible even when the only other adult is an
 *   account-less plus-one, which produces an odd state (that plus-one
 *   attending alone with no way to reach the app themselves). ADR W-0007
 *   §Amendment.3 accepts this knowingly as a consequence of following the DS
 *   rule literally, flagged to revisit if it proves wrong in practice — do
 *   not quietly add the stricter gate here.
 * - `partner2` → `true` whenever `draft.partner2` exists, **account or not**
 *   (T339). Hub ADR-0040 §4 asked whether a plus-one dropping out is the
 *   inviting partner removing them from the party or a decline that keeps the
 *   name; the answer recorded there is **a decline** — the name stays on the
 *   RSVP with `attending: false`, which is also what makes the now-required
 *   flag mean something on that member rather than being structurally always
 *   `true`. `partnerHasAccount()` is deliberately no longer consulted here: it
 *   still governs whether the *name* is editable (ADR W-0004), which is a
 *   different question from whether the person can decline.
 * - any child key → unchanged `false`, structurally: `RsvpDtoChildrenInner`
 *   has no `attending` field to toggle.
 *
 * The two adult branches are therefore the same test, and are written as one.
 */
export function canDeclineAlone(draft: RsvpDraft, key: PersonKey): boolean {
  if (key === 'partner1' || key === 'partner2') return !!draft.partner2;
  return false;
}

/**
 * Is this person coming? Absent or explicit `true` both mean "yes" — only an
 * explicit `false` means "no". Boolean mirror of the design system's
 * `rsvpComing(p)` (`p.attending !== 'no'`), specialised to this app's boolean
 * representation instead of the DS's `'yes' | 'no'` string.
 *
 * **On the parameter type.** It is `{ attending: boolean | undefined }`, not
 * `{ attending?: boolean }`: since hub ADR-0040 `attending` is required on
 * every adult member and `AdultDraft.attending` is non-optional to match, so a
 * member that structurally *lacks* the key is not a shape any caller can hand
 * in. The two `undefined`s that remain are each load-bearing:
 * - the outer one, because `draft.partner2` is genuinely optional (a party of
 *   one adult), and both call sites pass a slot straight through
 *   (`rsvp-editor.ts`, `isAttending`);
 * - the inner one, because an absent flag stays *reachable* even though it is
 *   no longer *representable*: stored RSVPs are not re-validated on read
 *   (ADR-0040 §1) and this bundle outlives any single API deploy (CLAUDE.md
 *   hard rule 17). `!== false` is therefore a defect tolerance, not a state —
 *   the reading is stated here rather than left to a crash in a computed that
 *   feeds a screen.
 *
 * This deliberately does **not** match `adultHeadCount()`'s `=== true` in
 * `statistic.service.ts`. The inputs differ: that one sums server DTOs into
 * the couple's totals and leaves a flagless seat out; this one reads *draft*
 * state in the guest's own editor, where the person is on screen and hiding
 * them would be the worse answer. The two only ever disagree about a member
 * the contract now forbids, so under ADR-0040 they never disagree at all.
 */
export function isPersonComing(person: { attending: boolean | undefined } | undefined): boolean {
  return person?.attending !== false;
}

/**
 * How many of the party are attending, once independent solo declines are
 * accounted for?
 *
 * Mirror of the design system's `rsvpAttending(v)`, specialised to this
 * app's fixed two-adult-max shape (`partner1` + optional `partner2` +
 * `children[]`) rather than a generic `people[]` walk: the total party size
 * (`1 + (partner2 ? 1 : 0) + children.length`, matching the editor's own
 * `total` computed) minus one for **each** adult who both `canDeclineAlone`
 * and has explicitly declined (`attending === false`) — so a party of two
 * adults who have both solo-declined counts 0 adults (plus any children).
 * Only a **child** can never reduce this count — a child structurally cannot
 * decline alone (see `canDeclineAlone` above). A plus-one `partner2` can,
 * since T339 / hub ADR-0040 §4.
 */
export function attendingCount(draft: RsvpDraft): number {
  const total = 1 + (draft.partner2 ? 1 : 0) + draft.children.length;
  const declinedAdults = (['partner1', 'partner2'] as const).filter(
    (key) => canDeclineAlone(draft, key) && draft[key]?.attending === false,
  ).length;
  return total - declinedAdults;
}

/**
 * What should `RsvpDto.status` be, given the per-adult `attending` flags
 * already on this draft? (ADR W-0007 §Amendment2.5, T328; corrected by
 * §Amendment3.8, T329 — see below.)
 *
 * `status` is not an independent axis from the per-adult flags — it is their
 * party-level roll-up: "did anyone from this party come?" But T328's first
 * cut treated an *absent* flag as evidence of "coming", which silently
 * reverted an already-declined RSVP (no per-adult flags at all — the common
 * shape for anything declined before this feature existed, per CLAUDE.md hard
 * rule 17) back to `attending` on the next save. §Amendment3.8 fixes this:
 * **absent flags are not evidence, in either direction.** This function acts
 * only on *explicit* flags, evaluated in this order:
 *
 * 1. `pending` is never touched — a party that has not answered has no
 *    declines to roll up, and promoting it would fabricate an answer the
 *    guest never gave.
 * 2. No eligible adult (`canDeclineAlone` false for both keys, e.g. a lone
 *    `partner1` with no `partner2`) ⇒ nobody to derive `status` from —
 *    `draft.status` stands as-is.
 * 3. Every eligible adult explicitly `attending === false` ⇒ `declined`.
 * 4. Otherwise, at least one eligible adult explicitly `attending === true`
 *    ⇒ `attending`.
 * 5. Otherwise — no eligible adult carries an *explicit* flag either way —
 *    `draft.status` stands unchanged. This is the clause that protects
 *    RSVPs already in production: a `status: declined` document with no
 *    per-adult flags at all stays `declined` rather than being promoted.
 *
 * Children never enter into it — they cannot decline (`RsvpDtoChildrenInner`
 * has no `attending` field). Both adult slots do, a plus-one `partner2`
 * included, since T339 / hub ADR-0040 §4 — so a party whose only second adult
 * is a declined plus-one rolls up like any other.
 *
 * This is now bidirectional in practice: `setStatus`
 * (`src/app/shared/rsvp-editor/rsvp-editor.ts`) writes the per-adult flags
 * when the guest uses the party-level status control, so the two
 * representations of one fact stay in sync instead of one silently
 * overwriting the other (§Amendment3.7).
 */
export function impliedStatus(draft: RsvpDraft): RsvpDto.StatusEnum {
  if (draft.status === RsvpDto.StatusEnum.PENDING) return draft.status;
  const eligible = (['partner1', 'partner2'] as const).filter((key) => canDeclineAlone(draft, key));
  if (eligible.length === 0) return draft.status;
  if (eligible.every((key) => draft[key]?.attending === false)) return RsvpDto.StatusEnum.DECLINED;
  if (eligible.some((key) => draft[key]?.attending === true)) return RsvpDto.StatusEnum.ATTENDING;
  return draft.status;
}
