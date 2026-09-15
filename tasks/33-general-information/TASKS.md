# Phase — General information (hub ADR-0047)

> Hub **ADR-0047** replaced `goodToKnow` — ADR-0046 §2's ordered array of typed blocks — with
> **`generalInfo`**, an optional object of named sections, and added an authenticated
> `GET /v1/config/general-information`. Read ADR-0047 **§6** first: it lists exactly which parts of
> ADR-0046 survive, so you neither rebuild something superseded nor discard something that stands.
>
> **Phase 32's T375–T382 describe a shape that no longer exists.** They are not deleted and not
> renumbered; **T386** marks them superseded with the reason. Do not work from them.
>
> Two things from phase 32 **still hold and are not up for revisiting**: dress-code **swatches stay
> derived** from `themeId` (ADR-0046 Amendment 3, re-affirmed by ADR-0047 §6 — build nothing for
> naming them), and Good to know is Settings section **08** with Appearance at **07**
> (Amendment 4 §A).
>
> Order: **T383 → T384 → T385**; **T386** can run at any point.
>
> **T383 and T384 are ONE MERGE UNIT, and the tree is red between them.** `pnpm gen:api` — T383's
> first step — deletes the generated models `config-manager` still uses, so typecheck, unit, build
> and e2e all fail on that single file from T383's commit until T384 rewrites it. This is inherent
> to splitting render from authoring across a repo-wide codegen step; it is not a defect in either
> task. **Do not "fix" it with a compile stub in `config-manager`** — that puts throwaway code in
> the exact file T384 must write clean, and is how the block machinery gets smuggled back in.
> **Run T384 immediately after T383**, and do not cut a release between them.
>
> **The working tree holds ~30 uncommitted files from an earlier attempt, and they are stale.** The
> generated client there was regenerated against an *intermediate* API state — it still carries 14
> `good-to-know-*` models — and the hand-edits to `config-manager` and `shared/good-to-know` were
> written before `couple` became optional, before `purpose` returned, and before `faq`/`note` gained
> ids and titles. `pnpm gen:api` will replace the generated half. **The hand-written half is the
> Product Owner's to keep or discard — ask before assuming either** (`.agent/skills/task-management.md`
> §3: uncommitted work in the tree is not yours). Do not `git stash`, `git clean` or `checkout --`
> any of it.

### T383 — Render the `generalInfo` sections
- **Status:** done (2026-09-15) — built against the regenerated client (`d836e3c`); the section reads
  `GET /v1/config/general-information`, and the trade-off is in the report. **The hard-rule-11 gate is
  red and T383 cannot close it alone:** `pnpm gen:api` deletes the 14 `good-to-know-*` models, and
  `config-manager` at **HEAD** — not just in the stale tree — has 30 references to them and 18 to
  `config.goodToKnow`, so the app does not compile until **T384** lands. Typecheck, unit tests, build
  and e2e all fail on that one file and nothing else. **T383 + T384 are one merge unit.** Unit tests
  were proven green (20 new, 630 total, 0 failing) behind a reversible local stub, restored
  byte-identically. See `reports/T383.json`.
