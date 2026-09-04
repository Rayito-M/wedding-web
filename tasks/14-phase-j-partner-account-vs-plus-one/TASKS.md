## Phase J — Partner: "own guest account" vs. "plus-one" (DS re-sync, in-repo ADR W-0002)

> The design system reworked partner handling across `ScreenGuestManager`,
> `ScreenGuestManagerMobile`, `ScreenRSVPCreate` and `ScreenRSVPEdit` (DS commits `9e44df2`,
> `2aef7de`, `f161a34`, `19005e7`, `f26c721`). One idea runs through all four: a partner either
> **has their own guest account** — name owned by that account, shown read-only and tinted
> `--accent` — or is a **plus-one** on someone else's invitation — name typed, shown muted.
> `GLOSSARY.md` §Plus-one and hub ADR-0024 already define this; the contract already carries it
> (`anyOf` where the presence of `id` is the only discriminator). **No hub escalation, no contract
> change, no `pnpm gen:api` needed.** In-repo ADR W-0002 pins the rule and the Hard-rule-15-safe
> way to read it. Read `docs/decisions/W-0002-partner-account-vs-plus-one.md` first.
>
> **Baseline warning:** at the time of writing, `guest-manager.{ts,html}`, `dashboard.{ts,html}`,
> `core/dashboard.service.ts`, `core/service/index.ts`, `core/service/statistic.service.ts` and all
> three `public/i18n/*.json` have **uncommitted in-flight work** (the shared `StatisticService`).
> Branch from that working tree, do not revert it. In particular `StatisticService.ownRsvp()` and
> `GuestManager.filteredGuests()` already implement "a partner with their own account carries the
> couple's shared RSVP but does not own it, so they get no second row" — Phase J builds on that and
> must not re-derive or contradict it.
>
> T255 and T256 are the foundation; T257–T261 each consume them and are otherwise independent.
> T256 lands **all** new i18n keys in one commit so the five consumer tasks never touch
> `public/i18n/*.json` and cannot conflict there.

### T255 — `app-input`: disabled/read-only visual state (DS `core/Input`)
- **Status:** done (`265a5d6`) — **one criterion deferred, not met:** the WCAG 2.1 AA contrast
  check fails. `--text-muted` on `--surface-chip` computes to 4.08:1 (terracotta), 3.86:1
  (mauve), 3.99:1 (verdeagua) against a 4.5:1 threshold (the field's 18px regular serif is not
  WCAG "large text"). Inherent to the token pair §Decision.4 prescribes, not to the rule as
  written — any implementation fails identically. `:host(:disabled)` is plausibly covered by
  WCAG 1.4.3's inactive-UI-component exemption; `:host([readonly])` is **not** (still focusable,
  still tab-ordered) and the DS applies `readOnly` for exactly the Phase J lock case. Resolving
  it needs a darker on-chip alias in `../wedding-ui-design` — a DS-side change, out of scope
  here. Unresolved.
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** DS `components/core/Input.jsx` now takes a `disabled` prop and renders
  `disabled` + `readOnly` with `background: var(--chip)`, `color: var(--sub)`,
  `cursor: default`. The web's `input[app-input]` (`src/app/shared/input/input.scss`) has no
  disabled state at all, so a natively-disabled field is indistinguishable from an editable one.
  Every Phase J lock UI depends on this. Pure styling — the component stays a bare attribute
  component with no new inputs (native `[disabled]`/`readonly` is what callers use).
- **Acceptance:**
  - `src/app/shared/input/input.scss` gains `:host(:disabled), :host([readonly])` rules using
    **semantic aliases only**: `background: var(--surface-chip)`, `color: var(--text-muted)`,
    `cursor: default`. No new hex, no raw-role token (`--chip`/`--sub`), no
    `@media (prefers-color-scheme: …)`.
  - The border stays `var(--border-hairline)` — the DS keeps the same 1px hairline when disabled;
    do not add a shadow (CLAUDE.md rule 3: in-flow elements stay flat).
  - `TextInput` in `src/app/shared/input/input.ts` gains **no** `input()` signal — no API change,
    no template change beyond what the selector already supports.
  - Verified visually in all three themes (`data-theme` = terracotta / mauve / verdeagua) that the
    disabled fill reads as a filled chip and the text still meets WCAG 2.1 AA contrast against it.
  - Component validates against the design spec (`../wedding-ui-design/components/core/Input.jsx`,
    `Input.prompt.md`).
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** in-repo ADR W-0002 §Decision.4; DS `components/core/Input.jsx`;
  `src/app/shared/input/{input.ts,input.scss}`; `src/styles/_tokens.scss` (`--surface-chip`)

