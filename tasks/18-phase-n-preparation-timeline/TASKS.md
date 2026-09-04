## Phase N — Couple's preparation timeline (hub ADR-0029, accepted)

> Hub **ADR-0029** is `accepted` with **Option B**: the couple gets a private, admin-only
> **preparation timeline** — a dated list of milestones they tick off. `SPEC.md` journey **J6**
> is the flow. Depends on `wedding-api` **T208** having landed and its contract committed in the
> hub.
>
> **The design system is a visual reference only, not the spec.**
> `wedding-ui-design/ui_kits/wedding-app/ScreenMilestones.jsx` and `ScreenMilestonesMobile.jsx`
> render the **guest-facing** milestone kind — audience chips, channel chips, a message body, an
> auto-send toggle, a delivery progress bar, a send confirmation and a toast. **None of that
> belongs in this task.** Hub **ADR-0030** is now `accepted`, so that surface is real product —
> but it is **T280's**, and ADR-0030 *rejected* three of the things those screens show: the
> message composer, the "Send automatically" toggle and the channel picker. Take the *timeline
> chrome* from these screens (date-ascending rows, the "Today" marker, status pills, the desktop
> detail pane / mobile bottom sheet) and nothing else.

### T279 — Couple-only preparation timeline screen
- **Status:** done (uncommitted) — 2026-08-25. `pnpm gen:api` regenerated (`kind` widened to
  `['internal','guest-facing']`; nothing yet consumes `guest-facing` — that's T280) and
  `pnpm gen:api:check` clean. New `src/app/screens/milestones/` (`.ts/.html/.scss/.spec.ts`, 11
  specs) behind `adminGuard` + `routeEnabledGuard` at `/milestones`, a new `nav-tabs.ts` entry
  (`roles: ['groom','bride']` only) and `environment{,.prod}.ts` `enabledRoutes` addition — a
  guest cannot reach the route or see the nav entry. New `MilestoneDataService` +
  `EntityNamesEnum.MILESTONE` (`src/app/core/data/`) following the existing `@ngrx/data` pattern;
  `StatusPill` extended (additive) with `reached`/`not-reached`/`at-risk` variants, the last using
  the T277 `--danger`/`--on-danger` tokens. `atRisk` is read directly off `MilestoneDto` (the API
  returns it computed) and never appears in a create/update payload. Delete goes through
  `app-confirm-dialog` `tone="danger"` (T277/T278 pattern). Two distinct empty states (no wedding
  date vs. an emptied timeline). One-line, non-recomputing hint added to `config-manager` after a
  wedding-date edit (hub ADR-0029 §4.3). i18n in all three `public/i18n/*.json`. T277's status line
  corrected alongside (see its entry).
- **Owner:** agent (implementer)
- **Depends on:** `wedding-api` T208 (contract), T235 (private shell / nav model)
- **Acceptance:**
  - `pnpm gen:api` regenerated after T208's contract lands; `pnpm gen:api:check` clean. No
    hand-written type restates a generated API model (hard rule 15).
  - A new couple-only feature under `src/app/features/` (or the repo's current equivalent),
    reachable from the **admin/couple navigation only** and guarded by the existing admin gate
    (T202's `role` claim check). A guest must not be able to reach the route, see the nav entry,
    or learn that the timeline exists (hub ADR-0029 §4.7).
  - **List:** every milestone, **date-ascending**, with a "Today" marker inserted before the first
    milestone dated later than today (and rendered at the end when every milestone is in the past),
    matching `ScreenMilestones.jsx:47,81-93,119,123`.
  - **Three displayed states, two of them stored:** *reached*, *not reached*, and **at-risk**, where
    at-risk is **derived** — planned date in the past **and** not reached (hub ADR-0029 §4.2). If
    the API returns at-risk as a computed field, use it; if not, derive it client-side against the
    current calendar date in **`Europe/Madrid`** — **not** the browser's timezone, so the web and
    the API cannot disagree. Never store or `PATCH` an at-risk value.
  - **Full CRUD**, all persisted server-side (hub ADR-0029 §4.1): tick/untick reached, create a
    milestone, rename one, change its date, delete one. **Delete is permanent** — put the shared
    `app-confirm-dialog` (T277) in front of it with `tone="danger"`, exactly as T278 did for RSVP
    participant removal.
  - **Persistence is not optional and not local-only.** Autosave-per-field or an explicit Save is
    your call, but every mutation must be persisted before it is presented as done, and a failed
    write must be surfaced (hub ADR-0029 §5). The kit's local-state-only model
    (`ScreenMilestones.jsx:18`) is explicitly **not** a permitted implementation.
  - **Two empty states, and they differ** (hub ADR-0029 §4.1): *no wedding date set yet* — the seed
    cannot run, so explain that and point at the config manager; *the couple deleted everything* —
    an ordinary empty list with a "create one" affordance and **no** re-seed offer, because the seed
    runs at most once ever. Plus the standard loading and error states via the existing
    `shared/loading` / `shared/error` conventions.
  - **Explicitly not built** — the whole guest-facing surface: no audience selector, no channel
    chips, no message body field, no "Send automatically" toggle, no send button, no send
    confirmation, no toast, no delivered-of-total progress bar, no "Mark as not sent". That whole
    surface is **T280** (hub ADR-0030, accepted) and must not be pulled forward into this task —
    it depends on `wedding-api` T211/T212, which do not exist yet. Note that three of the kit's
    controls are decided **out** under ADR-0030 and never get built at all: the message composer,
    the auto-send toggle and the channel picker.
  - **A wedding-date change does not move milestones** (hub ADR-0029 §4.3). You **may** surface a
    one-line hint after the couple edits the wedding date in the config manager, telling them the
    timeline was not re-dated. You must **not** offer to recompute dates, and must not recompute
    silently.
  - i18n: all UI labels in **all three** `public/i18n/{en,es,fr}.json`, real translations, the three
    files structurally identical. **Milestone titles themselves are never run through the translate
    pipe** — they are couple data, not UI strings. Note the title *is* stored localized
    (`{es,en,fr}`, hub ADR-0031, which reversed ADR-0029 §4.5): render the locale the admin is
    currently viewing in, exactly as you would any other localized content field.
  - **Title authoring ergonomics** (hub ADR-0031): a milestone title is an `{es,en,fr}` map with
    all three locales required, so the create/rename form takes **one** typed title and pre-fills
    all three locales with it, exposing the other two for optional editing behind a disclosure.
    The API requires three values, not three *distinct* values — do not force the couple to type
    a title three times. Milestone titles are still **never** run through the translate pipe: they
    are couple data, not UI strings, and a guest never sees one (hub ADR-0030 §10).
  - Responsive: desktop list + detail pane, mobile list + bottom sheet, following the kit's layout
    and the repo's sanctioned breakpoint tiers (T248).
  - Specs: at-risk is derived and never sent to the API; the list is date-ascending; the Today
    marker lands in the right place including the all-in-the-past case; delete asks for confirmation
    and a dismissal keeps the milestone; both empty states render for the right reason; a failed
    write surfaces an error rather than showing the change as saved.
  - No new `type`/`interface` restating a generated API model (hard rule 15); `pnpm typecheck &&
    pnpm lint && pnpm test` green (lint clean except the 4 known `shared/modal/` errors, per
    CLAUDE.md rule 11's carve-out). Verified by hand at mobile and desktop widths in all three
    themes; if no browser is available, **say so plainly** rather than claiming it (T273/T275
    precedent).
- **Refs:** hub ADR-0029 (§4.1 CRUD + seeding, §4.2 derived at-risk, §4.3 absolute dates, §4.5
  titles are not localized, §4.7 bounds, §5 what is left to this repo);
  hub `SPEC.md` journey **J6** and Users → Admin; hub `GLOSSARY.md` → Milestone;
  hub ADR-0030 (**accepted** — the send/audience UI it authorizes is T280, not this task; and it
  decides the composer, auto-send toggle and channel picker **out** permanently);
  `wedding-ui-design/ui_kits/wedding-app/ScreenMilestones.jsx` + `ScreenMilestonesMobile.jsx`
  (**visual reference for timeline chrome only**); in-repo T277 (`app-confirm-dialog`), T278
  (the destructive-confirm precedent), T235 (private shell), T248 (breakpoints)

### T280 — Guest-facing milestones: announcement type, audience, and the send button
- **Status:** todo — blocked on `wedding-api` T211/T212 landing and their contract being committed
  in the hub, and on T279 (the internal timeline) existing
- **Owner:** agent (implementer)
- **Depends on:** T279, `wedding-api` T211 + T212 (contract), T277 (`app-confirm-dialog`)
- **Acceptance:**
  - `pnpm gen:api` regenerated; `pnpm gen:api:check` clean. No hand-written type restates a
    generated API model (hard rule 15).
  - On the existing couple-only timeline: a **kind** control (internal / guest-facing) on create
    and edit, and — for a guest-facing milestone only — an **announcement type** selector and a
    **single-select audience** selector. Audience chips show live counts from `GET /v1/audiences`.
    **Two audiences from the design kit do not exist and must not appear**: "Travelling from
    abroad" and "Table hosts" (hub ADR-0030 §8).
  - **The send button, with a confirmation that states the blast radius first** (hub ADR-0030 §6):
    the milestone name, the announcement type, the audience, the **recipient count**, the
    **reachable count**, and that it goes out **immediately**. Nothing is sent without it. Disable
    the button when the milestone is not guest-facing, has no type, has no audience, the audience
    is empty, or it has already been sent.
  - **Already sent:** show the send date and the counts. **No "Send again" button.** Re-sending is
    reached only through an explicit **"Mark as not sent"**, behind `app-confirm-dialog` with
    `tone="danger"`, whose copy must say plainly that **it does not unsend anything** — it only
    allows sending again (hub ADR-0030 §7).
  - Handle `409` (already sent, or someone else edited/sent it) by re-reading and telling the
    couple what happened — never by retrying the send.
  - **Explicitly not built** (hub ADR-0030 §3, §6, §7, §11f): no message body or subject field, no
    channel chips, no "Send automatically" toggle, no schedule or send-date picker, no
    delivered-of-total progress bar, no per-recipient delivery list. If the design kit tempts you
    toward any of these, **stop** — they are decided out.
  - i18n: all UI labels in all three `public/i18n/{en,es,fr}.json`, real translations. **Milestone
    titles are never translated** (hub ADR-0029 §4.5 as reaffirmed by ADR-0030 §10) and neither is
    announcement copy — that lives server-side in the ADR-0028 catalog and never reaches this app.
  - Specs: the confirmation renders the counts it was given; the send button's disabled conditions;
    a `409` surfaces rather than retries; "mark as not sent" requires confirmation and a dismissal
    changes nothing; the two dropped audiences never render.
  - `pnpm typecheck && pnpm lint && pnpm test` green (lint clean except the 4 known
    `shared/modal/` errors, per CLAUDE.md rule 11's carve-out). Verified by hand at mobile and
    desktop widths in all three themes; if no browser is available, **say so plainly**.
- **Refs:** hub ADR-0030 (§3 no composing, §6 the button + confirmation, §7 idempotency and
  "mark as not sent", §8 audiences, §9 the catalogue, §11 the API surface); hub `SPEC.md`
  journey **J7**; hub `GLOSSARY.md` → Announcement / Announcement type / Audience;
  in-repo T277, T279

### T281 — Milestones: "Start from the usual plan" seed button in the empty state
- **Status:** todo
- **Owner:** agent
- **Depends on:** T279 (screen exists), T280 (`kind`/announcement fields exist on `MilestoneDto`)
- **Acceptance:**
  - `pnpm gen:api:check` is clean — the client already exposes
    `WeddingMilestonesService.milestonesControllerSeedV1()` returning `SeededMilestoneResponseDto
    { seeded: number }`; verify this rather than re-running `pnpm gen:api` blind. No new
    `type`/`interface` restates `SeededMilestoneResponseDto` or any other generated model (hard
    rule 15) — it is used as-is.
  - **This supersedes hub ADR-0029 §4.1's "no re-seed offer" clause** from T279's acceptance
    criteria: T279 predates `POST /v1/milestones/seed`'s existence in the contract. The endpoint
    is already live server-side (`wedding-api/src/modules/milestones/milestones.controller.ts` +
    `milestones.service.ts::seed()`), so this is this repo catching up to a decision already made,
    not a new hub ADR to request.
  - In the **`milestones.emptyNoMilestones` empty state only** (the "couple deleted everything, a
    wedding date exists" case — `milestones.html`'s current `emptyNoMilestones` block): add a
    "Start from the usual plan" button (real i18n key, all three `public/i18n/{en,es,fr}.json`)
    alongside the existing "create one" affordance. The **`emptyNoDate`** empty state (gated by
    the existing `hasWeddingDate()` computed) is unchanged — no seed button there, since seeding
    would 400 without a wedding date; this is defensive-only and not a UI path to design for.
  - `wedding-ui-design/ui_kits/wedding-app/ScreenMilestones.jsx` (`loadSuggested`, "Start from the
    usual plan", ~lines 58, 185) is the **visual reference for the button only** — its
    client-side `setItems(window.WEDDING_MILESTONES)` behavior is explicitly **not** what to
    build. Real behavior: an actual call to the seed endpoint, then a refetch of the real
    collection on success.
  - On click: call the seed endpoint. Follow whichever precedent `MilestoneDataService`'s existing
    `send()`/`clearAnnouncement()` methods set for a non-CRUD sub-action that bypasses `@ngrx/data`
    (a new `seed()` method there, calling `WeddingMilestonesService` directly) — architect's call
    is to keep this consistent with those two rather than reinvent a third pattern. In-flight state
    disables the button; no double-submit.
  - On success: re-read the collection via the existing `refetchMilestones()` pattern so the
    seeded rows render from the server response. **No client-side fabrication** of the seeded
    list (no local catalogue, no optimistic rows).
  - On `409` (`"Milestones already seeded"`): this is an **expected outcome, not a generic error**
    — it means the milestone collection document already existed (seeded or manually created,
    possibly since emptied by delete) even though the visible list is empty, and the client has
    no way to know this in advance. Show a plain, honest message via `actionError` (e.g. "this
    wedding already has its milestones on record" — real i18n copy, not "something went wrong")
    and leave the ordinary manual "create one" button in place/visible as the fallback (it must
    never be hidden or replaced by the seed button — both coexist in this empty state).
  - On `400` (no wedding date): unreachable via this UI since the button only renders when
    `hasWeddingDate()` is true; do not build any UI path for this case, note it as defensive-only.
  - Loading/error states match the rest of the screen's conventions: `actionError` signal,
    dismissible via the existing dismiss control, non-blocking (never a full-screen error state).
  - Specs: the seed button renders in `emptyNoMilestones` and not in `emptyNoDate`; a successful
    seed refetches the collection and renders the new (server-returned) rows; a `409` shows the
    "already has milestones" message (not the generic error copy) and the manual "create one"
    button remains present and clickable; the button disables itself while the call is in flight
    (no double-submit). Update the existing T279 spec at `milestones.spec.ts` titled "...no
    re-seed offer..." (~line 363) — its expectation is now wrong under this task and must assert
    the seed button **is** present and wired, not absent.
  - `pnpm typecheck && pnpm lint && pnpm test` green (lint clean except the 4 known
    `shared/modal/` errors, per CLAUDE.md rule 11's carve-out).
- **Refs:** hub ADR-0029 §4.1 (superseded here re: "no re-seed offer" — the seed endpoint now
  exists as a real, client-callable action); `wedding-api`
  `src/modules/milestones/milestones.controller.ts` + `milestones.service.ts::seed()`;
  `wedding-ui-design/ui_kits/wedding-app/ScreenMilestones.jsx` (button visual reference only);
  in-repo T279 (empty states, `hasWeddingDate()`), T280 (`send()`/`clearAnnouncement()` precedent
  in `MilestoneDataService`); `src/app/screens/milestones/milestones.ts`,
  `milestones.html`, `milestones.spec.ts`