- **Owner:** agent (implementer)
- **Depends on:** `wedding-api` T247, T248, T249
- **ADR:** hub **ADR-0047 §1/§2**; ADR-0046 §6 and Amendment 3 (both unchanged)
- **Acceptance:**
  - `pnpm gen:api` first; `pnpm gen:api:check` green. Never hand-write the models — hard rule 15.
  - `shared/good-to-know` renders the named sections: `dressCode`, `gift`, `contact`, `faq`,
    `dayLine`, `note`. **Ordering is structural now** — each section has its own field, so render
    the design system's fixed order and **delete every trace of the block-array logic**: the
    iteration over `blocks`, any sort, any per-type dispatch, any `id`-keyed bookkeeping. Leaving it
    behind as dead branches is how the next reader concludes ordering is still authored.
  - **`contact` renders two groups**: `weddingPlanner` (name, phone, email) and `guest` (the same
    plus the **`purpose`** line — *what to ask them about*, which is the point of the section).
    A person with no `phoneNumber` renders with **no call button — absent, not disabled**.
  - `faq` and `note` are **arrays with ULID ids**; key the rendered rows by `id`, not by index.
    `note` carries a **`title`** — render it as the section label, never unlabelled prose.
  - `dayLine` still picks **one** of three variants client-side, by comparing today's
    `Europe/Madrid` date against the config's `rsvpDeadline` and `date` (ADR-0046 §4, unchanged).
    No stored field says which phase is current and none may be requested.
  - **Decide, and state the trade-off in the report:** does the section read
    `GET /v1/config/general-information`, or ride the config read Home already makes? The old design
    deliberately avoided a second HTTP call; the new route exists and composes the `couple` digest
    server-side. Either is defensible — an unexplained choice is not.
  - **Swatches stay derived from `themeId`.** Build nothing for naming them (ADR-0047 §6).
  - Identifiers render byte-identically across locales — no `Intl` formatting, grouping or re-casing
    on IBAN, BIC, account holder, Bizum number, or a contact's name or number (hard rule 19a).
  - Unit tests: a contact with no `phoneNumber` renders without a call button; an absent section
    renders nothing; the three `dayLine` branches at their boundaries; a `note` renders its title.
  - Hard rule 11 gate green.
- **Refs:** hub ADR-0047 §1/§2; `src/app/shared/good-to-know/`; counterpart `wedding-api` T249

### T384 — The authoring screen becomes a fixed-shape editor
- **Status:** todo — **next, and urgent**: T383 landed (`5583e1e`) and the tree is red until this
  task lands. See the merge-unit note in the phase header
- **Owner:** agent (implementer)
- **Depends on:** T383
- **ADR:** hub **ADR-0047 §1/§2**; ADR-0045 §3 (Settings inside Manage); ADR-0031 (authoring
  ergonomics); ADR-0046 Amendment 4 §A (section **08**)
- **Acceptance:**
  - Settings' Good-to-know section is **one editor per named section**, not a block builder. **No
    add/reorder/remove of blocks, no block ids, no singleton enforcement, no 12-block ceiling** —
    all of that machinery died with the array, and re-creating any of it is the failure mode this
    bullet exists to prevent.
  - `faq` and `note` remain **add/remove arrays** (1–10 each), their entries carrying ULID ids the
    editor mints.
  - **`contact` is a picker, not a form.** The couple chooses people who already hold accounts —
    the wedding planner, or guests — and types only the `purpose` line, on guest entries. Names,
    emails and numbers come from the account and are **not editable here**. A person with no account
    is added as a guest first; this screen does not create one.
  - Three-locale authoring keeps ADR-0031's ergonomics: one typed value pre-fills all three locales,
    the other two behind a disclosure, and a customized locale sticks. Identifiers are single inputs,
    visibly not per-locale.
  - Save rides the existing `PATCH /v1/config` path, sending the whole `generalInfo` object.
  - **The per-component CSS budget is a hard stop.** `config-manager` measured **16.85 kB** against a
    17 kB error ceiling in T376. If this section pushes it over, **stop and say so** rather than
    raising the ceiling — and re-measure rather than trusting that figure.
  - Unit tests for the cardinality rules, the locale pre-fill, and the save payload shape.
  - Hard rule 11 gate green.
- **Refs:** hub ADR-0047 §1/§2; `src/app/screens/config-manager/`; T376 (the array-shaped editor
  this replaces — read it for the parts that still apply, not for its data model)

### T385 — The privacy notice describes what actually ships
- **Status:** todo — unblocked by T383 (`5583e1e`); run it after T384 so the gate is measurable
- **Owner:** agent (implementer)
- **Depends on:** T383
- **ADR:** hub **ADR-0047 §3**; ADR-0027; ADR-0035 §7/§8
- **Why:** ADR-0047 §2 made a contact a **person with an account**, and §3 accepts a real widening:
  a signed-in guest now sees a listed person's **email and phone number**. T381's copy says the
  opposite in two ways — it promises people "who are not guests and have no account on this site",
  which is now impossible, and it says details come from a profile, which T382 made false and then
  true again in a different sense. The notice must be rewritten from what ships, not patched.
