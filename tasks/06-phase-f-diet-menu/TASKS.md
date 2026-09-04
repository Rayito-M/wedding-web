## Phase F — Diet & menu (hub ADR-0024)

> Hub ADR-0024 turns the RSVP into a **party of named participants** (main + optional partner +
> children), each with their own dietary preferences, allergies, and a menu choice, backed by
> couple-managed CONFIG catalogs. Depends on the API landing the new RSVP/CONFIG shapes and the
> hub `contracts/openapi.json` regen (wedding-api T191); the client picks them up on `pnpm gen:api`.

### T216 — RSVP party editor + per-participant diet/allergy pickers
- **Status:** blocked (on wedding-api T191 contract regen + hub `openapi.json`)
- **Owner:** agent (implementer)
- **Depends on:** T215, wedding-api T191
- **Acceptance:**
  - After `pnpm gen:api`, the RSVP form builds a party: the main participant (name from the Guest
    record), an optional partner, and add/remove children — each named.
  - Per participant, dietary-preference and allergy **tag pickers** populated from CONFIG, each
    with a free-form "add your own" (maps to the `custom*` arrays). No `bringingPartner` /
    `childrenCount` / `dietaryNotes` fields remain.
  - Submits via the ADR-0022 CRUD resource (`POST` create / `PATCH` edit with `version`); labels
    localized (es/en/fr). `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** hub ADR-0024, ADR-0022, ADR-0009; `src/app/screens/rsvp/`

### T217 — Per-participant menu-selection view (Phase 2)
- **Status:** blocked (on wedding-api T191/T192)
- **Owner:** agent (implementer)
- **Depends on:** T216, wedding-api T192
- **Acceptance:**
  - A menu-selection view (reachable from the reminder deep link) lets the guest pick a `menuId`
    for each participant from CONFIG `menus`; menus suiting a participant's declared diet are
    flagged via `suitable*Ids`. Saves via `PATCH /v1/rsvp/:id`; revisitable until the window closes.
  - Shown only while the window is open; localized. `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** hub ADR-0024, ADR-0020; `src/app/screens/rsvp/` (or a dedicated menu screen)

### T218 — Admin diet & menu catalog management
- **Status:** blocked (on wedding-api T191)
- **Owner:** agent (implementer)
- **Depends on:** T216, wedding-api T191
- **Acceptance:**
  - An admin UI to CRUD the three CONFIG catalogs (dietary-preference tags, allergy tags, menus),
    each localized, with active/inactive; saved via `PATCH /v1/config`.
  - The admin RSVP view / CSV surfaces per-participant diet, allergies, and menu (from T191's report).
  - Couple-only (admin guard); `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** hub ADR-0024, ADR-0015; `src/app/screens/dashboard/` (admin area)
