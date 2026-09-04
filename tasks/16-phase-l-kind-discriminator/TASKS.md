## Phase L — The `kind` discriminator (live save bug) + the DS status-button rework

> Two independent upstream changes landed, and they are **not** equally urgent.
>
> **B — the API grew a `kind` discriminator on RSVP participants, and this repo is broken by it.**
> **`kind` is a `partner2` concern only — not a party-wide one.** This was rescoped by the API on
> 2026-08-23, *after* the first draft of this phase, and the narrowing is significant enough that
> anything you may remember about "every participant carries a `kind`" is now wrong:
>
> - `adults.partner2` is a discriminated union whose **both** variants require `kind`
>   (`'guest' | 'plus-one' | 'child'`), and whose second variant has **no `id`**. This is the whole
>   of the change as far as this repo is concerned.
> - `adults.partner1` has **no `kind`** (unchanged — the contract omits it for the primary guest).
> - **`children[]` no longer carries `kind` at all.** `RsvpChildrenParticipantSchema` now omits it
>   alongside `lastName`, so a child is `{ firstName, age, options? }`. There is nothing to stamp
>   on a child, and nothing in this phase may add one.
>
> **The committed generated client is one hunk stale.** `pnpm gen:api:check` reports drift in
> exactly one file — `src/app/core/api/model/rsvp-dto-children-inner.ts` loses its `kind` field and
> its `KindEnum` namespace (10 deletions); nothing else in the client moves. Regenerating is
> therefore **T270's first step**, not an optional hygiene item: it deletes four of the ten
> `typecheck` errors on its own.
>
> **Blocking dependency, check before regenerating:** the hub contract
> (`../wedding-architecture/contracts/openapi.json`) carries this re-sync **uncommitted**, as does
> `wedding-api/src/common/documents/rsvp.ts`. Do not run `pnpm gen:api` against a contract that is
> still moving — confirm the hub commit has landed (or that the user says to proceed against the
> working tree) and reference it in the PR.
>
> **`pnpm typecheck` is red at `HEAD`** — not in the brief that opened this phase, and worth
> stating plainly: 10 errors before regeneration, **6 after**, and every survivor is partner2's.
> Four sites read `.id` off a union whose second member does not have one
> (`core/helper/partner-account.ts:29`, `core/helper/rsvp-draft.ts:71`,
> `screens/invitee/invitee.ts:86`, `screens/rsvp/rsvp.ts:65`) and two are `rsvp-create.ts`'s
> `Omit<>`-derived `PartnerDraft` literals missing `kind` (L62, L77). T270 is therefore a
> build-restoring task, not only a payload fix — do not start anything else in this phase before
> it lands.
>
> **Read `docs/decisions/W-0004-rsvp-participant-kind-discriminator.md` first.** It pins the
> discriminator rule, why no legacy handling is implemented, why `partnerHasAccount()` stays a
> `boolean` rather than becoming a type predicate, and why the two `as unknown as
> RsvpDtoAdultsPartner2` casts are deleted rather than kept. It amends ADR W-0002 §Decision.1.
>
> **A — the design system reworked the RSVP status buttons** (`../wedding-ui-design`, commit
> `24e1259`). `RSVPEditor` gains `statusPending` (default `false`): "Pending" renders only when it
> is set, so the couple keeps three answers and the guest gets two. A muted reassurance line
> appears under the answer row when the answer is "no". And `ScreenRSVPEdit` changes materially:
> the editor now renders **always**, with `showStatus`, so a declined guest edits their status
> inline; "Change my answer" is gone; the eyebrow becomes `RSVP · CONFIRMED` / `RSVP · DECLINED`
> and the glyph `✓`/`—` follows the status.
>
> **One DS change is deliberately not adopted.** `ScreenRSVPEdit.jsx` L18 also makes the `<h2>`
> status-driven ("Your party" when attending, "Your reply" when declined). This repo does not
> follow it: Phase K decision 4 and ADR W-0003 §Decision.9 moved "Your party" *into* the editor,
> so adopting the DS literally would print "Your party" twice on the same screen. The host `<h2>`
> stays the single `rsvp.edit.title` = "Your reply" in both states. The status-driven **eyebrow**
> *is* adopted — that is what decision 4 said carries the status.
>
> Sequence: **T270 → T271 → T274 → T272 → T273.** B before A, because the save bug is live and the
> fix is in `core/helper`, which the DS work sits on top of. T274 (the "declining never prunes the
> party" invariant) is numbered last but **runs fourth**, before the two UI tasks: T272 ships the
> DS's promise that nothing is lost, and that promise has to be true before it is printed. T272
> and T273 both edit `public/i18n/{en,es,fr}.json` and are strictly serial — do **not** run them in
> parallel.
>
> **External dependency — the user owns it. Do not write a task for it and do not propose a fix.**
> Upstream, `z.discriminatedUnion('kind', [RsvpUserSchema, RsvpParticipantSchema])` still gives
> both members the same three-value `kind` enum. Zod v4 throws `Duplicate discriminator value
> "guest"` the first time that union is exercised (`zod/v4/core/schemas.js` L1152, reproduced
> against the real `zod@4.4.3`), so **any** payload containing a `partner2` fails server-side no
> matter what this repo sends. Sending `kind` is necessary but not sufficient. Recorded here only
> so the consequence for this phase is unambiguous: **no task may be gated on a live save round
> trip against a running API.** T270's proof is the payload shape, asserted in unit tests.

> **Phase L decisions (answered by the user, 2026-08-23).** All four open questions are resolved
> and **nothing in Phase L is blocked.** Recorded here because the task bodies cite them by number.
>
> 1. **Declining must never destroy the party — this is an invariant, not a preference.** The
>    user's answer was about the *model*, not the button: "a re-reply can hide the rest of the
>    participants but not the model behind. it should stay intact so 're-accepting' has to show
>    all the previously entered participants." So: `partner2` and `children`, with their meal
>    details, survive a decline in the draft, in the PATCH payload **and** in the stored document,
>    and switching back to "With joy" re-renders every participant the guest had entered. Removing
>    someone stays an explicit act. This is **T274**, and it is a real bug fix — `rsvp-create`'s
>    `submit()` drops `partner2` on a "sadly no" today. The DS's new reassurance line states this
>    promise in words, so the copy and the behaviour must agree before T272 prints it.
> 2. **A declined guest may edit their party — yes.** The host stops hiding the editor; the answer
>    row and the party are both live while declined. **Read with decision 1**, the two look like
>    they pull in different directions ("a re-reply can hide the rest"), so the DS settles it: in
>    `RSVPEditor.jsx` the party meta, the participant cards and the add links (L228–238) sit
>    **outside** the `showStatus` block and outside any status test, and `ScreenRSVPEdit.jsx` L26
>    renders the editor unconditionally. **The cards stay visible while declined.** Hiding them is
>    permitted by decision 1 but is *not* implemented — the binding half of that answer is the
>    non-destruction, which T274 guarantees.
> 3. **No legacy `kind` handling — the backend already migrated the stored documents.** `kind` is
>    always present on the wire, so `partnerHasAccount()` is `kind === 'guest'` with **no `id`
>    fallback** and `toRsvpDraft()` needs no defaults. ADR W-0004 §Decision.3 records the removed
>    rule and why, so nobody reintroduces it as a "safety" branch.
> 4. **The app header follows the status too.** One key pair drives both the on-screen eyebrow and
>    the `HeaderService` effect, so the chrome and the page can never disagree; a declined guest's
>    header reads "RSVP · DECLINED".
>
> **Still binding, unchanged from Phase K:** no user-facing copy may be re-worded on an
> implementer's initiative — flag it, do not change it.

### T270 — Regenerate the API client and carry `kind` on `partner2`

- **Status:** done (`462b933`, `cc868d2`) — 2026-08-23. Regeneration confirmed as the predicted
  single hunk (`rsvp-dto-children-inner.ts` loses `kind`/`KindEnum`; nothing else moved), committed
  alone. `AdultDraft` gained an optional `kind` typed off the generated
  `RsvpDtoAdultsPartner2OneOf.KindEnum`; `toRsvpDraft`/`fromRsvpDraft` carry it with no defaulting
  and no cast to the union (the old `as unknown as RsvpDtoAdultsPartner2` casts and their
  now-false `// reason:` comments are gone); a partner typed into `rsvp-create`/`rsvp-editor` is
  stamped `'plus-one'`; `children` untouched. `partnerHasAccount()` kept its `id`-based semantics
  behind an `in` check (discriminator switch is T271, deliberately out of scope here). Verified
  independently: `pnpm typecheck` clean, `pnpm lint` only the 4 known `shared/modal/` errors,
  `pnpm test` 46/46 (5 new specs in `rsvp-draft.spec.ts`). No live save round-trip attempted — the
  external Zod discriminator defect is out of this repo's scope (ADR W-0004).
- **Owner:** agent (implementer)
- **Depends on:** the hub contract re-sync landing in `../wedding-architecture` (see the preamble)
- **Context:** The live save bug, and the reason `pnpm typecheck` is red at `HEAD`. Two things are
  wrong and they must be fixed in that order: the committed client is one hunk behind the
  re-synced contract (children lost their `kind`), and the two write paths that build `partner2`
  do not send its `kind`. Regenerating first is not housekeeping — it deletes four of the ten
  `typecheck` errors, and hand-fixing them instead would mean writing code against a model the
  contract no longer has. **`children` are out of scope entirely: a child is
  `{ firstName, age, options? }` and carries no `kind` — do not add one, anywhere, in any form.**
  This is deliberately one PR even though it spans `core/api`, `core/helper`, one screen and the
  shared editor: a partial fix does not compile. Model change only — no visible UI change, no i18n
  change.
- **Acceptance:**
  - **First commit, on its own: `pnpm gen:api`.** The only file that changes is
    `src/app/core/api/model/rsvp-dto-children-inner.ts`, which loses its `kind` field and its
    `KindEnum` namespace (10 deletions). If anything else moves, stop and report — the contract
    moved under you. Reference the hub commit that carries the re-sync in the PR, and state that
    `pnpm gen:api:check` is clean afterwards. Nothing in `src/app/core/api/` is hand-edited
    (CLAUDE.md folder ownership).
  - `AdultDraft` in `src/app/core/helper/rsvp-draft.ts` gains an **optional** `kind`, typed with
    the **generated** `RsvpDtoAdultsPartner2OneOf.KindEnum` — **no hand-written
    `'guest' | 'plus-one' | 'child'` union anywhere** (CLAUDE.md Hard rule 15). Optional because
    the one type serves both adult slots and `adults.partner1` carries no `kind`; the doc comment
    records the invariant the type cannot express — *`kind` is a `partner2` field; `partner1`
    never has one and `fromRsvpDraft` never emits one for it*. **`ChildDraft` is not touched and
    gains nothing.** `EMPTY_RSVP_DRAFT` is unchanged.
  - `toRsvpDraft()` reads `partner2.kind` straight through — **no defaulting, no `??`, no
    inference** (decision 3: the backend migrated the stored documents, so `kind` is always on the
    wire; ADR W-0004 §Decision.3 records why a fallback must not be added back). It reads
    `partner2.id` via an `in` check (`'id' in p ? p.id : undefined`), the only narrowing the union
    supports. Its `children` mapping is unchanged.
  - `fromRsvpDraft()` emits `kind` on `partner2` and **omits it on `partner1` and on every
    child**. **Both `as unknown as RsvpDtoAdultsPartner2` casts and their now-false `// reason:`
    comments** (`rsvp-draft.ts` L93–103, `rsvp-create.ts` L292–300) are deleted: the object is
    built as `…OneOf` when an `id` is carried forward and `…OneOf1` when not, and assigns to the
    union with no cast. The finished diff contains no `as unknown as`, no `any` and no
    `@ts-expect-error` for this model.
  - `screens/rsvp-create/rsvp-create.ts` compiles and sends `kind` **for the partner only**: its
    `Omit<>`-derived `PartnerDraft` inherits the required field, so `EMPTY_DRAFT.partner` (L62)
    and `toCreateDraft()` (L77) supply it and `submit()` sends it — a typed-in partner is
    `'plus-one'`, and a server-linked `partner2` carried forward from `rsvp.adults.partner2` is
    passed through untouched, never re-stamped. Its `ChildDraft`, `toggleWithChildren()`,
    `addChild()` and the `children` payload need **no change** — they satisfy the regenerated
    type again.
  - `shared/rsvp-editor/rsvp-editor.ts`: `addPartner()` stamps `'plus-one'` on the draft it
    creates. `addChild()` is **unchanged**. No other change to the component.
  - The four `.id` reads compile without casts: `core/helper/partner-account.ts:29`,
    `core/helper/rsvp-draft.ts:71`, `screens/invitee/invitee.ts:86`, `screens/rsvp/rsvp.ts:65`.
    `partnerHasAccount()` keeps its **`id`-based semantics** in this task — the discriminator
    switch is T271, and mixing the two would hide which change caused a behaviour difference.
  - `rsvp-draft.spec.ts` covers: a `partner2.kind` present on the DTO survives `toRsvpDraft` →
    `fromRsvpDraft` unchanged; a plus-one `partner2` serialises with `kind: 'plus-one'` and **no
    `id` key at all**; a linked `partner2` keeps both its `id` and `kind: 'guest'`; `partner1`
    never carries `kind`; and **a serialised child has no `kind` property** — a guard against
    re-adding one out of symmetry. Fixtures in `partner-account.spec.ts`, `rsvp-editor.spec.ts`,
    `manage-rsvp-modal.spec.ts` and `rsvp-edit.spec.ts` are updated only where the compiler
    demands it, with no assertion changed.
  - `pnpm typecheck && pnpm lint && pnpm test` green. **`typecheck` is red before this task** —
    10 errors at `HEAD`, 6 after the regeneration commit, 0 at the end; report those three numbers
    in the PR. Lint: the 4 known `shared/modal/` errors only. Do **not** claim a verified
    end-to-end save — see the external dependency in the phase preamble.
- **Refs:** in-repo ADR W-0004 (whole document), ADR W-0002 §Decision.1;
  `src/app/core/api/model/rsvp-dto-adults-partner2{,-one-of,-one-of1}.ts`,
  `rsvp-dto-children-inner.ts` (regenerated here); `src/app/core/helper/rsvp-draft.ts`;
  `src/app/screens/rsvp-create/rsvp-create.ts`; `src/app/shared/rsvp-editor/rsvp-editor.ts`;
  `wedding-api/src/common/documents/rsvp.ts`; hub `contracts/openapi.json`, ADR-0024

### T271 — Move `partnerHasAccount()` onto `kind` (no `id` fallback)

- **Status:** done (`db05a48`) — 2026-08-23. `partnerHasAccount()` is now
  `partner?.kind === RsvpDtoAdultsPartner2OneOf.KindEnum.GUEST`, no `id` fallback, no `??`
  default, signature and three input types unchanged, still a plain `boolean` (both reasons from
  ADR W-0004 §Decision.4 in the doc comment). `partner1` now answers `false` where the old `id`
  rule answered `true` — stated in the doc comment; no caller passes `partner1`. Call sites
  confirmed unchanged in shape by grep (`rsvp-draft.ts` `unnamedAdultCount`, `rsvp-editor.ts`
  `nameLocked`/`accountId`/`partner2NameLocked`, `rsvp-create.ts` L176, `guest-profile-modal.html`,
  `guest-manager.html`); a `kind: 'guest'` partner now locks their name with no `id`, while "Open
  their profile" still gates on `canOpenProfile()`'s `accountId` check. `partner-account.spec.ts`
  rewritten per the acceptance list; two stale "empty/blank id" cases removed. ADR W-0002 not
  edited. Verified independently: `pnpm typecheck` clean, `pnpm lint` only the 4 known
  `shared/modal/` errors, `pnpm test` 47/47.
- **Owner:** agent (implementer)
- **Depends on:** T270
- **Context:** ADR W-0002 §Consequences predicted this task word for word: "`partnerHasAccount` is
  the single place to change if the contract ever gains a real discriminator (e.g. a `kind`
  field), instead of five call sites." It has, so this is that one change — the helper's body and
  doc comment, nothing else. Its five callers (`rsvp-editor`'s `nameLocked`/`accountId`,
  `rsvp-create` L173, `unnamedAdultCount`, and the guest-manager modals through the editor) keep
  their shape. Kept separate from T270 on purpose: T270 makes the app compile and send the right
  bytes without changing any behaviour, and this task changes exactly one behaviour, so a
  regression has one suspect.
- **Acceptance:**
  - `partnerHasAccount()` returns `true` when `kind === 'guest'` and `false` otherwise — including
    for an explicit `'plus-one'` or `'child'` **carrying a stale `id`**, and for a missing `kind`.
    **There is no `id` fallback and no `??` default** (decision 3: the backend migrated the stored
    documents; ADR W-0004 §Decision.1, §Decision.3). The body should end up a one-liner.
  - It stays a plain `boolean`, **not** a `partner is …OneOf` type predicate — and the doc comment
    gives the two reasons, because "the union has a discriminator now, so narrow on it" is the
    obvious wrong move here (ADR W-0004 §Decision.4): (a) openapi-generator gives **both** union
    members the same full three-value `KindEnum`, so neither has a unit-typed discriminator and
    `kind === 'guest'` eliminates neither member — a predicate would be an unchecked assertion,
    not a narrowing; (b) the helper also accepts `AdultDraft` and the profile partner type, so
    narrowing to a generated API interface would be unsound at the sites that pass one. Its
    signature and its three accepted input types are unchanged. No new `type`/`interface`.
  - **`partner1` now answers `false`** where the `id` rule answered `true` (it carries no `kind`).
    No caller passes `partner1` — `unnamedAdultCount` asks only about `partner2` and the editor
    hard-codes `nameLocked: false` for the primary card — so this changes no behaviour, but it is
    stated in the doc comment and in the PR so it is not later mistaken for a regression.
  - The doc comment's description of the old model ("an OpenAPI `anyOf` whose **only**
    discriminator is the presence of `id`", the merge-artifact paragraph) is rewritten to the
    current one and points at ADR W-0004. **ADR W-0002 itself is not edited** — W-0004 already
    records that it amends §Decision.1, and a superseded ADR is amended by reference, never
    rewritten in place (hub coordination protocol).
  - Behaviour at the call sites is stated explicitly in the PR, backed by a grep of
    `partnerHasAccount(`: a `kind: 'guest'` partner locks their name even with no `id`, while the
    couple's "Open their profile" jump still requires a real `accountId` (`rsvp-editor.ts` L193,
    `canOpenProfile()`) — a locked name without an id renders the hint and no link.
  - `partner-account.spec.ts` covers: `kind: 'guest'` with no `id` → true; `kind: 'plus-one'`
    **with** an `id` → false (the id no longer wins); no `kind` at all, with or without an `id` →
    false; `null`/`undefined` → false; and the
    `UserProfileListResponseDtoProfilesInnerGuestInfoPartner` variant (still a merged interface)
    with `kind: 'guest'` → true. The two existing "empty/blank `id`" cases are **replaced**, not
    kept — they tested a rule that no longer exists.
  - No template, SCSS or i18n file is touched.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** in-repo ADR W-0004 §Decision.1, §Decision.4; ADR W-0002 §Decision.1, §Consequences;
  `src/app/core/helper/{partner-account.ts,partner-account.spec.ts,rsvp-draft.ts}`;
  `src/app/shared/rsvp-editor/rsvp-editor.ts` (L192–193, L307–309);
  `src/app/screens/rsvp-create/rsvp-create.ts` L173

