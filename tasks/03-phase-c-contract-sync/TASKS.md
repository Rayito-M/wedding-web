## Phase C — Contract sync (hub ADR-0005 amendment 2026-07-15)

### T205 — Regenerate API client for typed response schemas
- **Status:** todo
- **Owner:** agent (implementer)
- **Acceptance:**
  - Run `pnpm gen:api` against the updated hub `contracts/openapi.json` (hub commit `03ae642`)
  - Regenerated client exposes the new typed response models: Guest (single + list), RSVP (single + report), WeddingConfig, HealthCheck
  - Consumers migrated to the regenerated types; `pnpm typecheck` / build green
- **Note:** single regen task covering wedding-api Phase J backfills T171–T174 + the T170 gate (all additive — response models added, no request/field-semantic change)
- **Note (2026-07-16):** the `openapi-typescript-codegen` mechanics assumed here are superseded by Phase D (in-repo ADR W-0001): the client is regenerated with **openapi-generator** via T207–T208. Keep this task's *intent* (consume the typed response models) but run it through the new `gen:api`.
- **Refs:** hub ADR-0005 (amendment 2026-07-15); wedding-api T170–T174