- **Acceptance:**
  - `privacyPolicy.goodToKnow.body` in **es/en/fr** says: the people listed in Good to know **hold an
    account on this site**, and states the kind — the couple, the wedding planner, or a guest; their
    **name, email and phone number** are shown **in that section**; and their number is **not** shown
    on their profile, where it stays visible to the couple only (ADR-0035 §7/§8 is untouched).
  - It says the couple lists people **with their agreement**, obtained outside the site.
    **It must not say the site enforces or verifies that authorization** — nothing records it, and a
    notice describing a capability the system lacks is the exact defect T381 was written to fix.
    This is that trap pointing the other way.
  - **Invert T381's positive assertion in the same commit as the copy.** `e2e/public-surface.spec.ts`
    currently asserts the notice *contains* the no-account phrasing; that will fail, and it must
    become an assertion of the account-holder wording instead. **A green suite proves nothing here
    until you have done it** — the suite is asserting the previous requirement.
  - Extend `e2e/public-surface.spec.ts` to assert **no `couple`, no email and no phone number**
    reaches any unauthenticated route — the client-side half of `wedding-api` T247.
  - No missing-key warnings in any locale; report the resolved `privacyPolicy.*` count for all three,
    **measured this run**.
  - Hard rule 11 gate green.
- **Not in scope:** the **delegation** disclosure — that is **T380**, still open and still
  pre-existing. Merging them would hide one behind the other in the history.
- **Refs:** hub ADR-0047 §3; `e2e/public-surface.spec.ts:126-145`; T378, T381, T382 (the three
  previous versions of this copy and why each was worded as it was); T380

### T386 — Mark phase 32's superseded tasks, and say why
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** —
- **ADR:** hub **ADR-0047**
- **Acceptance:**
  - In `tasks/32-good-to-know-content/TASKS.md` and in `tasks/README.md`, mark **T375, T376, T379,
    T382** as **superseded by ADR-0047**, naming the replacement task. **T377, T378, T380 and T381
    are not superseded** — T377/T378 are done and their work survives, T380 is an open pre-existing
    gap unrelated to the shape, and T381's copy is rewritten by T385 rather than voided.
  - **Never renumber and never delete** (`.agent/skills/task-management.md` §1). A superseded task
    keeps its number, its text and its report; only its status line changes, and it says why.
  - Each note is one sentence and names what replaced it, so a reader arriving from an ADR
    cross-reference lands somewhere useful instead of on a task describing a dead shape.
- **Refs:** `.agent/skills/task-management.md` §1; hub ADR-0047


### T387 — Two things in the tree that must not reach a release
- **Status:** todo — **gates the v1.3.0 tag**, not T384
- **Owner:** agent (implementer)
- **Depends on:** —
- **ADR:** none — both are working-tree debt, surfaced by T383's `risks[]`
- **Why:** neither is this phase's work, and both would ship silently:
  - **`wedding-config-data.service.ts:41`** — `add()` returns
    `throwError(() => new Error('WeddingConfigPublic reaction suspended'))` with the real call
    commented out. **Config creation is dead code.** It is also the source of the one new lint error
    T383 measured. Nobody has said whether this was a deliberate hold or a debugging leftover —
    find out before deleting or restoring it, because the two answers have opposite fixes.
  - **`src/environments/release.ts`** carries a **hand-edited** build stamp. Its own docstring says
    the file is written by `pnpm build:prod` and *"any manual edit is overwritten on the next
    build"* — so this is harmless until someone reads it as the released commit. Restore it to the
    committed placeholder and let the build own it.
- **Acceptance:**
  - Both resolved, each in its own commit with the reason stated.
  - **`CLAUDE.md` hard rule 11's lint exception says 4 pre-existing errors; there are 5.** The
    uncovered one is an unused `WeddingGuestsService` import at
    `src/app/screens/guest-manager/modal/guest-profile-modal.ts:25`, present at HEAD and outside the
    written clause. Raised twice now (T381, T383) and quoted as sanctioned every time a baseline is
    reported. Either fix the import or widen the clause to name it — **not both**, and say which and
    why. A documented exception that does not match the count teaches every future reader to trust
    the number over the code.
  - Re-measure the lint baseline afterwards and state the new figure.
- **Refs:** T383's `risks[]`; `CLAUDE.md` hard rule 11