### T272 — `app-rsvp-editor`: `statusPending` input + the "sadly no" reassurance line

- **Status:** done (`742f9ba`) — 2026-08-23. `statusPending = input(false)`; `statuses` is now a
  `computed` yielding `[attending, pending, declined]` when true, `[attending, declined]` when
  false, still off `RsvpDto.StatusEnum`. `showDeclinedHint` computed gates a new `.declined-hint`
  line — `showStatus() && status === DECLINED` — composed via `perspectiveKey('declinedHint')`,
  no English literal, no perspective `switch`. `manage-rsvp-modal.html` gained
  `[statusPending]="true"` next to `[showStatus]="true"`; no other call site touched. New
  `perspective.{owner,couple}.declinedHint` key added to all three `public/i18n/*.json` — English
  verified verbatim from the DS line, es/fr real translations, key sets symmetric. Verified
  independently: `pnpm typecheck` clean, `pnpm lint` only the 4 known `shared/modal/` errors,
  `pnpm test` 52/52.
- **Owner:** agent (implementer)
- **Depends on:** T271
- **Context:** DS `RSVPEditor.jsx` L107, L217–227 (commit `24e1259`). The answer row splits in
  two: "With joy" / "Sadly no" always render under `showStatus`, and "Pending" renders **only**
  when the new `statusPending` flag is set. Both guest-manager screens pass
  `showStatus statusPending`; the guest screen passes `showStatus` alone. A muted reassurance line
  appears under the row when the answer is "no", with different wording per perspective. This task
  is the component change **plus** the couple's call site, so the couple's editor is unchanged in
  behaviour when it lands — the guest side arrives in T273. It edits `public/i18n/*.json`; T273
  does too, so the two are strictly serial.
