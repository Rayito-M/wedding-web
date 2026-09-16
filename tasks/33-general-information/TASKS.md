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
- **Status:** done (2026-09-15) — the merge unit is closed: `pnpm typecheck` is green at HEAD alone
  for the first time since `5583e1e`. Two things the task text could not have known. **(a)** HEAD
  carried **22** typecheck errors, not 21: the 22nd was `login.service.ts`'s missing
  `wedding-planner` landing row, which T383's `gen:api` made mandatory (ADR-0047 §7) and which
  lived only in the uncommitted tree — committed separately as `11189ec`, with the owner's
  approval, because the merge unit does not compile without it. **(b)** Section **presence is
  derived from content** rather than from a control, which is how the add/remove affordances could
  go entirely; an all-blank section raises no issue and is dropped from the payload. The CSS budget
  was re-measured, not trusted: **16.85 kB**, unchanged, because the section adds no CSS.
  **Hard rule 11 is still red, for nothing this task owns:** lint carries T387's two items, and all
  30 e2e failures are `design-parity-info.spec.ts` asserting the block-array render against mocks
  that still serve `goodToKnow` — T383's surface, invisible until the app compiled. See
  `reports/T384.json`.
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
- **Status:** done (2026-09-15) — the notice is rewritten from what ships in es/en/fr, and
  `e2e/public-surface.spec.ts` changes in the same commit. Three guards, each **proven to bite**
  rather than asserted: T381's no-account clause is inverted (and **T382's provenance clause went
  with it** — the editor now *picks* an account and copies its digest, so *"the couple types their
  name and number in directly"* is as false as the sentence it replaced); the poisoning test poisons
  **`generalInfo`** plus the `couple` attribute ADR-0047 §5 uses as its worked example; and a new
  test walks all three unauthenticated routes asserting no `couple`, no email and no phone number,
  on the wire and in the DOM. **Amendment 3 §A forced a fifth claim the task text could not have
  known about:** digests are stored verbatim, so the honest notice has to say that closing an
  account does **not** remove that person — `wedding-api` T251 is the commit that revisits it.
  Suite 420 → **425** (the new test × 5 projects), 0 failed, 30 skipped; the residual flake is still
  the ds-kit harness (T389), 9 → 4. See `reports/T385.json`.
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
  - **The same file still asserts and poisons `goodToKnow`, an attribute that no longer exists**
    (found by T388, which left it deliberately because you own this file). It **passes**, which is
    the problem: a leak guard aimed at a field the API cannot return proves nothing. Re-point the
    poisoning test at **`generalInfo`** — with a real IBAN, a Bizum number and a contact phone in the
    ADR-0047 shape — so it is testing the attribute that actually carries the PII. Prove it bites
    the way T378 and T382 did: inject the value into an unauthenticated surface, watch it fail,
    restore, re-run.
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
- **Status:** done (2026-09-15) — all three resolved; lint is **6 → 4**, and the measured count
  matches hard rule 11's written clause for the first time. **The `add()` question has an answer:
  debugging leftover**, confirmed with the Product Owner before anything was touched — it lives in
  no commit (HEAD always had the live call), its message names the *public* entity inside the
  *admin* service, it uses neither of this repo's documented hold idioms, `wedding-api` still serves
  `POST /v1/config` to bride/groom, and **nothing anywhere calls `weddingConfigCollection.add()`**,
  so there was no misbehaviour for a hold to hold back. Restored in place — which is why it has
  **no commit**: the file is byte-identical to HEAD again. Two things the task text could not have
  known. **(a)** The "committed placeholder" `release.ts` was to be restored to is itself a stale
  hash (`f4ee01c`), *not* the `'dev'` placeholder its own docstring and
  `scripts/generate-release.mjs` both promise — restoring literally would have reinstated the same
  hazard, so `'dev'` was committed instead. **(b)** The unused import was the last reference to a
  commented-out `inject(WeddingGuestsService)` whose doc block also claimed, falsely, that no
  `Guest` entity exists; the dead symbol and its prose went with it. `CLAUDE.md` is deliberately
  **untouched** — the "not both" constraint. **The e2e gate is red for nothing this task owns:** all
  9 failures are the T389 ds-kit harness timeout at `e2e/helpers/ds-kit.ts:121-122`, and four runs
  produced four **disjoint** failing sets — the flake is now heavier than T388 measured it. See
  `reports/T387.json`.
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

