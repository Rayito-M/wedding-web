# Phase — Good to know content (hub ADR-0046)

> T364 shipped Home's "Good to know" section as an honest empty state and said why in
> `src/app/shared/good-to-know/good-to-know.ts:4-17`: no dress-code / FAQ / gift concept existed
> anywhere in the product to render. Hub **ADR-0046** creates one — `goodToKnow` on the wedding
> configuration, an **ordered array of typed blocks** the couple authors in all three locales — and
> this phase is that follow-up.
>
> **The content is the couple's, never ours.** The four blocks the design system draws are the
> designer's guess at what guests ask (hub ADR-0046 §Context); hardcoding any of that copy — a
> dress-code line, an FAQ question, an IBAN — is the one thing this phase must not do. Every string
> a guest reads here comes from the config; every string *around* it (section chrome, buttons,
> empty states) is ordinary i18n.
>
> Sequence, as it actually went: **T375 done** and shipped in v1.3.0 with the guest strings (so
> **T377's guest half is done** and its authoring half is split to **T379**). **T378** is
> independent and gates the v1.3.0 deploy. **T376 is still blocked, but no longer for want of a
> design** — one exists as of 2026-09-08 and proposes a *different data model* from the one shipped;
> it is now a reconciliation, described in hub **ADR-0046 Amendment 1 §C**. T379 waits behind it.
>
> Phase is done when: a signed-in guest reads couple-authored content in es/en/fr in the couple's
> order; the couple can write and re-order every field in Settings; nothing from this feature is
> reachable without signing in; and `ScreenInfo` is stamped `implemented` in the DS ledger **with a
> green committed parity spec** (hub ADR-0044, amended 2026-09-06 — a passing functional suite is
> not evidence of design fidelity).

### T375 — Home's Good to know section renders the couple's blocks
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** `wedding-api` **T244** (the field must be in `contracts/openapi.json` first —
  `pnpm gen:api` is the first step of this task, not an assumption)
- **ADR:** hub **ADR-0046** §2/§3/§4/§6; ADR-0045 §4 (the section, the pill row); ADR-0044 (the DS
  is the spec, and where it is not — below)
- **Acceptance:**
  - `pnpm gen:api`; `pnpm gen:api:check` green. Never hand-write the block types — hard rule 15.
  - `shared/good-to-know/` renders `goodToKnow` from the wedding configuration the Home screens
    already fetch. **No new HTTP call and no new service** — the content rides the config read.
  - **Stored order is render order.** Iterate the array; never sort, group or re-arrange by type.
    On wide screens the DS distributes the same sequence into two columns
    (`ScreenInfo.jsx:169-186`) — that is layout, not a second ordering.
  - **Presence is the only switch.** A block that is not in the array renders nothing — no empty
    card, no placeholder. With no blocks at all (or the field absent), the section keeps **today's
    shipped empty state** (`home.goodToKnowEmpty.title`/`.body`, T365's key names). Do not build a
    per-block toggle; none exists and none may be invented (hub ADR-0046 §3).
  - **Per block type** (hub ADR-0046 §2):
    - `dress-code` — headline, body, optional note. **The swatch row is derived from the active
      theme, never authored and never stored** (`ScreenInfo.jsx:7-27`): read the resolved palette,
      so it can never disagree with the CONFIG `themeId`.
    - `gift` — intro prose, then the labelled rows the couple filled (a field they left empty is
      not a row), plus the Bizum line. **Copy button must not lie:** the DS mock flips to
      "Copied ✓" whether or not the clipboard call succeeded (`ScreenInfo.jsx:50-52`) — that is a
      mock artifact. On failure or refusal, no confirmation, and the value stays selectable by
      hand. Copy the whitespace-stripped value; render the value exactly as stored.
    - `faq` — single-open accordion in stored order, `aria-expanded`, **all entries closed on
      first render** (owner's decision, overriding the mock's `useState(0)` at
      `ScreenInfo.jsx:55`).
    - `contacts` — name, purpose line, phone, `tel:` call button. No WhatsApp, no email, no
      messaging affordance of any kind (hub ADR-0014).
    - `day-line` — the block stores **three** localized sentences; render exactly one, chosen by
      comparing today's `Europe/Madrid` date against the config's `rsvpDeadline` and `date`
      (hub ADR-0046 §4: on/before deadline → `rsvpOpen`; after deadline through the wedding day →
      `rsvpClosed`; after → `afterWedding`). The choice is computed in the client; **no stored
      field says which phase is current** and none may be requested.
    - `note` — title + prose. This is the couple's free-form block and renders as plain text.
  - **Never translate stored content, and never reformat an identifier.** Localized fields are
    picked by the active locale (the pattern milestone titles already use — data, not the translate
    pipe). The IBAN, BIC, account holder, Bizum number, contact names and contact phones are
    **byte-identical in every locale** (hub ADR-0046 §5): no locale-aware number grouping, no
    `Intl` formatting, no re-casing.
  - **Prose is plain text.** No Markdown parsing, no `innerHTML`, no sanitizer bypass — hub
    ADR-0046 §2 keeps the stored content plain precisely so no renderer is needed here.
  - Load/error behaviour is inherited from Home; this section adds no state of its own.
  - A `design-parity-info.spec.ts` measured against the served DS kit, per the harness in
    `e2e/helpers/ds-kit.ts` (block outline + the metrics T369/T373 established). Deviations that
    are the kit's own go to `../wedding-ui-design/contract/FINDINGS.md`, never reported as app
    defects.
  - Unit tests for: stored order preserved; absent block renders nothing; empty/absent field
    renders the existing empty state; the three day-line branches at their boundaries; the copy
    failure path showing **no** confirmation.
  - **New hard rule 19 in `CLAUDE.md`**, text to add verbatim (hub ADR-0046):
    > 19. **Good to know content is the couple's, and it is behind sign-in** (hub ADR-0046). Every
    > word a guest reads in that section comes from the wedding configuration's `goodToKnow`
    > blocks — **never** from a locale file, a constant or a component template. If you are about
    > to type a dress-code line, an FAQ question or an IBAN into `es.json`, stop: that is the
    > defect the feature exists to remove, and the four blocks the design system draws are the
    > designer's guess, not the couple's answers. Three rules travel with it. **(a)** Localized
    > fields are picked by locale like other stored content; **identifiers are not** — the IBAN,
    > BIC, account holder, Bizum number and contact names/phones render byte-identically in all
    > three locales, with no `Intl` formatting, grouping or re-casing (§5). **(b)** A copy
    > confirmation must never appear when the clipboard call did not succeed — the DS mock's
    > unconditional "Copied ✓" is a mock artifact, and a guest who believes a wrong IBAN is on
    > their clipboard is worse off than one told it failed. **(c)** None of this content — no
    > IBAN, no Bizum number, no contact phone — may render on any unauthenticated surface; it is
    > not part of *Public wedding info* and never will be.
  - `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` per hard rule 11; report the
    baselines you measured, not the ones in this file.
- **Refs:** hub ADR-0046; `src/app/shared/good-to-know/good-to-know.{ts,html}` (the empty state and
  its docstring — this task closes the follow-up recorded there);
  `src/app/shared/home-section.ts:19` (the `'info'` id is **pre-existing** and stays: shipped deep
  links use it — hub ADR-0046 §10); `../wedding-ui-design/ui_kits/wedding-app/ScreenInfo.jsx`
  (reference, with the two corrections above); counterpart `wedding-api` **T244**

### T376 — Settings grows an eighth section: authoring Good to know
- **Status:** blocked — **not on the design any more, on a reconciliation.** A design now exists
  (Claude Design, 2026-09-08: `SECTIONS` is an 8-tuple, `['info', 'Good to know', '07']`, and
  Appearance moved to `'08'`). But it proposes a **different data model** from the one this repo's
  client and the API already ship, in five ways — see hub **ADR-0046 Amendment 1 §C** for the table.
  This is therefore a **reconciliation task, not a build**: somebody must decide, row by row, which
  side wins, and rows 1 and 5 contradict decisions the Product Owner already made. Do not start it
  by picking one and coding.
  Two further preconditions: `../wedding-ui-design` is **stale** on disk (still the 7-tuple, no
  `info.data.js`) so run its `/pipeline` sync first, and §B of that amendment — the contacts shape —
  must be settled, since it changes what this screen authors.
- **Owner:** agent (implementer)
- **Depends on:** T375 (the block types and the generated client), the DS design above
- **ADR:** hub **ADR-0046** §2/§3/§8; ADR-0045 §3 (Settings inside Manage, its sections nested under
  `PlanRail`); ADR-0031 (three-locale authoring ergonomics)
- **Acceptance:**
  - `shared/config-sections.ts` gains the eighth section (`'08'`), and `PlanRail`'s nested Settings
    list picks it up without a second hand-maintained list.
  - The couple can **add, edit, re-order and remove** blocks; the saved order is what guests read.
    `dress-code`, `gift` and `day-line` can be added at most once each — the UI should not offer a
    second one rather than letting the API 400.
  - **Three-locale authoring, with the ergonomics hub ADR-0031 established:** a prose field takes
    one typed value and pre-fills all three locales, exposing the other two behind a disclosure.
    The API requires three values, not three *distinct* values — do not make the couple type
    everything three times.
  - **Identifier fields are single inputs**, visibly not per-locale (hub ADR-0046 §5), with the
    reason surfaced in the UI copy if a hint is needed: they are transcribed, not translated.
  - FAQ blocks enforce **3–10** entries and contacts **1–10** before save, with a message that says
    what is missing. A block cannot be saved half-built (hub ADR-0046 §2's recorded consequence).
  - **The day-line editor shows the live wedding date and RSVP deadline beside the three fields**
    (hub ADR-0046 §4): the sentence is authored, so nothing detects it going stale when a date
    moves. This is the mitigation the ADR names.
  - Save rides the existing config `PATCH` path (`config-manager.ts` → `wedding-config-data.service`
    → `PATCH /v1/config`), sending the **whole** `goodToKnow` array. Section Save stays in the
    section header (ADR-0045 §3).
  - **While here, fix a stale docstring found by the feature draft:** `config-manager.ts:158-160`
    still claims the save is local-only, contradicted by its own `save()`. One-line correction, in
    this task's commit, called out in the report.
  - No new component patterns: compose from the existing catalogue and the layout layer
    (ADR-0044 §7). Watch the per-component CSS budget — `config-manager` is at 16.81 KB against a
    17 KB error ceiling (hub `ARCHITECTURE.md`); if the section pushes it over, say so and stop
    rather than raising the ceiling.
  - Unit tests for ordering, the cardinality rules, the locale pre-fill, and the save payload shape.
  - Hard rule 11 gate green.
- **Refs:** hub ADR-0046 §8; `src/app/shared/config-sections.ts:12-35`;
  `src/app/screens/config-manager/config-manager.ts:158-160, 408-414`;
  `src/app/core/data/wedding-config-data.service.ts:44-55`

### T377 — Good to know strings in es/en/fr
- **Status:** **done (guest half, 2026-09-09)** — the guest-facing strings shipped inside T375 and
  are verified in all three locales. The **authoring-form half is split out to T379**, which is
  parked with T376: those strings cannot be written until the reconciliation decides what the form
  contains. Splitting rather than leaving this `todo` because an 80%-complete `todo` misreports the
  phase.
- **Owner:** agent (implementer)
- **Depends on:** T375 (and T376's strings once it unblocks)
- **ADR:** hub ADR-0046; ADR-0009/ADR-0028 §4 (UI strings are governed separately from stored
  content)
- **Acceptance:**
  - Every **UI** string this phase introduces exists in all three locales, `es` first: copy-button
    label and its failed/succeeded states, the call-button `aria-label`, accordion `aria` copy, the
    authoring form's labels, validation messages and the locale-disclosure control.
  - **No content string.** Section labels a guest reads come from the couple's block `title`; a
    dress-code line, an FAQ question or a gift intro must never appear in a locale file. If you
    find yourself writing wedding copy into `es.json`, stop — that is the defect this whole phase
    exists to remove (hard rule 19).
  - No missing-key warnings in any locale; verify by resolving every new key against all three
    files (T365's method), and report the number.
  - Voice: warm and personal, sentence case, per the DS content fundamentals.
  - Hard rule 11 gate green.
- **Refs:** hub ADR-0046 §5; T365 (the key-parity method and the `home.goodToKnowEmpty.*` naming
  convention)

### T378 — The privacy notice covers couple-entered contact details, and nothing leaks pre-sign-in
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** —
- **ADR:** hub **ADR-0046** §7; ADR-0027 (the privacy notice this amends); ADR-0039 (the existing
  precedent — the notice already has to say a delegate sees someone else's whole reply)
- **Acceptance:**
  - The privacy policy copy gains, in **es/en/fr**, a plain-language line that the site may show
    **contact details for people the couple names** to signed-in guests. Hub ADR-0046 §7 decided
    **yes** on disclosing this deliberately; it is not optional polish.
  - **Word it for what ships, and do not write "including people who are not guests"** (hub
    ADR-0046 **Amendment 1 §B**, 2026-09-09). A contact is currently a reference to a *user of this
    system*, so the third-party/maid-of-honour case §7 describes is decided but **not built**. A
    privacy notice that describes a capability the system does not have is worse than one that is
    merely narrow — it invites a reader to assume data is being collected that is not. The notice
    widens on the day that case ships, not before.
  - The same copy covers the couple's own bank details being visible to signed-in guests.
  - An e2e assertion that the **unauthenticated** landing page and the `GET /v1/config/public`
    response the app consumes carry **no** Good to know content — no IBAN, no Bizum number, no
    contact phone, no block of any kind. The API side is guarded by `wedding-api` T244/T245; this
    is the client-side half, and it is cheap.
  - Hard rule 11 gate green.
- **Refs:** hub ADR-0046 §7; hub `SPEC.md` → Non-functional (the third-party-contacts clause);
  hub `GLOSSARY.md` → *Public wedding info*, *Good-to-know contact*

### T379 — The authoring form's strings, in es/en/fr
- **Status:** blocked — on T376's reconciliation (split out of T377, 2026-09-09)
- **Owner:** agent (implementer)
- **Depends on:** T376 (there is no form to label until the data model is settled)
- **ADR:** hub **ADR-0046** §5 and Amendment 1 §C; ADR-0009 / ADR-0028 §4 (UI strings are governed
  separately from stored content)
- **Acceptance:**
  - Every **UI** string the authoring form introduces exists in es/en/fr, `es` first: field labels,
    validation messages, the locale-disclosure control, the ordering affordance, and whatever the
    reconciliation adds or removes.
  - **No content string.** The same rule T377 shipped under and hard rule 19 states: a dress-code
    line, an FAQ question or an IBAN never appears in a locale file. If the reconciliation adopts
    the DS's swatch **names** (Amendment 1 §C row 5), note that those are *authored content* and do
    not belong here either.
  - No missing-key warnings in any locale; resolve every new key against all three files (T365's
    method) and report the number.
  - Voice: warm and personal, sentence case, per the DS content fundamentals.
  - Hard rule 11 gate green.
- **Refs:** T377 (the guest half, done); T365 (key-parity method); hub ADR-0046 Amendment 1
