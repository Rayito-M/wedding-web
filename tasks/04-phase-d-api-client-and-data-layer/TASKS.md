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
- **Status:** ✅ done (2026-07-17)
- **Owner:** agent (implementer)
- **Depends on:** T206
- **Acceptance:**
  - `@openapitools/openapi-generator-cli` added as a dev dependency; `openapitools.json` (or equivalent config) pins the generator version and `typescript-angular` options (Angular 22, `providedIn: 'root'`, interface models, kebab-case file naming, single request-parameter objects)
  - `gen:api` script reads `../wedding-architecture/contracts/openapi.json` (honoring an `OPENAPI_SOURCE` env override) and writes to `src/app/core/api/`; `gen:api:check` regenerates to a temp dir and diffs against the committed output, failing on drift
  - The JVM/Java prerequisite is documented in `README.md`, along with the regen steps; any prior `openapi-typescript-codegen` reference is removed
  - Open question resolved in-PR: confirm npm-vs-pnpm runner and align `CLAUDE.md`/`README.md` accordingly (see ADR W-0001 "Open questions")
- **Refs:** in-repo ADR W-0001 (decisions 1–2), hub ADR-0005, `contracts/README.md`; files: `package.json`, `openapitools.json`, `README.md`
- **Resolution (2026-07-17):** `@openapitools/openapi-generator-cli` added; `openapitools.json` pins generator 7.23.0 + `typescript-angular` options (`skipValidateSpec` needed — the hub spec declares 3.0 but uses 3.1 keywords, flagged for wedding-api); `scripts/gen-api.mjs` drives `gen:api`/`gen:api:check` (honors `OPENAPI_SOURCE`); runner confirmed **pnpm** (ADR W-0001 open question resolved in place); `README.md` documents the JVM prerequisite + regen steps. Smoke-tested end-to-end; generated output deliberately not committed (T208).