- **Acceptance:**
  - `app-rsvp-editor` gains `statusPending = input(false)`. The hard-coded `statuses` array
    becomes a `computed` that yields `[attending, pending, declined]` when `statusPending()` is
    true and `[attending, declined]` when it is false — the DS order is preserved, and the values
    still come from `RsvpDto.StatusEnum`, never from a local union.
  - A draft whose status is `pending` while `statusPending()` is false renders the row with
    **neither** answer selected. The editor does **not** silently rewrite the draft on render —
    it emits only in response to a user action (this is a controlled component, ADR W-0003
    §Decision.1).
  - A reassurance line renders under the answer row when — and only when — `showStatus()` is true
    and the draft's status is `declined`. Copy comes from a new per-perspective key
    `rsvp.editor.perspective.<p>.declinedHint`; the component composes it exactly as it composes
    the other perspective keys (`perspectiveKey('declinedHint')`), with no English literal in the
    template and no perspective `switch` in TypeScript.
  - New key in **all three** `public/i18n/{en,es,fr}.json`, purely additive, key sets identical
    afterwards. English is **verbatim from the DS** (L225), so it needs no copy sign-off:
    `perspective.owner.declinedHint` = "Your party and meal details are kept — switch back any
    time and nothing is lost."; `perspective.couple.declinedHint` = "Party and meal details are
    kept — switching back changes nothing else." es/fr are real translations in each file's
    existing voice. No existing string is re-worded (standing rule, end of Phase K).
  - Styling per the DS: small muted text (`t.$text-micro`, `var(--text-muted)`, `line-height:
    1.5`) in `rsvp-editor.scss`, semantic aliases only — no hex, no raw `--sub`, no new
    breakpoint, no inline style.
  - `manage-rsvp-modal.html` binds `[statusPending]="true"` alongside its existing
    `[showStatus]="true"`, so the couple still sees three answers. **No other call site changes in
    this task** — the guest screen still passes no `showStatus` until T273.
  - `rsvp-editor.spec.ts` covers: `showStatus` + `statusPending` false → two choice cards, and
    the `rsvp.editor.choice.pending` label is absent from the DOM; `statusPending` true → three;
    `showStatus` false → no row and no hint whatever the status; status `declined` + `showStatus`
    → the hint renders and its text is the *perspective's* string (assert `owner` and `couple`
    differ); status `attending` or `pending` → no hint. `manage-rsvp-modal.spec.ts` asserts the
    couple still gets three answers.
  - Component validates against the design spec
    (`../wedding-ui-design/ui_kits/wedding-app/RSVPEditor.jsx` L217–227).
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** DS `ui_kits/wedding-app/RSVPEditor.jsx` (commit `24e1259`, L107 signature, L217–227
  render), `ScreenGuestManager.jsx` L307, `ScreenGuestManagerMobile.jsx` L206; in-repo ADR W-0003
  §Decision.1, §Decision.4; `src/app/shared/rsvp-editor/rsvp-editor.{ts,html,scss,spec.ts}`;
  `src/app/screens/guest-manager/modal/manage-rsvp-modal.{html,spec.ts}`;
  `public/i18n/{en,es,fr}.json`

