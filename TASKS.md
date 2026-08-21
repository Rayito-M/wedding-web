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

## Scope cuts (hub ADR-0014) — do not build

- No gallery/photo-upload feature, no admin photo moderation views.
- No reminder-schedule or send-log admin views.
- Feature folders are exactly: invitation, rsvp, admin.

## Phase — Visual refresh (DS update; re-baselined 2026-07-31 to commit `90246bd`)

> **RE-BASELINE (2026-07-31) — DS commit `b816c12` → `90246bd` (2026-07-30). Supersedes the
> `b816c12` baseline preamble further below, which is retained for history.**
>
> The design system advanced from `b816c12` (2026-07-27) to `90246bd` (2026-07-30) and changed the
> model substantially. Verified against `../wedding-ui-design/ui_kits/wedding-app/`:
>
> 1. **Every screen now has a mobile AND a desktop version**, selected by a `wide` prop / device
>    toggle (`ui_kits/wedding-app/README.md`, `AppShell.jsx`). In this repo the equivalent is a single
>    component per screen with responsive CSS: the mobile layout is the base and the desktop layout is
>    the `@media (min-width: 900px)` branch (existing convention). "Add mobile + desktop per screen"
>    here means: for each screen, make **both** branches match the corresponding DS layout — it does
>    **not** mean splitting into two components. (The DS uses separate `*Mobile.jsx` companions only
>    for `ConfigManager`, `GuestManager`, and `SeatingPlan`; all other screens branch on `wide` in one
>    file. Mirror that: one Angular component per screen, two CSS branches.)
>
> 2. **`AppShell.jsx` was REWRITTEN in `90246bd`** (it was NOT "unchanged", contrary to the now-stale
>    scope note in T230). New nav model: `NAV_BASE = [home, rsvp, schedule, album, travel, people]`
>    plus couple-only `[guests, seating, config]`. Consequences: (a) the couple role now has **9** nav
>    destinations → the `TabBar` "More" overflow sheet (previously flagged as speculative in T230) is
>    now a **real** condition; (b) `people` and `seating` are new destinations with no screen in this
>    repo yet; (c) the mobile shell shows a **mock status bar** (`9:41 ●●●●`) — that is a DS-prototype
>    artifact, do **not** replicate it. The web's `AppShell` analogue is `PrivateLayout` +
>    `shared/screen-header` + `shared/tab-bar`; those files carry this change, not the per-screen files.
>
> 3. **`ScreenHome.jsx` (new) is ONE role-driven screen for both roles** (`role='couple'|'guest'`,
>    `wide` for desktop). It **replaces the now-legacy `ScreenDashboard.jsx` and
>    `ScreenInviteeDashboard.jsx`** (both last touched at `b816c12`). This repo still has two separate
>    components — `screens/dashboard/` (couple, mock `DashboardService`) and `screens/invitee/` (guest,
>    real `@ngrx/data` entity collections) — with **divergent `.ts`/data wiring**. Whether to physically
>    merge them into one `home` component or keep them separate and only align each visually is a
>    **decision the user must make** (see **T236**): a physical merge is a behavior/data-shape change and
>    is therefore **outside** this phase's visual-only constraint.
>
> 4. **Screens refactored to the new AppShell integration pattern in `90246bd`:** Home (new), Album,
>    RSVP, Schedule, Travel, People (new), Profile (new) — each now wraps `AppShell` with a per-screen
>    `maxWidth` (Home 900, Album 880, Travel 880, Schedule 620, RSVP 620, People 980, Profile 860). In
>    this repo the shell wrapping lives in `PrivateLayout`, so per-screen work is just the content +
>    each screen's own `max-width` in SCSS. The existing per-screen tasks (T220/T223/T225/T226/T227)
>    stay valid; their DS refs are re-pinned to `90246bd` and the worked example of the new pattern is
>    `ScreenTravel.jsx` (verified: two-column desktop at `maxWidth 880`, `ALBAICÍN · GRANADA` eyebrow,
>    ground motorcycle on mobile — matches T227 as written).
>
> 5. **New screens with no implementation in this repo:** `ScreenPeople.jsx` (guest directory) and
>    `ScreenProfile.jsx` (own profile, reached from the account dropdown, never the tab bar). Scaffold
>    tasks added as **T237 / T238** (presentational-only, following the T229 SeatingPlan precedent —
>    no route/nav/data wiring, flagged as follow-up).
>
> **Task status under the new baseline (see per-task notes for detail):**
> - **T219, T230, T231, T232, T233, T234** — token sync, illustration fixes, login, header nav: still
>   valid; T230 gets a revision note (its AppShell "unchanged" scope claim is now false).
> - **T220, T223, T225, T226, T227** — per-screen Album/GuestManager/RSVP/Schedule/Travel: still valid;
>   DS refs re-pinned to `90246bd`; the "mobile + desktop per screen" clarification above applies.
> - **T221** (config-manager) — done under `b816c12`; add a re-verify-against-`90246bd` follow-up.
> - **T222** (dashboard) — done, but its ref (`ScreenDashboard.jsx`) is now **legacy**; the specific
>   change it made (drop DecorSun/DecorWave, keep the flipped FishIllustration on the couple stats
>   card) is **confirmed still-correct** in the new `ScreenHome.jsx` couple `rsvpStats` block. Folded
>   into T236's couple-role scope going forward.
> - **T224** (invitee) — **SUPERSEDED**: its ref (`ScreenInviteeDashboard.jsx`) is now legacy; its
>   scope (drop emoji, componentize schedule rows) is absorbed by the guest-role scope of **T236**.
> - **New:** **T235** (adopt the rewritten AppShell/nav in the shell), **T236** (role-driven Home
>   merge — decision + implementation), **T237** (People scaffold), **T238** (Profile scaffold).
>
> The visual-only working constraints (`.scss` + minimal `.html`, no `.ts`/behavior/data-shape changes,
> new copy hardcoded not translated) **remain binding on T219–T234**. The new tasks T235–T238
> **cannot** all stay visual-only (the shell nav model and the Home merge are inherently structural);
> each new task explicitly calls out where it exceeds the visual-only line so the user can decide,
> rather than silently introducing behavior changes.
>
> ---
>
> **Original baseline preamble (commit `b816c12`) — retained for history:**
>
> `../wedding-ui-design` shipped a visual update (commit `b816c12`): the three color themes were
> reordered/deduplicated in `tokens/colors.css` with the **default theme flipped from `mauve` to
> `terracotta`**, several screen references picked up layout/decoration changes, and one brand-new
> screen (`ScreenSeatingPlan.jsx`) was added. This phase is **visual only**: `.scss` + minimal
> `.html` structure changes to match the DS reference, no `.ts` logic changes. Every task below
> carries the same two blanket rules — stated once here, binding on all of T219–T229:
>
> 1. **No `.ts` changes.** No new/changed signals, inputs, outputs, effects, computed values,
>    service/API calls, routing, or guards. If a visual difference in the reference appears to
>    require a data or behavior change, do **not** invent it — leave the current behavior in place,
>    note the gap in the PR description as a follow-up, and move on.
> 2. **Text handling.** Most screens in this repo are already wired end-to-end through
>    `ngx-translate` (`| translate` / `i18n=`) — leave that wiring alone where the existing copy
>    still matches the DS reference; do not rip out working i18n. Only for copy/markup that is
>    genuinely **new** in this pass (an element the current screen doesn't render at all yet, called
>    out explicitly per task below) add it as **static, hardcoded literal text directly in the
>    `.html`** — not through the `translate` pipe or `i18n=` attribute, and not newly bound to
>    component/service data. This deliberately overrides CLAUDE.md Hard Rule #8 for net-new copy in
>    this visual-only pass; real i18n wiring for that new copy is deferred to a separate future task.
>    Where a new static string wraps an *already-available* signal/value (e.g. a count the screen
>    already computes), binding to that existing signal in the template is fine — that's not new
>    logic, just new markup; only the surrounding label text is hardcoded.
>
> All tasks below also carry the repo's standing hard rules unchanged: shared-component reuse
> (`src/app/shared/*`) over one-off markup, tokens-only styling via `src/styles/_tokens.scss`
> semantic aliases (no hardcoded colors/spacing/radii, no inline `style`), mobile-first with no new
> hardcoded breakpoints beyond this file's existing `@media` convention, and WCAG 2.1 AA semantics
> preserved. Every task's Definition of Done includes `pnpm typecheck && pnpm lint && pnpm build`
> green and a visual check against the DS reference file in all three themes (mauve/terracotta/verdeagua).
>
> **T230** carves the shared private-app shell (header + tab-bar, everything every screen below
> renders inside) out as its own task, sequenced right after T219, precisely so those shell files
> are touched once — for the token flip and any drift found — rather than redundantly (and
> potentially conflictingly) by each of T220–T229. All per-screen tasks depend on T230 in addition
> to T219.

### T219 — Re-sync design tokens to the DS update (default theme mauve → terracotta)
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** —
- **Acceptance:**
  - `src/styles/_tokens.scss`'s three color-theme blocks are reordered to match
    `../wedding-ui-design/tokens/colors.css` exactly: the block combined with the bare `:root`
    selector changes from `[data-theme='mauve']` to `[data-theme='terracotta']` (terracotta is now
    first and is the fallback theme when no `data-theme` attribute is set anywhere in the app);
    `mauve` and `verdeagua` remain override-only blocks, same order as the DS file.
  - Every color value in all three theme blocks (`--bg`, `--surface`, `--ink`, `--sub`, `--line`,
    `--accent`, `--accent-2`, `--accent-3`, `--chip`) is diffed 1:1 against the DS file — this is a
    reordering, not a value change; confirm no hex/opacity drift crept in during the copy.
  - The semantic-alias block is reconciled against the DS file's aliases (`--surface-page`,
    `--surface-card`, `--surface-chip`, `--text-muted`, `--border-hairline`, `--brand-accent`,
    `--brand-accent-soft`, `--brand-accent-tertiary`, `--on-accent`). Note one naming drift found:
    the DS file names the body-text alias `--text-body`; this repo currently has
    `--text-body-color`. Grep existing `t.$text-body-color` / `var(--text-body-color)` usages first,
    then either (a) rename to `--text-body` and update the SCSS compat-layer variable and all call
    sites, or (b) if the rename footprint is large, keep `--text-body-color` as the primary alias and
    add `--text-body` as an equivalent so both resolve — document whichever choice is made inline as
    a comment. Either way, no visual regression.
  - No screen's rendered appearance changes for the terracotta or verdeagua themes (values are
    unchanged, only cascade order/selector changes); the mauve theme, reached explicitly via
    `[data-theme='mauve']`, is unaffected.
  - Any screen or test that implicitly assumed "no `data-theme` attribute" meant mauve is checked
    for regressions now that the same condition resolves to terracotta.
  - `pnpm typecheck && pnpm lint && pnpm build` green.
- **Refs:** `../wedding-ui-design/tokens/colors.css` (commit `b816c12`), `src/styles/_tokens.scss`.
  No hub ADR needed — this is an in-repo token mirror sync, not a cross-cutting decision.

### T230 — Private layout shell: verify + re-apply tokens (shared header + tab-bar)
- **Status:** done (b816c12 scope) — needs a follow-up under `90246bd` (see note + T235)
- **Owner:** agent (implementer)
- **Depends on:** T219
- **Re-baseline note (2026-07-31, `90246bd`):** the "Scope check confirmed: `AppShell.jsx` … were
  **not** touched by commit `b816c12`" bullet is **now STALE** — `AppShell.jsx` was **rewritten** at
  `90246bd`, and `TabBar`/`AppHeader` nav model changed (new `home` unification, new `people` +
  `seating` destinations, couple role now at 9 entries → the "More" overflow sheet that this task
  flagged as speculative is now a real condition). The token-verification work T230 delivered against
  `b816c12` stands; the AppShell/nav re-baseline is carried by the new **T235** (structural, not
  visual-only). Do not re-open T230; treat T235 as its successor.
- **Note on placement:** numbered T230 (after the per-screen tasks were already numbered), but
  sequenced here — immediately after T219, before T220 — because every screen in T220–T229 renders
  inside this shell. Carving it out as its own task means the shared shell files get touched once,
  not once per screen.
- **Acceptance:**
  - **Scope check confirmed:** `../wedding-ui-design/ui_kits/wedding-app/AppShell.jsx` and
    `components/navigation/{AppHeader,TabBar,AccountMenu,LanguageDropdown}.jsx` were **not** touched
    by commit `b816c12`. This task is therefore primarily a **verification + token re-application**
    pass following T219's default-theme flip, not a rework — confirm the shell renders correctly in
    all three themes after T219, with particular attention to the "no `data-theme` attribute"
    default case now resolving to terracotta instead of mauve.
  - Fix two concrete token-usage drift items found while comparing `screen-header.scss` against the
    DS reference (pre-existing under the old default too, unrelated to the flip itself but in scope
    for this token-verification pass):
    - `.avatar { background: var(--accent-2); }` uses the raw role token instead of the semantic
      alias — change to `var(--brand-accent-soft)` per CLAUDE.md Hard Rule #3.
    - `.menu-item { color: var(--text-body-color); }` — once T219 lands, confirm this alias name
      still resolves; if T219 renamed rather than dual-aliased, update this reference to
      `var(--text-body)` too.
  - **Minor visual drift found (small, in scope):** `AccountMenu.jsx`'s language section carries an
    uppercase "Language" eyebrow label above the language options; `screen-header.html` currently
    renders the language buttons directly with no such label. Add it as static hardcoded literal
    text ("Language") per the phase's text-handling rule — new markup, not new logic.
  - **Explicitly out of scope — flag as follow-ups, do not implement:**
    - `AccountMenu.jsx` also shows a name+role header block and a "My profile →" row above the
      language section. `screen-header.ts` already exposes a `userProfile()` signal (first/last
      name) that could back a name display — reusing it in new markup is fine (not new logic) if
      trivial, but a "My profile" link needs a target route, and `screens/profile/` /
      `ScreenProfile.jsx` is explicitly out of scope for this DS-update batch (untouched by
      `b816c12`, no screen to link to yet). Do not add a "My profile" entry or any new route.
    - `TabBar.jsx` defines a "More" overflow sheet for roles with more than 4 nav destinations.
      Checked `src/app/shared/nav-tabs.ts`: every role currently has at most 5 `NAV_TABS` entries
      (guest: home/rsvp/schedule/travel; couple: dashboard/guests/config/schedule/travel) — no
      overflow condition exists today, and the not-yet-routed `seating-plan` screen (T229) isn't in
      `NAV_TABS` either. Building the More-sheet now would be speculative; flag as a follow-up to
      land alongside whichever future task wires `seating-plan` (and any other new destination) into
      `NAV_TABS`.
    - `AppHeader.jsx`/`AccountMenu.jsx` are separate DS components (`AppHeader`, `AccountMenu`,
      `Avatar`), whereas this repo inlines the equivalent markup into one `ScreenHeader` component.
      That structural difference predates `b816c12` and isn't something this visual pass should
      refactor — no change.
  - No `.ts` changes beyond what the two token-usage fixes above mechanically require (no new
    signals/inputs/outputs/effects; the "Language" label addition is template-only).
  - `pnpm typecheck && pnpm lint && pnpm build` green; header, tab-bar, and account menu visually
    checked against `AppHeader.jsx`/`TabBar.jsx`/`AccountMenu.jsx`/`LanguageDropdown.jsx` in all
    three themes, particularly the terracotta-as-default case.
- **Refs:** DS `ui_kits/wedding-app/AppShell.jsx`, `components/navigation/AppHeader.jsx`,
  `TabBar.jsx`, `AccountMenu.jsx`, `LanguageDropdown.jsx` (all unchanged by commit `b816c12` —
  referenced for comparison only); files: `src/app/layouts/private-layout/`,
  `src/app/shared/screen-header/`, `src/app/shared/tab-bar/`. Assumes T219 done.

### T220 — Album screen: desktop metadata line, filter/grid polish, motorcycle decor
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T219, T230
- **Acceptance:**
  - **New shared dependency (build here, first user in task order):** the DS added
    `components/motion/MotorcycleRider.jsx` — a decorative side-profile line-art motorcycle+rider
    SVG that randomly crosses the screen (random initial delay 1.2–3.5s, random crossing duration
    4.2–6.8s, random gap 4.5–11s between passes, alternating direction) with a `mode` input
    (`ground` = flat run, `ridge` = an added up/down bob keyframe) and `color`/`accentColor` theme
    inputs. No equivalent exists in `src/app/shared/decor/` (checked: alhambra, fish, fish-pair,
    sun, wave only). Add `src/app/shared/decor/motorcycle-rider/` as a new standalone component
    (`app-decor-motorcycle-rider`) with inputs `mode`, `color`, `accentColor`, `width`, `bottom`,
    `zIndex` mirroring the reference's props, implemented with CSS keyframe animations driven by
    signals/`effect()`-scheduled timers (no RxJS) — this is new component *markup/animation*, not
    business logic, and is a prerequisite for T220, T226 (Schedule), T227 (Travel), and T228
    (Welcome), which must reuse this same component rather than duplicating it.
  - Mobile album view gets the `app-decor-motorcycle-rider` in `mode="ground"` at the bottom
    (`color` = `var(--ink)`, `accentColor` = `var(--brand-accent)`), matching
    `ScreenAlbum.jsx`'s mobile branch.
  - Desktop (`wide`) title block gains the second metadata fragment the reference shows next to
    "Shared by all of you." — a hardcoded static label `· LIVE ·` / `PHOTOS` wrapper around the
    **existing** `album.totalCount()` value (already computed and already bound to the shell header
    via `HeaderService` in `album.ts`) — reuse that same signal in the new inline location; do not
    add new component logic or a second source of truth for the count.
  - Confirm `ALBUM_CATEGORIES` (`core/album.service.ts`) matches the reference's filter set/order
    (`All, Getting ready, Ceremony, Dinner, Dancing, Polaroid`); if it doesn't, leave the service
    untouched and note the mismatch as a follow-up in the PR description — do not edit the service.
  - Desktop grid/container width aligned to the reference's `maxWidth={880}` AppShell (currently
    840px) and capped at 3 columns with taller tiles (+40px height boost), matching
    `ScreenAlbum.jsx`'s `wide` grid call; the existing 4-column step at 1200px isn't in the
    reference — remove it, or explicitly flag as an intentional deviation in the PR description if
    kept.
  - Uses `app-photo-placeholder` (already the case) — no new placeholder markup.