### T208 — Generate the initial API client into `src/app/core/api/`
- **Status:** ✅ done (2026-07-17)
- **Owner:** agent (implementer)
- **Depends on:** T207
- **Acceptance:**
  - `gen:api` produces `@Injectable`, `providedIn: 'root'` Angular services (one per OpenAPI tag) + typed models for every ADR-0015 resource (guests, agenda-items, venues, hotels, rsvps, config, auth) into `src/app/core/api/`
  - Generated services use Angular `HttpClient`; the auth interceptor supplies `Authorization: Bearer` (no per-call headers added, Hard Rule #6)
  - Generated dir is committed and marked generated (lint/format ignore); it is never hand-edited
  - `pnpm typecheck`/build green; supersedes the `openapi-typescript-codegen` mechanics of T205 (cross-referenced)
- **Refs:** in-repo ADR W-0001, hub ADR-0015; files: `src/app/core/api/**`
- **Resolution (2026-07-17):** client generated (5 services — auth, guests, config, rsvp, health — + 27 typed models); marked generated via `.prettierignore`, `.gitattributes` (`linguist-generated`), and an `ignores` block in `eslint.config.js`; `pnpm typecheck` script added (was documented in CLAUDE.md but missing from `package.json`); `typecheck`/`lint`/`build`/`gen:api:check` green. Regenerated same-day against the updated hub contract (typed `GET /v1/config/public` → `WeddingConfigPublicResponseDto` gains brideName/groomName/tagline/date/themeId/mainVenue…); no new services/models. Two things to flag: (1) the contract's `priceTier` enum values (`€€`, `€€€`) sanitize to invalid TS identifiers — fixed via `enumNameMappings` in `openapitools.json` (forwarded by `gen-api.mjs` as `--enum-name-mappings`), never by editing output; still needed after the contract update, as is `skipValidateSpec` (re-verified: 8 OpenAPI-3.1-keyword validation errors); (2) **contract gap vs ADR-0015/ADR-0013 (deferred):** the hub contract has no standalone `/v1/agenda-items`, `/v1/venues`, `/v1/hotels` collections (they exist only as models embedded in the WeddingConfig DTOs) and no `POST /v1/auth/social` — those services will appear on regen once wedding-api publishes the paths; T210/T211 (Agenda/Venue/Hotel repositories) and T200 (social sign-in) are blocked on that backfill. Generated bearer-header code (`addCredentialToHeaders`) is a no-op unless a credential is configured in `Configuration` — we don't configure one, so the interceptor stays the sole auth-header source (Hard Rule #6). ESLint landed as a follow-up: `ng add angular-eslint` (flat `eslint.config.js`, recommended presets; `component-selector` extended to allow the CLAUDE.md attribute-selector-on-native convention); Bytesafe-registry fetch-time-as-publish-time false positives added to `minimumReleaseAgeExclude` (each spot-checked against registry.npmjs.org, same pattern as T207).

### T209 — Bootstrap @ngrx/store + effects + entity + data
- **Status:** ✅ done (2026-07-17)
- **Owner:** agent (implementer)
- **Depends on:** T208
- **Acceptance:**
  - Add `@ngrx/store`, `@ngrx/effects`, `@ngrx/entity`, `@ngrx/data` dependencies
  - `app.config.ts` provides `provideStore`, `provideEffects`, and `provideEntityData(...)` (config wired in T210)
  - Store devtools enabled only under `isDevMode()` — no `environment.ts` feature flag (Hard Rule #7)
  - App still builds and runs with no entities behaviourally wired yet
- **Refs:** in-repo ADR W-0001 (decision 3); files: `package.json`, `src/app/app.config.ts`
- **Resolution (2026-07-17):** `@ngrx/{store,effects,entity,data,store-devtools}@^21.1.1` added — **no NgRx release targets Angular 22 yet** (21.1.1 is latest, peers pin `@angular/*@^21`; verified compiling/building/serving cleanly on Angular 22 — watch for an NgRx 22 release and bump then). `app.config.ts` provides `provideStore()`, `provideEffects()`, `provideEntityData({}, withEffects())` (metadata comes in T210), and `provideStoreDevtools()` behind an `isDevMode()` spread (Hard Rule #7). NgRx tree added to `minimumReleaseAgeExclude` (Bytesafe false positives, spot-checked: all published 2026-06-08). `typecheck`/`lint`/`build` green; dev server boots and serves the wired bundle.

### T210 — Entity metadata + repository-vs-direct boundary
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T209
- **Acceptance:**
  - `EntityMetadataMap` defines exactly `Guest`, `WeddingConfig`, `WeddingConfigPublic` (the ADR-0015 CRUD collections), with pluralization and `selectId`
  - A short doc comment (or `core/data/README`) records that RSVP (single mutable resource, ADR-0022), `config` (singleton), and auth (RPC) are deliberately excluded from repositories
  - No entity is added for any endpoint outside the four collections
- **Note (2026-07-17):** partial slice delivered ahead of schedule (user request): `src/app/core/data/entity-metadata.ts` exists with the `WeddingConfigPublic` entity only (`selectId` = server-issued `id`; invariant plural — singleton resource). T210 proper adds the remaining entities to this map.
- **Refs:** in-repo ADR W-0001 (decision 3), hub ADR-0015; files: `src/app/core/data/`

### T211 — Custom entity data services delegating to the generated client
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T210, T208
- **Acceptance:**
  - For each of the four entities, a custom `EntityCollectionDataService<T>` delegates `getAll/getById/add/update/delete` to the corresponding generated Angular service (no hand-written URLs)
  - Services registered via `EntityDataService.registerServices(...)`; the `me` id path is handled inside the Guest data service
  - The generated client remains the single source of endpoint URLs and request typing
- **Note (2026-07-17):** partial slice delivered ahead of schedule (user request): `WeddingConfigPublicDataService` (`src/app/core/data/wedding-config-public-data.service.ts`) delegates reads to the generated `ConfigService` (mutations rejected — read-only singleton), registered via `provideEntityDataServices()` (`core/data/index.ts`, `provideEnvironmentInitializer` + `EntityDataService.registerService`). `app.config.ts` now also wires `provideApi(environment.apiBaseUrl)` and `provideEntityData(entityConfig, withEffects())`. `ConfigurationService` exposes the collection as signals (`weddingConfigPublic`, `weddingConfigPublicLoading`) + `loadWeddingConfigPublic()`, called from its constructor (mock fetch disabled; full mock retirement stays in T214). T211 proper adds the remaining entity data services.
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
- **Note (2026-07-25 — hub ADR-0022):** the RSVP portion of this task is superseded. RSVP is no
  longer an append-only sub-resource at `/v1/guests/:id/rsvp`; it is a single mutable resource at
  `/v1/rsvp/:id` (`:id` = guest ULID or `me`) with `GET` (204 when absent) / `POST` (create,
  409 if exists) / `PATCH` (edit in place, `version` optimistic-lock → 409 re-read/retry). Build the
  RSVP thin service against that shape (see **T215**), not "GET latest + POST append". The
  auth/config/report parts of this task stand. The RSVP report (`/v1/rsvps`) is currently absent
  from the API contract (per T208 note); wire it only once it reappears on regen.
- **Refs:** in-repo ADR W-0001 (decisions 3–4), hub ADR-0013, hub ADR-0015, hub ADR-0022; files: `src/app/core/`

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
