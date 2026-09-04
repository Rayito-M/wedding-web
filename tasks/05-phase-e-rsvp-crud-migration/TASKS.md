## Phase E — RSVP CRUD migration (hub ADR-0022)

> Hub ADR-0022 makes RSVP a **single mutable resource per guest** at `/v1/rsvp/:id`
> (`:id` = guest ULID or `me`), replacing ADR-0015's append-only `/v1/guests/:id/rsvp`
> sub-resource. Depends on the API landing the new routes and the hub `contracts/openapi.json`
> being regenerated (wedding-api T190). The generated client picks up the shape on `pnpm gen:api`.

### T215 — Migrate RSVP flows to the single-mutable CRUD resource
- **Status:** blocked (on wedding-api T190 contract regen + hub `openapi.json` update)
- **Owner:** agent (implementer)
- **Depends on:** T213 (RSVP thin-service seam), wedding-api T190
- **Acceptance:**
  - After the hub contract carries `/v1/rsvp/:id` (POST/GET/PATCH), run `pnpm gen:api`; the RSVP
    service/model reflect the new resource (no `/v1/guests/:id/rsvp` path remains)
  - The RSVP thin service (T213) exposes: read (`GET /v1/rsvp/:id` → treat 204 as "no RSVP yet");
    create (`POST /v1/rsvp/:id`, surface 409 "already exists" as an edit path); edit
    (`PATCH /v1/rsvp/:id`, send the current `version`, and on 409 re-read + retry per the
    optimistic-lock contract). `410` after the RSVP deadline stays handled as today
  - Self uses `me`; delegation uses the delegated guest's ULID (no separate delegation route,
    ADR-0015). The guest edit flow shows only the **current** answer — no version list
  - Screens: the RSVP form submits once then switches to edit-in-place; re-visiting shows the
    current answer; `pnpm typecheck && pnpm lint && pnpm test` green
- **Refs:** hub ADR-0022, hub ADR-0015 (`me` + policy), hub ADR-0013, in-repo ADR W-0001; wedding-api T190
