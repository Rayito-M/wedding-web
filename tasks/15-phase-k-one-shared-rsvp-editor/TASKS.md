## Phase K — One shared RSVP editor (DS `RSVPEditor`, in-repo ADR W-0003)

> The design system extracted `ui_kits/wedding-app/RSVPEditor.jsx` (commit `a2ce7cf`, refined by
> `f26c721`) and rewired **every** screen that edits an RSVP onto it — `ScreenRSVPEdit` (the
> guest's own reply) and `ScreenGuestManager` / `ScreenGuestManagerMobile` (the couple managing
> someone else's). Its own header comment: *"One RSVP editor, used everywhere an RSVP is edited …
> The only thing that varies is `perspective` — who is filling it in — which drives section titles
> and copy."*
>
> This repo built the two editors independently and they have drifted: accordion cards vs. flat
> cards under group headings, allergies as **free text** on the guest side vs. **catalog chips** on
> the couple side (so an allergy entered on one surface is invisible on the other), two copies of
> every draft mutation, two SCSS files restating the same chip/card/remove/add vocabulary under
> different class names. Phase K collapses them into one `app-rsvp-editor`.
>
> **Read `docs/decisions/W-0003-shared-rsvp-editor.md` first** — it pins the component boundary,
> the `perspective` union, the allergy unification, and (importantly) what of `RSVPEditor` is
> deliberately **not** built: phone/email fields, the "Own account & invitation" toggle, the
> roster lookup + "Link account" card, and the `needPhone` validation. Those stay out for exactly
> the reasons ADR W-0002 §"Explicitly not decided" already records — no endpoints exist and
> guest-initiated account provisioning is a hub question. An implementer who ports them from the
> JSX is out of scope, not thorough.
>
> **No contract change, no hub escalation, no `pnpm gen:api`.** Both fields the allergy
> unification needs (`allergyIds`, `customAllergies`) already exist on the generated
> `RsvpDtoAdultsPartner1Options`.
>
> **Repo-shape note (the DS layout does not map 1:1):** there is no `src/app/features/` in this
> repo — screens live in `src/app/screens/`, shared components in `src/app/shared/<name>/`. And
> the DS's desktop/mobile split (`ScreenGuestManager` + `ScreenGuestManagerMobile`) does **not**
> exist here: `screens/guest-manager/` is one responsive component and the couple's editor is one
> modal, `modal/manage-rsvp-modal.*`. Do not go looking for a second mobile file — T267 is the
> whole couple-side migration, desktop and mobile.
>
> Sequence: T264 (foundation: keys + validation helper) → T265 (build the component) → T266 and
> T267 (the two migrations; independent of each other, both depend on T265) → T268 (dead-key and
> duplication sweep, after both). T264 lands **all** new i18n keys in one commit so T265–T267
> never touch `public/i18n/*.json` and cannot conflict there — same discipline as T256.

### T264 — Foundation: `rsvp.editor.*` i18n keys + shared unnamed-adult validation helper

- **Status:** done (uncommitted) — 2026-08-22. `rsvp-draft.ts` + new `rsvp-draft.spec.ts`;
  37 new keys (`rsvp.edit.title` + 36 under `rsvp.editor`) added to all three i18n files, purely
  additive, key sets identical. Verified: typecheck clean, 18/18 tests pass, lint shows only the
  4 known `shared/modal/` errors, `gen:api:check` no drift.
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** The shared editor needs a copy namespace of its own (it belongs to neither the
  `rsvp.edit.*` nor the `guest_manager.rsvp.*` tree) and both hosts need the *same* "someone still
  needs a name" gate, which today exists twice with two different rules: `RsvpEdit.unnamedCount`
  (counts every adult, correctly excluding a partner whose name is locked) and
  `ManageRsvpModal.partnerNameOk` (a boolean, partner only). ADR W-0003 §Decision.7 picks the
  guest's rule. This task lands both foundations and touches **no template** — the keys and the
  helper land unused, consumed by T265–T267.
- **Acceptance:**
  - `src/app/core/helper/rsvp-draft.ts` exports one new function
    `unnamedAdultCount(draft: RsvpDraft): number`, counting adults (`partner1`, `partner2`) whose
    trimmed `firstName` or `lastName` is empty, **excluding `partner2` when
    `partnerHasAccount(draft.partner2)` is true** (their name is read-only — ADR W-0002
    §Decision.3). The exclusion applies to `partner2` **only**: `partnerHasAccount()` is a
    non-empty-`id` check, and `partner1` is the signed-in guest, so it is always true for them —
    excluding `partner1` would drop the main guest from their own name gate and contradict the
    required case below. This matches today's guest rule, which hard-codes `hasAccount: false`
    for the primary card (`rsvp-edit.ts:128`). Children are never counted. Reachable from
    `@app/core`. **No new `type`/`interface`** is declared.
    *(Corrected 2026-08-22: the first draft of this criterion said "any adult", which was wrong
    for `partner1`; caught during T264 implementation.)*
  - Unit spec covering: empty party → 0; `partner1` missing a last name → 1; a plus-one `partner2`
    with neither name → counted; an account-holding `partner2` with an empty name → **not**
    counted; children with no name → 0.
  - New keys in **all three** `public/i18n/{en,es,fr}.json`, under a new `rsvp.editor` block,
    keeping each file's existing style and ordering: `attendingLabel`;
    `choice.{attending,pending,declined}`; `total` (`"Total: {{count}}"`); `kind.{partner,child}`;
    `person.{newGuest,meal,allergies,noMealDetails,yearsOld,allergiesSummary,firstNamePlaceholder,lastNamePlaceholder,agePlaceholder}`;
    the custom-allergy entry set `person.customAllergy.{label,placeholder,remove}` — placeholder
    in the "type and press Enter…" register, `remove` an `aria-label` taking the entry as a
    parameter (e.g. `"Remove {{name}}"`) — replacing the single-field `allergyNotePlaceholder`
    (open question 3, decided 2026-08-22: multi-entry chips, see T265);
    `unnamed.{none,singular,plural}` (plural set for `PluralTranslatePipe`).
  - Per-perspective copy under
    `rsvp.editor.perspective.<p>.{party,primaryHint,partyMeta,note,notePlaceholder,addPartner,addChild}`
    — all **seven** strings the DS `RSVP_PERSPECTIVE` table carries (`RSVPEditor.jsx` L10–15) —
    for exactly **two** perspectives, `owner` and `couple` (ADR W-0003 §Decision.3 — `partner` and
    `delegate` are not added until a call site exists). English values come verbatim from that
    table:
    - `party` (the **section title**, the string this whole DS change exists to make
      context-driven): owner "Your party" / couple "The party", verbatim from the DS table.
      Reuse the existing es/fr wording already shipped for `rsvp.edit.titleAttending` ("Your
      party") rather than inventing a second phrasing for the same two words — that key is
      retired in T268 and its translations move here.
    - `primaryHint`: owner "You" / couple "Main guest"
    - `partyMeta`: owner "Party · dietary & allergies" / couple "Participants · dietary & allergies"
    - `note`: owner "A note for us (optional)" / couple "Note from guest"
    - `notePlaceholder`: owner "A song to dance to, a memory…" / couple "No note left." — for
      the couple this is now an **empty state**, not an input placeholder (open question 2,
      decided 2026-08-22: the note is read-only for the couple, see T265)
    - `addPartner`: owner "+ Add my partner" / couple "+ Add partner"
    - `addChild`: owner "+ Add a child" / couple "+ Add child"
    es/fr must agree in register with each file's existing voice. The existing es/fr for
    `rsvp.edit.titleAttending` already translates "Your party" — reuse that exact wording for
    `perspective.owner.party` rather than inventing a second phrasing for the same two words
    (subject to open question 4).
  - **Guest page headline collapses to one key** (open question 4, decided 2026-08-22 — the
    editor owns the section heading, so the host `<h2>` becomes the screen-level title):
    add `rsvp.edit.title` = **"Your reply"**, one value for *both* the attending and declined
    states. Its es/fr values are the ones already shipped for `rsvp.edit.titleDeclined`, whose
    English is already "Your reply" — copy them across verbatim, no new translation needed.
    `titleAttending`/`titleDeclined` are **not** deleted here (T268 sweeps them) and
    `declinedSub` is **unchanged**. There is deliberately no status-driven variant: the eyebrow
    (`rsvp.edit.eyebrow`, "CONFIRMED") and the `seatsHeld`/`declinedSub` subtitle already carry
    the status, and only two states are reachable anyway — `screens/rsvp/rsvp.html:3` renders
    `app-rsvp-edit` only when `isDecided()`.
  - Any en string **not** taken verbatim from the DS table is a proposal in the DS
    voice** (sentence case, direct address, no emoji — `../wedding-ui-design/README.md`
    §"Content fundamentals"), not settled copy: get the user's confirmation on the English before
    commissioning es/fr, since a re-word after translation costs three files twice.
  - es/fr are real translations, not English placeholders; the three files stay structurally
    identical (same key set). Existing keys are **not** deleted here — the sweep is T268.
  - `pnpm typecheck && pnpm lint && pnpm test` green; `pnpm gen:api:check` still clean.
- **Refs:** in-repo ADR W-0003 §Decision.4, §Decision.7; ADR W-0002 §Decision.3; DS
  `ui_kits/wedding-app/RSVPEditor.jsx` (`RSVP_PERSPECTIVE` L10–15, `rsvpIssues` L34–47);
  `src/app/core/helper/{rsvp-draft.ts,partner-account.ts,index.ts}`;
  `src/app/core/pipe/plural-translate.pipe.ts`; `public/i18n/{en,es,fr}.json`

### T265 — Build the shared `app-rsvp-editor` component (no call sites yet)

- **Status:** done (uncommitted) — 2026-08-22. New `src/app/shared/rsvp-editor/rsvp-editor.{ts,
  html,scss,spec.ts}` (~1,230 lines); imported by no screen, as designed. Verified: nothing
  outside the new directory was touched, all 18 referenced i18n keys exist, no local type is
  exported and none restates an API model, no inline template/styles, no hex/raw-role tokens/
  `prefers-color-scheme`; typecheck clean, 28/28 tests pass, lint shows only the 4 known
  `shared/modal/` errors.
- **Owner:** agent (implementer)
- **Depends on:** T264
- **Context:** The DS component is `RSVPEditor.jsx` — read it end to end before starting, then
  read ADR W-0003 for what is excluded. This task builds the component and nothing else: it is
  imported by no screen when the PR lands, which keeps the migration diffs (T266/T267) readable.
  Compose the existing shared primitives — `app-avatar`, `app-pill`, `app-choice-card`,
  `input[app-input]` (already has the T255 disabled state), `textarea[app-textarea]` — do not
  re-author them.
- **Acceptance:**
  - New three-file component `src/app/shared/rsvp-editor/rsvp-editor.{ts,html,scss}`, standalone,
    `ChangeDetectionStrategy.OnPush`, selector `app-rsvp-editor`. No inline `template:`/`styles:`,
    no `style` attribute, no `ngStyle` (CLAUDE.md rules 1–2).
  - Public API is exactly: `draft = input.required<RsvpDraft>()`,
    `perspective = input<…>('owner')` typed by a local `'owner' | 'couple'` union,
    `showStatus = input(false)`, `noteReadonly = input(false)`, and
    `draftChange = output<RsvpDraft>()` emitting a new `RsvpDraft` on every edit. No `roster`, no
    `showNote`, no `showAdd` (ADR W-0003 §Decision.6 and §"Explicitly out of scope"); no
    `onOpenProfile` **in this task** — it arrives with T269. The component performs **no** HTTP
    write and holds no dirty/saved state — the host saves.
  - Renders, in DS order: the attendance row (three `app-choice-card`s, only when `showStatus()`);
    the party **section heading** from `rsvp.editor.perspective.<p>.party`; the party meta line —
    `rsvp.editor.perspective.<p>.partyMeta` left, `rsvp.editor.total` right;
    one accordion card per participant (`partner1`, `partner2` if present, then each child), the
    first expanded by default, expansion state internal; the add-partner (hidden when `partner2`
    exists) and add-child links; and the note.
  - **The note honours `noteReadonly()`** (open question 2, decided 2026-08-22 — the couple must
    not be able to overwrite words a guest wrote to them). False (the guest): a
    `textarea[app-textarea]` bound to `partner1.options.comments` with
    `rsvp.editor.perspective.owner.notePlaceholder`. True (the couple): the note renders as
    **static text, not a disabled input** — no textarea in the DOM, nothing focusable — and when
    `comments` is empty the empty state `rsvp.editor.perspective.couple.notePlaceholder` ("No
    note left.") shows in the muted text style. This is a documented, deliberate deviation from
    the DS, which makes the couple's note editable. `noteReadonly()` never suppresses the note
    itself — the couple always *sees* it.
  - Each expanded card shows: first/last name inputs (child: first name + a 2-digit numeric age
    field), a remove control for everyone except `partner1`, diet chips, allergy chips, and a
    custom-allergy entry field — catalog chips from `WeddingConfigResponseDto.dietaryPreferences`
    / `.allergies` resolved to the current language, writing `options.dietaryPreferenceIds` /
    `options.allergyIds`. The collapsed card shows avatar, name (or
    `rsvp.editor.person.newGuest`), a role `app-pill`, and the DS summary line (age · diets ·
    allergies, else `noMealDetails`).
  - **Custom allergies are multi-entry** (open question 3, decided 2026-08-22 — this *replaces*
    the single free-text field both surfaces have today, and supersedes ADR W-0003 §Decision.5):
    a text input where Enter (and blur on a non-empty value) commits the trimmed text as its own
    chip, each chip individually removable, writing `options.customAllergies` as a **real
    multi-element array**. Empty and whitespace-only entries are ignored; a duplicate of an
    existing entry on the same person is ignored (case-insensitive, trimmed) rather than added
    twice. Committing an entry must not submit the surrounding form. Existing single-element
    `customAllergies` data renders as one chip, no migration needed.
  - Custom-allergy chips are visually distinguishable from catalog allergy chips — a catalog chip
    is a toggle (`aria-pressed`), a custom chip is a removable entry (its own `aria-label` from
    `rsvp.editor.person.customAllergy.remove`) — so the two are not mistaken for one control.
  - The party section heading is a **real heading element**, not a styled `div` — semantic level
    chosen to fit the host's outline (the guest screen's `<h2>` and the modal's title are both
    level 2, so `<h3>` here), so the section is reachable by heading navigation (CLAUDE.md rule
    14). It is the *only* place either surface names the party section: the couple's
    `You` / `Partner` / `Children` group headings do not come back — the per-card role pill
    replaces them (ADR W-0003 §Consequences).
  - The role pill reads `rsvp.editor.perspective.<p>.primaryHint` for `partner1` and
    `rsvp.editor.kind.{partner,child}` otherwise — so the same card reads "You" for a guest and
    "Main guest" for the couple, with **no** English literal anywhere in the template and no
    perspective `switch` returning strings in TypeScript.
  - Name lock (ADR W-0002 §Decision.3) is preserved: when `partnerHasAccount()` is true the two
    name inputs render as static text with the `shared.partner.nameManaged` hint, and the
    corresponding setters return early so a programmatic call cannot rename another guest's
    account. Remove is still allowed.
  - The component owns its catalog read (the singleton `WeddingConfigResponseDto` collection,
    `getByKey('')` — the identical read both hosts do today) so the hosts can drop theirs. Any
    internal view type (person card, resolved catalog option) stays **private to this file**, is
    not exported, and restates no API model — `RsvpDto`, `RsvpDtoAdultsPartner1Options` and the
    `RsvpDraft` family are imported (Hard rule 15).
  - Styling from `src/styles/_tokens.scss` semantic aliases only — no hex, no raw
    `--accent`/`--sub`/`--line`, no `@media (prefers-color-scheme: …)`, no new breakpoint. Cards
    stay flat (1px `--border-hairline`, no shadow). Chip markup stays internal to this component —
    do **not** add a shared `app-chip-toggle` (ADR W-0003 §Decision.8).
  - Accessibility: every chip is a `type="button"`; **catalog** chips (diet, allergy) are toggles
    carrying `aria-pressed`, while a **custom-allergy** chip is a remove control carrying an
    `aria-label` and **no** `aria-pressed` — a toggle state on a delete control would be an a11y
    defect. *(Corrected 2026-08-22: the first draft said "every chip carries `aria-pressed`",
    contradicting the custom-chip criterion above it; caught during T265 implementation.)*
    The card header
    carries `aria-expanded`; the remove control carries `aria-label` from `shared.remove`;
    keyboard-operable throughout (CLAUDE.md rule 14).
  - Unit spec covering at least: the participant total tracks the draft; toggling a diet chip
    emits a `draftChange` with that id added and the original draft object untouched; an
    account-holding `partner2` renders no name input; `showStatus()` false renders no attendance
    row; the `owner` and `couple` perspectives request different `party`/`primaryHint`/`partyMeta`
    keys, and the rendered heading text differs between the two; `noteReadonly()` true renders no
    `textarea` and shows the empty state when `comments` is blank; committing two custom allergies
    yields a two-element `customAllergies` array, a duplicate is ignored, and removing the first
    leaves the second.
  - Component validates against the design spec (`../wedding-ui-design/ui_kits/wedding-app/RSVPEditor.jsx`);
    exclusions listed in ADR W-0003 are absent by design, not by omission.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** in-repo ADR W-0003; ADR W-0002 §Decision.3–4; DS `RSVPEditor.jsx`;
  `src/app/shared/{avatar,pill,choice-card,input,textarea}/`;
  `src/app/core/helper/{rsvp-draft.ts,partner-account.ts}`; `src/styles/_tokens.scss`;
  existing implementations to mine (then delete in T266/T267):
  `src/app/screens/rsvp-edit/rsvp-edit.{ts,html,scss}`,
  `src/app/screens/guest-manager/modal/manage-rsvp-modal.{ts,html,scss}`

### T266 — Migrate the guest screen (`app-rsvp-edit`) onto `app-rsvp-editor`

- **Status:** done (uncommitted) — 2026-08-22. **44 insertions, 590 deletions** across
  `rsvp-edit.{ts,html,scss}` (382→124, 174→50, 274→110) plus a new `rsvp-edit.spec.ts`. Verified:
  the shared component, i18n files and `TASKS.md` were not touched; `<h2>` reads the single
  `rsvp.edit.title`; editor bound `perspective="owner"` with no `showStatus`/`noteReadonly`;
  `titleAttending`/`titleDeclined` still present for T268. One new SCSS rule
  (`app-rsvp-editor { margin-top: 22px }`) carries the deleted `.cards` spacing.
  **Not verified by the agent:** hand-check at mobile/desktop widths in all three themes — no
  browser available; needs a human pass on `pnpm start`.
- **Owner:** agent (implementer)
- **Depends on:** T265
- **Context:** `ScreenRSVPEdit.jsx` is now 55 lines: a header, `<RSVPEditor perspective="owner">`,
  "Change my answer", and a footer whose message comes from the shared validation helper. This
  task makes `app-rsvp-edit` the same shape. It is a net **deletion** — roughly 180 lines of TS,
  110 of template and 150 of SCSS move into the component built by T265. The guest gains catalog
  allergy chips alongside the custom-allergy entry field, and that field becomes multi-entry
  (open question 3); both are expected, not regressions.
- **Acceptance:**
  - `rsvp-edit.html` renders the header, `<app-rsvp-editor [draft]="draft()" perspective="owner"
    (draftChange)="onDraftChange($event)" />` (no `showStatus`), the "Change my answer" button and
    the footer. The editor is still not rendered for a `declined` RSVP — that stays a host decision.
  - `rsvp-edit.ts` keeps only: the `rsvp` input, the draft signal and its resync `effect`, the
    header `effect`, `dirty`/`saving`/`saveFailed`, `save()`, `onChangeAnswer()`, `seatsHeld` and
    the footer message. **Deleted**: `PersonCard`, `PersonKind`, `cards`, `unnamedCount`,
    `openKey`/`isOpen`/`toggleOpen`, `kindLabelKey`, `fullName`, `initial`, `dietLabel`,
    `allergiesText`, `summaryFor`, every per-person setter, `toggleDiet`, `setAllergies`,
    `setNote`, `noteText`, `canAddPartner`, `addPartner`, `addChild`, `removePerson`,
    `updateOptions`, `childIndex`, `inputValue`, the `weddingConfig`/`dietaryOptions` catalog read
    and the now-unused imports (`Avatar`, `Pill`, `TextInput`, `TextareaInput`,
    `TranslateLanguageService`, `WeddingConfigResponseDto`, `partnerHasAccount`,
    `withPersonOptions`, …).
  - The footer gate now uses `unnamedAdultCount(draft())` (T264) with
    `rsvp.editor.unnamed.*` via `PluralTranslatePipe`; save stays disabled while it is > 0 and the
    saved / unsaved / error states are unchanged.
  - `rsvp-edit.scss` keeps only host layout, header, "Change my answer", footer and the desktop
    card wrapper. **Deleted**: `.cards`, `.card`, `.card-head`, `.info`, `.name-row`, `.name`,
    `.summary`, `.chevron`, `.card-body`, `.row`, `.name-hint`, `.remove-btn`, `.label`,
    `.options-label`, `.diet-chips`, `.chip`, `.add-row`, `.add-link`, `.note-label` and the
    `textarea[app-textarea]` rule.
  - The party section heading now comes from the editor
    (`rsvp.editor.perspective.owner.party`) — assert the rendered text, not just the binding.
  - **The host `<h2>` becomes the screen-level title** (open question 4, decided 2026-08-22):
    it renders the single key `rsvp.edit.title` ("Your reply") in **both** the attending and
    declined states, so the `@if`/ternary that chose between `titleAttending` and `titleDeclined`
    for the heading is **deleted**. The section heading "Your party" now belongs to the editor.
    Verify in the running app that "Your party" appears exactly **once** on the guest screen.
    `declinedSub`, `seatsHeld` and the eyebrow are unchanged and still carry the status. This
    task changes no i18n file — T264 added `rsvp.edit.title`.
  - The two headings are distinct strings and neither repeats the other: the host says which
    record this is ("Your reply"), the editor labels the list below it ("Your party") — they
    answer different questions (ADR W-0003 §Decision.9).
  - Behaviour verified by hand at mobile and desktop widths in all three themes: expanding a card,
    editing names, toggling diet and allergy chips, typing the free-text allergy, adding/removing a
    partner and a child, the note, and a successful save round-trip; a locked partner's name is
    still read-only with its hint.
  - No new local type; no hardcoded colour/spacing/radius; no `pnpm gen:api` (the DTO is unchanged).
  - `pnpm typecheck && pnpm lint && pnpm test` green (lint: the known pre-existing
    `shared/modal/` errors only, unchanged).
- **Refs:** in-repo ADR W-0003 §Decision.2; DS `ui_kits/wedding-app/ScreenRSVPEdit.jsx`;
  `src/app/screens/rsvp-edit/rsvp-edit.{ts,html,scss}`; `src/app/screens/rsvp/rsvp.html`
  (call site — should need no change)

### T267 — Migrate the couple's manage-RSVP modal onto `app-rsvp-editor` (desktop + mobile)

- **Status:** done (uncommitted) — 2026-08-22. **48 insertions, 618 deletions** across
  `manage-rsvp-modal.{ts,html,scss}` (399→175, 229→52, 188→25) and `_shared-modal-form.scss`
  (pruned `.choice-row`, verified no other consumer referenced it), plus a new
  `manage-rsvp-modal.spec.ts`. Bound `perspective="couple" [showStatus]="true"
  [noteReadonly]="true"`; `.group-label` headings gone; footer gate moved to
  `unnamedAdultCount()`. Verified: shared component, i18n and `rsvp-edit/` untouched;
  `src/environments/release.ts`, regenerated as a side effect of one `pnpm build`, was reverted
  to its committed value. **Not verified by the agent:** hand-check at mobile/desktop widths in
  all three themes — no browser available.

> **Post-T266/T267 combined verification (coordinator, 2026-08-22):** both migrations together are
> **92 insertions / 1,208 deletions**. `pnpm typecheck` clean, `pnpm test` 35/35 across 7 files,
> `pnpm lint` shows only the 4 known `shared/modal/` errors. No collision between the two parallel
> agents: each stayed inside its own screen directory.
- **Owner:** agent (implementer)
- **Depends on:** T265
- **Context:** `ScreenGuestManager` and `ScreenGuestManagerMobile` both now render
  `<RSVPEditor perspective="couple" showStatus roster=… onOpenProfile=… />` in their edit branch —
  in this repo that is the single responsive `app-manage-rsvp-modal` (there is no separate mobile
  component), and `roster`/`onOpenProfile` are out of scope per ADR W-0003. **This is a visible UI
  change on the couple side**: flat always-open cards under `You` / `Partner` / `Children`
  headings become the same accordion the guest sees, with the role pill replacing the headings
  (ADR W-0003 §Consequences). The couple gains the multi-entry custom-allergy field (open
  question 3) and **loses the ability to edit the guest's note**, which becomes read-only on this
  surface (open question 2) — both are deliberate. Independent of T266;
  if both are in flight, expect no file overlap beyond `public/i18n/*.json`, which T264 already
  froze.
- **Acceptance:**
  - `manage-rsvp-modal.html`'s body is `<app-rsvp-editor [draft]="draft()" perspective="couple"
    [showStatus]="true" [noteReadonly]="true" (draftChange)="onDraftChange($event)" />` plus the existing
    "no RSVP yet" empty state and the save-failed alert. Modal chrome (`app-modal`, eyebrow,
    `app-decor-fish`, footer buttons) is untouched.
  - `manage-rsvp-modal.ts` keeps only: `open()`/`close()`/`goBack()`, the `userId` signal, the
    `rsvp` lookup and resync `effect`, `draft`, `saving`/`saveFailed`, `save()`, `guestFullName`,
    `modalTitle` and the footer message. **Deleted**: `PersonKind`, `PersonCard`, `CatalogOption`,
    `cards`, `partnerCard`, `childCards`, `mainCard`, `participantsCount`, `partnerNameOk`,
    `statuses`, `setStatus`, `isStatus`, every per-person setter, `toggleDiet`, `toggleAllergy`,
    `setNote`, `noteText`, `addPartner`, `removePartner`, `addChild`, `removeChild`,
    `childIndex`, `inputValue`, `toCatalog`, the `weddingConfig` catalog read and the now-unused
    imports (`NgTemplateOutlet`, `ChoiceCard`, `TextInput`, `TextareaInput`,
    `TranslateLanguageService`, `WeddingConfigResponseDto`, `partnerHasAccount`,
    `toggleOptionId`, `withPersonOptions`, …).
  - The footer gate switches from `partnerNameOk()` to `unnamedAdultCount(draft()) === 0` (T264),
    with the message from `rsvp.editor.unnamed.*` via `PluralTranslatePipe`. This is a deliberate
    widening: the main guest's own missing name now blocks the save too, and an account-holding
    partner no longer can (their name is read-only). Save still disabled while the gate is unmet.
  - `manage-rsvp-modal.scss` keeps only `.footer-note`, `.summary-empty`, `.form-error` and any
    remaining modal-body spacing. **Deleted**: `.rsvp-section`, `.section-head`, `.section-title`,
    `.section-count`, `.group-label`, `.person-card`, `.person-head`, `.person-name`,
    `.person-role`, `.person-fields`, `.child-fields`, `.locked-fields`, `.name-hint`,
    `.remove-btn`, `.add-link`, `.pill-label`, `.pill-row`, `.pill-toggle`, `.pill-empty`,
    `.choice-row`. If `_shared-modal-form.scss` is left with rules only this file used, prune them
    in the same PR.
  - The party section heading now comes from the editor and reads **"The party"**
    (`rsvp.editor.perspective.couple.party`) — assert the rendered text. It replaces both the
    old `guest_manager.rsvp.participantsSection` title and the `You` / `Partner` / `Children`
    group headings; no heading is duplicated against the modal's own title (the guest's name).
  - Verified by hand at mobile and desktop widths in all three themes: open a guest profile →
    Manage RSVP, change the attendance answer, expand/collapse participants, edit names and ages,
    toggle diet and allergy chips, type a free-text allergy, add/remove a partner and a child,
    edit the note, save, and confirm the list row and `StatisticService` counts update; "Back"
    still returns to the profile modal.
  - Existing guest-manager behaviour is otherwise unchanged — one row per couple, counts still
    from `StatisticService`, no change to `guest-manager.{ts,html,scss}` beyond imports if any.
  - No new local type; no hardcoded colour/spacing/radius; no `pnpm gen:api`.
  - `pnpm typecheck && pnpm lint && pnpm test` green (lint: the known pre-existing
    `shared/modal/` errors only, unchanged).
- **Refs:** in-repo ADR W-0003 §Decision.2, §Consequences; DS
  `ui_kits/wedding-app/ScreenGuestManager.jsx` (edit branch, L303–315) and
  `ScreenGuestManagerMobile.jsx` (L208–219);
  `src/app/screens/guest-manager/modal/manage-rsvp-modal.{ts,html,scss}`,
  `src/app/screens/guest-manager/modal/_shared-modal-form.scss`,
  `src/app/screens/guest-manager/guest-manager.html` (L267, call site — should need no change)

### T268 — Phase K sweep: retire the orphaned i18n keys and prove the duplication is gone

- **Status:** done (uncommitted) — 2026-08-22. **30 leaf strings removed per locale** across 17
  subtrees, each grep-verified dead (0 references in `src/`, specs included) before deletion. The
  `children` trap fired exactly as predicted: `guest_manager.rsvp.{you,partner}` were dead and
  went, `guest_manager.rsvp.children` is still used by `guest-profile-modal.html:103` and stayed.
  Dynamic key construction audited — no concatenated/interpolated key reaches a deleted namespace.
  Verified independently by the coordinator: all three files valid JSON, diff is deletions only
  (the two apparent additions are trailing-comma changes on last-in-object keys), key-set parity
  vs. `HEAD` unchanged, and **all 283 literal i18n keys referenced in `src/` resolve** except
  three pre-existing ones (below). Duplication proof: `.chip`/`.name-hint`/`.remove-btn`/
  `.add-link`, the `PersonCard`/`PersonRole`/`CatalogOption` view types, the draft mutations and
  the wedding-config catalog read each now have exactly **one** declaration, in
  `src/app/shared/rsvp-editor/`. Also amended the ADR with a `## Status update` section and
  trimmed three dead stub entries from `manage-rsvp-modal.spec.ts`.

> **Phase K complete (T264–T269), 2026-08-22.** Net effect: `rsvp-edit` {ts,html,scss} 382/174/274
> → 124/50/110 and `manage-rsvp-modal` 399/229/188 → 197/53/25 — **1,646 → 559 lines** across the
> two hosts, against 984 in the shared editor. Final state: `pnpm typecheck` clean, `pnpm test`
> 41/41 across 7 files, `pnpm lint` only the 4 known `shared/modal/` errors, `pnpm gen:api:check`
> no drift. **Nothing is committed** and **nothing has been verified in a browser** — every
> implementer flagged the same gap, so the hand-check at mobile/desktop widths across all three
> themes is the one outstanding acceptance criterion for T266 and T267.
>
> **Pre-existing issues surfaced by the sweep — NOT Phase K regressions, not fixed, no task
> opened yet:**
> 1. `config-manager.html:810,835,838` references `common.add`, `common.cancel`, `common.close`.
>    There is no `common` namespace in any locale file, and there was none at `HEAD` either — that
>    screen renders raw key strings today. Worth its own bug task.
> 2. After T267, `guest_manager.form.{age,allergies,childName,dietary,notes}`,
>    `guest_manager.action.{addPartner,addChild}` and `guest_manager.modal.commentsPlaceholder`
>    grep to zero references. They were outside T268's enumerated removal list so were correctly
>    left alone; a follow-up sweep could retire them (`guest_manager.form.{firstName,lastName}`
>    are still live, so the namespace cannot go wholesale).
> 3. `.remove-btn`/`.add-link` also exist in `rsvp-create.scss`, `.remove-btn` in
>    `config-manager.scss`, and `.summary-empty` in both `manage-rsvp-modal.scss` and
>    `guest-profile-modal.scss` — all unchanged from `HEAD`, on screens outside Phase K's two
>    surfaces. A genuine consolidation-task signal.
- **Owner:** agent (implementer)
- **Depends on:** T266, T267
- **Context:** T264 deliberately added the `rsvp.editor.*` namespace without removing anything, so
  the two migrations could land independently. Once both are in, a pile of keys is unreferenced
  and the old copy lives twice — which is how the next drift starts. This is a verification task:
  every deletion must be justified by a grep showing zero references, and nothing in it may change
  rendered behaviour.
- **Acceptance:**
  - Removed from all three `public/i18n/{en,es,fr}.json`, each verified unreferenced by a
    repo-wide grep of `src/` (report the grep in the PR): `rsvp.edit.{addPartner,addChild,noteLabel,notePlaceholder}`,
    `rsvp.edit.kind.*`, `rsvp.edit.person.*`, `rsvp.edit.footer.unnamed.*`,
    `guest_manager.rsvp.{attending,you,partner,participantsSection,total,mainGuest,partnerNameRequired}`,
    `guest_manager.rsvp.choice.*`. Keys still used elsewhere (e.g. `guest_manager.rsvp.summary`,
    `…manage`, `…participants`, `…children`, `…dietary`, `…none`, `…saveFailed`,
    `guest_manager.form.*`, `rsvp.edit.{eyebrow,titleAttending,titleDeclined,seatsHeld,declinedSub,changeAnswer,footer.saved,footer.unsaved,error}`)
    **stay**. Do not delete a key on the strength of its name.
  - The group-heading trio is the trap that rule exists for, so it is spelled out here: the shared
    editor's `party` heading + role pills retire the `You` / `Partner` / `Children` headings, and
    `guest_manager.rsvp.you` and `…partner` are used **only** at `manage-rsvp-modal.html:38,54`
    and so die — but `guest_manager.rsvp.children` is *also* used at
    `guest-profile-modal.html:103` (the RSVP summary stat) and **survives**. Grep each one; do
    not delete the set as a set.
  - `rsvp.edit.{titleAttending,titleDeclined}` are **retired here** — T264 replaced both with the
    single `rsvp.edit.title` ("Your reply") and T266 deleted the branch that chose between them.
    Confirm by grep that neither key has any remaining reference before deleting. Do **not** also
    delete `rsvp.edit.declinedSub`, `seatsHeld`, `eyebrow` or `title`: they are live host copy.
  - `rsvp.edit.*` allergy-note copy retired by the multi-entry change (T265, open question 3):
    grep for the old single-field placeholder key on both surfaces and remove it once the
    `rsvp.editor.person.customAllergy.*` set has replaced it.
  - The three files remain structurally identical (same key set) and valid JSON; the app renders no
    `MISSING` / raw-key text on any of the touched screens in any of the three languages.
  - A grep-backed statement in the PR that the RSVP-editing markup now exists **once**: no
    `.chip`/`.pill-toggle` chip-toggle rule outside `shared/rsvp-editor/rsvp-editor.scss`, no
    second `PersonCard`/`PersonKind` declaration, no second `toggleDiet`/`addChild`/`removeChild`
    implementation, no second wedding-config catalog read for diet/allergy options.
  - `src/app/core/helper/rsvp-draft.ts`'s doc comment is updated to name the shared editor as the
    consumer (it currently describes "the two editors that exist for it"), and ADR W-0003 gets a
    short `## Status update` line recording that Phase K landed. No other doc edits.
  - Zero behaviour change: no template restructuring, no styling change, no new component.
  - `pnpm typecheck && pnpm lint && pnpm test` green; `pnpm gen:api:check` still clean.
- **Refs:** in-repo ADR W-0003; `public/i18n/{en,es,fr}.json`;
  `src/app/core/helper/rsvp-draft.ts`; T256 (which added `rsvp.edit.footer.unnamed.*`, retired here)

### T269 — Couple: "Open their profile" from a locked partner name

> **Run order note (2026-08-22):** T269 runs **before** T268, despite the numbering. T269 *adds*
> `rsvp.editor.person.openProfile` to `public/i18n/*.json` while T268 *deletes* orphaned keys from
> the same three files — running them concurrently would collide, and sweeping last means T268
> greps a codebase in its final state.

- **Status:** done (uncommitted) — 2026-08-22. `openProfile = output<string>()` on the shared
  editor, guarded by `perspective() === 'couple' && !!card.accountId` and re-checked in the
  emitter; real `<button>` inside the existing `.name-hint`; re-emitted by `manage-rsvp-modal` to
  `guest-manager.openGuestProfile()` — the same path the guest-list row and `(back)` already use,
  no new parent path. One key added to each i18n file (`+1/-0`, nothing removed or re-worded):
  en "Open their profile", es "Abrir su perfil", fr "Ouvrir son profil".
  **Unsaved-edit decision: discard**, chosen deliberately because the adjacent "Back" button
  already discards via the same swap; `onOpenProfile()` resets the draft from the cached `RsvpDto`
  rather than relying on refetch, and a spec asserts reopening shows the stored reply.
  SCSS: `.add-link`'s accent-text-button body lifted into a local `%accent-link` placeholder that
  `.profile-link` also extends — tokens only. Verified: guest screen untouched (binds nothing,
  renders no trigger, asserted in spec); typecheck clean, 41/41 tests, 4 known lint errors.
- **Owner:** agent (implementer)
- **Depends on:** T267
- **Context:** Phase K open question 1, decided 2026-08-22 — build it. DS `RSVPEditor.jsx` L166
  renders an "Open their profile" action next to the "Name managed by their own guest account."
  hint in the `couple` perspective, and `ScreenGuestManager` wires it to swap the manage-RSVP
  overlay back to that partner's profile. Every piece already exists in this repo
  (`app-guest-profile-modal`, the parent overlay swap in `guest-manager.html`) — only the link is
  missing. It is scheduled **after** T267 so the migration lands first and this is a small,
  reviewable addition rather than noise inside a large diff. Note the deliberate asymmetry: this
  is a couple-only affordance on a shared component, so the guest side binds nothing.
- **Acceptance:**
  - `app-rsvp-editor` gains `openProfile = output<string>()` emitting the linked guest's id. It is
    the **only** perspective-specific action on the component; the trigger renders solely when
    `perspective() === 'couple'` **and** `partnerHasAccount()` is true for that card.
  - The trigger is a real `button` (not a styled `div`), keyboard-operable, with an accessible
    name from a new i18n key `rsvp.editor.person.openProfile` in all three
    `public/i18n/{en,es,fr}.json` — en "Open their profile". It sits with the
    `shared.partner.nameManaged` hint, per the DS.
  - `app-manage-rsvp-modal` re-emits it to `guest-manager`, which swaps the manage-RSVP overlay
    for `app-guest-profile-modal` on that guest — the same swap the parent already performs from
    the guest list. The guest screen (`app-rsvp-edit`) binds nothing and renders no trigger.
  - Unsaved-edit behaviour is explicit and documented in the task's PR description: either block
    the swap while `dirty` is true, or discard — do not silently drop pending edits without
    saying which was chosen.
  - Unit spec: `couple` + account-holding partner renders the trigger and emits the right id;
    `couple` + plus-one partner renders none; `owner` renders none even for a linked partner.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** DS `ui_kits/wedding-app/RSVPEditor.jsx` L166, `ScreenGuestManager.jsx`;
  in-repo ADR W-0003 §Decision.6; ADR W-0002 §Decision.3;
  `src/app/screens/guest-manager/{guest-manager.html,modal/guest-profile-modal.ts,modal/manage-rsvp-modal.ts}`

> **Phase K decisions (answered by the user, 2026-08-22).** All four open questions are resolved;
> the wording for the guest `<h2>` was confirmed in the same round. Recorded here because the
> task bodies cite them by number.
>
> 1. **"Open their profile" from a locked name — BUILD IT.** Scheduled as **T269**, after T267,
>    so it lands as a small reviewable addition rather than inside the migration diff.
> 2. **The couple's note is READ-ONLY.** A deliberate, documented deviation from the DS, which
>    makes it editable: the couple must not be able to overwrite words a guest wrote to them.
>    They still always see the note; "No note left." becomes an empty state, not a placeholder.
>    Implemented as `noteReadonly` on the shared component (T265), set by T267.
> 3. **Custom allergies become MULTI-ENTRY guest-typed chips.** Each entry is its own element of
>    `options.customAllergies`, matching how the contract types the field, and individually
>    removable. This **supersedes ADR W-0003 §Decision.5** (single-element array) and *replaces*
>    the free-text field on both surfaces — it is new UI in T265, not a port of what exists.
>    Existing single-element data renders as one chip; no migration.
> 4. **The editor owns the party section heading on both surfaces; the guest `<h2>` is
>    re-pointed.** "Your party" moves into the editor (`<h3>`), and the host heading collapses to
>    one new key `rsvp.edit.title` = **"Your reply"** for both the attending and declined states —
>    reusing the es/fr already shipped for `titleDeclined`, so no new translation is commissioned.
>    `titleAttending`/`titleDeclined` retire in T268. Deliberately **not** a status-driven
>    headline: the eyebrow ("CONFIRMED") and the subtitle already carry the status.
>
> **Copy sign-off (user, 2026-08-22).** The three `rsvp.editor.person.customAllergy.*` English
> strings authored during T264 — label "Anything else?", placeholder "Type an allergy and press
> Enter…", remove "Remove {{name}}" — are **approved as shipped**. They are settled copy now, not
> proposals; es/fr are already in place. Do not re-word them.
>
> Nothing in Phase K is blocked. **Still true, and still binding:** no further user-facing copy
> may be re-worded on an implementer's initiative — if a string looks wrong while building, flag
> it, do not change it.