### T273 — Guest RSVP screen: inline status editing, status-driven eyebrow, no "Change my answer"

- **Status:** done (`4d045c4`) — 2026-08-23. `app-rsvp-editor` renders unconditionally with
  `[showStatus]="true"`, no `statusPending`; the `@if (draft().status !== 'declined')` wrapper is
  gone, so the party stays visible while declined (no status conditional added around it). "Change
  my answer" removed end to end — `rsvp-edit.{html,scss,ts}`'s button/SCSS/output, and
  `screens/rsvp/`'s `(changeAnswer)` binding, `onChangeAnswer()`, and the `forceCreate` signal
  (incl. `&& !forceCreate()`); `onSubmitted()`/`(submitted)` also removed as dead once
  `forceCreate` no longer needs resetting (flagged explicitly — not in the original acceptance
  list, but entailed). `app-rsvp-create` confirmed still reachable for a `pending` record, asserted
  in new `rsvp.spec.ts`. Eyebrow split into `rsvp.edit.eyebrow.{confirmed,declined}` across all
  three i18n files, consumed by both the template and the `HeaderService` effect. Check glyph
  follows status via `[class.declined]`, no inline style. `<h2>` deliberately untouched — stays
  `rsvp.edit.title`, the DS's status-driven `<h2>` is a documented non-adoption (ADR W-0003
  §Decision.9). **Manual cross-browser/theme verification not performed — no browser available in
  this environment**, stated plainly rather than claimed. Verified independently: `pnpm typecheck`
  clean, `pnpm lint` only the 4 known `shared/modal/` errors, `pnpm test` 60/60.