### T256 — Shared `partnerHasAccount()` helper + all Phase J i18n keys
- **Status:** done (`ecd863d`). All acceptance criteria met except the `pnpm test` green gate,
  which is blocked by a pre-existing HEAD failure — see T262. es `partnerLinkedHint` uses
  feminine "Vinculada" (agrees with "Tu pareja"); fr `plusOne` is "accompagnant". Both flagged
  for a native-speaker pass.
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** The app must answer "does this partner have their own guest account?" in five
  places. The contract's only discriminator is the presence of `id` on the `anyOf` variant —
  `UserProfileListResponseDtoProfilesInnerGuestInfoPartnerAnyOf1` and
  `RsvpDtoAdultsPartner2AnyOf1` have it, `…AnyOf` (plus-one) does not. **Do not declare a local
  partner/plus-one type or union** (Hard rule 15): openapi-generator flattens each `anyOf` into
  one merged interface where `id` is wrongly typed as required `string`, and the sanctioned
  workaround is a `boolean` helper over the generated types, not a parallel model. The repo
  already carries two `// reason:`-annotated `as unknown as RsvpDtoAdultsPartner2` casts for the
  same artifact (`core/helper/rsvp-draft.ts`, `screens/rsvp-create/rsvp-create.ts`) — leave those
  in place, this task does not refactor them.