### T388 — The e2e fixtures still serve the block array, so 30 specs assert a dead render
- **Status:** done (2026-09-15) — the 30 are gone: `design-parity-info.spec.ts` is **45/45 green**
  (9 tests × 5 projects, up from 6 × 5) and the suite is **420 tests, 0 assertion failures, 30
  skipped** (the same six pre-existing `test.skip`/`test.fixme` declarations as before). Counts
  measured this run, not inherited: the **baseline was 405/32 failed/343 passed**, i.e. 30 in this
  spec plus **2 the task text did not know about** — and those 2 turned out to be the same
  DS-kit-harness flake described below, not a second defect. **The residual flake is the
  `ds-kit` harness, not this phase**: `e2e/helpers/ds-kit.ts` starts one `python3 -m http.server`
  per project and every parity spec navigates it concurrently, so a `page.goto`/first-click can
  exceed the 30s test timeout under load. A plain run left 6 such timeouts across **four**
  different parity specs (home, dashboard, overview, info); `--retries=2` leaves **0 failed, 3
  flaky, 387 passed**, all three in specs T388 never touched. Two deviations from the task text,
  both forced by the contract: the app renders **six** sections against the kit's five, and the
  fixture's no-number contact has to be the **groom**. See `reports/T388.json`.
- **Owner:** agent (implementer)
- **Depends on:** T383, T384 (both done)
- **ADR:** hub **ADR-0047 §1/§2/§4**
- **Why:** `e2e/support/api-mocks.ts:274` still returns `goodToKnow: goodToKnowBlocks()` on the
  config response, and **nothing anywhere mocks `GET /v1/config/general-information`** — the route
  T383 made the section read from. So all 30 e2e failures are
  `design-parity-info.spec.ts` measuring a render that no longer exists.
  **This was invisible until the app compiled**: T383 could not run the suite at all (the tree was
  red until T384), so the gap surfaced only once the merge unit closed. It is nobody's mistake and
  it is not T385's work — but T385 cannot report a green gate on top of it, which is why it is filed
  ahead rather than folded in.
- **Acceptance:**
  - `api-mocks.ts` serves **`generalInfo`** in the ADR-0047 shape on the config response, and mocks
    **`GET /v1/config/general-information`** with `contact.couple` **present** — it is required on
    that route and composed server-side (ADR-0047 §4, Amendment 2), so a mock that omits it tests a
    response the API cannot produce.
  - The fixture exercises the cases the render actually branches on: a contact **with** and
    **without** a `phoneNumber`, at least one `faq` and one `note` entry with ULID ids and a note
    `title`, and a `dayLine` with all three variants. A fixture that only covers the happy path is
    how a parity spec passes while the feature is broken.
  - `design-parity-info.spec.ts` measures the **new** section against the kit — six named sections
    in the DS's fixed order, not blocks. Deviations that are the kit's own go to
    `../wedding-ui-design/contract/FINDINGS.md`, never reported as app defects (ADR-0044).
  - `pnpm test:e2e` green, or every remaining failure named with its owner. **Report the counts you
    measure**, and do not inherit T384's — it measured a tree that could not run this spec.
- **Refs:** T383 (the render), T384 (the editor), `e2e/support/api-mocks.ts:141-274`,
  `e2e/layout/design-parity-info.spec.ts`; hub ADR-0047 §4


