# ADR W-0003: One shared RSVP editor for the guest and couple surfaces

- **Status:** accepted
- **Date:** 2026-08-22
- **Deciders:** wedding-web architect (this repo)
- **Scope:** wedding-web (in-repo). No contract change, no glossary change, no design-system
  change, no `pnpm gen:api`.

## Context

The design system (`../wedding-ui-design`, commit `a2ce7cf`, refined by `f26c721`) extracted a
single component — `ui_kits/wedding-app/RSVPEditor.jsx` — and rewired every screen that edits an
RSVP to use it: `ScreenRSVPEdit` (the guest's own reply) and `ScreenGuestManager` /
`ScreenGuestManagerMobile` (the couple managing someone else's). The header comment states the
intent plainly:

> One RSVP editor, used everywhere an RSVP is edited: the guest's own screen, and the couple's
> guest-manager modal/sheet. The only thing that varies is `perspective` — who is filling it in —
> which drives section titles and copy.

`RSVPEditor` takes `perspective` (`owner` · `partner` · `couple` · `delegate`), which indexes a
copy table (`RSVP_PERSPECTIVE`, L10–15) supplying **seven** strings: `primaryHint` (the primary
participant's role label), `party` (the party **section title** — "Your party" / "The party" /
"Their party"), `partyMeta` (the meta line under it), `note`, `notePlaceholder`, `addPartner` and
`addChild`. Everything else — accordion participant cards, name lock, diet chips, allergy chips,
free-text allergy note, participant total, add/remove — is identical across perspectives.

One fidelity note, so it is not mistaken for an oversight later: `cfg.party` is **defined in the
table but never referenced by `RSVPEditor.jsx`'s own render** (L228 uses `cfg.partyMeta` only) —
in the DS the section title is still a literal in each host screen (`ScreenRSVPEdit.jsx` L18
hard-codes "Your party"). The web renders `party` *inside* the editor, from the perspective
namespace. That is a small deliberate extension of the DS, and it is the whole point of the
change: the section title is exactly the string that should follow the context flag rather than
being restated by every host.

This repo went the other way. Two editors were built independently and have drifted:

| | `src/app/screens/rsvp-edit/` (guest) | `src/app/screens/guest-manager/modal/manage-rsvp-modal.*` (couple) |
|---|---|---|
| Participant cards | accordion (avatar, pill, summary line, chevron) | flat, always open, under `You` / `Partner` / `Children` group headings |
| Dietary | chips from `WeddingConfigResponseDto.dietaryPreferences` | chips from the same catalog, different class + markup |
| Allergies | **free text** → `options.customAllergies[0]` | **chips** from `.allergies` → `options.allergyIds` |
| Attendance status | not editable (host offers "Change my answer") | three `app-choice-card` buttons |
| Name lock (ADR W-0002) | `[disabled]` inputs + hint | fields collapse to static text + hint |
| Validation | `unnamedCount` (excludes a locked partner) | `partnerNameOk` (partner only) |
| Local view types | `PersonKind`, `PersonCard` | `PersonKind`, `PersonCard`, `CatalogOption` |

The two files carry ~250 lines of near-identical draft-mutation logic (`toggleDiet`, `setNote`,
`addPartner`, `removePartner`, `addChild`, `removeChild`, `childIndex`, `inputValue`,
`cards`, the wedding-config catalog read) and two SCSS files that restate the same chip, card,
remove-button and add-link vocabulary with different class names and different values. The
allergy row is a genuine behavioural fork: a guest's typed allergy is invisible to the couple's
editor and vice versa, even though both fields ride the same `options` object on the same record.

## Decision

1. **One component: `app-rsvp-editor`**, three files under
   `src/app/shared/rsvp-editor/rsvp-editor.{ts,html,scss}`. It owns the whole editable body of an
   RSVP: the optional attendance row, the party section heading and its meta line with the
   participant total, the
   accordion participant cards (name/age fields, name lock, diet chips, allergy chips, free-text
   allergy note, remove), the add-partner / add-child links, and the note. `src/app/shared/` is
   the right home — precedent `shared/rsvp-status-tick/` shows domain-shaped shared components
   already live there, and neither `screens/rsvp-edit/` nor `screens/guest-manager/` may own a
   component the other imports.

2. **The host keeps chrome, persistence and gating.** Page/modal header, footer, save button,
   dirty/saved state, the `PATCH`, "Change my answer", "Back", and the decision whether to render
   the editor at all (a declined RSVP does not show a party) stay with `app-rsvp-edit` and
   `app-manage-rsvp-modal`. This mirrors the DS, where each screen supplies its own footer and
   calls the exported `rsvpIssueText` for the message.

3. **`perspective` is a plain local string union, and it ships with two members: `'owner' | 'couple'`.**
   It is a pure presentation concern with no API counterpart, so CLAUDE.md Hard rule 15 does not
   apply and no generated type may be pressed into service for it. The DS's `partner` (copy-identical
   to `owner`) and `delegate` (SPEC J3, not built in this repo) members are **not** added until a
   call site exists — an unreachable perspective means untranslated keys nobody notices.

4. **Section titles and copy come from i18n, keyed by perspective**, under
   `rsvp.editor.perspective.<perspective>.*`. The DS's `RSVP_PERSPECTIVE` table is a copy table;
   in this repo copy lives in `public/i18n/{en,es,fr}.json` (Hard rule 8), so the table becomes a
   key namespace and the component composes the key from the input. No English literal in the
   template, no per-perspective `switch` in TypeScript returning strings.

5. **Allergies are unified to "chips + free-text note", as the DS does.** Both surfaces render the
   configured allergy catalog as chips (`options.allergyIds`) *and* a free-text field for anything
   the catalog doesn't cover (`options.customAllergies`). Both fields already exist on the
   generated `RsvpDtoAdultsPartner1Options`; no contract change is needed. The guest gains the
   catalog, the couple gains the free text, and an allergy typed on one surface is finally visible
   on the other.

   **Amended 2026-08-22 (user decision, Phase K question 3):** the free-text field becomes a
   **multi-entry** control — the guest types an entry, it commits as its own removable chip, and
   `options.customAllergies` is written as a real multi-element array rather than the
   single-element `[0]` convention `app-rsvp-edit` uses today. This matches how the contract types
   the field and makes entries individually removable. Existing single-element data renders as one
   chip, so no data migration is implied. This is new UI in T265, not a port of the DS, which
   still shows a single free-text note.

6. **Amended 2026-08-22:** `noteReadonly` joins `showStatus` as a second implemented flag (Phase
   K question 2 — the couple's note is read-only, a deliberate deviation from the DS), and
   `onOpenProfile` moves *into* scope as `openProfile`, built by T269 (Phase K question 1). The
   reasoning below stands for `showNote`/`showAdd`, which remain unimplemented.

   **`showStatus` is the only DS flag implemented.** `couple` passes it, `owner` does not (the
   guest changes their answer through the create flow). The DS's `showNote` and `showAdd` are
   `true` at every call site the web has, so they are **not** built — an input with one possible
   value is dead API. Documented here so the omission reads as a decision, not an oversight.

7. **Validation stays in `core/helper/rsvp-draft.ts`**, next to the draft shape both hosts already
   share, as the DS keeps `rsvpIssues`/`rsvpIssueText` next to the editor for its callers' footers.
   One exported function counts adults missing a first or last name, excluding an account-owning
   partner whose name is locked (ADR W-0002 §Decision.3) — the guest's current rule, which is the
   correct one: a gate the user cannot satisfy is not a gate. It replaces `RsvpEdit.unnamedCount`
   and `ManageRsvpModal.partnerNameOk`.

8. **The chip control stays internal to the editor.** The DS keeps `RSVPChips` as a private helper
   inside `RSVPEditor.jsx` rather than promoting it to `components/core/`; this repo does the same
   rather than adding a shared `app-chip-toggle`. A new shared component would be a design-system
   question (there is no chip-toggle spec in `../wedding-ui-design/components/core/`), i.e. an
   escalation, and nothing outside this editor needs one.

9. **Two headings, two owners: the guest screen's page headline is status-driven and stays with
   the host; the party section heading is perspective-driven and belongs to the editor.** They
   answer different questions — "what did you answer?" versus "who is in this party?" — and
   collapsing them is what produced the "Your party" / "Your party" stack the first draft of
   these tasks would have shipped. The headline is therefore **not** a perspective string and
   never moves into the editor; the couple's modal already has the guest's name as its title and
   needs no equivalent.

   **Wording settled 2026-08-22 (user decision, Phase K question 4).** The editor owns the party
   section heading on *both* surfaces — "Your party" for `owner`, "The party" for `couple`. The
   guest host `<h2>` collapses to a single new key `rsvp.edit.title` = **"Your reply"**, used in
   both the attending and declined states; `titleAttending`/`titleDeclined` retire in T268, and
   the es/fr already shipped for `titleDeclined` carry over, so no new translation is
   commissioned. A status-driven headline was considered and rejected: the eyebrow
   ("CONFIRMED") and the `seatsHeld`/`declinedSub` subtitle already carry the status, so a
   sentence heading would have repeated them.

   Note the standing rule this ADR is now the record of: an earlier draft of these tasks asserted
   this decision *before* the user had made it, and re-valued shipped copy on that basis. No
   user-facing string may be re-worded on an implementer's or architect's own initiative — flag
   it as a question instead.

   Only **two** headline variants are reachable: `screens/rsvp/rsvp.html` L3 renders
   `app-rsvp-edit` solely when `isDecided()` is true (attending or declined) — a `pending` RSVP
   goes to `app-rsvp-create` instead. Do not build a `pending` headline; it would be dead copy.

## Explicitly out of scope (unchanged from ADR W-0002)

`RSVPEditor` also carries, for every adult, a phone field, an email field, an "Own account &
invitation" toggle, and a roster lookup that offers to link an existing guest account
(`rsvpFindAccount`, the "Link account" card). All of it is **excluded**, for the reasons ADR
W-0002 §"Explicitly not decided" already records: guest-initiated account provisioning is an
auth-model question for the hub, and there is no guest-readable guest-search endpoint. The
editor therefore renders no phone, no email, no account toggle, and no roster match, and takes no
`roster` input. The DS's `needPhone` validation issue is excluded with them.

`onOpenProfile` (the DS's "Open their profile" link on a locked name, wired only in the couple
perspective) is likewise not built in the first pass — it needs the guest-manager's
profile/RSVP modal swap plumbing and only makes sense on one of the two surfaces. See the open
question in `TASKS.md`.

## Consequences

- The couple's manage-RSVP body changes visibly: flat cards under group headings become the same
  accordion the guest sees, and the `You`/`Partner`/`Children` headings are replaced by the
  per-card role pill. This is the point of the change, not a regression.
- Two SCSS files shrink to host chrome only; the chip/card/remove-button vocabulary exists once.
- The local `PersonCard` / `PersonKind` / `CatalogOption` view types collapse into one internal
  set inside the editor. None of them is an API model, so Hard rule 15 is unaffected; the editor
  keeps importing `RsvpDto`, `RsvpDtoAdultsPartner1Options` and the `RsvpDraft` family rather
  than restating any of them.
- A future `delegate` perspective (SPEC J3) is one union member and one i18n block, not a third
  editor.

## Status update

**Phase K landed (2026-08-22, T264–T269).** `app-rsvp-editor` is live on both surfaces; the
per-screen `PersonCard`/`PersonKind`/`CatalogOption` types, the `toggleDiet`/`addPartner`/
`addChild` mutations, the wedding-config catalog read and the chip/card/remove/add SCSS
vocabulary now exist once, in `src/app/shared/rsvp-editor/`. T268 retired the i18n keys the
migration orphaned. Note §Decision.5 (single-element custom allergy) was superseded before the
build by the Phase K decision to make custom allergies multi-entry chips.

## References

- DS: `ui_kits/wedding-app/RSVPEditor.jsx` (commit `a2ce7cf`), `ScreenRSVPEdit.jsx`,
  `ScreenGuestManager.jsx`, `ScreenGuestManagerMobile.jsx`, `ScreenRSVPCreate.jsx`,
  `components/core/Input.jsx` + `Input.d.ts` (`disabled`, commit `f26c721`)
- Hub: `SPEC.md` J2 (guest RSVPs for their party), J3 (delegate — not built), J4 (couple manages
  guests); ADR-0022 (single mutable RSVP), ADR-0024 (participants, diet & menu)
- In-repo: ADR W-0002 (partner account vs. plus-one), ADR W-0001 (data layer), CLAUDE.md Hard
  rules 1–3, 5, 8, 15
- Code: `src/app/core/helper/rsvp-draft.ts`, `src/app/screens/rsvp-edit/`,
  `src/app/screens/guest-manager/modal/manage-rsvp-modal.*`
- Tasks: `TASKS.md` T264–T268
