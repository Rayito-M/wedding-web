## Phase I — Type hygiene (CLAUDE.md Hard rule 15)

> Hard rule 15 (added 2026-08-08) makes the generated API client in `src/app/core/api/` the single
> source of truth for API models and prohibits local `type`/`interface`/`enum`/string-union
> redeclarations of anything that maps to one. This QA sweep finds and removes the copies that
> already exist. **Deferred — run later**, not blocking current work. No hub/DS escalation: this is
> in-repo code hygiene against an existing rule, not a contract or design change.

### T254 — QA sweep: detect + remove type declarations that duplicate generated API types
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** The implementer repeatedly hand-copied API enums into local unions — the incident that
  motivated Hard rule 15. Confirmed seed instances: `type RelationSide = 'bride' | 'groom' | 'both'`
  and `type RelationKind = 'family' | 'friends' | 'colleagues' | 'other'` in
  `src/app/screens/guest-manager/modal/guest-create-modal.ts` and `rsvp-details-modal.ts` — the first
  duplicates the generated `CreateUserDtoGuestInfoRelationOneOf.SideEnum` (`bride`/`groom`/`both`) and
  had to be edited by hand when `both` was added to the contract (exactly the drift the rule guards
  against). These two are the starting point, **not** the whole scope — the sweep must find any others.
  Note the nuance the task must actually resolve rather than gloss: the contract models relation `kind`
  as a per-variant `const` string across `CreateUserDtoGuestInfoRelationOneOf*` (not a single named
  enum), so `RelationKind` may have no clean 1:1 generated type to import — decide whether a derived
  type covers it or whether it's a legitimate Hard-rule-15 exception, and record which.
- **Acceptance:**
  - Produce an **inventory** (in the PR description) of every local `type`/`interface`/`enum`/
    string-union in `src/app/**` **excluding the generated `src/app/core/api/` tree** whose members or
    shape duplicate or shadow a type already defined in `src/app/core/api/model/`. Detection: for each
    API enum/union under `src/app/core/api/model/`, grep `src/app/{screens,shared,core}/**/*.ts`
    (excluding `core/api`) for local declarations with the same literal members. Seed the list with
    `RelationSide`/`RelationKind`; the inventory drives the fix.
  - For each **confirmed** duplicate: verify the generated type's literal values exactly cover the
    local one's, then replace the local declaration with an **import of the generated type** and update
    every usage (form-control generics like `fb.control<RelationSide>('bride')`, method params, and
    option arrays like `relationSides`/`relationKinds`). No `any`, no re-alias that just renames the
    generated type.
  - **Exception handling (Hard rule 15):** if a local union is a deliberate strict *subset* of the API
    type (the UI intentionally offers fewer options), or the generated type is genuinely unsuitable, do
    **not** force the swap — stop and ask the user for approval with a clear synthetic explanation:
    (a) which API type exists, (b) why it can't be used directly, (c) the proposed local type. Record
    each exception (and the user's decision) in the PR.
  - No behavior/DOM/template-logic change beyond the type swap; i18n keys and rendered output
    unchanged.
  - `pnpm typecheck && pnpm lint && pnpm build` green (lint: allow only the known pre-existing
    `shared/modal/` errors, unchanged). `pnpm gen:api:check` still clean — the sweep must not touch the
    generated client or introduce drift.
- **Refs:** CLAUDE.md Hard rule 15; `.claude/agents/implementer.md` (Rules / When-to-stop-and-ask /
  Anti-patterns, all referencing this case); audit scope: `src/app/core/api/model/` (source of truth)
  vs. `src/app/{screens,shared,core}/**/*.ts`; seed files:
  `src/app/screens/guest-manager/modal/guest-create-modal.ts`,
  `src/app/screens/guest-manager/modal/rsvp-details-modal.ts`.