### T389 — Third-party CDN fetches, not the DS-kit server, were failing the parity specs
> **The original title was wrong, and the wrong diagnosis is the more useful record.** This task was
> filed as "the DS-kit static server loses races under parallel load" on the strength of four
> measurements across T387 and T388. Its implementer **disproved that before changing anything**:
> `ThreadingHTTPServer` handling 15 ms median under 8 concurrent clients, zero listen-queue
> overflows for the machine's uptime, a flat A/B across four server configurations — and T387's own
> `--workers=1` result had already contradicted the contention story had anyone weighed it.
- **Status:** done (2026-09-16) — cause found and removed; **8 consecutive clean runs, 395/0/30**,
  zero third-party requests leaving the machine. **A floor, not a cure** — falsified by more runs, a
  cold cache on a fresh checkout (~40 real fetches on the first run), or a busier machine.
  **The real cause was the public internet.** A fresh `BrowserContext` has an empty HTTP cache and
  the suite makes one per test, so every page fetched Google Fonts and Sentry's production DSN
  (app pages) or Google Fonts and ~5.3 MB of unpkg (kit pages) — **~1 GB from one IP in four
  minutes**, both dependencies render-blocking. Stalling either host reproduces `ds-kit.ts:121`'s
  error verbatim; a merely *slow* host spends the budget and the timeout lands wherever it runs out,
  which is why the reported line moved between `:121/:122/:128` while the cause did not, and why
  app-only specs (`smoke`, `occlusion-guard`) failed too — a fact the DS-kit theory never explained
  and nobody challenged it with.
- **Owner:** agent (implementer)
- **Depends on:** —
- **ADR:** none — test infrastructure
- **Why:** `e2e/helpers/ds-kit.ts` spawns one `python3 -m http.server` per Playwright project, and
  five workers navigate it. T388 measured **6 failures across four parity specs — three of which it
  never touched** — all `page.goto`/first-click timeouts against that server, and all green under
  `--retries=2` (387 passed, 0 failed, 3 flaky). It also explains why T388's baseline was 32 and not
  the 30 the task text predicted: the extra two were the same flake.
  Every implementer now pays for this twice — once measuring a baseline that includes it, once
  explaining which failures are theirs. `.agent/skills/task-management.md` §4 already warns that a
  clean-run count is a floor; this is the thing that makes it one.
- **Acceptance:**
  - Find the actual cause before changing anything: a single-threaded `http.server` serving five
    concurrent workers is the obvious suspect, but **reproduce it** (§5 — a failing run with the
    error, not a hypothesis). Worth checking whether one server shared across projects, a
    `--workers` bound for parity specs only, or a readiness probe before the first `goto` is the
    real fix.
  - The fix is in the harness, **not in `--retries`**. Retries hide a race; they do not remove it,
    and the next person still cannot tell a real failure from this one.
  - Report the number of consecutive full runs you achieved and **call it a floor, not a fix**
    (§4). Say what would falsify it — here, more runs under load.
- **A second, distinct cause lives in the same bucket — do not conflate them.** T390 measured flaky
  4 → 8: seven are the ds-kit contention above, and the **eighth is different**. In
  `public-surface.spec.ts` the first attempt rendered **raw translation keys** — the locale file had
  not loaded — and the assertion that failed was T385's section title, which T390 never touched.
  Isolated three consecutive times: 25/25, no retries, which its own report correctly calls a floor
  rather than proof of absence.
  **Ask the question the flake raises before fixing the test:** if the app can paint before
  translations resolve under a test harness, can a guest on a slow connection see raw keys on first
  load? If the answer is no, say what makes it impossible; if it is yes, that is an app defect and
  belongs in its own task, not in a retry.
- **Refs:** `e2e/helpers/ds-kit.ts`; T388's report (the 6/4-spec measurement); T390's report (the
  eighth flake); `.agent/skills/task-management.md` §4

### T390 — Settings tells the couple their contact cards self-update; the privacy notice says they don't
- **Status:** done (2026-09-15) — the hint now says what Amendment 3 §A establishes: the details are
  copied from the account the moment the couple adds the person, a later edit to that account does
  not update the card, and if someone's number changes the couple picks them again. One value per
  locale, no key added or removed (843 per locale, key sets identical, 0 empty). It says nothing
  about `wedding-api` T251. See `reports/T390.json` (`5b75068`).
