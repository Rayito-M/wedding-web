# TASKS.md — wedding-web

> Atomic, agent-sized tasks. One task = one PR. Tasks numbered T2xx to avoid collision with `wedding-api` (T1xx).
> Status: `todo` | `in-progress` | `blocked` | `done`.
>
> Note: task numbers T260–T263 referenced by (now superseded) hub ADR-0011 were never
> created and are void — messaging was cut from scope by hub ADR-0014.

---

## Phase A — App-managed auth (hub ADR-0013)

### T200 — Sign-in integration (app-managed auth)
- **Status:** todo
- **Owner:** agent (implementer)
- **Acceptance:**
  - Phone + SMS OTP flow: two-step form (enter E.164 phone → enter code) calling `POST /v1/auth/otp/request` and `POST /v1/auth/otp/verify` (`wedding-api` T152)
  - Google sign-in via Google Identity Services and Apple via Sign in with Apple JS; the obtained ID token is sent to `POST /v1/auth/social`
  - The returned app JWT is held in a signals-based auth store; an HTTP interceptor attaches `Authorization: Bearer <token>` to every API call
  - Session survives a page reload within the token's validity (storage strategy = implementer's call; document it)
  - Sign-out clears state and returns to the login screen
- **Refs:** hub ADR-0013

### T201 — Sign-in UX + unmatched-identity page
- **Status:** todo
- **Owner:** agent (implementer)
- **Acceptance:**
  - Unauthenticated visitors to any route land on a minimal localized welcome/sign-in screen (es/en/fr per hub ADR-0009)
  - A 403 from the API (identity matched no guest record) routes to a localized "contact the couple" page with no further navigation
  - Post-login, the guest lands on the invitation page (SPEC.md J1)
- **Refs:** hub ADR-0013, SPEC.md J1

### T202 — Admin gate via `role` claim
- **Status:** todo
- **Owner:** agent (implementer)
- **Acceptance:**
  - Route guard for `/admin/**` requires `role: admin` in the app session token
  - Non-admin signed-in users never see admin navigation entries
  - The old password login form (superseded hub ADR-0008) is not built
- **Refs:** hub ADR-0013

### T203 — Admin guest form: identity fields
- **Status:** todo
- **Owner:** agent (implementer)
- **Acceptance:**
  - Admin guest create/edit form captures `phoneNumber` (E.164, validated) and `email` — the data identity matching depends on
  - Guest list shows whether a guest has signed in yet (has a linked provider sub or a completed OTP sign-in)
- **Refs:** hub ADR-0013

## Phase B — AWS hosting (hub ADR-0012)

### T204 — S3 + CloudFront deploy pipeline
- **Status:** todo
- **Owner:** agent (implementer)
- **Acceptance:**
  - Production build synced to the private S3 bucket; CloudFront invalidation issued on deploy; site serves at `comolatruchaaltrucho.eu`
  - SPA fallback: CloudFront error responses 403/404 → `/index.html` (200)
  - Production environment config points at `api.comolatruchaaltrucho.eu`
  - CI credentials via GitHub OIDC role (no long-lived AWS keys), if CI deploys are used
  - Rollback documented: re-sync previous build (S3 object versions) + invalidate
- **Refs:** hub ADR-0012

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

## Phase D — API client generation + data-access layer (in-repo ADR W-0001)

