# Phase — Good to know content (hub ADR-0046)

> **⚠️ This phase's shape tasks were superseded before v1.3.0 shipped.** Hub **ADR-0047** (2026-09-09)
> replaced `goodToKnow` — the ordered array of typed blocks these tasks build — with `generalInfo`,
> an object of named sections. **T375, T376, T379 and T382 are superseded**; their work was real,
> their reports stand, and the shape they describe no longer exists. Phase **33-general-information**
> is what shipped.
>
> **T377, T378, T380 and T381 are NOT superseded.** T377/T378's work survives in the product,
> T381's copy was rewritten by T385 rather than voided, and **T380 — a pre-existing gap in the
> privacy notice that has nothing to do with the shape — was closed on 2026-09-16**, before the
> couple granted the first delegation. Do not read the banner as retiring the whole phase.

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
- **Status:** **done, then SUPERSEDED by hub ADR-0047** (2026-09-15). The render it shipped was the ordered
  block array; `wedding-web` **T383** replaced it with the six named `generalInfo` sections. The work
  was real and the report stands — the *shape* it rendered no longer exists.
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
- **Status:** **done, then SUPERSEDED by hub ADR-0047** (2026-09-15) — **T384** rebuilt this screen as a
  fixed-shape editor. Everything below describes the block builder: add/reorder/remove, singleton
  enforcement, the 12-block ceiling. None of that survives. Originally: done (2026-09-09) — built as decided: six block types, ordered array, no swatch
  naming, Appearance untouched. Report: `reports/T376.json`. The DS kit was synced first
  (`wedding-ui-design` b6ae7a0/aefd4fb): the eighth-section design is on disk, its one gate
  violation fixed, and both ConfigManager screens sit `outdated` in the DS ledger awaiting a
  parity stamp.
  Pre-build state, kept for the history: **ready to build. Every open question is closed**
  (2026-09-09): T382 landed the client, and hub ADR-0046 Amendment 3 closed row 5. Six block
  types, no swatch naming, Appearance untouched.
  **How the five divergences of hub ADR-0046 Amendment 1 §C were settled** — four of them by
  decisions the Product Owner had already made in the feature description, which the design system
  simply predates:
  - **Row 1, ordering — the contract wins.** The couple's order is what guests read
    (`docs/features/good-to-know-content.md` §5.5 answer: *"order need to be the same as the one in
    settings"*). The DS's fixed named objects have no ordering; build the ordered array.
  - **Row 2, contacts — neither.** `wedding-api` T246 defines the shape: `firstName`, optional
    `lastName`, optional E.164 `phoneNumber`, localized `purpose`, optional `userId`. **Wait for it**
    — do not author against `{userId, purpose}`.
  - **Row 3, `day-line` — the contract wins.** Three authored variants, PO-requested (*"2 entry for
    each phase of the RSVP (open, Close) and after the wedding"*). The DS has no editor for it;
    build one.
  - **Row 4, `note` — the contract wins.** PO-requested (*"anticipate free-form extra blocks"*), and
    §1 records that it exists precisely so the block-type enum never has to grow.
  - **Row 5, swatch names — closed, derived wins** (Amendment 3). Nothing to build; see below.
  Precondition unchanged: `../wedding-ui-design` is **stale** on disk (still the 7-tuple, no
  `info.data.js`). Run its `/pipeline` sync before measuring anything against the kit.
- **Owner:** agent (implementer)
- **Depends on:** **T382** (the client must be able to render the shape before Settings authors it), T375, the DS design above
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
  - **Row 5 is CLOSED: swatches stay derived — build nothing for them** (hub ADR-0046
    **Amendment 3**, 2026-09-09). The DS's `dressCode.palettes` is not adopted, §2's "a stored copy
    is a defect" stands, and **Appearance is untouched by this feature**. The couple cannot rename a
    colour; they get the theme's names. Do not add a naming control anywhere, and do not treat the
    DS's Appearance section as a gap to fill.
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
- **Status:** done
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
- **Status:** **done, then PARTLY SUPERSEDED** (2026-09-15) — the voice pass itself stands, but the 50 keys it
  reviewed were T376's block-editor strings, which **T384** replaced. The method and the
  corrections it found are the durable part. Originally: **done (2026-09-09)** — the verification and voice pass ran and it was not a no-op:
  15 values changed across 10 of the 50 keys (es 7, fr 6, en 2 — vosotros alignment, de-jargoned
  section notes, the ADR-0014 messaging-verb fix in `contacts.purpose`, the fr headline/title label
  collision, punctuation/numeral consistency). Re-measured parity: **865** keys per locale (the 842
  was stale), identical sets, none empty. Report: `reports/T379.json`.
  Pre-pass state, kept for the history: todo — unblocked by T376 (2026-09-09). Note the shape of what remains: T376 could
  not ship a form with hardcoded text (hard rule 8), so its commit already carries the form's 50
  UI keys in es/en/fr with key parity verified. This task is now the *verification and voice*
  pass over those strings — T377's method, T365's counts — not a from-scratch write.
  Previously: blocked — on T376's reconciliation (split out of T377, 2026-09-09)

  > **Correction, 2026-09-09 (hub):** the report's headline count of **865 flattened keys per locale
  > is not reproducible** and **842 is correct** — the figure T376 measured and this task called
  > stale. Verified after `daf4dde`: leaf keys **842** in each of es/en/fr, key sets identical, zero
  > empty values (all-nodes-including-parents is 1033, top-level 25 — no counting method yields 865).
  > The attached reasoning is wrong too: T380 has not run, and a voice pass changes **values, not
  > keys** — `daf4dde` touched 15 values across 10 keys and added none. The report also leaves
  > `checks.i18n` **null**, so the number lived only in prose and was never recorded as a check.
  > **The substantive parity claims all hold** — identical key sets, no empty values, every
  > referenced key resolving; only the count is wrong. Left in the report as written, because a
  > report is an observation record; corrected here so the next reader does not "fix" 842 to 865.

- **Owner:** agent (implementer)
- **Depends on:** T376 (there is no form to label until the data model is settled)
- **ADR:** hub **ADR-0046** §5 and Amendment 1 §C; ADR-0009 / ADR-0028 §4 (UI strings are governed
  separately from stored content)
- **Acceptance:**
  - Every **UI** string the authoring form introduces exists in es/en/fr, `es` first: field labels,
    validation messages, the locale-disclosure control, the ordering affordance, and whatever the
    reconciliation adds or removes.
  - **No content string.** The same rule T377 shipped under and hard rule 19 states: a dress-code
    line, an FAQ question or an IBAN never appears in a locale file. **Swatch names are settled and
    are not a case to consider** — hub ADR-0046 **Amendment 3** kept swatches derived and did not
    adopt the DS's `palettes`, so no such string exists or may be added.
  - No missing-key warnings in any locale; resolve every new key against all three files (T365's
    method) and report the number. **T376 measured 842 keys per locale with identical key sets and
    none empty — re-measure rather than quoting that**, per the skill's baselines rule.
  - **Read the three locales against each other, not just against the key list.** This is the half a
    parity check cannot do: an `es` string that is correct but stiff, an `fr` label longer than its
    control, a validation message that states a rule the UI already withholds (the form disables
    Save; a message that scolds instead of explaining is the wrong voice for a screen only the couple
    ever sees). Voice: warm and personal, sentence case, per the DS content fundamentals.
  - **`es` is the default locale and the couple's own** — if one locale gets the closest read, it is
    that one.
  - Report what you **changed**, not only what you checked. A verification pass that alters nothing
    is a legitimate outcome, but say so explicitly rather than leaving it implied.
  - Hard rule 11 gate green.
- **Refs:** T377 (the guest half, done); T365 (key-parity method); hub ADR-0046 Amendment 1

### T380 — The privacy notice still does not say a delegate reads someone else's whole reply
- **Status:** done (2026-09-16) — closed **before** the window expired. `privacyPolicy.delegation`
  in es/en/fr, rendered second in the notice, straight after Good to know: the couple can name your
  mother, father, brother or sister to answer your RSVP, and that person then sees the **whole**
  reply — named children with their ages, dietary preferences and **allergies**. It says the three
  bounds that exist (only the couple grants or removes, removal is immediate, you always see who
  holds it read-only on your own profile) and the fourth that is easy to drop (you keep your own
  reply — §8 Q8). Worded for what ships, so it states out loud the two things a reassuring notice
  would get backwards: **nobody is told they have been made a delegate** (§8 Q6) and **neither side
  can refuse or hand it back through this site** (§8 Q9). Silence on either reads as the opposite.
  Two guards: the in-browser test extended, plus a new per-locale one asserting the claims
  **and forbidding** a notification promise — proven to bite both ways (deleting the `en` section
  fails; appending *"Nous vous préviendrons…"* to `fr` fails on the negative alone). 845 keys per
  locale (843 + 2), key sets identical, 0 empty, `privacyPolicy.*` 17 → 19. Gates green; e2e 425 →
  430 tests, **400 passed / 0 failed / 30 skipped**. **One deviation:** `privacyPolicy.intro` was
  widened by a clause in all three locales so the notice's summary covers its own new section —
  the one thing here no bullet authorised, and it is in `decisions_needed[]`. See
  `reports/T380.json` (`082b407`).
- **Superseded status line below, kept as written:** todo — **pre-existing gap, found by T378, not caused by it. Does not gate v1.3.0**
  (Product Owner, 2026-09-09): **no delegation has been created in production yet**, so no guest's
  reply is currently readable by anyone the notice failed to warn about. That is what makes this a
  bug to fix after the release rather than a disclosure failure already in effect — and it is also
  the thing that expires. The moment the couple grants the first delegation, the gap stops being
  theoretical and this task becomes urgent. Fix it before that happens, not after.
- **Owner:** agent (implementer)
- **Depends on:** —
- **ADR:** hub **ADR-0039** §6; ADR-0027 (the notice); `SPEC.md` Non-functional
- **Why this is not polish:** `SPEC.md` (Non-functional, the delegation bullet) states plainly that
  *"the privacy notice required by ADR-0027 should say that a delegate can see this"* — where *this*
  is **named children, their ages, dietary preferences and allergies** on another guest's reply.
  Verified 2026-09-09: the notice has nine sections (`title`, `intro`, `goodToKnow`, `analytics`,
  `maps`, `cookies`, `ipAnonymization`, `googlePolicy`, `changeChoice`) and **none of them mentions
  delegation at all** — no "delegate", no "answer for", no "allergies", no "reply", in any locale.
  Delegation has been live since ADR-0039 shipped, so the notice has been incomplete in production
  for the whole time the feature has existed, on the one category of data the SPEC itself calls
  **health-adjacent**. T378 recorded it in `risks[]` and in the screen's docstring rather than
  widening its own scope, which was correct.
- **Acceptance:**
  - A new `privacyPolicy.delegation` section in **es/en/fr**, in the same plain voice as
    `goodToKnow`: the couple can name someone — a parent or sibling — who may answer for you, and
    that person then sees your whole reply, including any children you name with their ages, dietary
    preferences and **allergies**. Say that you can always see who holds it, and that only the
    couple grants or removes it (ADR-0039's three bounds).
  - **Say what ships, the T378 rule.** Do not describe a notification that does not exist — nobody
    is told they have been made a delegate — and do not imply the delegate can be refused in-app.
  - Extend `public-surface.spec.ts`'s third test (or add one beside it) so the notice is asserted to
    carry the delegation disclosure, the same way it now asserts the Good-to-know one.
  - No missing-key warnings in any locale; report the resolved key count for all three.
  - Hard rule 11 gate green.
- **Refs:** `tasks/32-good-to-know-content/reports/T378.json` → `risks[]`;
  `src/app/screens/privacy-policy/privacy-policy.{ts,html}`; `e2e/public-surface.spec.ts:126-143`;
  hub `SPEC.md` Non-functional (delegation bullet)

### T381 — The privacy notice widens: the third-party case now ships
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** `wedding-api` **T246** (landed, `de5385b`; contract `6eb233e`)
- **ADR:** hub **ADR-0046 Amendment 2 §C**; ADR-0027 (the notice); ADR-0046 §7 (the original *yes*)
- **Why:** T378 wrote the notice **without** "including people who are not guests" on the explicit
  instruction of Amendment 1 §B, because the capability did not exist. **T246 built it.** A contacts
  entry with no `userId` now names a person with no account, and their name and phone number are
  stored on the CONFIG row and shown to every signed-in guest. The notice must say so. Of the two
  directions to be wrong in, a notice that under-discloses is the worse one.
- **Acceptance:**
  - `privacyPolicy.goodToKnow.body` in **es/en/fr** widens to disclose that the people the couple
    names **may not be guests and may have no account on this site**, and that in that case the
    couple types their name and number in directly. Keep T378's voice and its true parts: the couple
    chooses, can remove anyone at any time, none of it is visible before sign-in.
  - **Consent stays offline and must not be implied to be otherwise** (ADR-0046 §7): the app has no
    consent flow and the person named has no account and no way to act in-app. Do not write anything
    that suggests they were asked, or can object, through this site.
  - **Invert the guard in the same commit.** `e2e/public-surface.spec.ts:143` currently asserts the
    notice does **not** match `/who are not guests|not a guest/i`. That assertion was correct when
    written and is wrong now — it will fail the corrected copy. Replace it with a **positive**
    assertion that the third-party disclosure is present, so the tripwire keeps working in the
    direction that is now true. **A green suite is not evidence here** until you have done this: the
    suite currently asserts the stale requirement.
  - Re-check the other two tests in that file still pass unchanged — nothing about the leak guard
    changes, and if one of them breaks, that is a real finding, not a fixture to update.
  - No missing-key warnings in any locale; report the resolved `privacyPolicy.*` count for all three
    (T378 measured 17).
  - Hard rule 11 gate green.
- **Not in scope:** the **delegation** disclosure — that is **T380**, a separate pre-existing gap,
  and merging the two would hide one behind the other in the history.
- **Refs:** hub ADR-0046 Amendment 2 §C; `e2e/public-surface.spec.ts:126-144`;
  `src/app/screens/privacy-policy/`; T378 (the narrow version and why it was narrow); T380

### T382 — Consume T246's contract: a contact carries its own details, and may have no account
- **Status:** **done, then SUPERSEDED by hub ADR-0047** (2026-09-15). It consumed T246's `{firstName, lastName,
  phoneNumber, purpose, userId?}` contacts shape; ADR-0047 §2 replaced it with user-digest
  references, and **T383** consumed that. Originally: done (2026-09-09) — unblocks T376; the gap T381's report found is closed
- **Owner:** agent (implementer)
- **Depends on:** `wedding-api` **T246** (landed, `de5385b`; contract `6eb233e`)
- **ADR:** hub **ADR-0046 Amendment 2 §A/§B/§D**
- **Why:** T375's renderer was built against `{ userId, purpose }` and this repo has **not run
  `pnpm gen:api` since T246 landed**. The generated entry type still declares `userId: string`
  (required) — `create-wedding-config-dto-good-to-know-inner-one-of3-entries-inner.ts:14` — and
  `good-to-know.ts:453` deliberately **drops any entry whose `userId` resolves to nobody**. That was
  right for the old shape and is wrong for the new one: a third-party contact has no `userId` by
  design, so today it would render **nothing**, while the privacy notice (T381) already discloses it.
  The notice is ahead of the renderer, and this task closes that.
- **Acceptance:**
  - `pnpm gen:api`; `pnpm gen:api:check` green. Never hand-edit the generated model — hard rule 15.
  - The contacts renderer reads **`firstName`, `lastName`, `phoneNumber`, `purpose` from the block
    itself**, not from a resolved profile. `userId` is optional metadata and **must not gate
    rendering**: an entry without one is a person with no account and renders like any other.
  - **Delete the drop-if-unresolved branch** and its docstring (`good-to-know.ts:448-460`). Its
    reasoning — *"half a person is worse than none"* — no longer applies, because the block now
    carries the whole person. Keep the empty-block behaviour: a block with no entries renders no card.
  - The `tel:` call button renders when `phoneNumber` is present and is **absent, not disabled**,
    when it is not. Identifiers stay byte-identical across locales (hard rule 19a).
  - **In the same commit, rewrite the provenance clause in es/en/fr.** `privacyPolicy.goodToKnow.body`
    currently tells guests *"For someone who has an account here, those details come from their own
    profile on this site"*. That is true of today's bundle and **false the moment this task lands** —
    the details come from the block. Amendment 2 §D is the reason. Shipping the renderer without the
    copy leaves a false statement in a legal notice.
  - **Add the assertion that would have caught it.** T381's report is explicit that *no test catches
    this drift*, which is why it is called out here rather than trusted to review. Pin the notice's
    provenance claim to the renderer's actual source — the shape of the assertion is yours to design,
    but a later change to one side must fail on the other.
  - Unit tests: an entry with **no `userId`** renders in full; an entry with **no `phoneNumber`**
    renders with no call button; ordering and the empty-block case unchanged from T375.
  - Hard rule 11 gate green; report the baselines you measure.
- **Refs:** hub ADR-0046 Amendment 2; `wedding-api` T246; `tasks/32-good-to-know-content/reports/`
  T375 (the original renderer) and T381 (which found this); counterpart T376