- **Owner:** agent (implementer)
- **Depends on:** —
- **ADR:** hub **ADR-0047 Amendment 3 §A**; §2 (struck bullet); §3
- **Why:** `configManager.goodToKnow.contact.hint` currently tells the couple, in all three locales:
  > *"Their name, email and phone number come from that account and are not edited here — **if they
  > change their profile, their card changes too**."*

  `privacyPolicy.goodToKnow.body`, shipped by T385 in the same release, tells the guest:
  > *"a later edit to their account **does not update** the section, and closing an account does not
  > remove them from it."*

  **The notice is correct and the hint is false** (Amendment 3 §A: digests are stored verbatim).
  Found by T385's implementer, who filed it rather than folding it into a task that did not own it.
  This is the **fourth** copy of the same false claim — after ADR-0047 §2, `SPEC.md`/`GLOSSARY.md`,
  and `wedding-api/src/common/documents/wedding-config.ts:199-202` (now T251's first bullet) — and
  the first one **a user reads**. It is the worst of the four for a reason worth stating: the couple
  will *act* on it. Someone told their contact cards self-update has no reason to revisit the
  section when a guest changes their number, and the number a guest is asked to call goes quietly
  stale.
- **Acceptance:**
  - The hint, in **es/en/fr**, says what is true: the details are **copied from the account when the
    couple adds the person**, and **do not update afterwards** — so if someone's number changes, the
    couple re-picks them. Keep the true half (only account holders; not edited here; someone without
    an account is added as a guest first).
  - **Match the privacy notice's register and its facts** — the two strings are read by different
    people about the same data, and a guest comparing them should find no daylight. T385's copy is
    the reference.
  - **Do not promise a fix that does not exist.** If `wedding-api` T251 later makes details resolve
    at read time, *both* strings change again, in that task's commit. Say nothing here about what
    might change.
  - No missing-key warnings; report the resolved counts you measure.
  - Hard rule 11 gate green.
- **Refs:** T384 (which shipped the hint), T385 (which found it and shipped the correct notice);
  hub ADR-0047 Amendment 3 §A; `wedding-api` T251


### T391 — The copy that carries a factual claim should be asserted, not just written
- **Status:** done (2026-09-16) — `e2e/copy-claims.spec.ts`: the hint asserted on the **live**
  Settings screen (which also proves the key is not orphaned) and then per locale off disk, both
  ways — it must **not** promise a self-updating card and it **must** say the details are copied
  when the couple adds the person. A third test asserts the couple-facing hint and the guest-facing
  notice **agree**, which is the test that would actually have caught T390: neither string was badly
  written, they simply contradicted each other in one release and nothing asserted the pair. Proven
  to bite by restoring the pre-T390 wording out of `5b75068^` — all three fail, all three pass on
  restore, `git diff` clean. T380's delegation copy is covered in `public-surface.spec.ts` and is
  **deliberately not duplicated**; the new file's header says where it lives.
  **The finding, and it is a habit rather than a one-off: 43 user-facing strings carry a claim about
  how the system behaves, 3 are asserted and 40 are not** — 120 strings across three locales. **Seven
  look false today.** Six hardcode the RSVP deadline (*"until 1 May"*, ×3 locales) while
  `rsvpDeadline` is configurable and **no RSVP screen reads it** — the correct value is already on
  the config object the screen has, so this is worse than T390's; and
  `delegation.field.emptyGuest` tells a guest *"only you can reply"* when the couple can edit any
  RSVP by role (ADR-0015). **Reported, not fixed**, per this task's own acceptance; the complete list
  is enumerated in the report so nobody re-derives it. Gates green; e2e 430 → 445 tests, **415
  passed / 0 failed / 30 skipped**. See `reports/T391.json` (`9230ab3`).
- **Superseded status line below, kept as written:** todo — **not release-blocking**; it is the reason the last four defects were possible
- **Owner:** agent (implementer)
- **Depends on:** T385, T390 (both done — they are the reference for what "true" currently is)
- **ADR:** hub **ADR-0047 §3**, Amendment 3 §A
- **Why:** the same false claim — *contact details update themselves* — shipped in **four** places
  before anyone caught it: ADR-0047 §2, `SPEC.md`/`GLOSSARY.md`, `wedding-api`'s
  `wedding-config.ts:199-202`, and finally `configManager.goodToKnow.contact.hint`, which a **user
  reads**. T385's implementer found the fourth; T390 fixed it; and T390's report ends with the point
  that matters: **the hint is covered by no test at all.** Its correctness rests on the copy alone,
  so the next false claim in that string ships exactly the way this one did.
  The pattern that *does* work already exists in this repo. T381 added a **negative** assertion —
  the notice must not promise the unbuilt third-party case — and it did its job: it failed loudly
  when ADR-0047 made the opposite true, forcing T385 to invert it deliberately rather than drift.
- **Acceptance:**
  - Assert the **factual claims** of `configManager.goodToKnow.contact.hint` the way
    `public-surface.spec.ts` asserts the privacy notice's: that it does **not** promise cards update
    themselves, and that it **does** say details are copied when the person is added.
  - **Assert meaning, not prose.** Match on the load-bearing clause, not the whole sentence — a test
    that breaks when someone improves the wording will be deleted by the third person who hits it,
    and then there is no test at all. Do it in all three locales.
  - **Prove it bites**, the standard T378, T382 and T385 all met: restore the pre-T390 wording, watch
    the assertion fail, restore, re-run.
  - Say in the report whether any **other** user-facing string carries a factual claim about how the
    system behaves and is likewise unasserted. **Report the list; do not fix it** — the size of that
    list is the finding, and it decides whether this is a one-off or a habit.
- **Refs:** T390's report (the observation); T381 (the negative assertion that worked); T385
  (`e2e/public-surface.spec.ts`); hub ADR-0047 Amendment 3 §A

### T392 — Settings → Basics must write `couple.*.firstName`, not only the deprecated pair
- **Status:** done (2026-09-15) — Basics' two inputs call `setCoupleFirstName`, which writes the
  deprecated field **and** `couple.<role>.firstName`, spreading the stored digest at both levels so
  the shallow merge cannot drop `id`, `lastName`, `email` or `phoneNumber`; a row with no `couple`
  sends the deprecated field alone. `'brideName' | 'groomName'` came **out of `setBasics`' `Pick`**,
  so the silently-inert write is now a compile error rather than a convention. `couple` is still not
  refreshed from the USER documents (ADR-0047 Amendment 4) — "The couple" keeps changing nothing.
  Gates: typecheck green, lint 4 → 4 (the documented modal exception), unit 644 → 647, build green,
  e2e 395/0/30 before and after. See `reports/T392.json`. **Still to do by hand:** the
  `check-config-row.sh` verification below, which needs a deployed bundle.
- **Owner:** agent (implementer)
- **Depends on:** `wedding-api` **T252** (landed, `936d0ec`) — no further API work is needed
- **ADR:** hub **ADR-0037** (the switch phase T252 completed on the read side); **ADR-0047**
  Amendment 4 (what is deferred, and must not be attempted here)
- **Why:** after T252 both response builders derive the displayed names from `couple` when it is
  present, falling back to `brideName`/`groomName` when it is not. Production has `couple`. So:
  - **Settings → Basics** still writes only `brideName`/`groomName` — fields **no surface reads any
    more**. A control that silently does nothing is a defect, not a no-op.
  - **Settings → "The couple"** writes the USER document, and `config.couple` is a stored copy that
    nothing refreshes — **deferred** by ADR-0047 Amendment 4, not this task's problem.
  - Net effect today: **there is no way to change the couple's displayed names from the app.**
  The alternative — removing the Basics fields — was considered by T252 and is worse for exactly
  that reason: it leaves the names uneditable until the deferred propagation work lands.
- **Acceptance:**
  - Basics' bride/groom name inputs write **`couple.bride.firstName` / `couple.groom.firstName`**
    *and* keep writing the deprecated `brideName`/`groomName`. Both, until ADR-0037's contract phase
    drops the pair — which needs its own ADR and is blocked on PITR (`wedding-api` T225).
  - **The PATCH must carry the complete `couple` object.** `updateWeddingConfig` merges shallowly
    (`{...config, ...update}`), so sending a partial `couple` **replaces** it and drops `id`,
    `lastName`, `email` and `phoneNumber`. Read the current value, change the one field, send the
    whole thing.
  - **If the config row has no `couple`, write only the deprecated pair.** `coupleSchema` requires
    `id`, `lastName` and `phoneNumber`, so a valid `couple` cannot be constructed from a first name
    alone and the PATCH would 400. Production has one; a fresh or seeded environment may not.
  - **Do not refresh `couple` from the USER documents** — that is the deferred work (ADR-0047
    Amendment 4), and no task may fix staleness in one field alone. Editing a name under
    "The couple" continuing to change nothing is the accepted cost, not a bug to fix here.
  - Unit test: editing the bride's name sends a complete `couple` **and** the deprecated field, and
    a config without `couple` sends only the deprecated field.
  - Hard rule 11 gate green.
- **Verification beyond the suite:** after this lands, rename one of the couple in Basics and run
  `../wedding-api/scripts/migration/check-config-row.sh <api-url>` — it asserts
  `couple.bride.firstName == brideName`, and that is the invariant this task has to preserve.
- **Refs:** `wedding-api` T252 (the read side, and the decision this implements); `wedding-api`
  T251 + hub ADR-0047 Amendment 4 (what is deferred); `src/app/screens/config-manager/`

### T393 — Six strings hardcode the RSVP deadline the couple can change
- **Status:** todo — **the highest-consequence item on T391's list, and true only by coincidence**
- **Owner:** agent (implementer)
- **Depends on:** T391 (which enumerated it)
- **ADR:** hub **ADR-0024** (`rsvpDeadline` on the CONFIG row); ADR-0009 (UI strings vs stored
  content); `wedding-web` hard rule 19's reasoning, applied to a different field
- **Why:** six locale keys across es/en/fr say the deadline in words — *"Please reply by 1 May"*,
  *"Edit anything until 1 May"*, *"You can change your mind until 1 May"* and their `es`/`fr`
  counterparts. **`rsvpDeadline` is a configurable field the couple edits in Settings → Basics**, and
  the only things that read it are `shared/good-to-know`'s day-line and two spec fixtures. **No RSVP
  screen reads it at all.**
  So the copy is correct **today by coincidence** — the configured deadline happens to be
  `2027-05-01` — and becomes a lie the moment the couple edits it, on the one screen where the date
  is the whole point. Nothing would detect it: no test asserts these strings, and changing a config
  value cannot fail a build.
  This is the same defect as `configManager.goodToKnow.contact.hint` (T390), one field over, and it
  was found by T391's sweep asking whether that was an accident or a habit. It is a habit.
- **Acceptance:**
  - The six strings take the deadline as an **interpolated parameter** from the wedding
    configuration, formatted for the active locale — not typed into a locale file. The RSVP screens
    read `rsvpDeadline` from the config they already load; do not add a fetch for it.
  - **Locale-correct formatting, and nothing else locale-dependent.** A date is prose-adjacent and
    *is* localized (`1 May` / `1 de mayo` / `1er mai`), unlike the identifiers hard rule 19a governs.
    Say in the report which formatter you used and why it is safe in all three locales.
  - **Assert it**, per T391's method: a test that the rendered string carries the configured deadline
    and **not** a hardcoded month. Prove it bites by changing the fixture's deadline and watching it
    fail.
  - **Scope fence:** fix these six and nothing else. T391's report enumerates 40 unasserted strings
    and 7 that look false; the rest are **T394**'s to triage, and doing them here would produce a
    diff nobody can review.
- **Refs:** T391's report (the full enumeration); T390 (the same defect one field over); hub ADR-0024

### T394 — Triage T391's list: 40 unasserted behavioural claims, 7 of them apparently false
- **Status:** todo — **triage, not a fix.** Its output is a decision about scope, not a diff
- **Owner:** agent (implementer)
- **Depends on:** T391 (done), T393 (which takes the worst item out of the list first)
- **ADR:** none yet — the point of this task is to find out whether one is owed
- **Why:** T391 answered the question it was given. **43 user-facing strings carry a claim about how
  the system behaves; 3 are asserted; all 3 got there because a defect shipped first.** Seven look
  false today. That is a habit, not an accident, and the response to a habit is not forty patches.
- **Acceptance:**
  - Work T391's enumeration and sort each entry into: **false now** (a defect — file it), **true but
    unasserted** (debt — is it worth a test?), or **not actually a behavioural claim** (drop it, and
    say why the sweep caught it).
  - **Report the shape, not just the list.** If the false ones cluster — configurable values typed
    into locale files, capabilities described that were later cut, promises about propagation — say
    so. A cluster is an ADR or a lint rule; scattered one-offs are just tasks.
  - **Propose the cheapest thing that would have caught the whole class**, and be honest if the
    answer is "nothing general — they need reading". A convention nobody can check is worth less
    than an accurate list.
  - **Fix nothing.** File what needs filing.
- **Refs:** T391's report; T390, T393 (two instances already fixed); T385/T381 (the assertion pattern
  that works)