- **Owner:** agent (implementer)
- **Depends on:** T272 (and, in run order, T274 — this screen ships the promise T274 makes true)
- **Context:** DS `ScreenRSVPEdit.jsx` is now 55 lines and materially different: the editor
  renders **always**, with `showStatus` (and without `statusPending`, so the guest gets two
  answers — a guest may not park their own reply back on "pending"); the "Change my answer" button
  is gone; the eyebrow reads `RSVP · CONFIRMED` / `RSVP · DECLINED`; the glyph is `✓` in the
  accent when attending and `—` muted when declined. This is the visible half of Phase L and the
  only task in it that changes what a guest sees. It also removes a navigation path — decisions 1,
  2 and 4 (above) settle that and are cited per criterion below.
- **Acceptance:**
  - `rsvp-edit.html` renders `<app-rsvp-editor … [showStatus]="true">` **unconditionally** —
    the `@if (draft().status !== 'declined')` wrapper and its comment are deleted (decision 2).
    `statusPending` is **not** bound, so the guest sees exactly "With joy" and "Sadly no", and
    the T272 reassurance line appears when they choose "Sadly no".
  - **The participant cards stay visible while declined** — the editor is rendered whole, not
    trimmed. The DS settles this rather than leaving it to taste: in `RSVPEditor.jsx` the party
    meta line, the cards and the add links (L228–238) sit **outside** the `showStatus` block and
    outside any status test, and `ScreenRSVPEdit.jsx` L26 renders the editor unconditionally.
    Decision 1 permits hiding them but does not ask for it, and its binding half — that nothing is
    destroyed — is T274's, not this task's. Do **not** add a status conditional around the party.
  - "Change my answer" is removed end to end (decision 1's UI half): the button and `.change-answer`
    SCSS rule in `rsvp-edit.{html,scss}`, `onChangeAnswer()` and the `changeAnswer` output in
    `rsvp-edit.ts`, and in the parent `screens/rsvp/`: the `(changeAnswer)` binding,
    `Rsvp.onChangeAnswer()` and the `forceCreate` signal — including the `&& !forceCreate()`
    condition in `rsvp.html` L3. `rsvp.edit.changeAnswer` is deleted from all three i18n files
    after a grep proves it dead. **`app-rsvp-create` must stay reachable** for a `pending` record
    (`rsvp.html` L5–7): assert it, in the spec and in the PR description.
  - The eyebrow becomes status-driven (decision 4). The leaf key `rsvp.edit.eyebrow` is
    replaced by `rsvp.edit.eyebrow.confirmed` / `rsvp.edit.eyebrow.declined` in all three i18n
    files; **both** consumers move to the pair — the template eyebrow *and* the `HeaderService`
    effect in `rsvp-edit.ts` L77–80 — so the app header and the page can never disagree. English
    comes verbatim from the DS (`ScreenRSVPEdit.jsx` L17): "CONFIRMED" / "DECLINED". es/fr for
    `.confirmed` are today's `rsvp.edit.eyebrow` values copied across verbatim (no new
    translation); `.declined` is newly translated. Values stay in the shipped register —
    `%eyebrow` already applies `text-transform: uppercase`, so do not change the casing of the
    existing string while moving it.
  - The check glyph follows the status: `✓` in `var(--brand-accent)` when attending, `—` in
    `var(--text-muted)` when declined. Implemented with a class binding
    (`[class.declined]="…"`) and a rule in `rsvp-edit.scss` — **no inline `style`, no `ngStyle`**
    (CLAUDE.md rule 2). It stays `aria-hidden="true"`: the status is already announced by the
    eyebrow and the subtitle.
  - **The `<h2>` is not touched.** It stays the single `rsvp.edit.title` ("Your reply") in both
    states. The DS's status-driven `<h2>` (`ScreenRSVPEdit.jsx` L18, "Your party" when attending)
    is a **deliberate non-adoption**, recorded in the PR description: Phase K decision 4 and ADR
    W-0003 §Decision.9 moved "Your party" into the editor, so following the DS here would render
    it twice. `declinedSub` and `seatsHeld` are unchanged and still carry the status.
  - `rsvp-edit.spec.ts` covers: a `declined` RSVP now renders `app-rsvp-editor` (it previously
    did not); the editor receives `showStatus` true and `statusPending` false/unset; the eyebrow
    reads the `.declined` key when declined and `.confirmed` when attending; the glyph element
    carries the declined class and renders `—`; no "Change my answer" control exists in the DOM;
    the existing save / dirty / unnamed-gate assertions still pass unchanged. Add or extend an
    `app-rsvp` assertion that a `pending` RSVP still routes to `app-rsvp-create`.
  - The three i18n files stay structurally identical (same key set) and valid JSON; no screen
    renders a raw key in any of the three languages.
  - Verified by hand at mobile and desktop widths in all three themes: switch "With joy" ⇄ "Sadly
    no" and watch the eyebrow, subtitle, glyph and reassurance line change together; edit the
    party while declined; save, reload, and confirm the whole party is still listed (the T274
    invariant, seen from the guest's side — if this fails, T274 did not land or regressed). If no
    browser is available, say so plainly rather than marking it done.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** DS `ui_kits/wedding-app/ScreenRSVPEdit.jsx` (commit `24e1259`, L13–28); in-repo ADR
  W-0003 §Decision.2, §Decision.9; Phase K decision 4 (above);
  `src/app/screens/rsvp-edit/rsvp-edit.{ts,html,scss,spec.ts}`;
  `src/app/screens/rsvp/{rsvp.ts,rsvp.html}`; `public/i18n/{en,es,fr}.json`; hub SPEC J2.5

### T274 — Declining an RSVP must never drop the party

> **Run order note (2026-08-23):** T274 is numbered last but runs **fourth** — after T271 and
> **before** T272/T273. T272 prints the DS line "Your party and meal details are kept — switch
> back any time and nothing is lost"; that sentence must be true before it ships. Numbered here
> rather than inserted mid-phase because the phase's numbering was already published.

- **Status:** done (`f797c4f`) — 2026-08-23. `submit()` now branches on `d.attending === 'no'`
  first: `partner2 = rsvp.adults.partner2` and `children = rsvp.children` verbatim, `status` the
  only field that changes. The `d.attending === 'yes'` branch keeps the prior
  `withPartner`/`withChildren` gating unchanged, so explicit removal still removes. Added the named
  regression spec (`it('keeps the party on a declined save')`) and a draft-layer round-trip spec
  (attending → decline → attending, partner2/children/options identical throughout) to
  `rsvp-draft.spec.ts`. Guest-manager side verified by inspection, not changed:
  `manage-rsvp-modal.ts:188` saves via `...fromRsvpDraft(this.draft())` unconditionally; grep for
  `status === 'declined'` / `StatusEnum.DECLINED` across `src/` turns up only a status-dropdown
  option list (`rsvp-editor.ts:143`), an `attendingFromStatus` read, and this task's own `status`
  assignment — no branch anywhere prunes participants. `pnpm typecheck && pnpm lint && pnpm test`
  green (the 4 pre-existing `shared/modal/` lint errors only, per CLAUDE.md's carve-out).
- **Owner:** agent (implementer)
- **Depends on:** T270 (it edits the same two write paths; landing after avoids a conflict)
- **Context:** Phase L decision 1, and a real data-loss bug rather than a nicety. Declining is a
  change of *answer*, not a deletion of the party — the guest must be able to switch back and find
  everyone they entered, with their meal details. `fromRsvpDraft()` already behaves (it emits
  `partner2` and `children` whatever the status), so the fix is one path plus two regression
  guards. `rsvp-create.submit()` is the offender: `partner2` and `children` are both gated on
  `d.attending === 'yes'`, so a "sadly no" sends `adults: { partner1 }` with the `partner2` key
  absent — which replaces the stored `adults` object and destroys a server-linked partner. Note
  the asymmetry that makes this easy to misdiagnose: `children` survives the same code path *by
  accident*, because an omitted top-level key leaves the stored array untouched (the API's
  `RsvpDocumentSchema` deliberately has no default on `children`), while `adults` is sent and so
  is replaced. Fixing only what is visibly broken would leave the two halves inconsistent again.
- **Acceptance:**
  - `rsvp-create.submit()` carries the party forward on a decline: when `d.attending === 'no'`,
    `adults.partner2` and `children` are sent as whatever the RSVP already holds
    (`rsvp.adults.partner2`, `rsvp.children`), not `undefined`. Only `status` changes.
  - **Explicit removal still removes.** Un-ticking "With my partner" or "With children" *while
    attending*, and the editor's per-card remove control, are unchanged — the preservation rule
    applies to the decline path alone. Today's single `d.attending === 'yes' && d.withPartner`
    condition conflates the two; separate them rather than widening one.
  - `fromRsvpDraft()` is covered by a **named regression spec** — `it('keeps the party on a
    declined save')` or equivalent — asserting that a draft with a `partner2` and two children,
    status `declined`, still serialises both, with their `options` intact. It passes before the
    change; that is the point. It exists so a future "a declined RSVP has no party" simplification
    fails loudly.
  - A round-trip spec for the invariant, at the draft layer where it can be asserted without a
    live API: draft with a full party → set status `declined` → `fromRsvpDraft` →
    `toRsvpDraft` of the resulting DTO → set status back to `attending` → the party is identical
    (same partner, same children, same `dietaryPreferenceIds`/`allergyIds`/`customAllergies`).
  - The guest-manager side is verified by inspection, not changed: the couple's modal saves
    through `fromRsvpDraft()` and so already preserves — say so in the PR, with the grep that
    shows no other `status === 'declined'` branch prunes participants anywhere in `src/`.
  - No UI change, no i18n change, no new type, no `pnpm gen:api`.
  - `pnpm typecheck && pnpm lint && pnpm test` green. Do **not** claim a verified server round
    trip — the upstream Zod defect in the phase preamble still blocks any `partner2` save.
- **Refs:** in-repo ADR W-0004 §Decision.6; Phase L decision 1; DS `RSVPEditor.jsx` L225 (the
  promise being made); `src/app/screens/rsvp-create/rsvp-create.ts` (`submit()`, L286–311);
  `src/app/core/helper/{rsvp-draft.ts,rsvp-draft.spec.ts}`;
  `wedding-api/src/common/documents/rsvp.ts` (why an omitted `children` survives but a sent
  `adults` does not)

> **Phase L reopens, 2026-08-23, same day it closed.** The external Zod duplicate-discriminator
> defect that T270–T274 were built around (phase preamble, "External dependency — the user owns
> it") is **fixed upstream** — the same day, by the same author who owned it. The fix changes the
> generated client's shape in ways that break every `KindEnum` reference T270/T271 wrote. This is
> not a new defect and not scope creep on the couple's or guest's side: it is the follow-through
> that ADR W-0004's "Recorded external dependency" section always said would be needed once the
> dependency resolved. **ADR W-0004 has already been amended** (a new "Amendment (2026-08-23)"
> section plus inline superseded-notes on §Decision.2, §Decision.4, the Context note, and the
> "Recorded external dependency" section, which is now marked resolved) — read it before starting
> T275; it settles the reasoning so T275 does not have to re-argue it.

### T275 — Follow the upstream Zod-discriminator fix: `kind` degrades to `string`, `partner1` gains `attending?`

- **Status:** done (`3f0b718`, `5dc71a6`) — 2026-08-23. Regeneration matched the tripwire exactly
  (verified independently): `partner1` gained `attending?`; both partner2 variants' `kind` became
  plain `string` with their `KindEnum` namespaces gone; the profile-partner `AnyOf`/`AnyOf1`/merged
  files swapped which carries `id`/`attending` and lost their own `KindEnum` block the same way.
  All eleven call sites across the eight named files switched to direct `'guest'`/`'plus-one'`
  string-literal comparison/assignment; `AdultDraft.kind` retyped plain optional `string`; the
  now-unused `RsvpDtoAdultsPartner2OneOf` import dropped everywhere it was only used for
  `.KindEnum`. Both "needs no code change" claims confirmed by grep, not assumed: the split
  profile-partner variants have zero consumers outside `core/api/`, and nothing reads or writes
  `partner1.attending` anywhere in `src/`. No behaviour, `.html`, or `.scss` change. Baseline
  `pnpm typecheck` at true `HEAD` was 0 errors (the committed client still matched the code
  written against it); 0 after too — the regeneration and the fix landed as two atomic, each
  individually clean commits. Verified independently: `pnpm typecheck` clean, `pnpm lint` only the
  4 known `shared/modal/` errors, `pnpm test` 60/60, `pnpm gen:api:check` clean.
- **Owner:** agent (implementer)
- **Depends on:** T270, T271, T272, T273, T274 — **all done**, landed 2026-08-23. This task does
  not build on any incomplete work; it is a pure follow-up to a shape change in a dependency T270
  already integrated once.
- **Context:** The API fixed the Zod bug the phase preamble flagged as out of scope by giving each
  `adults.partner2` variant its own `z.literal('guest')` / `z.literal('plus-one')` instead of
  sharing a three-value enum. The hub contract (`../wedding-architecture/contracts/openapi.json`)
  is re-synced to match. This is good news for the save path and bad news for this repo's types,
  for a specific and slightly counter-intuitive reason recorded in ADR W-0004's amendment:
  openapi-generator turns a Zod `z.enum([...])` into a generated `KindEnum` namespace, but it has
  **no code path that emits any type at all** for a Zod `z.literal(...)` — JSON Schema represents
  it as `const`, and the generator's output for a `const` field is plain `kind: string`. So making
  the schema *more* precise upstream makes the generated TypeScript *less* precise: the `KindEnum`
  namespace disappears from the client altogether, on both `RsvpDtoAdultsPartner2OneOf` and
  `…OneOf1`, and every reference this repo has to
  `RsvpDtoAdultsPartner2OneOf.KindEnum.{GUEST,PLUS_ONE}` (11 sites across 8 files, all written in
  T270/T271) stops compiling. Separately, `adults.partner1` gained an optional
  `attending?: boolean` it never had — a narrower `omit` upstream (`kind` only, not `kind` +
  `attending`), not a field this repo asked for or needs to read or write; ADR W-0004's amendment
  records this as settled dead weight, not an open question. And the **non-discriminated** union
  behind the profile-partner type had its two members reordered (unaffected by the Zod fix — that
  union was never discriminated), which swaps which generated interface name — `…AnyOf` vs.
  `…AnyOf1` — carries which shape; confirmed by grep to have zero positional consumers in this
  repo, so it is a rename with no code impact, stated for the record rather than left for the next
  reader to rediscover. This task is a type-following exercise, not a feature: it changes how
  `kind` is spelled and compared, not what any screen does or shows.
- **Acceptance:**
  - **First commit, on its own: `pnpm gen:api`,** against the hub contract with the re-sync landed
    (confirm the hub commit before regenerating — same rule as T270's blocking-dependency note; do
    not assume today's working tree already reflects a committed regeneration, even if it looks
    like it does). State the hub commit referenced in the PR. **Tripwire — the expected diff
    shape:**
    - `rsvp-dto-adults-partner1.ts` gains one field: `attending?: boolean;`.
    - `rsvp-dto-adults-partner2-one-of.ts` and `…-one-of1.ts`: `kind` changes from the generated
      enum type to `kind: string;`, and the `export namespace RsvpDtoAdultsPartner2OneOf { … }` /
      `…OneOf1` `KindEnum` blocks are deleted entirely (not renamed, not narrowed — gone).
    - `user-profile-list-response-dto-profiles-inner-guest-info-partner-any-of.ts` and `…-any-of1.ts`
      swap which one carries `id`/`attending` (the guest shape) vs. neither (the plus-one shape);
      the merged `user-profile-list-response-dto-profiles-inner-guest-info-partner.ts` loses its
      own `KindEnum` block the same way the partner2 variants do.
    - Nothing else moves. If the actual diff differs from this shape in kind (not just in which
      exact files list which fields), **stop and report** — do not adapt the rest of the task to a
      different-shaped diff without asking. `pnpm gen:api:check` clean afterwards. Nothing in
      `src/app/core/api/` is hand-edited (CLAUDE.md folder ownership).
  - **`AdultDraft.kind`** (`core/helper/rsvp-draft.ts`) is retyped from
    `RsvpDtoAdultsPartner2OneOf.KindEnum` (removed) to plain **`string`**, still **optional** —
    matching the type the generated `…OneOf`/`…OneOf1` interfaces themselves now give the field.
    This is **not** a new hand-written type and does not trigger CLAUDE.md Hard rule 15: it is the
    same generated-field type, carried over, not a locally invented union. The doc comment is
    updated to stop citing `KindEnum` (ADR W-0004 §Decision.2's superseded-note has the replacement
    wording).
  - **Every `RsvpDtoAdultsPartner2OneOf.KindEnum.GUEST` / `.PLUS_ONE` reference becomes a direct
    string-literal comparison or assignment against `'guest'` / `'plus-one'`** — the values the
    contract's `const`s actually carry. This is a plain equality/assignment against a field already
    typed `string` by the generated client, not a redeclared type, so Hard rule 15 does not apply;
    do **not** invent a local `type Kind = 'guest' | 'plus-one'` (or similar) to feel safer about
    it — ADR W-0004's amendment explains why that would be the wrong move, and if anyone still
    disagrees after reading it, that is a stop-and-ask, not a unilateral call. Fix, file by file:
    - `core/helper/rsvp-draft.ts`: the doc comment (L35) drops the `KindEnum` citation; the type
      decl (L40) becomes `kind?: string;`; the two `fromRsvpDraft()` sites (L109, L115) drop the
      `as RsvpDtoAdultsPartner2OneOf.KindEnum` cast — narrow only the optionality
      (`string | undefined` → `string`, since the wire type's `kind` is required on both variants),
      by whatever idiomatic means (`as string`, `!`, or restructuring); no `as unknown as`.
    - `core/helper/rsvp-draft.spec.ts` (L67, L89): fixtures use `'guest'` in place of
      `RsvpDtoAdultsPartner2OneOf.KindEnum.GUEST`.
    - `core/helper/partner-account.ts`: the doc comment (L24, "three-value `KindEnum`") is updated
      per ADR W-0004's amendment; the comparison (L39) becomes `partner?.kind === 'guest'`.
    - `core/helper/partner-account.spec.ts` (L19, L30, L52): `'guest'` / `'plus-one'` in place of
      the `RsvpDtoAdultsPartner2OneOf.KindEnum.*` and
      `UserProfileListResponseDtoProfilesInnerGuestInfoPartner.KindEnum.GUEST` fixtures.
    - `shared/rsvp-editor/rsvp-editor.ts` (L442, `addPartner()`): stamps `'plus-one'`.
    - `shared/rsvp-editor/rsvp-editor.spec.ts` (L184, L207, L229, L238): fixtures use `'guest'` /
      `'plus-one'`.
    - `screens/rsvp-create/rsvp-create.ts` (L65, L82, L301 — `EMPTY_DRAFT.partner`,
      `toCreateDraft()`, `submit()`'s `typedPartner`): all three stamp `'plus-one'`.
    - `screens/guest-manager/modal/manage-rsvp-modal.spec.ts` (L90): fixture uses `'guest'`.
    - In every one of the eight files above, drop the now-unused `RsvpDtoAdultsPartner2OneOf`
      import if nothing else in that file still references the type (confirmed by grep: today it
      is imported in exactly these eight files and used **only** for `.KindEnum` access in every
      one — no file uses `RsvpDtoAdultsPartner2OneOf` as a type annotation elsewhere, so the import
      is fully removable in all eight, not just some). An unused import is both a lint failure and
      dead weight; do not leave it "just in case."
  - **The profile-partner union swap needs no code change.** State in the PR the grep that proves
    it: `UserProfileListResponseDtoProfilesInnerGuestInfoPartnerAnyOf` / `…AnyOf1` are referenced
    nowhere in `src/app/` outside the generated model files themselves — the only consumer of the
    profile partner shape is `partnerHasAccount()`, via the merged
    `UserProfileListResponseDtoProfilesInnerGuestInfoPartner` type, reading `.kind`, never a split
    variant and never by structural position. If the grep turns up a consumer this task's recon
    missed, stop and report before writing around it.
  - **`RsvpDtoAdultsPartner1` gaining `attending?: boolean` needs no code change**, per ADR
    W-0004's amendment: nothing in this app may start reading or writing `attending` on `partner1`
    as part of this task — `fromRsvpDraft()`'s `partner1` object literal is unchanged and stays
    that way. This is stated so nobody "completes the picture" by wiring it up as a drive-by.
  - **No behaviour change beyond the type mechanics.** `partnerHasAccount()`'s logic
    (`kind === 'guest'`, no `id` fallback), `fromRsvpDraft()`'s shape (what fields it emits and
    when), and every screen's rendering are unchanged — this task only changes how `kind` is typed,
    compared and imported. If a diff touches an `.html` or `.scss` file, that is out of scope and a
    sign something went sideways.
  - `pnpm typecheck && pnpm lint && pnpm test` green at the end. State the before/after
    `typecheck` error count in the PR (recon for this task found the working tree already failing
    to compile against a client shaped like the tripwire above, from the 11 sites listed, but did
    not run the compiler to get an exact count — get the real number from `HEAD` before touching
    anything, the same way T270 did). Lint clean except the 4 known `shared/modal/` errors
    (CLAUDE.md's carve-out).
- **Refs:** in-repo ADR W-0004 (whole document, particularly "Amendment (2026-08-23)"); ADR
  W-0002 §Decision.1 (superseded by W-0004, unaffected by this task); CLAUDE.md Hard rule 15;
  `src/app/core/api/model/rsvp-dto-adults-partner1.ts`,
  `rsvp-dto-adults-partner2-{one-of,one-of1}.ts`,
  `user-profile-list-response-dto-profiles-inner-guest-info-partner{,-any-of,-any-of1}.ts`
  (regenerated here); `src/app/core/helper/{rsvp-draft.ts,rsvp-draft.spec.ts,partner-account.ts,
  partner-account.spec.ts}`; `src/app/shared/rsvp-editor/rsvp-editor.{ts,spec.ts}`;
  `src/app/screens/rsvp-create/rsvp-create.ts`;
  `src/app/screens/guest-manager/modal/manage-rsvp-modal.spec.ts`;
  `wedding-api/src/common/documents/rsvp.ts`; hub `contracts/openapi.json`