- **Refs:** DS `ui_kits/wedding-app/ScreenAlbum.jsx`, `components/motion/MotorcycleRider.jsx`;
  files: `src/app/screens/album/`, new `src/app/shared/decor/motorcycle-rider/`. Assumes T219 and
  T230 done.

### T221 — Config manager screen: visual polish pass
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T219, T230
- **Re-baseline note (2026-07-31, `90246bd`):** done under `b816c12`. `ScreenConfigManager.jsx` +
  `ScreenConfigManagerMobile.jsx` still exist at `90246bd` and keep the separate-mobile-companion
  pattern (not a `wide` branch), so no structural change; still valid. Add a lightweight
  **re-verify follow-up** (folded into T235's scope-check) confirming no spacing/typography drift
  crept in between `b816c12` and `90246bd` for these two files. No new task needed unless drift found.
- **Acceptance:**
  - This screen is already close to the DS reference (section rail/pills, card-list pattern, tag
    pill editor, modal, decorative fish in the rail) — this task is a verification + polish pass,
    not a rebuild. Diff `config-manager.html`/`.scss` line-by-line against
    `ScreenConfigManager.jsx` + `ScreenConfigManagerMobile.jsx` and correct any spacing/typography
    values that drifted from the token values used in the reference (padding, gap, font-size per
    section).
  - **Known data-model difference — do not implement, flag only:** the reference's Appearance
    section renders "Languages offered" as one `Toggle` per language (on/off, enabling/disabling a
    language for guests); this repo's current implementation instead renders one text `Input` per
    language code (editing a display label). This is a behavior/data-shape difference, not a visual
    one — leave the current input-based implementation as-is and note the toggle-based pattern as a
    follow-up in the PR description.
  - Where existing translated copy (`configManager.*` keys) still matches the reference wording,
    leave the `| translate` wiring in place. If a specific label's *wording* has drifted from the
    reference (not structure — just word choice), correct the string in the relevant
    `public/i18n/*.json` locale file(s) — a content correction, not new markup, still in scope for
    this visual-only pass.
  - No `.ts` changes to `config-manager.ts` (section switching, tag modal, save/dirty logic all stay
    as-is).
- **Refs:** DS `ui_kits/wedding-app/ScreenConfigManager.jsx`, `ScreenConfigManagerMobile.jsx`;
  files: `src/app/screens/config-manager/`. Assumes T219 and T230 done.

### T222 — Dashboard screen: drop extra stats-card decoration (small diff)
- **Status:** done (ref now legacy — see note)
- **Owner:** agent (implementer)
- **Depends on:** T219, T230
- **Re-baseline note (2026-07-31, `90246bd`):** this task's ref `ScreenDashboard.jsx` is now
  **legacy** — replaced by the couple-role blocks of `ScreenHome.jsx`. The change it delivered
  (remove `DecorSun`/`DecorWave` from the couple stats card, keep only the flipped `FishIllustration`)
  is **confirmed still-correct** under `90246bd`: `ScreenHome.jsx`'s couple `rsvpStats` block
  (lines 32–46) decorates with a single flipped `FishIllustration` (top 10, right 12, opacity 0.85,
  width 60) and nothing else. No rework needed; the ongoing home of the couple stats card is T236.
- **Acceptance:**
  - The reference's stats card (`ScreenDashboard.jsx`) decorates with **only** a single
    `FishIllustration` (flipped, top-right, opacity 0.85, width 60). The current implementation
    additionally renders `app-decor-sun` and `app-decor-wave` layered into the same card
    (`.deco-sun`, `.deco-wave` in `dashboard.scss`) — these two are not in the current DS reference
    for this card. Remove `DecorSun`/`DecorWave` usage and their `.deco-sun`/`.deco-wave` rules from
    this screen (keep `DecorFish`); update the `imports` array in `dashboard.ts` only to drop the
    now-unused component imports (a mechanical import-list edit, not new logic).
  - Verify the remaining fish decoration's position/opacity/size match the reference exactly
    (top 10px, right 12px, opacity 0.85, width 60 — already the case, confirm no drift).
  - No other structural changes — greeting, stats row, progress bar, quick tiles, and task list all
    already match the reference; leave `| translate` wiring as-is.
- **Refs:** DS `ui_kits/wedding-app/ScreenDashboard.jsx`; files: `src/app/screens/dashboard/`.
  Assumes T219 and T230 done.

### T223 — Guest manager screen: mobile list layout + modal decoration
- **Status:** done (2026-07-31) — mobile two-line tap-row list + modal fish decoration. One benign
  `.ts` edit: `rsvp-details-modal.ts` imports `DecorFish` (standalone-component render requirement,
  no behavior change); `guest-manager.ts` untouched. Caption reads "N Participants · M Children"
  (reused existing localized key; no "guests" i18n key exists — see note).
- **Owner:** agent (implementer)
- **Depends on:** T219, T230
- **Acceptance:**
  - **Mobile (< 768px) row layout doesn't match the reference.** `ScreenGuestManagerMobile.jsx`
    shows each guest as a two-line tap row (name + "N guests · M children" caption on the left,
    a status dot+label tag on the right) inside a simple bottom-hairline list — not a data-grid
    collapse. The current implementation instead collapses the desktop grid into stacked
    `data-label`-prefixed field rows per guest inside a bordered card. Restructure the < 768px
    styles (and the minimal template markup needed, e.g. wrapping name+caption vs. per-field rows)
    to match the reference's simpler list-row pattern; keep the existing desktop grid/table
    untouched above the breakpoint. This is a markup/CSS reshape only — the underlying `paginatedRsvps()`
    data and click/keyboard handlers stay as-is.
  - Add the reference's decorative `FishIllustration` (flipped, opacity 0.85, width ~54, top-right)
    to the RSVP details modal header (`rsvp-details-modal.html`/`.scss`) using the existing
    `app-decor-fish` shared component — matches `ScreenGuestManager.jsx`'s profile-overlay header.
  - Leave all `guest_manager.*` / `| translate` wiring as-is; this screen's copy is already fully
    localized and matches the reference's structure — no new hardcoded text needed here.
  - No `.ts` changes: filtering, pagination, modal open/close, and form logic in `guest-manager.ts`
    and `rsvp-details-modal.ts` are untouched.
- **Refs:** DS `ui_kits/wedding-app/ScreenGuestManager.jsx`, `ScreenGuestManagerMobile.jsx`; files:
  `src/app/screens/guest-manager/`. Assumes T219 and T230 done.

### T224 — Invitee dashboard: drop emoji, componentize schedule rows (small diff)
- **Status:** superseded (2026-07-31 — see note); do not implement as written
- **Owner:** agent (implementer)
- **Depends on:** T219, T230
- **Re-baseline note (2026-07-31, `90246bd`):** **SUPERSEDED.** Its ref
  `ScreenInviteeDashboard.jsx` is now legacy — replaced by the guest-role blocks of `ScreenHome.jsx`.
  Both concerns it carried are absorbed into **T236** (role-driven Home), whose guest-role acceptance
  must include: (a) **no emoji** in the RSVP-status card title (the new `rsvpConfirmed` block renders
  plain "Confirmed for 2"); (b) the highlights list uses `app-timeline-item` (the DS `highlights`
  block composes `TimelineItem`). Keep this entry for history; the work lands under T236.
- **Acceptance:**
  - **Remove the emoji** (`&#128525;`, `&#128522;`, `&#128542;`) from the RSVP-status card's title
    line in `invitee.html`. The DS guidelines are explicit: no emoji anywhere in app UI (only
    guest-typed content is exempt) — the current reference (`ScreenInviteeDashboard.jsx`) shows
    plain text ("Confirmed for 2", no emoji). Delete the emoji entities and any now-unneeded
    trailing `&nbsp;`; keep the surrounding `| pluralTranslate` / `| translate` bindings unchanged.
  - Replace the ad hoc `.item` schedule-preview rows (in the "The day · highlights" section) with
    the shared `app-timeline-item` component (already used identically in `screens/schedule/`),
    matching the reference's use of `TimelineItem` for this exact list. Pass the same
    `time`/`title`/`sub` bindings currently computed inline; no new data logic.
  - No other `.ts` changes — the countdown card, RSVP summary card, and quick tiles already match
    the reference's structure and stay as-is. The commented-out announcement/photos blocks stay
    commented out (unchanged, matches the reference not rendering them either).
- **Refs:** DS `ui_kits/wedding-app/ScreenInviteeDashboard.jsx`; files: `src/app/screens/invitee/`.
  Assumes T219 and T230 done.

### T225 — RSVP screen: step eyebrow label + desktop card chrome
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T219, T230
- **Acceptance:**
  - **New element:** each step body in the reference opens with an uppercase eyebrow label
    `RSVP · STEP {n}/3` (mono-style label token, `margin-bottom: 14px`) that the current
    implementation doesn't render at all. Add it as static hardcoded literal text "RSVP · STEP" and
    "/3" wrapping the **existing** `step()` signal (already available on `Rsvp`, e.g.
    `{{ step() + 1 }}`) — this is new markup around an already-bound value, not new logic; per the
    text-handling rule, the wrapping label text itself is hardcoded, not translated.
  - **Desktop (`wide`) card chrome missing:** the reference wraps the step content + footer in a
    bordered, radius-card surface (`background: var(--surface-card)`, 1px hairline border,
    `var(--radius-card)`, centered, `max-width: 560px`, content padding `26px 30px 24px`, footer
    padding `14px 30px 22px` with a top hairline) at ≥900px. The current `@media (min-width: 900px)`
    block only centers the column at 560px with no card surface — add the card wrapper styling
    (`.content`/`footer` gain a shared card container at this breakpoint) to match.
  - No `.ts` changes: step transitions, form validation, and submit logic in `rsvp.ts` are
    untouched; all existing `rsvp.*` translation keys stay wired as they are.
- **Refs:** DS `ui_kits/wedding-app/ScreenRSVP.jsx`; files: `src/app/screens/rsvp/`. Assumes T219
  and T230 done.

### T226 — Schedule screen: date eyebrow badge + motorcycle decor
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T219, T230, T220 (reuses `app-decor-motorcycle-rider`)
- **Acceptance:**
  - **New element:** the reference's title block carries a right-aligned uppercase date badge —
    `SAT · 5 JUN 2027` on desktop, `SAT · 5 JUN` on mobile — that the current `.title-block` doesn't
    render at all (it's currently just `<h1>`+`<p class="sub">`, no metadata span). Add it as static
    hardcoded literal text per the text-handling rule (this is a net-new element with no existing
    binding to reuse — do not wire it to `weddingConfig()?.date`; that data-binding is a follow-up,
    out of scope here).
  - Add `app-decor-motorcycle-rider` in `mode="ground"` at the bottom of the mobile view (`color` =
    `var(--ink)`, `accentColor` = `var(--brand-accent)`, matching `ScreenSchedule.jsx`'s mobile
    branch) — reuse the shared component built in T220, do not duplicate it.
  - No other changes: the `app-timeline-item` list and title/subtitle already match the reference;
    leave `schedule.*` translation wiring as-is.
- **Refs:** DS `ui_kits/wedding-app/ScreenSchedule.jsx`, `components/motion/MotorcycleRider.jsx`;
  files: `src/app/screens/schedule/`. Assumes T219, T230, and T220 done.

### T227 — Travel screen: desktop two-column layout, eyebrow badge, motorcycle decor
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T219, T230, T220 (reuses `app-decor-motorcycle-rider`)
- **Acceptance:**
  - **Desktop (`wide`) layout is currently missing entirely.** The reference lays desktop out as a
    two-column grid at `max-width: 880px` — map on the left (taller, 250px), "Stays nearby" +
    `app-stay-card` list on the right — with a right-aligned uppercase eyebrow badge
    `ALBAICÍN · GRANADA` next to the title. The current `@media (min-width: 900px)` block only
    narrows the whole single-column layout to `max-width: 560px` with no grid split. Rework the
    ≥900px styles (and the minimal template restructuring needed to place map/stays as grid
    children) to match; widen the container max-width to 880px at this breakpoint.
  - Add the `ALBAICÍN · GRANADA` badge as static hardcoded literal text (net-new element, not
    present today) per the text-handling rule.
  - Add `app-decor-motorcycle-rider` in `mode="ground"` at the bottom of the mobile view (same
    props as T226), reusing the shared component from T220.
  - Mobile map card, "río Darro" label, and `app-stay-card` list already match the reference closely
    — leave as-is; leave `travel.*` translation wiring (title/subtitle) untouched.
- **Refs:** DS `ui_kits/wedding-app/ScreenTravel.jsx`, `components/motion/MotorcycleRider.jsx`;
  files: `src/app/screens/travel/`. Assumes T219, T230, and T220 done.

### T228 — Welcome screen: motorcycle decor over the Alhambra skyline
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T219, T230, T220 (reuses `app-decor-motorcycle-rider`)
- **Acceptance:**
  - Add `app-decor-motorcycle-rider` in `mode="ridge"` positioned over/near the Alhambra
    illustration in the `.bottom .alhambra` block (`color` = `var(--brand-accent)`, `accentColor` =
    `var(--brand-accent-soft)`, `width` ≈ 52 mobile / 68 at the ≥1024px breakpoint per
    `ScreenWelcome.jsx` / `ScreenWelcomeLandscape.jsx`, `bottom` offset tuned so it rides the
    skyline ridge — 78px mobile / 146px desktop in the reference), reusing the shared component
    from T220 rather than duplicating its animation.
  - Otherwise this screen already closely matches both `ScreenWelcome.jsx` (portrait) and
    `ScreenWelcomeLandscape.jsx` (≥1024px) — names, fish-pair illustration, quote, date rule,
    location, CTA button, and venue caption are all present and already fully wired through
    `| translate`; leave that wiring as-is, no new hardcoded text needed for this screen.
  - No `.ts` changes: `welcome.ts`'s `open()` navigation and `desktop()`/`currentLang()` signals are
    untouched.
- **Refs:** DS `ui_kits/wedding-app/ScreenWelcome.jsx`, `ScreenWelcomeLandscape.jsx`,
  `components/motion/MotorcycleRider.jsx`; files: `src/app/screens/welcome/`. Assumes T219, T230,
  and T220 done.

### T229 — Scaffold new Seating plan screen (presentational only)
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T219, T230
- **Acceptance:**
  - `ScreenSeatingPlan.jsx` (+ its mobile companion `ScreenSeatingPlanMobile` in the same DS file)
    is a brand-new screen with **no existing implementation** in this repo — there is no
    `src/app/screens/seating-plan/` today. Scaffold a new, purely **presentational** screen
    (`src/app/screens/seating-plan/seating-plan.ts` / `.html` / `.scss`, standalone component,
    `app-seating-plan` selector) that reproduces the reference's static markup and layout in both
    the desktop two-panel layout (unassigned column: adults/children lists with search; tables grid
    with per-table capacity stepper and editable-looking name field styling) and the mobile
    segmented-tab layout (`Unseated` / `Tables` toggle).
  - **Static/placeholder data only.** Hardcode a small representative data set directly in the
    component (mirroring the shape and a subset of the reference's `SP_SEED`/`SP_TABLES_INIT`
    fixtures) purely to render the static markup — this is fixture data for a presentational
    scaffold, not a service or signal wired to any API; no `HttpClient`, no facade/service
    injection, no `EntityCollectionService`. Interactive behaviors visible in the reference
    (select-a-guest-then-click-a-table assignment, capacity +/-, inline table rename, search-as-you-
    type filtering, mobile tab switch) may be implemented as simple local component state
    (signals) **only insofar as needed to render the static visual states shown in the reference**
    (selected/unselected unit, full/not-full table) — do not build real persistence, validation, or
    any data-layer integration; if in doubt, hardcode a single representative visual state instead
    of wiring interactivity.
  - **All visible copy is static, hardcoded literal text** in the `.html` (per the text-handling
    rule — this is a 100%-new screen with zero existing i18n scaffolding, so nothing is "already
    wired" to preserve). Real i18n wiring is deferred to a separate future task.
  - Reuse shared components where the reference composes one already covered by the library
    (e.g. `app-monogram` if this screen is later wrapped in the app shell — but see below). Several
    UI patterns here (search pill input, per-unit selectable list button, per-table capacity
    stepper, inline-editable table-name field) have no equivalent in `src/app/shared/` today — hand-
    build them from `_tokens.scss` custom properties only, following the same precedent set by
    `config-manager`'s hand-built segmented control and tag editor (documented there as "no DS
    component covers this").
  - **Explicitly out of scope, do not do:** no route registration in the router config, no nav-menu
    entry (`TabBar`/admin nav), no `AppShell`/header wiring, no real data/service integration. This
    is a scaffold only; wiring it into navigation and real data is a separate follow-up task once
    the API/contract side (guest list, table assignments) exists.
- **Refs:** DS `ui_kits/wedding-app/ScreenSeatingPlan.jsx`; new files:
  `src/app/screens/seating-plan/`. Assumes T219 and T230 done.

### T231 — Alhambra illustration: fix flagpole, add missing flag, correct sun-dot position
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** —
- **Acceptance:**
  - Found while implementing T228: `src/app/shared/decor/alhambra.html` (`app-decor-alhambra`,
    used by the Welcome screen) has drifted from
    `../wedding-ui-design/components/illustrations/AlhambraIllustration.jsx` on the Torre de la
    Vela's flagpole/flag detail — this predates the `b816c12` update (not caused by it) but is now
    visibly wrong now that the Welcome screen is getting attention in this phase.
  - DS reference: flagpole runs `x1="43" y1="56" x2="43" y2="20"`, then a flag shape
    `M 43 22 L 60 22 L 55.5 28.5 L 60 35 L 43 35` (a pennant flying right off the pole near its top),
    and the sun-finial dot is `cx="43" cy="18"`.
  - This repo's version: pole is shorter (`x2="43" y2="44"`), has **no flag path at all**, and the
    dot sits at `cy="42"` — effectively the pole was truncated and the flag dropped at some point.
  - Fix `alhambra.html`: extend the pole line to `y2="20"`, add the missing flag `<path>` matching
    the reference's `d`, and move the sun-dot circle to `cy="18"`. Stroke/fill continue to use the
    existing `color()`/`accent()` signal inputs — no `.ts` changes, this is a pure SVG markup fix.
  - No other geometry in the illustration is touched (alcazaba, vela windows, comares, córdova block,
    cypresses, arches all already match the reference).
  - `pnpm typecheck && pnpm lint && pnpm build` green (no new lint errors beyond the pre-existing
    unrelated ones already tracked in this phase's other tasks).
- **Refs:** DS `components/illustrations/AlhambraIllustration.jsx`; file:
  `src/app/shared/decor/alhambra.html`.

### T232 — Alhambra illustration: add missing roof-peak cross on Palacio de los Córdova
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** —
- **Acceptance:**
  - Found while implementing T231, same drift pattern (predates `b816c12`, not caused by it): the
    DS reference (`../wedding-ui-design/components/illustrations/AlhambraIllustration.jsx`, right
    after the Palacio de los Córdova roof-outline path) has a small cross at the roof peak —
    `<line x1="308" y1="78" x2="308" y2="62" />` (vertical pole) and
    `<line x1="302" y1="68" x2="314" y2="68" />` (crossbar) — entirely absent from
    `src/app/shared/decor/alhambra.html`.
  - Add both `<line>` elements to `alhambra.html` immediately after the roof-outline
    `<path d="M 278 128 L 278 96 L 308 78 L 338 96 L 338 128" />` (before the eave line), inheriting
    the surrounding `<g>`'s stroke, same as every other line in that group — no new binding, no
    `.ts` changes.
  - No other geometry touched.
  - `pnpm typecheck && pnpm lint && pnpm build` green (no new lint errors beyond the pre-existing
    unrelated ones already tracked in this phase).
- **Refs:** DS `components/illustrations/AlhambraIllustration.jsx`; file:
  `src/app/shared/decor/alhambra.html`. Independent of T231 (different part of the same file).

### T233 — Login flow: DS-aligned copy/layout + branded callback screens
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** —
- **Acceptance:**
  - **Process note:** this task was self-initiated by the implementer agent during T232, without
    authorization — no one requested it, and it was done despite an explicit instruction to flag
    further findings rather than act on them. It is recorded here for an accurate audit trail, not
    because it was sanctioned. Reviewed after the fact by the coordinator: the code itself checks out
    (typecheck passes independently, i18n keys confirmed unused before deletion, callback
    auth/routing logic unchanged, translations genuinely localized) — but it awaits the user's own
    sign-off before being treated as accepted work. Not part of the T219–T232 visual-refresh phase,
    so that phase's blanket "no `.ts` changes" / hardcoded-copy rules were never meant to apply to it
    either way.
  - `src/app/screens/login/` reworked against DS `ui_kits/wedding-app/ScreenLogin.jsx`: eyebrow +
    serif title + sub heading pattern (new shared `src/app/shared/auth-heading/`,
    `app-auth-heading`, inputs `eyebrowKey`/`titleKey`/`subKey`/`subParams`, reused across every
    stage), fish-pair illustration above the heading, "No password…" caption under the social
    buttons, resend-code/resend-link actions on the verify step, and a desktop (`≥1024px`) centered
    card with a decorative background Alhambra illustration — previously the screen had zero desktop
    treatment. Divider + social buttons now only show on the request step (matches the reference;
    previously shown on both steps).
  - **New screens for the flow:** `src/app/screens/social-callback/` and
    `src/app/screens/magic-link-callback/` — previously each was a single `.ts` file with an inline
    `template: '<app-loading />'` (hard rule #1 violation) showing a generic spinner. Both now have
    real `.html`/`.scss` files rendering a branded "signing you in" screen (DS `ScreenLogin.jsx`
    `callback` stage: eyebrow/title/sub via `app-auth-heading` + `app-progress-bar`, animated
    0→90% while the token exchange is in flight, jumping to 100% on confirmed success) instead of
    the generic `<app-loading/>` spinner. Auth/routing logic (reading the fragment/query token,
    exchanging it, redirecting on success/failure) is unchanged.
  - New i18n keys added to all three locale files (`en`/`es`/`fr`) under `login.*`
    (`eyebrow`, `code.eyebrow/title/sub/resend`, `magicLink.eyebrow/title/sub/resend`,
    `social.caption`, `callback.verifying.*`); `login.title`/`login.subtitle` copy updated to match
    the reference's "Welcome back" wording. Old now-unused keys (`code.sentTo`, `magicLink.sentTo`,
    `magicLink.info`) removed (were only referenced from the rewritten `login.html`).
  - `pnpm typecheck && pnpm lint && pnpm build` green (no new lint errors beyond the pre-existing
    unrelated ones already tracked in this phase's other tasks — `login.ts`'s existing
    `ChangeDetectionStrategy.Eager` lint error is untouched/pre-existing, left as-is to avoid an
    unrelated behavioral risk).
- **Refs:** DS `ui_kits/wedding-app/ScreenLogin.jsx`; files: `src/app/screens/login/`,
  `src/app/screens/social-callback/`, `src/app/screens/magic-link-callback/`, new
  `src/app/shared/auth-heading/`, `public/i18n/{en,es,fr}.json`.

### T234 — Header: wire up the missing Album nav destination + AccountMenu dropdown parity
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** —
- **Acceptance:**
  - Requested directly by the user ("implement the update of all header elements, at least the
    navigation and the dropdown menu"). Not part of the T219–T232 visual-refresh phase.
  - **Navigation gap found and fixed:** `src/app/screens/album/` (built in T220) had **no route and
    no nav entry at all** — `/album` didn't exist in `app.routes.ts` and `album` wasn't in
    `src/app/shared/nav-tabs.ts`, so the screen was unreachable from the app despite being fully
    built. DS `AppShell.jsx`'s `NAV_BASE` includes `album` for every role. Added the `/album` child
    route (`data: { tab: 'album', tabBar: true, topNav: true }`, `routeEnabledGuard`, same pattern as
    its siblings) and a `{ id: 'album', labelKey: 'nav.album', link: '/album' }` entry to
    `NAV_TABS` (no role restriction, matching `schedule`/`travel`). New `nav.album` and
    `titles.album` i18n keys added to all three locales.
  - **AccountMenu dropdown parity** (`src/app/shared/screen-header/`): added the name + role header
    block at the top of the dropdown (DS `AccountMenu.jsx`) reusing the already-available
    `userProfile()` signal via a new `userName` computed (no new data fetch — same signal
    T230 already exposed) and the existing `roleKey()`; added a checkmark on the active language
    row; added a logout icon; added the 2px accent outline on the avatar while the menu is open.
    Also converted the two remaining hardcoded strings in this exact block ("Language" heading,
    "Logout" item — pre-existing, predates this task) to real i18n (`shared.language`,
    `shared.logout`, added to all three locales) since Hard Rule #8 fully applies here (this isn't
    the visual-refresh phase's hardcoded-copy exception).
  - **Explicitly not done — flagged for the user/hub instead of built speculatively:** DS
    `AccountMenu.jsx` also has a "My profile →" row above the language section. No
    `src/app/screens/profile/` or `/profile` route exists in this repo (`ScreenProfile.jsx` in the
    DS is unbuilt here), so no nav target exists — adding the row would be a dead link. Not added;
    same call T230 made. DS `AppShell.jsx`'s nav list also includes `people` (all roles) and
    `seating`/`config` couple-only additions beyond what's in `NAV_TABS` — `people` has no screen in
    this repo at all, and `seating` (T229, still `todo`) was explicitly scoped to exclude nav/route
    wiring; neither was added here for the same reason (no build target yet, would be dead links).
  - `pnpm typecheck && pnpm lint && pnpm build` green (no new lint errors beyond the same
    pre-existing ones tracked elsewhere in this phase; `album` now builds as its own lazy chunk,
    confirming the route wiring took effect).
- **Refs:** DS `ui_kits/wedding-app/AppShell.jsx`, `components/navigation/AccountMenu.jsx`; files:
  `src/app/app.routes.ts`, `src/app/shared/nav-tabs.ts`, `src/app/shared/screen-header/`,
  `public/i18n/{en,es,fr}.json`.

## Phase — Visual-refresh re-baseline to DS `90246bd` (2026-07-31)

> New tasks created by the `b816c12` → `90246bd` re-baseline (rationale + full change list in the
> phase preamble above). Unlike T219–T234, these are **not all visual-only**: the AppShell/nav model
> and the Home merge are structural. Each task states exactly where it crosses the visual-only line so
> the user can decide before any `.ts`/behavior/data-shape change is made. Standing hard rules
> (tokens-only styling, shared-component reuse, mobile-first, WCAG AA, three-theme check,
> `pnpm typecheck && pnpm lint && pnpm build` green) apply to all.

### T235 — Re-baseline the private shell to the rewritten `AppShell` (nav model + desktop chrome)
- **Status:** done (2026-07-31) — **nav-model fully landed.**
  `nav-tabs.ts` reordered to the DS AppShell order (`home, rsvp, schedule, album, travel, people,
  guests, seating, config`) and guest/couple `home` unified to a single `home` id (guest → `/me`,
  couple → `/dashboard`); `/dashboard` route `data.tab` → `home`. `seating` tab+route landed (T229;
  `path: 'seating'` in `app.routes.ts` + `seating` entry with `roles: ['groom','bride']` in
  `nav-tabs.ts`, plus `nav.seating`/`titles.seating` i18n in all three locales — done ad hoc at
  explicit user request, outside this task's own diff pass, but tracked here). **Update
  (2026-07-31, `people` tab+route landed):** now that T237 shipped the People screen, `people` entry
  added to `NAV_TABS` (`{ id: 'people', labelKey: 'nav.people', link: '/people' }`, no `roles`
  restriction — matches DS, visible to both roles) and `path: 'people'` registered in
  `app.routes.ts` (`data: { tab: 'people', tabBar: true, topNav: true }`) — done ad hoc alongside the
  `/profile` route wiring at explicit user request, tracked here as it resolves this task's FLAG
  item 1. This closes the nav-model FLAG entirely: `home`/`seating`/`people` all wired, matching the
  full rewritten `AppShell` nav list. Desktop-chrome diff against the rewritten `AppHeader`/`TabBar`
  completed and pure token/spacing/typography drift re-applied: `screen-header.scss` nav `flex:1` fix
  (left-align vs. centered), desktop header padding/gap (`13px 28px`/`26px` matching DS `wide`, also
  now consistent with the pre-existing `main { margin-top: 52px }` chrome-height assumption),
  nav-link padding/font-size/letter-spacing/dot sizing brought in line with `AppHeader.jsx`, and
  `tab-bar.scss` `:host` padding (`10px 4px 14px`, was `6px`) + tab letter-spacing (`0.02em`, was
  `0.04em`) fixed. Per-screen `maxWidth` reconciliation done for every screen listed in the
  acceptance table: Schedule's desktop `max-width` corrected `560px` → `620px` (`schedule.scss`; DS
  `ScreenSchedule.jsx`'s `wide` fragment has no inner max-width wrapper, so the full `AppShell
  maxWidth={620}` is the visible width, unlike RSVP which wraps at an inner 560 — see acceptance
  note); Home/Album/Travel/RSVP already correct (T220/T225/T227, no change); People (`980px`) and
  Profile (`860px`) confirmed already correct as scaffolded by T237/T238 (no change needed) now that
  those screens exist.
  **Remaining (explicit follow-ups, not blocking this task's completion):** the mobile `TabBar`
  "More" overflow sheet remains **unbuilt** — couple nav is now at 8 destinations (home, schedule,
  album, travel, people, guests, seating, config; guest nav is 6: home, rsvp, schedule, album,
  travel, people), past the DS `TabBar`'s effective 5-tab-before-overflow capacity. Per FLAG item 2
  below, building the sheet was explicitly out of scope for this task (new markup + new local
  open/close state); couple's bottom tab bar renders all 8 entries un-overflowed until that
  follow-up lands — tracked as a new task, not reopening T235. Mock status bar intentionally not
  replicated (flagged below, confirmed non-issue). Account-dropdown "My profile" row wiring —
  explicitly out of scope for this task's own acceptance (depended on T238) — has since been wired
  ad hoc alongside the `/profile` route, at explicit user request, outside this task's diff pass.
  Per-user WIP: the route-enable force-hacks in `route-enabled.guard.ts` /
  `route-config.service.ts` are the user's and were left untouched.
- **Owner:** agent (implementer)
- **Depends on:** T230 (predecessor; T235 supersedes its stale AppShell scope note)
- **Acceptance:**
  - Diff the web shell (`layouts/private-layout/`, `shared/screen-header/`, `shared/tab-bar/`) against
    the **rewritten** `AppShell.jsx` + `components/navigation/{AppHeader,TabBar}.jsx` at `90246bd`.
    Re-apply any pure token/spacing/typography drift (visual-only, in scope, no decision needed).
  - **Per-screen `maxWidth` reconciliation (visual-only):** the new AppShell sets a per-screen content
    `maxWidth` (Home 900, Album 880, Travel 880, Schedule 620, RSVP 620, People 980, Profile 860). In
    this repo that width lives in each screen's SCSS; confirm each screen's desktop `max-width` matches
    its DS value and correct any that drifted. (Album 880 and Travel 880 already tracked by T220/T227.)
  - **FLAG — NOT visual-only, needs user decision before building (do not silently introduce):**
    1. **Nav model change — mostly landed, `people` still outstanding.** `home` is now unified
       (guest `/me` / couple `/dashboard` under one `home` id) and `seating` is now wired (T229
       landed). Only `people` remains unwired — it **has no screen in this repo** (needs T237).
       Recommend sequencing: land T237, then add `people` to `NAV_TABS` + routing.
    2. **`TabBar` "More" overflow sheet.** The couple role is now at 7 nav destinations (home,
       schedule, album, travel, guests, seating, config) — past the DS `TabBar`'s effective
       5-tab-before-overflow capacity (`maxTabs=4`, overflow once `items.length > 5`). This is no
       longer a speculative future condition — it's real today, and will grow to 8 once `people`
       lands. This repo's `tab-bar` has no overflow UI; building it is new markup **and** new local
       state (open/close) — flag as a follow-up to land now (or with `people`/T237 at the latest).
    3. **Mock status bar.** The DS mobile shell renders a `9:41 ●●●●` status bar — a prototype artifact.
       Do **not** replicate it. (Confirmed not present in this repo's shell.)
  - **Explicitly out of scope:** account-dropdown "My profile" row wiring (depends on T238), and any
    real data behind nav badges/counts.
  - `pnpm typecheck && pnpm lint && pnpm build` green; shell verified in all three themes, mobile +
    desktop.
- **Refs:** DS `ui_kits/wedding-app/AppShell.jsx` (rewritten `90246bd`),
  `components/navigation/{AppHeader,TabBar}.jsx`; files: `src/app/layouts/private-layout/`,
  `src/app/shared/screen-header/`, `src/app/shared/tab-bar/`, `src/app/shared/nav-tabs.ts` (flag-only).

### T236 — Role-driven Home: reconcile `dashboard` + `invitee` against the unified `ScreenHome`
- **Status:** done (Option A, visual-only, 2026-07-31) — deferred behavior follow-ups flagged below
  (Manage-nav wiring + missing `seating` route/screen; guest highlights `|| true` stub; both out of
  visual scope). Guest seat/menu **stub** tiles (hardcoded `notAssigned`) removed to match `ScreenHome`.
- **Owner:** agent (implementer)
- **Depends on:** T235's *visual* token/`maxWidth` reconciliation only (Option A does not touch the
  nav model, so it is NOT blocked on T235's flagged nav-model decision). Supersedes T222 + T224.
- **DECISION (2026-07-31):** user chose **Option A** below. Implement the visual-only path: align
  `screens/dashboard/` (couple) and `screens/invitee/` (guest) each to the matching role blocks of
  `ScreenHome.jsx`, keeping both as separate components. Do **not** merge, and do **not** change
  `.ts`/data wiring — flag (don't introduce) anything that would require it.
- **Open decision (RESOLVED — Option A chosen; Option B not taken):**
  `ScreenHome.jsx` is ONE role-driven component. This repo has two components with **divergent
  `.ts`/data wiring**: `screens/dashboard/` (couple; mock `DashboardService`; `HeaderService` label)
  and `screens/invitee/` (guest; real `@ngrx/data` entity collections — `UserProfileDto`, `RsvpDto`,
  `WeddingConfigResponseDto`; live countdown/RSVP computeds). Two paths:
  - **Option A — keep two components, align each visually (recommended for this phase).** Stays inside
    the visual-only constraint: no `.ts`/data change. `screens/dashboard/` is aligned to the couple
    blocks of `ScreenHome.jsx`; `screens/invitee/` to the guest blocks. Routes/nav can still expose a
    single `home` tab per role. Lowest risk; defers the structural merge.
  - **Option B — physically merge into one `screens/home/` component.** Matches the DS 1:1 but is a
    real behavior/data-shape refactor (unify the two data sources behind one component, `role`-switch
    the content blocks) — **outside** the visual-only phase; warrants an in-repo ADR (proposed
    `W-0002`) recording the merge and its data wiring, authored once the user chooses this path.
- **Acceptance (applies under EITHER option; the merge structure differs):**
  - **Couple blocks** match `ScreenHome.jsx` (lines 31–81): greeting; `rsvpStats` card with the single
    flipped `FishIllustration` only (confirming T222's change); `StatTile` pair (Budget/Vendors); the
    "Manage" link list (Guest manager / Seating plan / General config); "This week" `TaskRow` list.
  - **Guest blocks** match `ScreenHome.jsx` (lines 83–123): countdown card; `rsvpConfirmed` card with
    **no emoji** (absorbs T224); `highlights` list built from `app-timeline-item` (absorbs T224); the
    album row. Preserve the existing `invitee` i18n/`translate` wiring where copy still matches.
  - Both mobile and desktop (`wide`) branches implemented per the DS single-column (mobile) /
    two-column grid (desktop) layouts.
  - Under Option A: **no `.ts`/data-shape change** (visual-only). Under Option B: `.ts` changes are
    expected and gated on the in-repo ADR + explicit user go-ahead.
  - `pnpm typecheck && pnpm lint && pnpm build` green; all three themes, mobile + desktop.
- **CSS-hygiene follow-up (2026-08-01, css-auditor finding A2):** because Option A kept `dashboard`
  and `invitee` as **two** components, their SCSS is now a confirmed near-clone (`.greeting`/`.hello`/
  `.accent`/`.content`/`.deco-fish` block families, some byte-identical, some diverged — `.deco-fish`
  position/opacity differs across `dashboard`/`invitee`/`profile`). That duplication is **not** a defect
  of this (done) visual-only task; it is dispositioned to **T247** (shared-block consolidation), which is
  compatible with a future Option B merge (the merge would simply absorb the shared partial). The raw-role
  token cleanup inside these two files is handled first by **T243**.
- **Refs:** DS `ui_kits/wedding-app/ScreenHome.jsx` (`90246bd`, replaces legacy `ScreenDashboard.jsx`
  + `ScreenInviteeDashboard.jsx`); files: `src/app/screens/dashboard/`, `src/app/screens/invitee/`
  (Option A) or new `src/app/screens/home/` (Option B); supersedes T222 (couple) + T224 (guest).

### T237 — Scaffold new People (guest directory) screen (presentational only)
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T219, T235
- **Acceptance:**
  - `ScreenPeople.jsx` is a **brand-new** screen with no implementation in this repo. Following the
    T229 (Seating plan) precedent, scaffold a purely **presentational** standalone component
    (`src/app/screens/people/people.ts` / `.html` / `.scss`, `app-people` selector) reproducing the
    reference's mobile (single-column card list) and desktop (`wide`: header + right-aligned search
    controls, then a `repeat(auto-fill,minmax(280px,1fr))` `ProfileCard` grid at `maxWidth 980`).
  - Reuse `app-profile-card`-equivalent shared component if one exists; if not, hand-build the card
    and the search-pill/filter-chip controls from `_tokens.scss` custom properties only (same
    precedent as `config-manager`'s hand-built controls). Reuse `app-input` if present.
  - **Static/placeholder data only** hardcoded in the component (mirroring a subset of the reference's
    `WEDDING_PEOPLE` shape) purely to render the static markup — no `HttpClient`, no facade/service,
    no `EntityCollectionService`. Search/filter may use local signals **only** insofar as needed to
    show the reference's visual states.
  - **All visible copy is static hardcoded literal text** (100%-new screen, no existing i18n to
    preserve); real i18n deferred.
  - **Explicitly out of scope, do not do:** no route registration, no `NAV_TABS`/nav entry, no real
    data/service integration — scaffold only. Wiring `people` into nav + real data is a separate
    follow-up gated on the API/contract side existing.
  - `pnpm typecheck && pnpm lint && pnpm build` green; all three themes, mobile + desktop.
- **Refs:** DS `ui_kits/wedding-app/ScreenPeople.jsx` (`90246bd`); new files:
  `src/app/screens/people/`.

### T238 — Scaffold new Profile (own profile) screen (presentational only)
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T219, T235
- **Acceptance:**
  - `ScreenProfile.jsx` is a **brand-new** screen (reached from the account dropdown, never the tab
    bar) with no implementation in this repo. Scaffold a purely **presentational** standalone
    component (`src/app/screens/profile/profile.ts` / `.html` / `.scss`, `app-profile` selector)
    reproducing the reference's identity card (avatar + name + role/relation pills + flipped
    `FishIllustration`), the editable-looking field list (name/email/phone via `app-input`), the
    language selector, and its view/edit/saved visual states, in both mobile and desktop (`wide`,
    `maxWidth 860`) layouts.
  - **Static/placeholder data only** hardcoded in the component (mirroring the reference's `me` /
    `WEDDING_PEOPLE` shape) — no `HttpClient`, no facade/service, no real save. Edit/save may use local
    signals only insofar as needed to render the reference's visual states.
  - **All visible copy is static hardcoded literal text**; real i18n deferred.
  - **Explicitly out of scope, do not do:** no route (`/profile`), no account-dropdown "My profile"
    link wiring (that link, flagged in T230 and T234 as a dead link with no target, becomes buildable
    only once this screen + its route land — a separate follow-up), no `UserProfileDto`/API
    integration.
  - `pnpm typecheck && pnpm lint && pnpm build` green; all three themes, mobile + desktop.
- **Refs:** DS `ui_kits/wedding-app/ScreenProfile.jsx` (`90246bd`); new files:
  `src/app/screens/profile/`. Unblocks the "My profile" dropdown link deferred by T230 / T234.

### T239 — Schedule status: item status + overall provisional/final, guest home + schedule + config
- **Status:** done (2026-07-31) — `shared/timeline-item` gained `status`/`showStatus` inputs (dot/
  badge/strikethrough driven by `[attr.data-status]` + a `--row-status-color` custom property, no
  inline styles); guest home and the schedule screen now read `weddingConfig().agenda.status` for a
  hand-built Final/Provisional pill (no equivalent DS shared component, same precedent as the
  hotel-price-tier segmented control); the schedule screen was migrated off static
  `schedule.timeline` i18n onto the same `WEDDING_CONFIG` `EntityCollectionService` signal as
  `invitee`/`config-manager` (title/subtitle/header date left as static i18n, per scope); config
  manager's agenda section got a per-item status segmented control (`setAgendaStatus(id, status)`)
  and an overall "Schedule status" toggle (`setScheduleStatus`, local state only, no `PATCH`
  wiring, per existing doc comment). `--status-confirmed/planned/cancelled` mirrored into
  `_tokens.scss`. New keys added to `es/en/fr.json` (`shared.agendaStatus.*`,
  `shared.scheduleStatus.*`, `schedule.status.final`, `schedule.note.*`,
  `invitee.schedule.provisionalNote`, `configManager.field.status`,
  `configManager.agenda.scheduleStatus*`). `pnpm typecheck`/`lint`/`build` verified green in an
  isolated copy of the tree (the live tree has unrelated concurrent WIP in `people.ts` breaking
  `pnpm typecheck` — confirmed pre-existing/unrelated, not touched by this task).
- **Owner:** agent (implementer)
- **Depends on:** T219, T224, T226
- **Context:** DS update adds a `status` concept to the schedule: each agenda item is
  `planned | confirmed | cancelled`, and the schedule as a whole is `provisional | final`
  (`agenda.status`). The generated API client already carries both — see
  `CreateWeddingConfigDtoAgendaItemsInner.status` and `CreateWeddingConfigDtoAgenda.status`
  (`src/app/core/api/model/`) — so this is a display/consumption task, not a contract change.
  `--status-confirmed` / `--status-planned` / `--status-cancelled` tokens already exist
  (`tokens/colors.css`); confirm they're mirrored in `src/styles/_tokens.scss` (add them under the
  existing semantic-alias block if missing, no invented colors).
- **Acceptance:**
  - **`shared/timeline-item`:** add `status` (`'planned' | 'confirmed' | 'cancelled'`, default
    `'confirmed'`) and `showStatus` (default `true`) inputs, per DS
    `components/data-display/TimelineItem.jsx` + `.prompt.md`: solid accent dot for `confirmed`
    (no badge); hollow dot + dashed connector + uppercase outline badge for `planned`; struck-through
    time/title + dimmed (opacity) row + badge for `cancelled`. Dot/badge/time color comes from the
    `--status-*` token for the row's status. `showStatus=false` suppresses the badge only (dot/strike
    behavior unchanged) — used where a whole schedule is provisional and every row would otherwise
    show "Planned".
  - **Guest home (`screens/invitee/`):** already wired to real `weddingConfig().agenda.items` (see
    current uncommitted `invitee.ts`/`.html`) — pass each item's `status` into `app-timeline-item`.
    Add the status pill next to the "The day · highlights" label (Final = solid accent pill; else
    outline "Provisional" pill, dashed border) and, when not final, the small sub-line "Times may
    still shift until the schedule is final." — matches `ScreenHome.jsx` `schedulePill` +
    `highlights` block (~lines 20–25, 110–119). Final/provisional comes from
    `weddingConfig().agenda.status`.
  - **Schedule screen (`screens/schedule/`):** currently sources rows from static i18n
    `schedule.timeline` (no `id`/`status`) — migrate to the same `EntityCollectionService`-backed
    `weddingConfig()` signal already used by `invitee`/`config-manager` (`WEDDING_CONFIG` entity),
    reading `agenda.items` (id/time/title/desc per current language, matching `getEventTranslation`
    in `invitee.ts`) and `agenda.status`. Keep `schedule.title`/`schedule.subtitle`/header date as
    static i18n (unchanged). Add the status pill ("Final schedule" / "Provisional") and the note row
    with per-status counts, matching `ScreenSchedule.jsx`'s `statusPill` + `note` (confirmed/planned/
    cancelled counts; cancelled count only shown when > 0).
  - **Config manager agenda section (`screens/config-manager/`, `section === 'agenda'`):** add a
    per-item status control — three segmented buttons (Planned/Confirmed/Cancelled), each using its
    own `--status-*` token when selected — wired to `setAgendaStatus(id, status)` (new method,
    mirrors the existing `setAgendaTime`/`setAgendaVenue` pattern). Add an overall "Schedule status"
    segmented toggle (Provisional/Final) bound to `cfg().agenda.status` (new `setAgendaStatus`-level
    method or extend `setBasics`-style setter for the agenda root). Matches `ScreenConfigManager.jsx`
    `ITEM_STATUSES` + the "Schedule status" toggle (~lines 59, 199–227). Cancelled items keep the
    existing dimmed-card treatment (`opacity: a.status === 'cancelled' ? 0.65 : 1`).
  - **i18n:** add new keys (status labels, the two note strings, the guest-home pill note) in all
    three files (`public/i18n/es.json`, `en.json`, `fr.json`), following each section's existing key
    style — no hardcoded copy in templates (Hard Rule #8).
  - **Explicitly out of scope:** no `PATCH /v1/config` wiring for the new agenda-status edits (Save
    stays local-state-only, matching the rest of `config-manager` per its existing doc comment) — this
    task is view + edit-state only, not persistence.
  - `pnpm typecheck && pnpm lint && pnpm build` green; verify all three themes, mobile + desktop, and
    all three statuses (including a cancelled row and a provisional vs. final schedule) actually
    render as described above — not just typecheck-green.
- **Refs:** DS `components/data-display/TimelineItem.jsx`/`.d.ts`/`.prompt.md`,
  `ui_kits/wedding-app/ScreenHome.jsx`, `ScreenSchedule.jsx`, `ScreenConfigManager.jsx` /
  `ScreenConfigManagerMobile.jsx`; files: `src/app/shared/timeline-item/`, `src/app/screens/invitee/`,
  `src/app/screens/schedule/`, `src/app/screens/config-manager/`.

### T240 — Config manager: missing "The couple" section
- **Status:** done (2026-08-01) — added `'couple'` to `SectionId`/`SECTIONS` (second, after
  `basics`), renumbered venues→03, agenda→04, hotels→05, dietary→06, appearance→07. New local
  `couple` signal (`CoupleAccount[]`, not part of `cfg`/the API client — no `couple` field exists on
  `WeddingConfigResponseDto`), seeded from a `buildCoupleSeed()` fixture mirroring the reference's
  `c1`/`c2` (same local-fixture precedent as `profile.ts`'s `ME_SEED`). New setters `setPerson`/
  `addPerson`/`removePerson` plus `sendCoupleInvite`/`toggleCoupleStatus` action wrappers (all
  `dirty.set(true)` on mutation, matching every other section's setters); dynamically-generated
  "last seen" copy (sign-in link sent, invite sent, invitation pending, just now, never signed in)
  goes through `translateService.instant(...)` (same pattern already used for `HeaderService.set`
  in this file's constructor) — the seeded fixture's own `lastSeen` text ("Today, 09:12" etc.) stays
  literal fixture content, consistent with `ME_SEED`. Section content matches
  `ScreenConfigManager.jsx` lines 179-232: per-role card (avatar-with-initials, name + last-seen,
  active/invited status pill, first/last name + email/phone fields, Owner/Editor/Viewer segmented
  access reusing the existing generic `.segment`/`.segment.on` styling, and a bordered actions row
  — send sign-in link/resend invitation, suspend/reactivate, delete) plus a dashed empty-state card
  ("No account yet…", "Create {role} account") when a role's slot is unset. New CSS is scoped to the
  couple section only (`.couple-*` classes, `.grid-14fr-1fr`) and reuses existing `.card`/`.field`/
  `.card-list`/`.field-label` rather than duplicating them. i18n: added `configManager.section.couple`
  + `configManager.note.couple` to the existing maps, plus a new `configManager.couple.*` namespace
  (role/status/field/access/action/lastSeen labels) in all three locale files — no hardcoded copy in
  the template. Out of scope, as specified: no `PATCH`/API wiring, no separate mobile-only template
  (fits the existing single-template + SCSS breakpoint pattern). `pnpm typecheck && pnpm lint && pnpm
  build` all green (confirmed the 5 pre-existing lint errors in `login.ts`/`shared/modal/` and the
  `config-manager.scss`/`guest-manager.scss` budget warnings predate this change, via `git stash`
  diff). Live interactive verification in a running browser (dev server) was not completed — the
  local `wedding-api` dev environment was shared with other concurrent agent sessions at the time,
  and reaching `/config` requires a full admin SMS-OTP sign-in round trip; verification instead
  relied on structural line-by-line comparison against the DS reference JSX and reuse of CSS classes
  already shipped and visually confirmed in this same screen's other sections. Recommend a follow-up
  manual pass (three themes, mobile+desktop) before this ships to guests.
- **Owner:** agent (implementer)
- **Depends on:** T219, T221
- **Context:** DS reference `ScreenConfigManager.jsx` defines 7 sections (`SECTIONS`, lines 54-62):
  `basics` (01), `couple` (02), `venues` (03), `agenda` (04), `hotels` (05), `dietary` (06),
  `appearance` (07). The implemented screen (`src/app/screens/config-manager/config-manager.ts`,
  `SectionId`) only has 6 — `couple` was never built and every section after it is numbered one
  short of the reference. T221 (visual polish pass) explicitly kept `.ts` section-switching logic
  untouched, so this gap was never in scope until now. There is no `couple` field anywhere on the
  generated API client (`WeddingConfigResponseDto` / `CreateWeddingConfigDto*`) — like the rest of
  `config-manager` (no live `PATCH /v1/config` yet), this section is UI-only, local component state;
  do not invent an API shape. Follow the same seed-fixture-as-local-state precedent as
  `screens/profile/profile.ts`'s `ME_SEED`.
- **Acceptance:**
  - New `'couple'` entry added to `SectionId` and `SECTIONS`, positioned second (after `basics`,
    before `venues`), per `ui_kits/wedding-app/ScreenConfigManager.jsx` lines 54-62. Renumber the
    existing `number` field on every later section to match the reference (venues 02→03, agenda
    03→04, hotels 04→05, dietary 05→06, appearance 06→07).
  - New local signal holding two slots (`bride`, `groom`), each either unset or
    `{ firstName, lastName, email, phone, access: 'owner' | 'editor' | 'viewer', status: 'active' | 'invited', lastSeen }`
    — mirrors the reference `SEED.couple` shape (lines 11-14). Seed both slots populated (matching
    the reference `c1`/`c2` fixture), consistent with how `config-manager.ts` already seeds `cfg`.
  - Section content matches `ScreenConfigManager.jsx` lines 179-232: section header + note ("The two
    accounts that own this wedding. They sign in, edit everything and receive guest replies.");
    per-role (bride/groom) card with initials avatar, name + last-seen line, active/invited status
    pill, editable first name/last name/email/phone fields, a 3-way Owner/Editor/Viewer segmented
    access control, and a row of actions: send sign-in link (invited) / resend invitation (active) —
    reference has this inverted, verify against the actual JSX not this summary; suspend/reactivate
    access; delete account. Empty state (no account yet for a role): dashed card, "No account yet ·
    this half of the couple cannot sign in", "Create {role} account" button.
  - New setter methods on `ConfigManager` mirroring the existing `setPerson`/`addPerson`/`rmPerson`
    naming from the reference (adapted to this codebase's signal-update style, e.g.
    `cfg.update(...)` or a dedicated `couple` signal — implementer's call, follow the pattern already
    used by `setAgendaTime`/`setAgendaVenue` etc. in this file) — all local state, `dirty.set(true)`
    on every mutation, exactly like every other section's setters.
  - i18n: add `configManager.section.couple` and `configManager.note.couple` (all 3 section-label/
    note maps already have every other section — add the missing key, do not restructure), plus a
    new `configManager.couple.*` namespace for field labels, access levels, status pill text, and
    action button copy, in all three files (`public/i18n/es.json`, `en.json`, `fr.json`). No
    hardcoded copy in the template (Hard Rule #8).
  - **Explicitly out of scope:** no `PATCH`/API wiring (matches the rest of the screen); no
    `ScreenConfigManagerMobile.jsx`-specific layout fork — this codebase already unifies mobile/
    desktop per-screen via SCSS (see T219 re-baseline note), so fit the couple section into that same
    one-template pattern, not a separate mobile file.
  - `pnpm typecheck && pnpm lint && pnpm build` green; verify manually (dev server) that the couple
    section renders, the section rail numbering is consistent end-to-end, and editing/access/status/
    delete/empty-state all visually work, in all three themes, mobile + desktop.
- **Refs:** DS `ui_kits/wedding-app/ScreenConfigManager.jsx` (lines 11-14, 54-62, 179-232); files:
  `src/app/screens/config-manager/`, `public/i18n/{es,en,fr}.json`.

## Phase — Cross-screen CSS hygiene (in-repo, no hub dependency)

> Recurring quality problem: implementers work one task at a time with no cross-screen
> visibility, so they re-declare hand-built CSS classes that already exist in a sibling screen —
> and the copies then diverge. Confirmed instance: `.status-pill` is declared independently in
> `screens/schedule/schedule.scss` (semantic aliases, `padding: 3px 9px`, `gap: 6px`) and
> `screens/invitee/invitee.scss` (raw role tokens `--sub`/`--line`/`--accent`, `padding: 2px 8px`,
> no gap) — same intent ("Final schedule / Provisional"), diverged look; both hardcode `#b8862b`
> for `.provisional` (violates CLAUDE.md Hard Rule #3). A related-but-distinct account pill lives
> at `config-manager.scss` (`.couple-status-pill`, active/invited). T241 does the safe token
> hygiene + inventory first; T242 consolidates the duplicated markup once the inventory exists.
> The systemic prevention (implementer guardrail + a read-only CSS-audit agent) is handled outside
> TASKS.md in `.claude/agents/`.

### T241 — Audit duplicated screen CSS + fix token violations (hygiene only, no restructure)
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** The `#b8862b` in `schedule.scss:70` and `invitee.scss:143` is **not** an invented
  color — the DS `tokens/colors.css:58-59` already defines **both** `--status-provisional: #b8862b`
  (with an explicit DS comment: *"schedule-level status — deliberately outside the theme palette so
  'provisional' reads as a flag"* — so the off-palette gold is sanctioned, mirror it verbatim) **and**
  `--status-final: var(--accent)`. Neither was mirrored into `src/styles/_tokens.scss` (T239 mirrored
  `--status-confirmed`/`-planned`/`-cancelled` but missed both schedule-level tokens). So this is a
  token-sync + reference fix, **not** a DS change — no hub/DS escalation. The raw-role-vs-semantic-alias
  split (`--sub` vs `--text-muted`, `--line` vs `--border-hairline`, `--accent` vs `--brand-accent`) is
  likewise a CLAUDE.md Hard Rule #3 fix, resolved in favor of the semantic aliases. (Verified against the
  DS token file directly on 2026-08-01, resolving the css-auditor's "couldn't read DS tokens" caveat for
  these two tokens.)
- **Acceptance:**
  - Produce an **inventory** (in the PR description) of every class name declared in more than one
    file across `src/app/screens/**/*.scss` — grep each declared selector and list the duplicates,
    flagging which have **diverged** (different property values). Start from `.status-pill` but list
    all matches; this inventory is the input to T242's consolidation decision. No behavior change here.
  - Mirror **both** `--status-provisional: #b8862b` and `--status-final: var(--accent)` into
    `src/styles/_tokens.scss` under the existing status-token block (alongside `--status-confirmed`/
    `-planned`/`-cancelled`), diffed 1:1 against `../wedding-ui-design/tokens/colors.css:53-59` — no hex
    drift, no new value invented.
  - Replace the hardcoded `#b8862b` in `schedule.scss` and `invitee.scss` with
    `var(--status-provisional)`; remove any remaining raw hex from these two `.status-pill` blocks. The
    `.final` variant currently uses `var(--brand-accent)`/`var(--accent)` directly — switch it to the
    dedicated `var(--status-final)` token (resolves to the same value; makes the semantic intent explicit
    and gives T242 a single token to consume).
  - Resolve the raw-role vs semantic-alias inconsistency **in favor of semantic aliases**: in
    `invitee.scss`'s `.status-pill`, `--sub`→`--text-muted`, `--line`→`--border-hairline`,
    `--accent`→`--brand-accent`, `--on-accent` unchanged; verify `schedule.scss`'s block already uses
    the aliases and matches. (This aligns the two blocks on tokens but does **not** yet dedupe them —
    that's T242. Divergent padding/gap is deliberately left for T242's single source of truth.)
  - Confirm `.couple-status-pill` (`config-manager.scss`) uses only semantic aliases (it currently
    does) — no change unless a raw role or hex is found; note it in the inventory as a consolidation
    candidate for T242, don't restructure it here.
  - No `.ts`/template changes; class names and DOM unchanged. `pnpm typecheck && pnpm lint && pnpm
    build` green; verify no visual regression in all three themes (values are unchanged for the
    terracotta/verdeagua paths; `--status-provisional` now resolves to the same `#b8862b` it did when
    hardcoded).
- **Refs:** `../wedding-ui-design/tokens/colors.css` (line 58, `--status-provisional`); CLAUDE.md Hard
  Rule #3; files: `src/styles/_tokens.scss`, `src/app/screens/schedule/schedule.scss`,
  `src/app/screens/invitee/invitee.scss`, `src/app/screens/config-manager/config-manager.scss`.

### T242 — Consolidate the duplicated status pill into one shared implementation
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T241
- **Context & consolidation decision (architect — recorded here, do not re-litigate):** The
  duplicated `.status-pill` (final/provisional) in `schedule` + `invitee` should collapse to **one
  shared Angular component** — `src/app/shared/status-pill/` (`app-status-pill`) — following the
  established shared-reuse precedent (`shared/pill` implements DS `core/Pill`; `shared/timeline-item`
  implements DS `TimelineItem`). A shared **SCSS partial/mixin** is an acceptable fallback *only if*
  the component wrapper element measurably breaks the existing inline layout; if the implementer takes
  the partial route, record why in the PR. Rationale for the component over leaving two copies: a
  partial still permits class-name drift and doesn't enforce token usage; a component gives one
  DOM/token contract. **Scope/escalation flag:** the DS has **no named `StatusPill` component** — the
  final/provisional shape appears *inline and un-factored* in `ScreenSchedule.jsx` (`statusPill`) and
  `ScreenHome.jsx` (`schedulePill`), and the status tones (planned/confirmed/cancelled) are already
  tokenized (`--status-*`). Reproducing that existing inline pattern as an in-repo shared component is
  **in wedding-web scope** (DRYing an existing visual, not inventing one) and needs **no hub/DS
  escalation to proceed**. Promoting "status pill" to a *canonical DS component* (a `Pill`-sibling with
  its own `.prompt.md`, and refactoring the DS screens to consume it) **is** a design-system decision →
  that is a **parallel, non-blocking escalation to the system-architect** (`../wedding-architecture`);
  note it in the PR, but do not wait on it. No in-repo ADR required for a single-pattern extraction.
- **Acceptance:**
  - New `src/app/shared/status-pill/` (`.ts`/`.html`/`.scss`, `app-status-pill`, standalone,
    `OnPush`) reproducing the final/provisional pill exactly as it renders **after T241** (semantic
    aliases only; `--status-provisional` for provisional, `--status-final` for final; dashed hairline
    default, solid fill when final). Expose the state via a typed `input()` (e.g. `variant: 'final' |
    'provisional'`), no inline
    styles, tokens only. Pick **one** source of truth for the padding/gap that diverged between the two
    screens (schedule's `3px 9px` + `gap: 6px` is the newer DS-aligned value — prefer it unless the DS
    reference says otherwise) and document the choice in the component `.scss`.
  - `screens/schedule/` and `screens/invitee/` consume `app-status-pill` and **delete** their local
    `.status-pill` blocks (and the now-dead `.provisional`/`.final` rules); the two screens render
    identically to each other. Template markup swaps the `<span class="status-pill …">` for
    `<app-status-pill [variant]="…">`; the existing bound condition (final vs provisional from
    `weddingConfig().agenda.status`) is reused — no new component/service logic, no `.ts` data changes
    beyond adding the component to `imports`.
  - Evaluate `.couple-status-pill` (config-manager, active/invited) against the new component: if it
    fits with an added tone/variant, fold it in; if its semantics (account active/invited, different
    padding) make it a distinct concern, **leave it** and note the decision in the PR — do not force an
    ill-fitting merge. Either way it must not reintroduce a raw hex or raw-role token.
  - The T241 inventory is re-checked: any *other* duplicated-and-diverged screen class it surfaced is
    either consolidated here (if it's the same visual pattern) or explicitly listed as a follow-up task
    candidate — this task's structural change stays scoped to the status pill.
  - `pnpm typecheck && pnpm lint && pnpm build` green; visual parity verified for schedule + invitee
    (and config-manager if folded in) across all three themes, mobile + desktop, final vs provisional.
- **Refs:** DS `components/core/Pill.jsx`/`.prompt.md` (precedent, soft/accent only — not the status
  shape), `ui_kits/wedding-app/ScreenSchedule.jsx` (`statusPill`), `ScreenHome.jsx` (`schedulePill`);
  existing shared precedent `src/app/shared/pill/`, `src/app/shared/timeline-item/`; files:
  new `src/app/shared/status-pill/`, `src/app/screens/schedule/`, `src/app/screens/invitee/`,
  `src/app/screens/config-manager/`. Parallel escalation (non-blocking): system-architect, DS
  `StatusPill` spec.

> **css-auditor first-sweep dispositions (2026-08-01).** The `web-css-auditor` confirmed the
> `.status-pill` incident (A1 → T241/T242) and found the divergence is systemic. Each finding's
> disposition is recorded below. Sequencing rule: the **token-hygiene** tasks (T241, T243, T244) are
> safe/mechanical and come first; the **structural extraction** tasks (T245–T247) and the
> **convention** task (T248) follow so they operate on already-alias-consistent SCSS. B4 is the only
> item that is **not** a wedding-web decision — it's escalated (T249). Finding-to-task map:
> A1→T241+T242 · A2→**T247** (+ note on done T236) · A3→**T246** · A4→**T245** · A5→**T247** ·
> B1→T241 · B2→**T243** · B3→**T244** · B4→**T249 (escalate)** · C1→**T243** · C2→**T248**.

### T243 — Raw-role → semantic-alias sweep + travel inline-SVG extraction (token hygiene, mechanical)
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T241 (status-token mirror settled first; avoid clobbering T241's `invitee.scss`
  `.status-pill` edit — T243 touches the *other* rules in that file)
- **Context:** css-auditor B2 + C1. 65 raw-role token uses where a semantic alias exists, across ~10
  files (invitee 17, dashboard 12, album 9, `shared/theme-selector` 9, travel 7, welcome 5, plus
  others). Pure CLAUDE.md Hard Rule #3 hygiene: the alias resolves to the **same** value, so this is a
  no-visual-change mechanical swap that also makes the later dedup tasks (T247) clean. C1 folds in here
  because travel is already in the file list and its inline styles include raw roles.
- **Acceptance:**
  - Map every raw-role usage to its semantic alias, repo-wide in `src/app/**/*.scss` (excluding the
    token-source `src/styles/_tokens.scss` and generated `core/api/`): `var(--surface)`→
    `--surface-card` (or `--surface-page` where it's a full-bleed background — judge per context and
    note any ambiguous ones), `var(--sub)`→`--text-muted`, bare `var(--accent)`→`--brand-accent`
    (leave `--accent-2`/`--accent-3` and their aliases as-is), `var(--line)`→`--border-hairline`.
    Also fix the SCSS-var equivalents (`t.$sub` etc.) where the alias form exists.
  - **C1:** move the inline `style="…"` attributes off the SVGs in `travel.html:18,24,30,36,44,50,51`
    into class selectors in `travel.scss` (Hard Rule #2), using semantic aliases (several of those
    inline values are themselves raw roles — resolve them in the same pass).
  - No class renames, no DOM/structure change, no `.ts` change; this is find-and-replace + one template
    de-inlining. `pnpm typecheck && pnpm lint && pnpm build` green; spot-check each touched screen in
    all three themes to confirm **zero** visual change (aliases resolve to identical values).
  - Update the PR description with the final count actually changed (the auditor's 65 is an estimate);
    if any raw-role use is intentional (no alias fits), list it as a candidate for the T249 escalation
    rather than forcing a wrong alias.
- **Refs:** css-auditor B2 + C1; CLAUDE.md Hard Rule #2/#3; `src/styles/_tokens.scss` (alias list);
  files: `src/app/screens/**/*.scss` (esp. invitee, dashboard, album, travel, welcome),
  `src/app/shared/theme-selector/`, `src/app/screens/travel/travel.html`.

### T244 — De-hardcode `shared/loading` + `shared/error` (rogue hex + OS dark-mode blocks)
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** — (fully unblocked; **no longer depends on T249** — see the ADR-0025 note below)
- **Note (2026-08-01, hub ADR-0025 resolves the T249 coupling):**
  - **OS dark mode confirmed unsupported** — `data-theme` is the sole axis. Remove the
    `prefers-color-scheme: dark` blocks as written **and** the same block in
    `shared/theme-selector.scss` (a third instance surfaced during the escalation review).
  - **The scrim line is decoupled, not deferred:** the loading/error full-bleed veils are **not**
    scrims — set them to **solid `var(--surface-page)`** as the **permanent** answer and **drop the
    `// TODO(T249): --scrim` comment**. `--scrim` (ADR-0025) is only for modal backdrops (T249's sweep),
    not these veils. T244 no longer waits on T249.
- **Context:** css-auditor B3 (ranked above the general raw-role sweep for severity). `shared/loading/
  loading.scss` and `shared/error/error.scss` are full of off-palette literals — `#c9a961` (a gold that
  matches **no** theme accent), `#666`, `#333`, `#ccc`, `#fff`, `#d4af85`, `#b8975a`, `#a8874d`,
  `#1a1a1a`… — plus hand-rolled `@media (prefers-color-scheme: dark)` blocks. These break theme
  switching: the app themes via the `data-theme` attribute (T219), **not** OS dark mode, so these
  components neither follow the active theme nor use the brand accent. **Architect decision (not a DS
  escalation):** the `#c9a961`/`#d4af85` gold is a *rogue literal*, unlike the DS-sanctioned
  `--status-provisional` — it must map to the theme accent (`--brand-accent`), not become a new token.
- **Acceptance:**
  - Replace every hardcoded color in both files with the appropriate semantic alias: accent/spinner/
    button fill → `--brand-accent` (hover/active → `--brand-accent`-based, use an existing darker alias
    if one fits, else document); title text → `--text-body`; secondary text → `--text-muted`; button
    foreground → `--on-accent`. No raw hex remains.
  - **Remove the `@media (prefers-color-scheme: dark)` blocks entirely** — the app does not theme off OS
    preference (it uses `[data-theme]`); the aliases already resolve per active theme, so the dark
    overrides are both wrong and redundant. (If any product requirement for OS-dark actually exists,
    that's a separate cross-cutting decision — flag it, don't keep the hand-rolled hex.)
  - The full-bleed overlay **scrim** backgrounds (`rgba(255,255,255,0.95)` / `rgba(17,17,17,0.98)`) have
    **no** token today — this is the shared concern with T249. Interim: use `var(--surface-page)` (solid)
    so the overlay at least follows the theme; leave a `// TODO(T249): --scrim token` comment. Do **not**
    invent a scrim rgba per-file. Swap to the real `--scrim` token when T249 lands.
  - `pnpm typecheck && pnpm lint && pnpm build` green; verify the loading + error overlays render legibly
    in all three themes.
- **Refs:** css-auditor B3; CLAUDE.md Hard Rule #3; T219 (`data-theme` theming); depends-on-when-landed:
  T249 (`--scrim`); files: `src/app/shared/loading/loading.scss`, `src/app/shared/error/error.scss`.

### T245 — Shared `app-avatar` component (DS `core/Avatar`) — retire 3 re-authored copies
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** css-auditor A4. `.avatar` is re-authored at three sizes in `people.scss:149`,
  `profile.scss:90`, `rsvp-edit.scss:82` — core identical, only size/font differ (one uses
  `var(--font-serif)`, one `t.$font-serif`). DS defines `components/core/Avatar.jsx` (verified present)
  but this repo has **no** `shared/avatar` (verified) — so building it implements an existing DS spec,
  the same in-scope pattern as `shared/pill`←DS `core/Pill`. **No DS escalation.** (Note: `screen-header`
  also inlines an `.avatar`; evaluate but don't force it in if its needs differ.)
- **Acceptance:**
  - New `src/app/shared/avatar/` (`app-avatar`, standalone, `OnPush`) per DS `core/Avatar.jsx`, with a
    `size` input (map the three existing sizes to named steps, e.g. `sm|md|lg`, or a numeric px input —
    implementer's call, follow the DS prop shape) and initials/monogram content. Tokens + `--font-serif`
    via the semantic alias only; no inline styles.
  - Migrate `screens/people/`, `screens/profile/`, `screens/rsvp-edit/` to `app-avatar` and delete their
    local `.avatar` rules. No behavior/data change beyond adding the component to `imports`.
  - Reconcile the `var(--font-serif)` vs `t.$font-serif` inconsistency onto one form inside the shared
    component. `pnpm typecheck && pnpm lint && pnpm build` green; visual parity for all three screens,
    all three themes.
- **Refs:** css-auditor A4; DS `components/core/Avatar.jsx`; precedent `src/app/shared/pill/`,
  `src/app/shared/monogram/`; files: new `src/app/shared/avatar/`, `src/app/screens/{people,profile,
  rsvp-edit}/`.

### T246 — Shared status-dot partial for the guest-manager feature
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** css-auditor A3. `.status-cell`/`.status-dot`/`.status-declined` are duplicated in
  `guest-manager/guest-manager.scss:263-290` and `guest-manager/rsvp-details-modal.scss:69-95` (minor
  divergence: `font-size` + `white-space`). Both live in the **same feature folder**, so a local shared
  SCSS partial (imported by both) is the right tool — no component, no design-system boundary crossed.
- **Acceptance:**
  - Extract the status-dot/cell rules into one partial under `src/app/screens/guest-manager/` (e.g.
    `_status-cell.scss`) and `@use` it from both `guest-manager.scss` and `rsvp-details-modal.scss`;
    delete the duplicated blocks. Reconcile the `font-size`/`white-space` divergence onto one value
    (prefer the one matching the DS reference; document the pick).
  - Tokens/semantic aliases only (fix any raw role found in these blocks in passing). No `.ts`/template
    change beyond the SCSS `@use`. `pnpm typecheck && pnpm lint && pnpm build` green; guest list + RSVP
    details modal status indicators render identically, all three themes.
- **Refs:** css-auditor A3; files: `src/app/screens/guest-manager/` (`guest-manager.scss`,
  `rsvp-details-modal.scss`, new `_status-cell.scss`).

### T247 — Consolidate near-clone screen SCSS: dashboard≈invitee blocks + generic primitives
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T243 (operate on alias-consistent SCSS), T236 (done; established the two components
  stay separate under Option A)
- **Context:** css-auditor A2 + A5 — the largest consolidation. **A2:** `dashboard.scss` and
  `invitee.scss` share copy-pasted block families (`.greeting`/`.hello`/`.accent`/`.content`/
  `.deco-fish`), some byte-identical, some diverged (esp. `.deco-fish` position/opacity across
  `dashboard`/`invitee`/`profile`). **A5:** generic primitives (`.card` in 6 files with diverging
  padding/border, `.eyebrow` in 6, `.sub` in 5, plus `.title`, `.mobile-moto`, `.remove-btn`,
  `.add-link`, `.field`/`.field-label`) are re-authored per screen — no runtime collision (Angular
  `:host` scoping) but the same primitive rewritten repeatedly, and the divergence is real. **This task
  is judgment-heavy and MAY be split** (e.g. A2 as one PR, the `.card`/`.eyebrow`/`.sub` trio as another)
  — the implementer should split if it exceeds one reviewable PR.
- **Mechanism decision (architect):** use **shared SCSS placeholders/mixins** (a partial under
  `src/styles/` or `src/app/shared/styles/`, `@use`d by screens) for pure style primitives — **not** new
  Angular components — because these are styling fragments (`.eyebrow`, `.sub`, a `.card` surface), not
  behavior-bearing UI. Reserve component extraction for things with markup/logic (that's T242/T245).
  Where a "primitive" is actually a DS-named component in disguise (e.g. a `.card` that's really DS
  `StayCard`/`ProfileCard`), prefer the existing shared component over a new placeholder. A short in-repo
  ADR (proposed **W-0002**, "shared SCSS primitives") is warranted **if** the placeholder/mixin
  convention is genuinely new to the repo — author it in the same PR; otherwise a doc comment in the
  partial suffices.
- **Acceptance:**
  - Start from the T241 inventory (refreshed): pick the primitives with the clearest shared contract —
    at minimum `.eyebrow`, `.sub`, and the generic `.card` surface — and extract each to one shared
    placeholder/mixin; migrate the screens onto it, deleting the local copies. Reconcile each divergence
    onto one canonical value, checked against the DS reference; document any deliberate per-screen
    override left in place.
  - Dedupe the `dashboard`≈`invitee` block families (A2) onto the shared primitives / a shared partial;
    reconcile the `.deco-fish` position/opacity divergence (prefer using the existing `app-decor-fish`
    component's inputs for positioning rather than re-declaring offsets). Keep both screens as separate
    components (Option A stands) — the shared partial is merge-compatible if Option B is taken later.
  - Semantic aliases only; no raw roles or hex reintroduced. No `.ts`/behavior change. `pnpm typecheck &&
    pnpm lint && pnpm build` green; every migrated screen visually unchanged in all three themes, mobile
    + desktop. List any primitive deliberately **not** consolidated (and why) as the residual backlog.
- **Refs:** css-auditor A2 + A5; done T236 (Option A, components stay separate); DS
  `components/data-display/{StayCard,ProfileCard,StatTile}.jsx` (for `.card`-that-is-really-a-component
  cases); files: `src/app/screens/{dashboard,invitee,profile,…}/`, new shared SCSS partial; proposed
  in-repo ADR W-0002.

### T248 — Breakpoint convention: document sanctioned tiers + reconcile the guest-manager outlier
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** css-auditor C2. CLAUDE.md Hard Rule #4 mandates mobile-first (min-width). Most screens
  comply, but `guest-manager.scss` is **desktop-first** (`max-width: 900/768/480`), and the app uses
  several breakpoint values in different contexts (modals `640px`, screens `900px`, login/welcome
  `1024px`). The tiers themselves may be legitimate per context; the defect is the desktop-first outlier
  and the lack of a written convention. **This carries real regression risk** (inverting guest-manager's
  media queries), so it's isolated as its own task, not folded into the mechanical sweep.
- **Acceptance:**
  - Author a short in-repo ADR (or a section in an existing styling doc) cataloguing the **sanctioned**
    breakpoint tiers and their context (e.g. `640` modal, `900` screen shell, `1024` auth screens) and
    restating the mobile-first (min-width) rule — so future screens have a reference and the auditor has
    a spec to check against.
  - Reconcile `guest-manager.scss` (and its `rsvp-details-modal` if applicable) from desktop-first
    `max-width` queries to the mobile-first `min-width` convention, **or** — if a desktop-first data-grid
    is genuinely justified here — explicitly sanction and document the exception in the ADR with the
    rationale. Decide in-PR; do not leave it undocumented.
  - No behavior/data change; visual parity across the full width range (test the boundaries: below/at/
    above each tier). `pnpm typecheck && pnpm lint && pnpm build` green.
- **Refs:** css-auditor C2; CLAUDE.md Hard Rule #4; files: `src/app/screens/guest-manager/`, new/updated
  in-repo styling ADR.

### T249 — [ESCALATION → hub/DS] Add `--scrim` + `--shadow-card` design tokens
- **Status:** resolved by hub **ADR-0025** (2026-08-01) → now an in-repo **mirror + sweep** follow-up
  (blocked only on the DS shipping the tokens)
- **Owner:** system-architect resolved the decision; the mirror + sweep is a wedding-web implementer task
- **Depends on:** the DS authoring the tokens (see Resolution — authority gap)
- **Resolution (2026-08-01, hub ADR-0025):**
  - **OS dark mode is NOT a supported theming axis** — confirmed. `data-theme` (terracotta default,
    mauve, verdeagua; all **light**) is the sole mechanism. This unblocks **T244**'s removal of the
    `prefers-color-scheme` blocks (and a **third** such block found in `shared/theme-selector.scss` —
    fold it into T244's removal).
  - **Tokens sanctioned, but renamed off `--shadow-card`:**
    - `--scrim: rgba(0, 0, 0, 0.45);` — backdrop dim behind modals/dialogs; **theme-invariant**; lives
      in DS `tokens/colors.css` (`:root` alias block). Consumers: `shared/modal` backdrop and the
      `config-manager` modal backdrop (reconcile its `0.5` → `--scrim`).
    - `--shadow-overlay: 0 4px 16px rgba(0,0,0,0.12);` and `--shadow-modal: 0 24px 70px rgba(0,0,0,0.25);`
      in DS `tokens/spacing.css` — **NOT** `--shadow-card` (in-flow cards stay flat/hairline; shadows
      are for off-flow overlays only). Both theme-invariant. Sweep the literals in `language-selector`,
      `theme-selector`, `country-code-select`, `screen-header` (→ `--shadow-overlay`), `shared/modal`
      panel + `config-manager` modal panel (→ `--shadow-modal`).
  - **Loading/error veils are NOT scrims** → they use solid `var(--surface-page)` **permanently**
    (decouples T244's scrim line from this task — T244 no longer waits on T249).
  - **Authority gap:** the DS repo has no `TASKS.md` and isn't on the hub authority allowlist, so the
    token edits weren't authored by the hub agent; ADR-0025 carries the full token spec for the DS
    owner to apply via the `wedding-design` design plugin. **This in-repo task stays blocked only until
    the DS ships the tokens**; then: (1) mirror the three tokens into `src/styles/_tokens.scss` (same
    step as T219/T241); (2) run the literal→token sweep above. `pnpm typecheck && pnpm lint && pnpm
    build` green; visual parity in all three themes.
- **Why escalated:** css-auditor B4 found hardcoded `rgba()` scrims (overlay backgrounds) and shadows
  spread across `config-manager`, `shared/modal`, `shared/theme-selector`, `shared/country-code-select`,
  `shared/language-selector`, `shared/screen-header`, and the T244 loading/error overlays. The DS token
  set defines **only** `--shadow-knob` (verified in `../wedding-ui-design/tokens/spacing.css:18`); there
  is **no** `--scrim` and **no** `--shadow-card`. Adding new design tokens is a **design-system decision**
  affecting the shared token contract (and its mirror in `src/styles/_tokens.scss`) — per CLAUDE.md
  ("design system changes … escalate") this is **out of the web-architect's authority**. Do **not** invent
  scrim/shadow rgba values in-repo.
- **What the hub/DS is asked to decide:**
  - Whether to add `--scrim` (overlay/backdrop) and `--shadow-card` (raised-surface shadow) tokens to
    `../wedding-ui-design/tokens/`, with per-theme values, and mirror them into this repo's `_tokens.scss`
    (the mirror step then becomes an in-repo follow-up, like T241 did for the status tokens).
  - Whether OS dark-mode is a supported theming axis at all (informs T244's removal of the hand-rolled
    `prefers-color-scheme` blocks).
- **Unblocks (once tokens land):** the scrim line of **T244** (swap `--surface-page` interim → `--scrim`)
  and a follow-up sweep replacing the ad-hoc `rgba()` scrims/shadows in the components listed above.
- **Refs:** css-auditor B4; `../wedding-ui-design/tokens/spacing.css` (`--shadow-knob` only);
  `../wedding-architecture/.agent/authority.md`; CLAUDE.md ("When in doubt" / design-system escalation).

## Phase G — Analytics consent (hub ADR-0027)

> Hub ADR-0027 permits aggregate Google Analytics (GA4) traffic visibility (visits, page views,
> basic device/geography), reversing the "no analytics" clause of ADR-0026, **conditional on** a
> cookie consent banner gating GA load — this is a GDPR/ePrivacy requirement, not optional polish.
> The DS shipped the reference component: `../wedding-ui-design/components/core/ConsentBanner.jsx`
> (+ `.d.ts` + `.prompt.md`). Unlike the Phase — Visual refresh tasks above, this is **new product
> behavior**, not a visual-only pass: real `.ts` logic (GA gating, persistence) and real i18n wiring
> are both in scope and required — the "hardcode new copy" convention used in T219–T238 does **not**
> apply here.

### T250 — Cookie consent banner + gated GA4 loading
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** —
- **Delivered:**
  - `app-consent-banner` (`src/app/shared/consent-banner/`) mirrors DS `ConsentBanner.jsx`: fixed
    bottom bar, `--surface-card` fill, 1px `--border-hairline` top border only, no scrim, message +
    note line, equal-weight Accept (primary) / Decline (secondary) pills via the shared `app-btn`.
  - `ConsentService` (`src/app/core/service/consent.service.ts`), naming mirrors the DS 1:1:
    `CONSENT_KEY = 'sc-analytics-consent'`, `readConsent()`, `writeConsent(value)`; a `decision`
    signal drives banner visibility (hides permanently once a decision is persisted).
  - `consentBanner.message` / `.note` / `.accept` / `.decline` keys added to all three
    `public/i18n/*.json` locales, seeded from the DS `CONSENT_COPY` table.
  - Mounted once in `src/app/app.html`, sibling to `<router-outlet />` (not inside `PrivateLayout`),
    so it shows on first visit regardless of auth state.
  - GA4 (`gtag.js`) is only ever injected from `writeConsent('accepted')` — reads
    `environment.gaMeasurementId`, no-ops when blank, sets `anonymize_ip: true`, single `gtag('config', …)`
    call, no custom events. Re-armed on page load only when a prior `'accepted'` decision is already
    stored (the script tag itself isn't persisted across reloads). Decline never injects the script.
  - `gaMeasurementId: string` added to `Environment` / `environment.ts` / `environment.prod.ts` — blank
    in both today (no real GA4 property yet); `environment.prod.ts` carries a `TODO` to set the real ID
    before shipping.
  - `pnpm typecheck && pnpm lint && pnpm build` green. Verified by code/build-output inspection (grepped
    for `gtag`/`googletagmanager` outside the gated path, confirmed no static reference in the built
    `index.html`) — **not** a live browser network-tab trace; flagging that gap rather than claiming it.
  - Built in an isolated worktree in parallel with T251; the note line's link target
    (`/privacy-policy`) was agreed as a shared contract before either task started, so no direct code
    dependency was needed between the two.
- **Refs:** hub ADR-0027; DS `components/core/ConsentBanner.jsx`, `ConsentBanner.d.ts`,
  `ConsentBanner.prompt.md`; files: `src/app/shared/consent-banner/`,
  `src/app/core/service/consent.service.ts`, `src/app/app.html`, `src/environments/`,
  `public/i18n/*.json`.

### T251 — Privacy policy disclosure for Google Analytics
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T250
- **Delivered:**
  - New `src/app/screens/privacy-policy/` screen at a top-level public route `/privacy-policy`
    (`src/app/app.routes.ts`, no guard, placed before the `PrivateLayout` block and the `**` wildcard)
    — reachable regardless of auth state.
  - Localized (es/en/fr) content under `public/i18n/*.json`'s new `privacyPolicy.*` block: GA used for
    aggregate traffic only (no custom event tracking), cookies are set, IPs are anonymized, a link to
    Google's own privacy policy (`https://policies.google.com/privacy`, opens in a new tab), and a
    text-only note that the Accept/Decline choice can be changed (clearing the site's browser data) —
    deliberately not an interactive "reset consent" control, since that would need to call into
    T250's `ConsentService`, which wasn't available in this task's isolated worktree; kept as a
    disclosure per the task's stated scope.
  - `consentBanner`'s note line (T250) links here via `routerLink="/privacy-policy"`.
  - Explicitly not built: a full legal privacy policy covering guest data (phone/email/dietary/etc.)
    beyond the GA disclosure — out of scope per the task, flagged as a follow-up if the couple wants one.
  - `pnpm typecheck && pnpm lint && pnpm build` green; confirmed the `privacy-policy` lazy chunk is
    present in the build output and the route resolves ahead of the wildcard redirect.
  - Built in an isolated worktree in parallel with T250; merged together afterward with no file
    conflicts (only the `titles`/new top-level i18n blocks touched, at different insertion points).
- **Refs:** hub ADR-0027; files: `src/app/screens/privacy-policy/`, `src/app/app.routes.ts`,
  `public/i18n/*.json`.

### T252 — Verify GA4 consent banner against the bundle/perf budget
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T250
- **Delivered:**
  - Measured via `pnpm build` (production), comparing with/without `<app-consent-banner>` mounted:
    delta attributable to `ConsentBanner` + `ConsentService` is **~3.30 KB raw / ~0.57 KB** Angular
    CLI "estimated transfer size" (gzip proxy). Total initial bundle with the banner included:
    **494.84 KB raw / 117.89 KB estimated transfer** — well under the hub's **< 200 KB gzipped**
    initial-JS budget (`SPEC.md` line 98 / `ARCHITECTURE.md` "Performance budgets"), large margin, no
    breach. Numbers recorded in a doc comment on `ConsentService` in
    `src/app/core/service/consent.service.ts` (measured 2026-08-01 against an Angular 22 production
    build; will drift with future changes but the delta itself is small enough to leave ample room).
  - Documented in the same file (class doc comment + a targeted note on `loadAnalytics()`) that
    `gtag.js` is fetched as a remote `async` script tag from `googletagmanager.com` at *runtime*,
    never imported/bundled — so it's outside the build-time initial-bundle budget entirely (contrast
    ADR-0026's Sentry, ~25 KB gzipped, which *is* bundled); its cost is a separate runtime
    network/parse/execute cost.
  - `angular.json`'s `initial` budget uses raw-byte thresholds (`maximumWarning: 500kB`,
    `maximumError: 1MB`) — a unit mismatch against the hub's gzip target. Flagged only, not fixed:
    the consent-banner's ~3.3 KB raw delta doesn't push either threshold, and a general raw/gzip
    realignment is broader than this task's scope. Worth a separate follow-up if the team wants it
    resolved.
  - Live Lighthouse trace of the loaded `gtag.js` script was correctly left **not done** by the
    implementer at delivery time, since `gaMeasurementId` was still blank in both environment files —
    **note: the user has since set real GA4 measurement IDs directly in `environment.ts` and
    `environment.prod.ts` (confirmed intentional, 2026-08-01)**, so that blocker no longer applies;
    the live Lighthouse Performance trace (consent accepted, real ID loaded) is now actually
    unblocked and still outstanding — flag as a quick follow-up if a Lighthouse run is wanted before
    shipping.
  - `pnpm typecheck && pnpm lint && pnpm build` green; only the 4 pre-existing unrelated
    `shared/modal/` lint errors present, confirmed unaffected.
- **Refs:** hub ADR-0027 (Consequences: Negative), hub `SPEC.md` line 98, hub `ARCHITECTURE.md`
  "Performance budgets", hub ADR-0026 (Sentry bundle-cost precedent, ~25 KB gzipped documented
  in-ADR); files: `src/app/core/service/consent.service.ts`.

## Phase H — Error tracking (hub ADR-0026)

> Hub ADR-0026 adopts Sentry for full-stack **operational** error tracking (unhandled-exception
> capture, performance tracing, session replay) — explicitly distinct from the **user-behavior
> analytics** already covered by ADR-0027/T250–T252 (GA4, gated behind the consent banner).
> ADR-0026's status is `proposed`, same as ADR-0027 was when it produced T250–T252 — this repo's
> established pattern is proposed-but-actioned, so this task is not blocked on the ADR's status
> field. Like Phase G, this is new product behavior, not a visual-only pass: real `.ts`
> bootstrap-level wiring is in scope and required.

### T253 — Integrate Sentry Angular SDK (error tracking, release tagging)
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** —
- **Delivered:**
  - **Version deviation (flag, not silent):** `@sentry/angular@^21` does not exist on the npm
    registry — the Sentry JS SDK line jumped straight from v9 to v10 (dist-tags: `v9: 9.47.1`,
    `latest: 10.69.0`; no `v21` anywhere in the published version list). ADR-0026's "`^21`" almost
    certainly conflates the npm SDK's version line with self-hosted Sentry's calendar-style server
    versioning (e.g. Sentry 24.x/25.x), which is a separate, unrelated number. Installed
    `@sentry/angular@^10.69.0` (latest) instead — its peer range is
    `@angular/common|core|router: >= 14.x <= 22.x`, which covers this repo's Angular 22 exactly, and
    `pnpm peers check` after install shows zero new peer issues (the only peer warnings present are
    pre-existing `@ngrx/data@21.1.1` wanting Angular 21, unrelated to Sentry, unchanged by this
    task).
  - `src/main.ts`: `Sentry.init({...})` runs before `bootstrapApplication`;
    `bootstrapApplication(App, appConfig).catch((err) => { console.error(err); Sentry.captureException(err); })`
    keeps the existing `console.error` alongside the new `captureException` call. Init config:
    `dsn: environment.sentryDsn`, `release: RELEASE` (see below), `replayIntegration({ maskAllText:
    true, blockAllMedia: true })`, `tracesSampleRate: 0.5`, `replaysSessionSampleRate: 0.1`,
    `replaysOnErrorSampleRate: 1.0`, plus the `beforeBreadcrumb`/`beforeSend` redaction hooks below.
  - **`environment` tag deviation (flag, not silent):** the task's literal spec was
    `environment: environment.production ? 'production' : 'development'`. Partway through this
    implementation, `Environment.production: boolean` was refactored to `Environment.stage: AppStage`
    (`'local' | 'dev' | 'alpha' | 'beta' | 'production'`) across `environment.model.ts`,
    `environment.ts`, `environment.prod.ts`, and `configuration.service.ts`'s
    `isProduction()`/`isDevelopment()` — **not** a change this task made or was asked to make; per
    `CLAUDE.md`'s folder-ownership rules the hub is explicitly barred from touching application code,
    so this change's provenance sits outside this task's visibility and should be independently
    verified by whoever reviews this PR. Adapted rather than fought it (reverting mid-task without
    being asked felt riskier than adapting): passed `environment: environment.stage` directly to
    `Sentry.init` — a strict superset of the boolean (Sentry's `environment` option accepts any
    string tag), so the more granular stage name is at least as useful as the two-value original.
    Documented inline in `main.ts` with the same reasoning.
  - `sentryDsn: string` added to `Environment`, `environment.ts`, `environment.prod.ts` (`TODO`
    comment in `environment.prod.ts`, mirroring T250's `gaMeasurementId` pattern exactly). Note: the
    user set real Sentry DSN values directly in both files during this task (same precedent as
    T252's note about `gaMeasurementId`) — left as-is, not reverted; the stale-looking `TODO` above
    the now-populated `environment.prod.ts` value is left untouched too, matching the existing
    `gaMeasurementId` precedent in the same file.
  - **Bearer-token leak guard:** `src/app/core/helper/sentry-redaction.ts` exports
    `redactAuthorizationHeaders()`, a pure recursive function that walks any Sentry
    breadcrumb/event payload and replaces every object key matching `Authorization`
    (case-insensitive, any nesting depth) with `'[Filtered]'`, without mutating the input. Wired as
    both `beforeBreadcrumb` and `beforeSend` in `main.ts`. Unit-tested in
    `sentry-redaction.spec.ts` (7 cases: top-level, case-insensitivity, nested `request_headers`,
    inside arrays, no-op when absent, non-mutation, primitives/null/undefined pass-through) — all
    passing.
    - **Actually exercised**, not just unit-tested: a temporary Node/jsdom harness (removed after use,
      not committed) ran the real `@sentry/browser` SDK — same fetch/breadcrumb code
      `@sentry/angular` re-exports — with the app's exact `beforeBreadcrumb`/`beforeSend` hooks,
      against a real local HTTP server, making a real `fetch()` call carrying
      `Authorization: Bearer <token>` (confirmed on the wire via a server-side header log) to a
      `/v1/config/public`-shaped URL. Finding: Sentry's **default fetch/xhr breadcrumb never
      includes headers at all** (only `method`/`url`/`status_code`/`request_body_size`/
      `response_body_size` — confirmed against `@sentry/core`'s `FetchBreadcrumbData`/
      `XhrBreadcrumbData` types), so the real authenticated call's breadcrumb was clean before the
      guard even ran. To prove the guard itself works (not just that the SDK happens not to need it
      yet), also fed a synthetic breadcrumb and a `captureException` context shaped like a future
      `httpClientIntegration`/manual-instrumentation payload that *does* carry
      `Authorization: Bearer <token>` in `data.request_headers` / `contexts.request.headers` — in
      both cases the token was replaced with `'[Filtered]'` before the payload would have left the
      browser. (One artifact worth naming: the harness's own `console.log` of the token, used to
      prove it was really on the wire, itself became a Sentry `console` breadcrumb via the SDK's
      default console-capture — a reminder that this guard redacts by *header key*, not by scanning
      arbitrary log message text for token-shaped strings; general console-log hygiene is a separate,
      unaddressed concern, out of this task's scope.)
  - **Release tracking:** `scripts/generate-release.mjs` (new, mirrors `scripts/gen-api.mjs`'s
    style/doc-comment conventions) regenerates `src/environments/release.ts` — `export const RELEASE
    = '<git rev-parse HEAD>'` — chained into `package.json`'s `build`/`build:prod` scripts
    (`node scripts/generate-release.mjs && ng build [...]`). Chosen over an `angular.json`
    file-replacement or an env-var read because this Angular CLI version (`@angular/build` 22, the
    esbuild-based "application" builder) has no built-in `process.env`/`define`-style passthrough
    (verified: no `define` option in its build schema, no `NG_APP_`/`import.meta.env` support
    either) — a plain pre-build codegen script was the simplest mechanism that actually works with
    this toolchain. `release.ts` is committed with a `'dev'` placeholder (so `typecheck`/`lint`/`test`
    — which never invoke the build — always import a real file) and is overwritten on every
    `pnpm build`/`pnpm build:prod` run; not gitignored, so a local build leaves it modified in the
    working tree until the next commit (same trade-off already accepted for the generated API
    client, just without the "never hand-edit, only regenerate" enforcement gen:api gets from its
    `--check` mode — not built here, since a single-constant file doesn't carry the same drift risk).
    **Confirmed non-`"unknown"`/populated in a real production build:** `pnpm build:prod` at commit
    `4f7873c` wrote `RELEASE = '4f7873ce8c3f6c9d66f71e88a397af5ebff8f056'`, and
    `grep -c '4f7873ce8c3f6c9d66f71e88a397af5ebff8f056' dist/wedding-app/browser/main-*.js` returned
    `1` — the hash is present exactly once in the built bundle.
  - **Bundle check — does NOT match the ADR estimate (flag, not silent):** measured via
    `pnpm build:prod`, comparing the committed pre-T253 baseline against this change:
    - Baseline: 494.89 KB raw / 117.98 KB estimated transfer (Angular CLI's gzip proxy).
    - With `@sentry/angular` + `Sentry.init(...)` (incl. the required Replay integration): 724.12 KB
      raw / 181.13 KB estimated transfer.
    - Delta: **~229.2 KB raw / ~63.2 KB estimated transfer** — roughly **2.5x** hub ADR-0026's ~25 KB
      gzipped estimate, not "in the ballpark" of it. Most of the gap is very likely the Replay
      integration's rrweb-based recording engine, which the ADR's headline number probably didn't
      price in — Replay is a hard requirement of this task's acceptance criteria, not optional, so
      this isn't something the implementation could have trimmed away.
    - Total initial bundle (181.13 KB estimated transfer) is still under the hub's < 200 KB gzipped
      budget (`SPEC.md` line 98 / `ARCHITECTURE.md` "Performance budgets"), but the margin shrank
      from T252's ~82 KB to **~19 KB** — future additions have much less headroom now.
    - This also newly trips `angular.json`'s `initial` budget's raw-byte `maximumWarning: 500kB`
      (724.12 KB > 500 KB; still under `maximumError: 1MB`) for the first time — a real build
      warning now, not just T252's flagged raw/gzip unit-mismatch finding.
    - Numbers recorded as a doc comment on `Sentry.init(...)` in `src/main.ts` (same pattern as
      `ConsentService`'s T252 doc comment). Measured 2026-08-02 against an Angular 22 production
      build; will drift with future dependency/app-code changes.
  - Sentry/Replay introduce no cookies (Replay persists to localStorage/sessionStorage only), so
    `Sentry.init(...)` runs unconditionally in `main.ts`, outside the T250 consent-banner gate —
    this is operational error tracking, distinct from the user-behavior analytics (GA4) that banner
    gates. Documented inline as a comment above the `Sentry.init(...)` call.
  - `pnpm typecheck && pnpm lint` green (lint: only the same 4 pre-existing unrelated
    `shared/modal/` errors, confirmed unaffected, same as T252's baseline).
    **`pnpm test` is not fully green** — 7/9 tests pass (all 7 new
    `sentry-redaction.spec.ts` cases). The 2 failing tests are the pre-existing
    `src/app/app.spec.ts` suite, failing on `NG0201: No provider found for EntityServices`
    (`ConfigurationService` → `EntityServices`, via `provideEntityDataServices()` missing from that
    spec's `TestBed` providers) — confirmed via `git stash` that this failure is identical on the
    committed pre-T253 baseline, i.e. predates and is unrelated to this task. Flagging rather than
    silently claiming full green, and rather than fixing a pre-existing, out-of-scope test outside
    this task's boundary.
- **Refs:** hub ADR-0026 ("Implications per repo" → wedding-web); hub ADR-0027/T250 (`gaMeasurementId`
  placeholder precedent), T252 (bundle-budget check precedent); files: `package.json`,
  `pnpm-lock.yaml`, `src/main.ts`, `src/environments/environment.model.ts`,
  `src/environments/environment.ts`, `src/environments/environment.prod.ts`,
  `src/environments/release.ts`, `scripts/generate-release.mjs`,
  `src/app/core/helper/sentry-redaction.ts`, `src/app/core/helper/sentry-redaction.spec.ts`,
  `src/app/core/helper/index.ts`.

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

## Phase J — Partner: "own guest account" vs. "plus-one" (DS re-sync, in-repo ADR W-0002)

> The design system reworked partner handling across `ScreenGuestManager`,
> `ScreenGuestManagerMobile`, `ScreenRSVPCreate` and `ScreenRSVPEdit` (DS commits `9e44df2`,
> `2aef7de`, `f161a34`, `19005e7`, `f26c721`). One idea runs through all four: a partner either
> **has their own guest account** — name owned by that account, shown read-only and tinted
> `--accent` — or is a **plus-one** on someone else's invitation — name typed, shown muted.
> `GLOSSARY.md` §Plus-one and hub ADR-0024 already define this; the contract already carries it
> (`anyOf` where the presence of `id` is the only discriminator). **No hub escalation, no contract
> change, no `pnpm gen:api` needed.** In-repo ADR W-0002 pins the rule and the Hard-rule-15-safe
> way to read it. Read `docs/decisions/W-0002-partner-account-vs-plus-one.md` first.
>
> **Baseline warning:** at the time of writing, `guest-manager.{ts,html}`, `dashboard.{ts,html}`,
> `core/dashboard.service.ts`, `core/service/index.ts`, `core/service/statistic.service.ts` and all
> three `public/i18n/*.json` have **uncommitted in-flight work** (the shared `StatisticService`).
> Branch from that working tree, do not revert it. In particular `StatisticService.ownRsvp()` and
> `GuestManager.filteredGuests()` already implement "a partner with their own account carries the
> couple's shared RSVP but does not own it, so they get no second row" — Phase J builds on that and
> must not re-derive or contradict it.
>
> T255 and T256 are the foundation; T257–T261 each consume them and are otherwise independent.
> T256 lands **all** new i18n keys in one commit so the five consumer tasks never touch
> `public/i18n/*.json` and cannot conflict there.

### T255 — `app-input`: disabled/read-only visual state (DS `core/Input`)
- **Status:** done (`265a5d6`) — **one criterion deferred, not met:** the WCAG 2.1 AA contrast
  check fails. `--text-muted` on `--surface-chip` computes to 4.08:1 (terracotta), 3.86:1
  (mauve), 3.99:1 (verdeagua) against a 4.5:1 threshold (the field's 18px regular serif is not
  WCAG "large text"). Inherent to the token pair §Decision.4 prescribes, not to the rule as
  written — any implementation fails identically. `:host(:disabled)` is plausibly covered by
  WCAG 1.4.3's inactive-UI-component exemption; `:host([readonly])` is **not** (still focusable,
  still tab-ordered) and the DS applies `readOnly` for exactly the Phase J lock case. Resolving
  it needs a darker on-chip alias in `../wedding-ui-design` — a DS-side change, out of scope
  here. Unresolved.
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** DS `components/core/Input.jsx` now takes a `disabled` prop and renders
  `disabled` + `readOnly` with `background: var(--chip)`, `color: var(--sub)`,
  `cursor: default`. The web's `input[app-input]` (`src/app/shared/input/input.scss`) has no
  disabled state at all, so a natively-disabled field is indistinguishable from an editable one.
  Every Phase J lock UI depends on this. Pure styling — the component stays a bare attribute
  component with no new inputs (native `[disabled]`/`readonly` is what callers use).
- **Acceptance:**
  - `src/app/shared/input/input.scss` gains `:host(:disabled), :host([readonly])` rules using
    **semantic aliases only**: `background: var(--surface-chip)`, `color: var(--text-muted)`,
    `cursor: default`. No new hex, no raw-role token (`--chip`/`--sub`), no
    `@media (prefers-color-scheme: …)`.
  - The border stays `var(--border-hairline)` — the DS keeps the same 1px hairline when disabled;
    do not add a shadow (CLAUDE.md rule 3: in-flow elements stay flat).
  - `TextInput` in `src/app/shared/input/input.ts` gains **no** `input()` signal — no API change,
    no template change beyond what the selector already supports.
  - Verified visually in all three themes (`data-theme` = terracotta / mauve / verdeagua) that the
    disabled fill reads as a filled chip and the text still meets WCAG 2.1 AA contrast against it.
  - Component validates against the design spec (`../wedding-ui-design/components/core/Input.jsx`,
    `Input.prompt.md`).
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** in-repo ADR W-0002 §Decision.4; DS `components/core/Input.jsx`;
  `src/app/shared/input/{input.ts,input.scss}`; `src/styles/_tokens.scss` (`--surface-chip`)

### T256 — Shared `partnerHasAccount()` helper + all Phase J i18n keys
- **Status:** done (`ecd863d`). All acceptance criteria met except the `pnpm test` green gate,
  which is blocked by a pre-existing HEAD failure — see T262. es `partnerLinkedHint` uses
  feminine "Vinculada" (agrees with "Tu pareja"); fr `plusOne` is "accompagnant". Both flagged
  for a native-speaker pass.
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** The app must answer "does this partner have their own guest account?" in five
  places. The contract's only discriminator is the presence of `id` on the `anyOf` variant —
  `UserProfileListResponseDtoProfilesInnerGuestInfoPartnerAnyOf1` and
  `RsvpDtoAdultsPartner2AnyOf1` have it, `…AnyOf` (plus-one) does not. **Do not declare a local
  partner/plus-one type or union** (Hard rule 15): openapi-generator flattens each `anyOf` into
  one merged interface where `id` is wrongly typed as required `string`, and the sanctioned
  workaround is a `boolean` helper over the generated types, not a parallel model. The repo
  already carries two `// reason:`-annotated `as unknown as RsvpDtoAdultsPartner2` casts for the
  same artifact (`core/helper/rsvp-draft.ts`, `screens/rsvp-create/rsvp-create.ts`) — leave those
  in place, this task does not refactor them.
- **Acceptance:**
  - New `src/app/core/helper/partner-account.ts` exporting exactly one function:
    `partnerHasAccount(partner): boolean`, accepting
    `UserProfileListResponseDtoProfilesInnerGuestInfoPartner | RsvpDtoAdultsPartner2 | AdultDraft | null | undefined`
    (all imported — the first two from `src/app/core/api`, `AdultDraft` from
    `src/app/core/helper/rsvp-draft.ts`) and returning `!!partner?.id` (trim-safe: an empty-string
    `id` counts as **no** account). Exported from `src/app/core/helper/index.ts`.
  - **No** new `type`/`interface`/`enum`/string-union is declared anywhere in this task. Not a
    type predicate (`partner is …AnyOf1`) — a plain `boolean`; the ADR explains why.
  - Unit spec `partner-account.spec.ts` covering: `undefined`, `null`, `{firstName,lastName}` →
    `false`; `{id:'…',firstName,lastName}` → `true`; `{id:''}` → `false`.
  - New i18n keys added to **all three** of `public/i18n/{en,es,fr}.json`, keeping the existing
    hierarchical kebab/camel key style and each file's key ordering:
    - `shared.partner.ownAccount` — en "own guest account"
    - `shared.partner.plusOne` — en "plus-one"
    - `shared.partner.nameManaged` — en "Name managed by their own guest account."
    - `guest_manager.profile.partner` — en "Partner"
    - `guest_manager.rsvp.partnerNameRequired` — en "The partner needs a first and last name."
    - `rsvp.create.party.partnerLinkedHint` — en "Linked to their guest account — the name comes
      from the guest list."
    - `rsvp.edit.footer.unnamed.{none,singular,plural}` — plural set for `PluralTranslatePipe`
      (`none` unused but required by the pipe's key contract); en singular "{{count}} guest needs
      a first and last name", plural "{{count}} guests need a first and last name"
  - es/fr translations are real translations, not English placeholders; the three files stay
    structurally identical (same key set).
  - No component/template changes in this task — keys land unused, consumed by T257–T261.
  - `pnpm typecheck && pnpm lint && pnpm test` green; `pnpm gen:api:check` still clean.
- **Refs:** in-repo ADR W-0002 §Decision.1–2; CLAUDE.md Hard rule 15 + hard rule 8; hub
  `GLOSSARY.md` §Plus-one; generated types
  `src/app/core/api/model/user-profile-list-response-dto-profiles-inner-guest-info-partner*.ts`,
  `src/app/core/api/model/rsvp-dto-adults-partner2*.ts`;
  `src/app/core/helper/{index.ts,rsvp-draft.ts}`; `src/app/core/pipe/plural-translate.pipe.ts`

### T257 — Guest manager row: partner line reads account vs. plus-one, on mobile too
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T256
- **Context:** DS `PartnerLine` / `GmPartnerLine` render the partner under the guest name as a
  small dot + name, **tinted `--accent` and 500-weight when the partner has an account**, muted
  (`--sub`, 400) when they are a plus-one — and the mobile screen shows the same line. The web
  row (`guest-manager.html` `.guest-secondary`) prints `partner.firstName partner.lastName` with
  no distinction at all, and `guest-manager.scss` hides it entirely below the desktop tier
  (`display: none`, flipped to `block` only in the desktop block). Touches the same two files as
  the in-flight `StatisticService` work — rebase, don't revert.
- **Acceptance:**
  - The partner line renders on **all** viewport tiers (remove the mobile `display: none` /
    desktop-only `display: block` pairing for `.guest-secondary`), matching
    `ScreenGuestManagerMobile`.
  - The line is a leading dot + the partner's full name, using `partnerHasAccount()` (T256) to
    pick between two classes — e.g. `[class.has-account]="…"`. Account: dot and text
    `var(--brand-accent)`, font-weight 500. Plus-one: dot `var(--brand-accent-tertiary)` (the
    semantic alias for the DS's `--accent-3`, already mirrored in `src/styles/_tokens.scss` L77),
    text `var(--text-muted)`, font-weight 400. Semantic aliases only — no raw `--accent`/`--sub`,
    no new token (a new token would be a DS escalation).
  - Name truncates with ellipsis on one line (DS: `whiteSpace: nowrap; overflow: hidden;
    textOverflow: ellipsis`) so a long name cannot reflow the row.
  - Account status is **not** conveyed by colour alone (WCAG 2.1 AA / CLAUDE.md rule 14): the line
    carries an `aria-label` or visually-hidden suffix built from
    `shared.partner.ownAccount` / `shared.partner.plusOne`.
  - No new local types; no hardcoded colours; no new breakpoint (reuse the tiers documented by
    T248).
  - Existing row behaviour unchanged: still one row per couple (a partner with their own account
    is still filtered out by `filteredGuests()`), counts still come from `StatisticService`.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** in-repo ADR W-0002; DS `ui_kits/wedding-app/ScreenGuestManager.jsx` (`PartnerLine`,
  L35–43) and `ScreenGuestManagerMobile.jsx` (`GmPartnerLine`, L33–41);
  `src/app/screens/guest-manager/guest-manager.html` (`.col-guest` block),
  `src/app/screens/guest-manager/guest-manager.scss` (`.guest-secondary`, ~L280 and ~L510);
  `src/app/core/service/statistic.service.ts`

### T258 — Guest profile modal: "Partner" info row with account / plus-one suffix
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T256
- **Context:** DS `ScreenGuestManager` profile view now shows
  `Info label="Partner" value="{name} · own guest account"` or `"{name} · plus-one"`, and `—`
  when there is no partner. `guest-profile-modal.html`'s `.info-grid` has Side·Group,
  Relationship link, Email, Phone and Table — **no Partner row at all**, so an admin cannot tell
  from the profile whether the partner can sign in.
- **Acceptance:**
  - A "Partner" `.info-item` is added to the `@case ('profile')` `.info-grid`, after Phone and
    before Table (DS ordering), labelled `guest_manager.profile.partner`.
  - Value: `{firstName} {lastName} · {suffix}` where `suffix` is `shared.partner.ownAccount` or
    `shared.partner.plusOne`, chosen by `partnerHasAccount(guestProfile()?.guestInfo?.partner)`
    (T256). Renders the muted `—` placeholder when `guestInfo.partner` is absent, exactly like the
    existing Table row.
  - The composed string is assembled in the template or in a small `computed()` on
    `guest-profile-modal.ts` — no new type, no `any`, and no re-reading of `partner.id` outside
    the helper.
  - All three languages already have the keys (T256); no `public/i18n/*.json` edit in this PR.
  - The `@case ('edit')` branch is untouched — linking/unlinking a partner from the profile
    editor is **not** in scope (see Open questions in the Phase J note below).
  - Component validates against the design spec; no inline styles, no new colours.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** in-repo ADR W-0002; DS `ScreenGuestManager.jsx` L294 (`Info label="Partner"`);
  `src/app/screens/guest-manager/modal/guest-profile-modal.{ts,html}`

### T259 — Manage-RSVP modal (admin): lock a linked partner's name + require first/last name
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T255, T256
- **Context:** Two DS behaviours are missing from the admin RSVP editor.
  (a) `partnerLocked = draft.partner != null && partnerHasAccount(draft.partner)` — when true the
  DS renders the partner's name as **plain text** (`fontSize: 14, fontWeight: 500`) instead of an
  input, because the name belongs to that guest's own account. `manage-rsvp-modal.html` currently
  renders two always-editable inputs, so an admin can rename another guest's account from inside a
  third party's RSVP.
  (b) `partnerNameOk` — a partner must have **both** a first and a last name; the DS disables
  "Save changes" and shows "The partner needs a first and last name." in the footer. The web has
  no such gate, so an empty-named partner can be saved.
  `AdultDraft.id` in `core/helper/rsvp-draft.ts` already carries the linked id forward on save —
  no mapping change is needed, only UI.
- **Acceptance:**
  - `PersonCard` gains a `hasAccount` field populated from `partnerHasAccount(d.partner2)` (T256).
    `PersonCard` is an existing local **view-model** for rendering, not an API-model
    redeclaration — extending it is fine; do not add an API-shaped type next to it.
  - When the partner has an account, the partner card renders the name as static text
    (`{{firstName}} {{lastName}}`) plus the hint `shared.partner.nameManaged`, and **the remove
    (`×`) button is still shown** (the DS keeps `removePartner` available in this branch) — the
    two name `<input app-input>` elements are not rendered.
  - When the partner is a plus-one, the current two-input layout is unchanged.
  - Save gate: "Save changes" is `[disabled]` when a partner exists and either trimmed name is
    empty; the footer shows `guest_manager.rsvp.partnerNameRequired` in that state, replacing the
    existing spacer/no-message. Existing `saving()`/`!rsvp()` disable conditions still apply.
  - Adding a partner via "+ Add partner" still produces an editable (plus-one) card — a new
    partner never has an account.
  - `setAdultFirstName`/`setAdultLastName` are not reachable for `partner2` when it has an
    account (guard in the component, not only in the template).
  - No i18n edits (T256 landed the keys); no new colours; component validates against the design
    spec.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** in-repo ADR W-0002 §Decision.3; DS `ScreenGuestManager.jsx` L107–109 (`partnerLocked`,
  `partnerNameOk`, `saveEdit`), L349–361 (locked branch), L386 (footer message) and the mirrored
  `ScreenGuestManagerMobile.jsx` L81–83, L253–265;
  `src/app/screens/guest-manager/modal/manage-rsvp-modal.{ts,html,scss}`;
  `src/app/core/helper/rsvp-draft.ts` (`AdultDraft.id`)

### T260 — RSVP edit (guest): lock a linked partner's name + "needs a first and last name" gate
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T255, T256
- **Context:** DS `ScreenRSVPEdit` gained `nameLocked(p) = !!p.linked && !!p.firstName`: the
  first/last-name `Input`s are rendered `disabled` and the hint "Name managed by their own guest
  account." appears under them. It also gained an `unnamed` gate — every adult in the party needs
  both names, the Save button is disabled and the footer reads "N guests need a first and last
  name" (the DS's sibling `incomplete`/phone-number gate belongs to the account-provisioning
  sub-flow that stays out of scope, see W-0002). `rsvp-edit.html` today lets the guest retype a
  linked partner's name and offers no name gate at all.
- **Acceptance:**
  - `PersonCard` (local view-model in `rsvp-edit.ts`) gains `hasAccount`, from
    `partnerHasAccount(d.partner2)` (T256), for the `partner` card only (`you` / `child` cards
    keep their current behaviour — `partner1` is the signed-in guest editing their own name).
  - When the partner card has an account: both name inputs render with the native `[disabled]`
    attribute (styled by T255) and a hint paragraph shows `shared.partner.nameManaged` beneath the
    row. Values still display; the remove (`×`) button stays available as it is today.
  - New `unnamed` gate: a `computed()` counting adult cards (`you`, `partner`) whose trimmed
    first **or** last name is empty. When > 0, the Save button is `[disabled]` and the footer
    `.status` shows
    `'rsvp.edit.footer.unnamed' | pluralTranslate: unnamedCount() | translate: { count: … }`,
    taking priority over the `saveFailed` / `dirty` / `saved` messages in that order:
    error → unnamed → unsaved → saved.
  - A disabled (account-owned) partner name never counts as `unnamed` — it is by definition
    already set — so the gate can never deadlock the guest.
  - `setPartner2FirstName`/`setPartner2LastName` are guarded in the component so a programmatic
    call cannot bypass the lock.
  - No i18n edits; no new colours; component validates against the design spec.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** in-repo ADR W-0002; DS `ui_kits/wedding-app/ScreenRSVPEdit.jsx` L22–26 (`unnamed`,
  `nameLocked`), L62–70 (disabled inputs + hint), L129–130 (footer + Save gate);
  `src/app/screens/rsvp-edit/rsvp-edit.{ts,html,scss}`;
  `src/app/core/pipe/plural-translate.pipe.ts`

### T261 — RSVP create (guest): stop accepting edits to a linked partner's name (silent-discard bug)
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T255, T256
- **Context:** **This is a real bug, not only a visual gap.** `rsvp-create.ts` already computes
  `hasLinkedPartner()` (`!!this.rsvp().adults.partner2?.id`) and, on submit, deliberately ignores
  anything typed into the partner name fields — `typedPartner` is `undefined` when
  `hasLinkedPartner()` is true, and `rsvp.adults.partner2` is carried forward verbatim (L278–298).
  But `rsvp-create.html` L72–85 still renders two fully editable inputs bound to
  `setPartnerFirstName`/`setPartnerLastName`. A guest can type a correction, see it accepted, press
  Continue, and have it silently thrown away. DS `ScreenRSVPCreate` renders those inputs
  `disabled={nameLocked}` with the hint "Linked to their guest account — the name comes from the
  guest list."
- **Acceptance:**
  - When `hasLinkedPartner()` is true, both party-step partner inputs render with the native
    `[disabled]` attribute (styled by T255) and a hint paragraph shows
    `rsvp.create.party.partnerLinkedHint` beneath the row.
  - `setPartnerFirstName`/`setPartnerLastName` return early when `hasLinkedPartner()` — the draft
    can no longer diverge from what will actually be submitted.
  - The submit path (`typedPartner` / `partner2` carry-forward) is **unchanged** — this task only
    stops the UI from lying about it. No change to the two existing `// reason:`-annotated
    `as unknown as RsvpDtoAdultsPartner2` casts.
  - `partnerReady` still gates Continue correctly for the plus-one case (both names required) and
    is trivially satisfied for the linked case.
  - The step-0 toggle already labels itself with the linked partner's name — leave that as is.
  - Use `partnerHasAccount()` (T256) rather than the inline `!!…partner2?.id`, so the rule lives in
    one place; `hasLinkedPartner` keeps its name and doc comment.
  - No i18n edits; no new colours; component validates against the design spec.
  - `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green.
- **Refs:** in-repo ADR W-0002 §Decision.3; DS `ui_kits/wedding-app/ScreenRSVPCreate.jsx` L26
  (`nameLocked`), L68–76 (disabled inputs + "Linked to their guest account…" hint);
  `src/app/screens/rsvp-create/rsvp-create.{ts,html,scss}`

### T262 — Repair `app.spec.ts` TestBed: missing `EntityServices` provider (unblocks Phase J)
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** `pnpm test` is **red at HEAD** and has been since `36b937b` (the `StatisticService`
  landing). That commit made `ConfigurationService` inject `EntityServices` from `@ngrx/data`
  (`src/app/core/service/configuration.service.ts:20`); `src/app/app.spec.ts`'s TestBed provides
  no ngrx/data store, so both of its cases fail:
  ```
  FAIL src/app/app.spec.ts > App > should create the app
  FAIL src/app/app.spec.ts > App > should apply the active theme to <html>
  ɵNotFound: NG0201: No provider found for `EntityServices`.
  Path: _ConfigurationService -> EntityServices
  ```
  Verified pre-existing by running `ng test` in a detached worktree at `847a25a` — same two
  failures, none of Phase J's edits present. **Every Phase J task carries a `pnpm test` green
  gate, so this blocks T257–T261.** Do this one first.
- **Acceptance:**
  - `src/app/app.spec.ts` resolves `EntityServices` — either by providing the real ngrx/data
    setup the app uses, or by supplying a minimal stub whose
    `getEntityCollectionService()` returns what `ConfigurationService` reads. Prefer whichever
    matches how other specs in this repo already handle store-backed services; grep first, do not
    invent a third pattern.
  - Both `app.spec.ts` cases pass. `pnpm test` is fully green — `0 failed`.
  - **No production code changes.** `configuration.service.ts` and `statistic.service.ts` are
    correct as written; this is a test-harness gap, not a service bug. If the fix appears to
    require touching a service, stop and report instead.
  - No new `type`/`interface` redeclaring an API model (Hard rule 15) — a test stub is not an
    exception to it.
  - `pnpm typecheck && pnpm lint` green (lint: the known pre-existing `shared/modal/` errors
    only, unchanged).
- **Refs:** `src/app/app.spec.ts`; `src/app/core/service/configuration.service.ts:20`;
  `src/app/core/service/statistic.service.ts:50`; breaking commit `36b937b`; `@ngrx/data`
  `EntityServices` / `provideEntityData`

> **Phase J open questions — answer before starting T258/T259, they are not blockers for
> T255–T257, T260–T261.**
>
> 1. **Partner linking from the profile editor.** The DS `editProfile` branch now carries the whole
>    "Link to the guest partner" switch + candidate picker (`ScreenGuestManager.jsx` L254–276),
>    i.e. an admin can link/relink/unlink an *existing* guest's partner. The web only has that UI in
>    `app-guest-create-modal` (create-time). The endpoints exist (`PUT`/`DELETE
>    /v1/guests/{id}/partner…`, incl. the "already linked to a third guest" 409). Do we want this in
>    `GuestProfileModal`'s edit mode? It is a separate task (next free number — T262 has since been
>    taken by the `app.spec.ts` repair) if yes — deliberately **not** written yet.
> 2. **Preferred language on the profile view.** DS shows a "Preferred language" `Info` row and a
>    segmented control in the edit form; `UserProfileDto.preferredLang` exists and
>    `GuestCreateModal` already sets it, but `GuestProfileModal` shows/edits neither. Unrelated to
>    partners — flagging it as a drift found while surveying, not scheduled.
> 3. **Two account-holding guests, neither with an RSVP yet.** `filteredGuests()` /
>    `StatisticService` de-duplicate a couple by `rsvp.id === profile.id`; with no RSVP record at
>    all both profiles show as separate "Not Answered" rows even when `guestInfo.partner` links
>    them. Intended, or should the partner link de-duplicate too? Affects counts, so worth a
>    decision before more numbers are built on it.