### T395 — The app paints raw translation keys on its first frame, on every route
- **Status:** done (2026-09-16) — strategy: **inline the minimal first-frame set**, in all three
  locales (the active locale is known synchronously, so es/fr guests get correct-language copy on
  frame one), served by a custom `MissingTranslationHandler` — the only inlining mechanism that
  works, because `use()` skips the HTTP load whenever the store already has an entry, so
  pre-seeding would have silently suppressed the real locale file forever. Route content waits for
  the locale alongside the config it already waits for; an unresolved key renders as `''`, never as
  itself — and "loaded" means a **non-empty** store entry, because the http-loader swallows a
  failed fetch into `{}`. The named trade: ~1.5 kB of UI copy in the bundle (ADR-0009 allows it;
  an e2e drift guard pins it byte-identical to the locale files). First paint untouched (FCP
  136–152 ms vs 144–160 ms); real banner copy at 116–132 ms where raw keys painted at 121–142 ms;
  raw keys never, at locale delays 0/1/3 s **and** with the fetch aborted. Proven to bite: fix
  reverted, both behavioural tests fail on `consentBanner.*` at the first sampled frame. Gates
  green: unit 654 (647+7), e2e **460 tests, 430/0/30**. See `reports/T395.json` (`755e42d`,
  `8eacd2e`).