- **Acceptance:**
  - New `src/app/core/helper/partner-account.ts` exporting exactly one function:
    `partnerHasAccount(partner): boolean`, accepting
    `UserProfileListResponseDtoProfilesInnerGuestInfoPartner | RsvpDtoAdultsPartner2 | AdultDraft | null | undefined`
    (all imported — the first two from `src/app/core/api`, `AdultDraft` from
    `src/app/core/helper/rsvp-draft.ts`) and returning `!!partner?.id` (trim-safe: an empty-string
    `id` counts as **no** account). Exported from `src/app/core/helper/index.ts`.
  - **No** new `type`/`interface`/`enum`/string-union is declared anywhere in this task. Not a
    type predicate (`partner is …AnyOf1`) — a plain `boolean`; the ADR explains why.
  - Unit spec `partner-account.spec.ts` covering: `undefined`, `null`, `{firstName,lastName}` →
    `false`; `{id:'…',firstName,lastName}` → `true`; `{id:''}` → `false`.
  - New i18n keys added to **all three** of `public/i18n/{en,es,fr}.json`, keeping the existing
    hierarchical kebab/camel key style and each file's key ordering:
    - `shared.partner.ownAccount` — en "own guest account"
    - `shared.partner.plusOne` — en "plus-one"
    - `shared.partner.nameManaged` — en "Name managed by their own guest account."
    - `guest_manager.profile.partner` — en "Partner"
    - `guest_manager.rsvp.partnerNameRequired` — en "The partner needs a first and last name."
    - `rsvp.create.party.partnerLinkedHint` — en "Linked to their guest account — the name comes
      from the guest list."
    - `rsvp.edit.footer.unnamed.{none,singular,plural}` — plural set for `PluralTranslatePipe`
      (`none` unused but required by the pipe's key contract); en singular "{{count}} guest needs
      a first and last name", plural "{{count}} guests need a first and last name"
  - es/fr translations are real translations, not English placeholders; the three files stay
    structurally identical (same key set).
  - No component/template changes in this task — keys land unused, consumed by T257–T261.
  - `pnpm typecheck && pnpm lint && pnpm test` green; `pnpm gen:api:check` still clean.
- **Refs:** in-repo ADR W-0002 §Decision.1–2; CLAUDE.md Hard rule 15 + hard rule 8; hub
  `GLOSSARY.md` §Plus-one; generated types
  `src/app/core/api/model/user-profile-list-response-dto-profiles-inner-guest-info-partner*.ts`,
  `src/app/core/api/model/rsvp-dto-adults-partner2*.ts`;
  `src/app/core/helper/{index.ts,rsvp-draft.ts}`; `src/app/core/pipe/plural-translate.pipe.ts`

### T257 — Guest manager row: partner line reads account vs. plus-one, on mobile too
- **Status:** done (`18c12c1`) — **ships a known WCAG 2.1 AA violation, accepted by the user.**
  The account-partner name uses `--brand-accent` on `--surface-card` at 12px/500: 3.51:1
  (terracotta), 3.05:1 (mauve), **2.50:1 (verdeagua)** against the 4.5:1 threshold. Inherent to
  the token pairing this task and ADR W-0002 prescribe — any implementation fails identically —
  and it contradicts CLAUDE.md Hard rule 14. No exemption argument applies (unlike T255's
  `:disabled` half). Real fix is a darker accent-on-surface alias in `../wedding-ui-design`.
  Tracked, unresolved. The colour-alone criterion (1.4.1) **is** satisfied via an sr-only suffix.
- **Owner:** agent (implementer)
- **Depends on:** T256
- **Context:** DS `PartnerLine` / `GmPartnerLine` render the partner under the guest name as a
  small dot + name, **tinted `--accent` and 500-weight when the partner has an account**, muted
  (`--sub`, 400) when they are a plus-one — and the mobile screen shows the same line. The web
  row (`guest-manager.html` `.guest-secondary`) prints `partner.firstName partner.lastName` with
  no distinction at all, and `guest-manager.scss` hides it entirely below the desktop tier
  (`display: none`, flipped to `block` only in the desktop block). Touches the same two files as
  the in-flight `StatisticService` work — rebase, don't revert.
- **Acceptance:**
  - The partner line renders on **all** viewport tiers (remove the mobile `display: none` /
    desktop-only `display: block` pairing for `.guest-secondary`), matching
    `ScreenGuestManagerMobile`.
  - The line is a leading dot + the partner's full name, using `partnerHasAccount()` (T256) to
    pick between two classes — e.g. `[class.has-account]="…"`. Account: dot and text
    `var(--brand-accent)`, font-weight 500. Plus-one: dot `var(--brand-accent-tertiary)` (the
    semantic alias for the DS's `--accent-3`, already mirrored in `src/styles/_tokens.scss` L77),
    text `var(--text-muted)`, font-weight 400. Semantic aliases only — no raw `--accent`/`--sub`,
    no new token (a new token would be a DS escalation).
  - Name truncates with ellipsis on one line (DS: `whiteSpace: nowrap; overflow: hidden;
    textOverflow: ellipsis`) so a long name cannot reflow the row.
  - Account status is **not** conveyed by colour alone (WCAG 2.1 AA / CLAUDE.md rule 14): the line
    carries an `aria-label` or visually-hidden suffix built from
    `shared.partner.ownAccount` / `shared.partner.plusOne`.
  - No new local types; no hardcoded colours; no new breakpoint (reuse the tiers documented by
    T248).
  - Existing row behaviour unchanged: still one row per couple (a partner with their own account
    is still filtered out by `filteredGuests()`), counts still come from `StatisticService`.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** in-repo ADR W-0002; DS `ui_kits/wedding-app/ScreenGuestManager.jsx` (`PartnerLine`,
  L35–43) and `ScreenGuestManagerMobile.jsx` (`GmPartnerLine`, L33–41);
  `src/app/screens/guest-manager/guest-manager.html` (`.col-guest` block),
  `src/app/screens/guest-manager/guest-manager.scss` (`.guest-secondary`, ~L280 and ~L510);
  `src/app/core/service/statistic.service.ts`

### T258 — Guest profile modal: "Partner" info row with account / plus-one suffix
- **Status:** done (`0c01a25`). Two discrepancies found and **flagged rather than decided**:
  (a) **this task's own text is wrong about the DS** — it says "after Phone and before Table
  (DS ordering)", but `ScreenGuestManager.jsx` L294 puts Partner *after* Table. The task text was
  followed as authoritative; flip it if DS fidelity matters more. (b) The DS renders `'Unnamed'`
  for a partner with no name; no such i18n key exists and this task forbade adding one, so a
  nameless partner currently renders as `" · plus-one"` with a leading space. Cosmetic, real.
  Also noted in passing: `guest-profile-modal.ts` L27–28 carries the local `RelationSide` /
  `RelationKind` unions — already the seed instances tracked by **T254**, left alone.
- **Owner:** agent (implementer)
- **Depends on:** T256
- **Context:** DS `ScreenGuestManager` profile view now shows
  `Info label="Partner" value="{name} · own guest account"` or `"{name} · plus-one"`, and `—`
  when there is no partner. `guest-profile-modal.html`'s `.info-grid` has Side·Group,
  Relationship link, Email, Phone and Table — **no Partner row at all**, so an admin cannot tell
  from the profile whether the partner can sign in.
- **Acceptance:**
  - A "Partner" `.info-item` is added to the `@case ('profile')` `.info-grid`, after Phone and
    before Table (DS ordering), labelled `guest_manager.profile.partner`.
  - Value: `{firstName} {lastName} · {suffix}` where `suffix` is `shared.partner.ownAccount` or
    `shared.partner.plusOne`, chosen by `partnerHasAccount(guestProfile()?.guestInfo?.partner)`
    (T256). Renders the muted `—` placeholder when `guestInfo.partner` is absent, exactly like the
    existing Table row.
  - The composed string is assembled in the template or in a small `computed()` on
    `guest-profile-modal.ts` — no new type, no `any`, and no re-reading of `partner.id` outside
    the helper.
  - All three languages already have the keys (T256); no `public/i18n/*.json` edit in this PR.
  - The `@case ('edit')` branch is untouched — linking/unlinking a partner from the profile
    editor is **not** in scope (see Open questions in the Phase J note below).
  - Component validates against the design spec; no inline styles, no new colours.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** in-repo ADR W-0002; DS `ScreenGuestManager.jsx` L294 (`Info label="Partner"`);
  `src/app/screens/guest-manager/modal/guest-profile-modal.{ts,html}`

### T259 — Manage-RSVP modal (admin): lock a linked partner's name + require first/last name
- **Status:** done (`154378e`). Closes the permissions leak: an admin editing one guest's RSVP
  could rename a *different* guest's account. Three notes, all flagged rather than decided:
  (a) **`partnerNameOk` deliberately does not exempt an account-holding partner, unlike T260's
  `unnamedCount`.** This task's text and the DS both gate on "a partner exists and either trimmed
  name is empty". Consequence: an account-holding partner with a blank name would present a gate
  the admin cannot satisfy from this screen, since the inputs are gone. Harmless if account
  creation always requires both names — worth confirming, and worth harmonising the two screens
  deliberately rather than by accident. (b) DS specifies `fontSize: 14` for the locked name; no
  14px token exists (`--text-body` 13, `--text-body-lg` 15), so the existing `.person-name`
  (13px/500) was reused rather than hardcoding or inventing a token. 1px off the mock.
  (c) `.name-hint` is now declared in both `rsvp-edit.scss` (T260) and here with identical rules
  — see the consolidation note on T260.
- **Owner:** agent (implementer)
- **Depends on:** T255, T256
- **Context:** Two DS behaviours are missing from the admin RSVP editor.
  (a) `partnerLocked = draft.partner != null && partnerHasAccount(draft.partner)` — when true the
  DS renders the partner's name as **plain text** (`fontSize: 14, fontWeight: 500`) instead of an
  input, because the name belongs to that guest's own account. `manage-rsvp-modal.html` currently
  renders two always-editable inputs, so an admin can rename another guest's account from inside a
  third party's RSVP.
  (b) `partnerNameOk` — a partner must have **both** a first and a last name; the DS disables
  "Save changes" and shows "The partner needs a first and last name." in the footer. The web has
  no such gate, so an empty-named partner can be saved.
  `AdultDraft.id` in `core/helper/rsvp-draft.ts` already carries the linked id forward on save —
  no mapping change is needed, only UI.
- **Acceptance:**
  - `PersonCard` gains a `hasAccount` field populated from `partnerHasAccount(d.partner2)` (T256).
    `PersonCard` is an existing local **view-model** for rendering, not an API-model
    redeclaration — extending it is fine; do not add an API-shaped type next to it.
  - When the partner has an account, the partner card renders the name as static text
    (`{{firstName}} {{lastName}}`) plus the hint `shared.partner.nameManaged`, and **the remove
    (`×`) button is still shown** (the DS keeps `removePartner` available in this branch) — the
    two name `<input app-input>` elements are not rendered.
  - When the partner is a plus-one, the current two-input layout is unchanged.
  - Save gate: "Save changes" is `[disabled]` when a partner exists and either trimmed name is
    empty; the footer shows `guest_manager.rsvp.partnerNameRequired` in that state, replacing the
    existing spacer/no-message. Existing `saving()`/`!rsvp()` disable conditions still apply.
  - Adding a partner via "+ Add partner" still produces an editable (plus-one) card — a new
    partner never has an account.
  - `setAdultFirstName`/`setAdultLastName` are not reachable for `partner2` when it has an
    account (guard in the component, not only in the template).
  - No i18n edits (T256 landed the keys); no new colours; component validates against the design
    spec.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** in-repo ADR W-0002 §Decision.3; DS `ScreenGuestManager.jsx` L107–109 (`partnerLocked`,
  `partnerNameOk`, `saveEdit`), L349–361 (locked branch), L386 (footer message) and the mirrored
  `ScreenGuestManagerMobile.jsx` L81–83, L253–265;
  `src/app/screens/guest-manager/modal/manage-rsvp-modal.{ts,html,scss}`;
  `src/app/core/helper/rsvp-draft.ts` (`AdultDraft.id`)

### T260 — RSVP edit (guest): lock a linked partner's name + "needs a first and last name" gate
- **Status:** done (`bab91fe`). All criteria met. Note: `.name-hint` is now the **5th** local copy
  of the hint pattern (`rsvp-create.scss`, `config-manager.scss`, `album.scss`,
  `guest-create-modal.scss` `.partner-hint`) — there is no `%hint` primitive in
  `src/styles/_primitives.scss`. Consolidation candidate; a `web-css-auditor` sweep would find it.
- **Owner:** agent (implementer)
- **Depends on:** T255, T256
- **Context:** DS `ScreenRSVPEdit` gained `nameLocked(p) = !!p.linked && !!p.firstName`: the
  first/last-name `Input`s are rendered `disabled` and the hint "Name managed by their own guest
  account." appears under them. It also gained an `unnamed` gate — every adult in the party needs
  both names, the Save button is disabled and the footer reads "N guests need a first and last
  name" (the DS's sibling `incomplete`/phone-number gate belongs to the account-provisioning
  sub-flow that stays out of scope, see W-0002). `rsvp-edit.html` today lets the guest retype a
  linked partner's name and offers no name gate at all.
- **Acceptance:**
  - `PersonCard` (local view-model in `rsvp-edit.ts`) gains `hasAccount`, from
    `partnerHasAccount(d.partner2)` (T256), for the `partner` card only (`you` / `child` cards
    keep their current behaviour — `partner1` is the signed-in guest editing their own name).
  - When the partner card has an account: both name inputs render with the native `[disabled]`
    attribute (styled by T255) and a hint paragraph shows `shared.partner.nameManaged` beneath the
    row. Values still display; the remove (`×`) button stays available as it is today.
  - New `unnamed` gate: a `computed()` counting adult cards (`you`, `partner`) whose trimmed
    first **or** last name is empty. When > 0, the Save button is `[disabled]` and the footer
    `.status` shows
    `'rsvp.edit.footer.unnamed' | pluralTranslate: unnamedCount() | translate: { count: … }`,
    taking priority over the `saveFailed` / `dirty` / `saved` messages in that order:
    error → unnamed → unsaved → saved.
  - A disabled (account-owned) partner name never counts as `unnamed` — it is by definition
    already set — so the gate can never deadlock the guest.
  - `setPartner2FirstName`/`setPartner2LastName` are guarded in the component so a programmatic
    call cannot bypass the lock.
  - No i18n edits; no new colours; component validates against the design spec.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** in-repo ADR W-0002; DS `ui_kits/wedding-app/ScreenRSVPEdit.jsx` L22–26 (`unnamed`,
  `nameLocked`), L62–70 (disabled inputs + hint), L129–130 (footer + Save gate);
  `src/app/screens/rsvp-edit/rsvp-edit.{ts,html,scss}`;
  `src/app/core/pipe/plural-translate.pipe.ts`

### T261 — RSVP create (guest): stop accepting edits to a linked partner's name (silent-discard bug)
- **Status:** done (`1892d5a`). The silent-discard bug is fixed. Reused the existing `.hint` class
  rather than adding a sixth copy. The `pnpm test:e2e` criterion was dropped as unmeetable — see
  T263.
- **Owner:** agent (implementer)
- **Depends on:** T255, T256
- **Context:** **This is a real bug, not only a visual gap.** `rsvp-create.ts` already computes
  `hasLinkedPartner()` (`!!this.rsvp().adults.partner2?.id`) and, on submit, deliberately ignores
  anything typed into the partner name fields — `typedPartner` is `undefined` when
  `hasLinkedPartner()` is true, and `rsvp.adults.partner2` is carried forward verbatim (L278–298).
  But `rsvp-create.html` L72–85 still renders two fully editable inputs bound to
  `setPartnerFirstName`/`setPartnerLastName`. A guest can type a correction, see it accepted, press
  Continue, and have it silently thrown away. DS `ScreenRSVPCreate` renders those inputs
  `disabled={nameLocked}` with the hint "Linked to their guest account — the name comes from the
  guest list."
- **Acceptance:**
  - When `hasLinkedPartner()` is true, both party-step partner inputs render with the native
    `[disabled]` attribute (styled by T255) and a hint paragraph shows
    `rsvp.create.party.partnerLinkedHint` beneath the row.
  - `setPartnerFirstName`/`setPartnerLastName` return early when `hasLinkedPartner()` — the draft
    can no longer diverge from what will actually be submitted.
  - The submit path (`typedPartner` / `partner2` carry-forward) is **unchanged** — this task only
    stops the UI from lying about it. No change to the two existing `// reason:`-annotated
    `as unknown as RsvpDtoAdultsPartner2` casts.
  - `partnerReady` still gates Continue correctly for the plus-one case (both names required) and
    is trivially satisfied for the linked case.
  - The step-0 toggle already labels itself with the linked partner's name — leave that as is.
  - Use `partnerHasAccount()` (T256) rather than the inline `!!…partner2?.id`, so the rule lives in
    one place; `hasLinkedPartner` keeps its name and doc comment.
  - No i18n edits; no new colours; component validates against the design spec.
  - `pnpm typecheck && pnpm lint && pnpm test` green. (This criterion originally also demanded
    `pnpm test:e2e`; that script has never existed in this repo — see T263. Dropped as unmeetable.)
- **Refs:** in-repo ADR W-0002 §Decision.3; DS `ui_kits/wedding-app/ScreenRSVPCreate.jsx` L26
  (`nameLocked`), L68–76 (disabled inputs + "Linked to their guest account…" hint);
  `src/app/screens/rsvp-create/rsvp-create.{ts,html,scss}`

### T262 — Repair `app.spec.ts` TestBed: missing `EntityServices` provider (unblocks Phase J)
- **Status:** done. `pnpm test` is green again (`13 passed`, 0 failed). Fixed with the **real**
  ngrx/data wiring mirroring `app.config.ts:64–69`, not a stub, so `App` keeps exercising the
  actual `ConfigurationService` loading/error signals. `provideHttpClientTesting()` was added
  alongside: wiring the real effects means the constructor's `load()` now genuinely reaches
  `HttpClient`, and without a testing backend jsdom would fire a live XHR at
  `environment.apiBaseUrl` during unit tests. Note for future specs: this repo had **no**
  prior TestBed pattern for store-backed services — `app.spec.ts` is now the reference.
  T257–T261 are unblocked.
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** `pnpm test` is **red at HEAD** and has been since `36b937b` (the `StatisticService`
  landing). That commit made `ConfigurationService` inject `EntityServices` from `@ngrx/data`
  (`src/app/core/service/configuration.service.ts:20`); `src/app/app.spec.ts`'s TestBed provides
  no ngrx/data store, so both of its cases fail:
  ```
  FAIL src/app/app.spec.ts > App > should create the app
  FAIL src/app/app.spec.ts > App > should apply the active theme to <html>
  ɵNotFound: NG0201: No provider found for `EntityServices`.
  Path: _ConfigurationService -> EntityServices
  ```
  Verified pre-existing by running `ng test` in a detached worktree at `847a25a` — same two
  failures, none of Phase J's edits present. **Every Phase J task carries a `pnpm test` green
  gate, so this blocks T257–T261.** Do this one first.
- **Acceptance:**
  - `src/app/app.spec.ts` resolves `EntityServices` — either by providing the real ngrx/data
    setup the app uses, or by supplying a minimal stub whose
    `getEntityCollectionService()` returns what `ConfigurationService` reads. Prefer whichever
    matches how other specs in this repo already handle store-backed services; grep first, do not
    invent a third pattern.
  - Both `app.spec.ts` cases pass. `pnpm test` is fully green — `0 failed`.
  - **No production code changes.** `configuration.service.ts` and `statistic.service.ts` are
    correct as written; this is a test-harness gap, not a service bug. If the fix appears to
    require touching a service, stop and report instead.
  - No new `type`/`interface` redeclaring an API model (Hard rule 15) — a test stub is not an
    exception to it.
  - `pnpm typecheck && pnpm lint` green (lint: the known pre-existing `shared/modal/` errors
    only, unchanged).
- **Refs:** `src/app/app.spec.ts`; `src/app/core/service/configuration.service.ts:20`;
  `src/app/core/service/statistic.service.ts:50`; breaking commit `36b937b`; `@ngrx/data`
  `EntityServices` / `provideEntityData`

### T263 — Stand up the Playwright e2e suite (the gate CLAUDE.md has always promised)
- **Status:** done — 2026-09-04. `@playwright/test` + `playwright.config.ts` (webServer runs
  `pnpm start`; 4 mobile projects: iPhone SE/12/14 via WebKit, Pixel 7 via Chromium for Chrome
  Android — CLAUDE.md rule 4). `e2e/support/api-mocks.ts` + `e2e/support/auth.ts` stub every
  endpoint the app calls and drive the real `/login` OTP flow (no live `wedding-api`, no token
  seeded into storage). `e2e/smoke.spec.ts` — welcome screen renders real copy and the language
  switcher changes it. `e2e/layout/` — both required specs, each proven to fail against
  `9474809^` and pass against `9474809` (captured output in `tasks/reports/T263.json`); the
  `clip`-flex-item spec deviates from its literal acceptance text — see that report's
  `deviations[]`, `main.scrollHeight <= main.clientHeight` is always true and cannot see the
  defect; compares against the flex parent's `clientHeight` instead. `angular.json`'s `test`
  target now sets `include: ["src/**/*.spec.ts"]` so `ng test` never touches `e2e/`. **Local-only:
  no `.github/` CI workflow runs `pnpm test:e2e`.** CLAUDE.md Hard rule 11 + Testing + Commands
  restored in the same commit as the green suite.
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** CLAUDE.md listed Playwright under **Testing** and Hard rule 11 required
  `pnpm test:e2e` to pass before merging — but the suite has never existed: no `test:e2e` script
  in `package.json`, no `@playwright/test` dependency, no `playwright.config.*`, no `e2e/`
  directory. Every task written against that rule inherited an unmeetable criterion (caught on
  T261, which met every other criterion). CLAUDE.md has since been corrected to say the suite
  does not exist and to point here; this task makes the promise true. The unit runner, for the
  record, is **Vitest** via `ng test` — CLAUDE.md previously said Jasmine, also wrong, also fixed.
- **Acceptance:**
  - `@playwright/test` added as a dev dependency; `playwright.config.ts` at the repo root;
    `"test:e2e": "playwright test"` in `package.json`.
  - Config starts the app itself (`webServer` running `pnpm start`) so the suite is one command
    from a cold checkout, and targets the browsers CLAUDE.md rule 4 names: mobile Safari (iPhone
    SE / 12 / 14 viewports) and current Chrome Android, mobile-first.
  - At least one **real** smoke spec that would fail if the app were broken — e.g. the app boots,
    the welcome screen renders, and the language switcher changes rendered copy. No placeholder
    or always-true assertions.
  - **A layout-regression tier, asserting computed geometry rather than DOM presence.** This is the
    half that earns the dependency: Vitest under JSDOM already checks that elements *exist*, and
    that is precisely what failed to catch T341 — 556 tests passed while pinning did not work at
    all in a browser. A spec in this tier reads `getBoundingClientRect()` or
    `getComputedStyle()` and asserts a *relationship*, never a class name. Two specs from real
    defects, both of which must fail against the commit before their fix:
      - **Pinned regions stay put** (`9474809`): on `/guests`, record the head's and foot's
        `boundingClientRect().y`, scroll the list region, assert both are unchanged and the first
        row's `y` has decreased. Fails against `9474809^`
      - **A `clip` flex item does not outgrow its parent** (hub ADR-0041 §4): assert
        `main.scrollHeight <= app-private-layout.clientHeight` — the space `main`'s flex parent
        actually gave it. This is the `min-height: 0` trap, and T347 is about to convert 47 more
        sites that can hit it. Fails against `9474809^`.
        **Corrected 2026-09-04.** This bullet originally said
        `main.scrollHeight <= main.clientHeight`, which is *always* true and can never distinguish
        broken from fixed — measured at `4097 = 4097` while broken and `329 = 329` while fixed.
        That was an error in the task, not in the implementation: without `min-height: 0` the flex
        algorithm's content-based automatic minimum grows `main`'s **own** box, so its `clientHeight`
        balloons with its content and there is nothing left for `scrollHeight` to exceed. The
        overflow surfaces one level up, against the viewport-pinned parent that does *not* grow. The
        bullet's title was right; its assertion named the wrong pair of properties. Deviation
        reported and accepted — see this phase's `reports/T263.json`
  - The suite must not depend on a live `wedding-api`: either stub network at the Playwright
    layer (`page.route`) or document precisely what must be running. A suite that only passes on
    the author's machine is worse than none.
  - `pnpm test:e2e` passes from a clean checkout after `pnpm install`.
  - CI note: if no CI workflow runs it yet, say so explicitly in the PR rather than implying
    coverage that does not exist.
  - Once green, restore `pnpm test:e2e` to CLAUDE.md Hard rule 11 and the Commands list in the
    **same** commit.
  - `pnpm typecheck && pnpm lint && pnpm test` still green.
- **Refs:** CLAUDE.md Hard rule 11 + Testing/Commands (both amended by this task's sibling commit);
  CLAUDE.md rule 4 (target browsers); `package.json`; T261's report (where the gap surfaced)

> **Phase J open questions — answer before starting T258/T259, they are not blockers for
> T255–T257, T260–T261.**
>
> 1. **Partner linking from the profile editor.** The DS `editProfile` branch now carries the whole
>    "Link to the guest partner" switch + candidate picker (`ScreenGuestManager.jsx` L254–276),
>    i.e. an admin can link/relink/unlink an *existing* guest's partner. The web only has that UI in
>    `app-guest-create-modal` (create-time). The endpoints exist (`PUT`/`DELETE
>    /v1/guests/{id}/partner…`, incl. the "already linked to a third guest" 409). Do we want this in
>    `GuestProfileModal`'s edit mode? It is a separate task (next free number — T262 has since been
>    taken by the `app.spec.ts` repair) if yes — deliberately **not** written yet.
> 2. **Preferred language on the profile view.** DS shows a "Preferred language" `Info` row and a
>    segmented control in the edit form; `UserProfileDto.preferredLang` exists and
>    `GuestCreateModal` already sets it, but `GuestProfileModal` shows/edits neither. Unrelated to
>    partners — flagging it as a drift found while surveying, not scheduled.
> 3. **Two account-holding guests, neither with an RSVP yet.** `filteredGuests()` /
>    `StatisticService` de-duplicate a couple by `rsvp.id === profile.id`; with no RSVP record at
>    all both profiles show as separate "Not Answered" rows even when `guestInfo.partner` links
>    them. Intended, or should the partner link de-duplicate too? Affects counts, so worth a
>    decision before more numbers are built on it.