> Implements the real API integration. The generated client (openapi-generator) is the
> single source of endpoint/shape truth; @ngrx/data manages **entity collections only**;
> RPC/non-entity endpoints call the generated client through thin services; Observables
> become signals at the `core/` facade boundary (Hard Rule #5). Full rationale and the
> entity-vs-RPC split: `docs/decisions/W-0001-api-client-and-data-layer.md`.

### T206 — [ESCALATION → hub] Amend ADR-0005 for the openapi-generator switch
- **Status:** ✅ done (hub **ADR-0016** landed 2026-07-16)
- **Owner:** system-architect (in `wedding-architecture`) — NOT a wedding-web implementer task
- **Depends on:** —
- **Acceptance:** all met by hub ADR-0016 —
  - ✅ ADR-0005 §Decision.3 amended and `contracts/README.md` ("Who reads this file") generalized off `openapi-typescript-codegen`; both now name `openapi-generator` and delegate the tool choice to wedding-web (in-repo ADR W-0001)
  - ✅ hub drift-check description (`gen:api:check`) generalized to "the web repo's configured generator"
  - ✅ amendment references in-repo ADR W-0001 and unblocks T207
- **Refs:** hub **ADR-0016** (amends ADR-0005 §Decision.3), in-repo ADR W-0001, `../wedding-architecture/.agent/authority.md`, hub `CHANGELOG.md`
- **Resolution (2026-07-16):** hub ADR-0016 created; ADR-0005 header + §Decision.3 carry an amendment pointer; `contracts/README.md` and CHANGELOG updated. T207 is now unblocked.

### T207 — Add openapi-generator tooling + `gen:api` / `gen:api:check` scripts
- **Status:** ready (T206 resolved by hub ADR-0016, 2026-07-16)
- **Owner:** agent (implementer)
- **Depends on:** T206
- **Acceptance:**
  - `@openapitools/openapi-generator-cli` added as a dev dependency; `openapitools.json` (or equivalent config) pins the generator version and `typescript-angular` options (Angular 22, `providedIn: 'root'`, interface models, kebab-case file naming, single request-parameter objects)
  - `gen:api` script reads `../wedding-architecture/contracts/openapi.json` (honoring an `OPENAPI_SOURCE` env override) and writes to `src/app/core/api/`; `gen:api:check` regenerates to a temp dir and diffs against the committed output, failing on drift
  - The JVM/Java prerequisite is documented in `README.md`, along with the regen steps; any prior `openapi-typescript-codegen` reference is removed
  - Open question resolved in-PR: confirm npm-vs-pnpm runner and align `CLAUDE.md`/`README.md` accordingly (see ADR W-0001 "Open questions")
- **Refs:** in-repo ADR W-0001 (decisions 1–2), hub ADR-0005, `contracts/README.md`; files: `package.json`, `openapitools.json`, `README.md`

### T208 — Generate the initial API client into `src/app/core/api/`
- **Status:** blocked (on T207)
- **Owner:** agent (implementer)
- **Depends on:** T207
- **Acceptance:**
  - `gen:api` produces `@Injectable`, `providedIn: 'root'` Angular services (one per OpenAPI tag) + typed models for every ADR-0015 resource (guests, agenda-items, venues, hotels, rsvps, config, auth) into `src/app/core/api/`
  - Generated services use Angular `HttpClient`; the auth interceptor supplies `Authorization: Bearer` (no per-call headers added, Hard Rule #6)
  - Generated dir is committed and marked generated (lint/format ignore); it is never hand-edited
  - `pnpm typecheck`/build green; supersedes the `openapi-typescript-codegen` mechanics of T205 (cross-referenced)
- **Refs:** in-repo ADR W-0001, hub ADR-0015; files: `src/app/core/api/**`

### T209 — Bootstrap @ngrx/store + effects + entity + data
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T208
- **Acceptance:**
  - Add `@ngrx/store`, `@ngrx/effects`, `@ngrx/entity`, `@ngrx/data` dependencies
  - `app.config.ts` provides `provideStore`, `provideEffects`, and `provideEntityData(...)` (config wired in T210)
  - Store devtools enabled only under `isDevMode()` — no `environment.ts` feature flag (Hard Rule #7)
  - App still builds and runs with no entities behaviourally wired yet
- **Refs:** in-repo ADR W-0001 (decision 3); files: `package.json`, `src/app/app.config.ts`

### T210 — Entity metadata + repository-vs-direct boundary
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T209
- **Acceptance:**
  - `EntityMetadataMap` defines exactly `Guest`, `AgendaItem`, `Venue`, `Hotel` (the ADR-0015 CRUD collections), with pluralization and `selectId`
  - A short doc comment (or `core/data/README`) records that RSVP (sub-resource/report), `config` (singleton), and auth (RPC) are deliberately excluded from repositories
  - No entity is added for any endpoint outside the four collections
- **Refs:** in-repo ADR W-0001 (decision 3), hub ADR-0015; files: `src/app/core/data/`

### T211 — Custom entity data services delegating to the generated client
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T210, T208
- **Acceptance:**
  - For each of the four entities, a custom `EntityCollectionDataService<T>` delegates `getAll/getById/add/update/delete` to the corresponding generated Angular service (no hand-written URLs)
  - Services registered via `EntityDataService.registerServices(...)`; the `me` id path is handled inside the Guest data service
  - The generated client remains the single source of endpoint URLs and request typing
- **Refs:** in-repo ADR W-0001 (decision 3); files: `src/app/core/data/`

### T212 — Signals-first entity facades
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T211
- **Acceptance:**
  - Each entity has a facade in `src/app/core/data/` exposing `entities`, `loading`, `error` as signals via `toSignal()`, plus imperative `load/add/update/remove` commands
  - Components inject the facade only — they never inject `EntityCollectionService` and never `.subscribe()`; RxJS stays inside `core/` (Hard Rule #5)
  - At least one screen consumes a facade end-to-end to prove the boundary
- **Refs:** in-repo ADR W-0001 (decision 4); files: `src/app/core/data/`

### T213 — RPC / non-entity client services with signal boundary
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T208
- **Acceptance:**
  - Thin services wrap the generated client for: auth (`/v1/auth/otp/request|verify`, `/v1/auth/social`), RSVP (`/v1/guests/:id/rsvp` GET latest + POST append), the RSVP report (`/v1/rsvps`, incl. `?format=csv`), and config (`/v1/config` GET/PATCH)
  - Reads are exposed as signals (`toSignal`); imperative actions return `Promise` via `firstValueFrom` — no raw `Observable` reaches a component
  - These are explicitly NOT @ngrx/data repositories; a doc comment states why (append-only sub-resource, report, singleton, RPC)
  - Auth service aligns with T200's signals-based auth store (no duplication of token handling)
- **Refs:** in-repo ADR W-0001 (decisions 3–4), hub ADR-0013, hub ADR-0015; files: `src/app/core/`

### T214 — Retire mock services; migrate screens to the data layer
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T212, T213
- **Acceptance:**
  - `guest.service`, `rsvp.service`, `dashboard.service`, `configuration.service` mock implementations replaced by the facades (T212) / RPC services (T213); mock data removed
  - Consuming screens read facade/service signals; no behavioural regression in invitation, rsvp, admin flows
  - `album.service` is left untouched and out of scope (gallery cut by hub ADR-0014)
  - `pnpm typecheck && pnpm lint && pnpm test` green
- **Refs:** in-repo ADR W-0001, hub ADR-0014; files: `src/app/core/*.service.ts`, `src/app/screens/**`

## Scope cuts (hub ADR-0014) — do not build

- No gallery/photo-upload feature, no admin photo moderation views.
- No reminder-schedule or send-log admin views.
- Feature folders are exactly: invitation, rsvp, admin.