- **Owner:** agent (implementer)
- **Depends on:** — (T389 found it; its spec-side race is already fixed)
- **ADR:** hub **ADR-0009** (UI strings); ADR-0031 (three locales)
- **Why:** T389 was asked, when a flaky test rendered raw keys, whether a guest on a slow connection
  could see the same thing before assuming it was a test artefact. **It measured the answer: yes.**
  Raw keys are painted at **155–182 ms**, with real copy arriving at **213 ms / 1.1 s / 3.1 s** for
  locale-file delays of 0 / 1 s / 3 s. The window is the locale fetch, and it is **every route** —
  `consentBanner.*` keys come from the root-mounted banner, so the first frame of the app shows
  `consentBanner.title` to anyone whose locale file has not landed.
  ~150 guests, many on phones, on Spanish, French and British networks, opening a link at the same
  time. This is not theoretical.
- **Acceptance:**
  - **Decide and state the strategy before coding**: block the first paint until the active locale
    resolves, inline a minimal set of first-frame strings into the bundle, or render nothing where a
    key is unresolved. Each trades differently — a blank frame, a bundle that carries copy hard rule
    19 wants out of locale files, or a flash of missing text. Name the trade you took.
  - **Never show a raw key.** Whatever the strategy, `consentBanner.title` must not reach a screen.
  - The fix covers **every route**, not the banner alone — the banner is where it was measured, not
    the only place it happens.
  - **A test that fails on a raw key**, with the locale fetch delayed the way T389 delayed it.
    Prove it bites: revert the fix, watch it fail. T389's report has the harness.
  - Measure first paint before and after and report both. If the chosen strategy costs first-paint
    time, say how much — LCP has a 2.5 s budget (`CLAUDE.md`).
- **Refs:** T389's report (`decisions_needed[]`, with the measurements and the harness); hub ADR-0009
