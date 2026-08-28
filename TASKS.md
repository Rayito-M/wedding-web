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
- **Status:** done (`18c12c1`) — **ships a known WCAG 2.1 AA violation, accepted by the user.**
  The account-partner name uses `--brand-accent` on `--surface-card` at 12px/500: 3.51:1
  (terracotta), 3.05:1 (mauve), **2.50:1 (verdeagua)** against the 4.5:1 threshold. Inherent to
  the token pairing this task and ADR W-0002 prescribe — any implementation fails identically —
  and it contradicts CLAUDE.md Hard rule 14. No exemption argument applies (unlike T255's
  `:disabled` half). Real fix is a darker accent-on-surface alias in `../wedding-ui-design`.
  Tracked, unresolved. The colour-alone criterion (1.4.1) **is** satisfied via an sr-only suffix.
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
- **Status:** done (`0c01a25`). Two discrepancies found and **flagged rather than decided**:
  (a) **this task's own text is wrong about the DS** — it says "after Phone and before Table
  (DS ordering)", but `ScreenGuestManager.jsx` L294 puts Partner *after* Table. The task text was
  followed as authoritative; flip it if DS fidelity matters more. (b) The DS renders `'Unnamed'`
  for a partner with no name; no such i18n key exists and this task forbade adding one, so a
  nameless partner currently renders as `" · plus-one"` with a leading space. Cosmetic, real.
  Also noted in passing: `guest-profile-modal.ts` L27–28 carries the local `RelationSide` /
  `RelationKind` unions — already the seed instances tracked by **T254**, left alone.
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
- **Status:** done (`154378e`). Closes the permissions leak: an admin editing one guest's RSVP
  could rename a *different* guest's account. Three notes, all flagged rather than decided:
  (a) **`partnerNameOk` deliberately does not exempt an account-holding partner, unlike T260's
  `unnamedCount`.** This task's text and the DS both gate on "a partner exists and either trimmed
  name is empty". Consequence: an account-holding partner with a blank name would present a gate
  the admin cannot satisfy from this screen, since the inputs are gone. Harmless if account
  creation always requires both names — worth confirming, and worth harmonising the two screens
  deliberately rather than by accident. (b) DS specifies `fontSize: 14` for the locked name; no
  14px token exists (`--text-body` 13, `--text-body-lg` 15), so the existing `.person-name`
  (13px/500) was reused rather than hardcoding or inventing a token. 1px off the mock.
  (c) `.name-hint` is now declared in both `rsvp-edit.scss` (T260) and here with identical rules
  — see the consolidation note on T260.
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
- **Status:** done (`bab91fe`). All criteria met. Note: `.name-hint` is now the **5th** local copy
  of the hint pattern (`rsvp-create.scss`, `config-manager.scss`, `album.scss`,
  `guest-create-modal.scss` `.partner-hint`) — there is no `%hint` primitive in
  `src/styles/_primitives.scss`. Consolidation candidate; a `web-css-auditor` sweep would find it.
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
- **Status:** done (`1892d5a`). The silent-discard bug is fixed. Reused the existing `.hint` class
  rather than adding a sixth copy. The `pnpm test:e2e` criterion was dropped as unmeetable — see
  T263.
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
  - `pnpm typecheck && pnpm lint && pnpm test` green. (This criterion originally also demanded
    `pnpm test:e2e`; that script has never existed in this repo — see T263. Dropped as unmeetable.)
- **Refs:** in-repo ADR W-0002 §Decision.3; DS `ui_kits/wedding-app/ScreenRSVPCreate.jsx` L26
  (`nameLocked`), L68–76 (disabled inputs + "Linked to their guest account…" hint);
  `src/app/screens/rsvp-create/rsvp-create.{ts,html,scss}`

### T262 — Repair `app.spec.ts` TestBed: missing `EntityServices` provider (unblocks Phase J)
- **Status:** done. `pnpm test` is green again (`13 passed`, 0 failed). Fixed with the **real**
  ngrx/data wiring mirroring `app.config.ts:64–69`, not a stub, so `App` keeps exercising the
  actual `ConfigurationService` loading/error signals. `provideHttpClientTesting()` was added
  alongside: wiring the real effects means the constructor's `load()` now genuinely reaches
  `HttpClient`, and without a testing backend jsdom would fire a live XHR at
  `environment.apiBaseUrl` during unit tests. Note for future specs: this repo had **no**
  prior TestBed pattern for store-backed services — `app.spec.ts` is now the reference.
  T257–T261 are unblocked.
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

### T263 — Stand up the Playwright e2e suite (the gate CLAUDE.md has always promised)
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** CLAUDE.md listed Playwright under **Testing** and Hard rule 11 required
  `pnpm test:e2e` to pass before merging — but the suite has never existed: no `test:e2e` script
  in `package.json`, no `@playwright/test` dependency, no `playwright.config.*`, no `e2e/`
  directory. Every task written against that rule inherited an unmeetable criterion (caught on
  T261, which met every other criterion). CLAUDE.md has since been corrected to say the suite
  does not exist and to point here; this task makes the promise true. The unit runner, for the
  record, is **Vitest** via `ng test` — CLAUDE.md previously said Jasmine, also wrong, also fixed.
- **Acceptance:**
  - `@playwright/test` added as a dev dependency; `playwright.config.ts` at the repo root;
    `"test:e2e": "playwright test"` in `package.json`.
  - Config starts the app itself (`webServer` running `pnpm start`) so the suite is one command
    from a cold checkout, and targets the browsers CLAUDE.md rule 4 names: mobile Safari (iPhone
    SE / 12 / 14 viewports) and current Chrome Android, mobile-first.
  - At least one **real** smoke spec that would fail if the app were broken — e.g. the app boots,
    the welcome screen renders, and the language switcher changes rendered copy. No placeholder
    or always-true assertions.
  - The suite must not depend on a live `wedding-api`: either stub network at the Playwright
    layer (`page.route`) or document precisely what must be running. A suite that only passes on
    the author's machine is worse than none.
  - `pnpm test:e2e` passes from a clean checkout after `pnpm install`.
  - CI note: if no CI workflow runs it yet, say so explicitly in the PR rather than implying
    coverage that does not exist.
  - Once green, restore `pnpm test:e2e` to CLAUDE.md Hard rule 11 and the Commands list in the
    **same** commit.
  - `pnpm typecheck && pnpm lint && pnpm test` still green.
- **Refs:** CLAUDE.md Hard rule 11 + Testing/Commands (both amended by this task's sibling commit);
  CLAUDE.md rule 4 (target browsers); `package.json`; T261's report (where the gap surfaced)

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

## Phase K — One shared RSVP editor (DS `RSVPEditor`, in-repo ADR W-0003)

> The design system extracted `ui_kits/wedding-app/RSVPEditor.jsx` (commit `a2ce7cf`, refined by
> `f26c721`) and rewired **every** screen that edits an RSVP onto it — `ScreenRSVPEdit` (the
> guest's own reply) and `ScreenGuestManager` / `ScreenGuestManagerMobile` (the couple managing
> someone else's). Its own header comment: *"One RSVP editor, used everywhere an RSVP is edited …
> The only thing that varies is `perspective` — who is filling it in — which drives section titles
> and copy."*
>
> This repo built the two editors independently and they have drifted: accordion cards vs. flat
> cards under group headings, allergies as **free text** on the guest side vs. **catalog chips** on
> the couple side (so an allergy entered on one surface is invisible on the other), two copies of
> every draft mutation, two SCSS files restating the same chip/card/remove/add vocabulary under
> different class names. Phase K collapses them into one `app-rsvp-editor`.
>
> **Read `docs/decisions/W-0003-shared-rsvp-editor.md` first** — it pins the component boundary,
> the `perspective` union, the allergy unification, and (importantly) what of `RSVPEditor` is
> deliberately **not** built: phone/email fields, the "Own account & invitation" toggle, the
> roster lookup + "Link account" card, and the `needPhone` validation. Those stay out for exactly
> the reasons ADR W-0002 §"Explicitly not decided" already records — no endpoints exist and
> guest-initiated account provisioning is a hub question. An implementer who ports them from the
> JSX is out of scope, not thorough.
>
> **No contract change, no hub escalation, no `pnpm gen:api`.** Both fields the allergy
> unification needs (`allergyIds`, `customAllergies`) already exist on the generated
> `RsvpDtoAdultsPartner1Options`.
>
> **Repo-shape note (the DS layout does not map 1:1):** there is no `src/app/features/` in this
> repo — screens live in `src/app/screens/`, shared components in `src/app/shared/<name>/`. And
> the DS's desktop/mobile split (`ScreenGuestManager` + `ScreenGuestManagerMobile`) does **not**
> exist here: `screens/guest-manager/` is one responsive component and the couple's editor is one
> modal, `modal/manage-rsvp-modal.*`. Do not go looking for a second mobile file — T267 is the
> whole couple-side migration, desktop and mobile.
>
> Sequence: T264 (foundation: keys + validation helper) → T265 (build the component) → T266 and
> T267 (the two migrations; independent of each other, both depend on T265) → T268 (dead-key and
> duplication sweep, after both). T264 lands **all** new i18n keys in one commit so T265–T267
> never touch `public/i18n/*.json` and cannot conflict there — same discipline as T256.

### T264 — Foundation: `rsvp.editor.*` i18n keys + shared unnamed-adult validation helper

- **Status:** done (uncommitted) — 2026-08-22. `rsvp-draft.ts` + new `rsvp-draft.spec.ts`;
  37 new keys (`rsvp.edit.title` + 36 under `rsvp.editor`) added to all three i18n files, purely
  additive, key sets identical. Verified: typecheck clean, 18/18 tests pass, lint shows only the
  4 known `shared/modal/` errors, `gen:api:check` no drift.
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** The shared editor needs a copy namespace of its own (it belongs to neither the
  `rsvp.edit.*` nor the `guest_manager.rsvp.*` tree) and both hosts need the *same* "someone still
  needs a name" gate, which today exists twice with two different rules: `RsvpEdit.unnamedCount`
  (counts every adult, correctly excluding a partner whose name is locked) and
  `ManageRsvpModal.partnerNameOk` (a boolean, partner only). ADR W-0003 §Decision.7 picks the
  guest's rule. This task lands both foundations and touches **no template** — the keys and the
  helper land unused, consumed by T265–T267.
- **Acceptance:**
  - `src/app/core/helper/rsvp-draft.ts` exports one new function
    `unnamedAdultCount(draft: RsvpDraft): number`, counting adults (`partner1`, `partner2`) whose
    trimmed `firstName` or `lastName` is empty, **excluding `partner2` when
    `partnerHasAccount(draft.partner2)` is true** (their name is read-only — ADR W-0002
    §Decision.3). The exclusion applies to `partner2` **only**: `partnerHasAccount()` is a
    non-empty-`id` check, and `partner1` is the signed-in guest, so it is always true for them —
    excluding `partner1` would drop the main guest from their own name gate and contradict the
    required case below. This matches today's guest rule, which hard-codes `hasAccount: false`
    for the primary card (`rsvp-edit.ts:128`). Children are never counted. Reachable from
    `@app/core`. **No new `type`/`interface`** is declared.
    *(Corrected 2026-08-22: the first draft of this criterion said "any adult", which was wrong
    for `partner1`; caught during T264 implementation.)*
  - Unit spec covering: empty party → 0; `partner1` missing a last name → 1; a plus-one `partner2`
    with neither name → counted; an account-holding `partner2` with an empty name → **not**
    counted; children with no name → 0.
  - New keys in **all three** `public/i18n/{en,es,fr}.json`, under a new `rsvp.editor` block,
    keeping each file's existing style and ordering: `attendingLabel`;
    `choice.{attending,pending,declined}`; `total` (`"Total: {{count}}"`); `kind.{partner,child}`;
    `person.{newGuest,meal,allergies,noMealDetails,yearsOld,allergiesSummary,firstNamePlaceholder,lastNamePlaceholder,agePlaceholder}`;
    the custom-allergy entry set `person.customAllergy.{label,placeholder,remove}` — placeholder
    in the "type and press Enter…" register, `remove` an `aria-label` taking the entry as a
    parameter (e.g. `"Remove {{name}}"`) — replacing the single-field `allergyNotePlaceholder`
    (open question 3, decided 2026-08-22: multi-entry chips, see T265);
    `unnamed.{none,singular,plural}` (plural set for `PluralTranslatePipe`).
  - Per-perspective copy under
    `rsvp.editor.perspective.<p>.{party,primaryHint,partyMeta,note,notePlaceholder,addPartner,addChild}`
    — all **seven** strings the DS `RSVP_PERSPECTIVE` table carries (`RSVPEditor.jsx` L10–15) —
    for exactly **two** perspectives, `owner` and `couple` (ADR W-0003 §Decision.3 — `partner` and
    `delegate` are not added until a call site exists). English values come verbatim from that
    table:
    - `party` (the **section title**, the string this whole DS change exists to make
      context-driven): owner "Your party" / couple "The party", verbatim from the DS table.
      Reuse the existing es/fr wording already shipped for `rsvp.edit.titleAttending` ("Your
      party") rather than inventing a second phrasing for the same two words — that key is
      retired in T268 and its translations move here.
    - `primaryHint`: owner "You" / couple "Main guest"
    - `partyMeta`: owner "Party · dietary & allergies" / couple "Participants · dietary & allergies"
    - `note`: owner "A note for us (optional)" / couple "Note from guest"
    - `notePlaceholder`: owner "A song to dance to, a memory…" / couple "No note left." — for
      the couple this is now an **empty state**, not an input placeholder (open question 2,
      decided 2026-08-22: the note is read-only for the couple, see T265)
    - `addPartner`: owner "+ Add my partner" / couple "+ Add partner"
    - `addChild`: owner "+ Add a child" / couple "+ Add child"
    es/fr must agree in register with each file's existing voice. The existing es/fr for
    `rsvp.edit.titleAttending` already translates "Your party" — reuse that exact wording for
    `perspective.owner.party` rather than inventing a second phrasing for the same two words
    (subject to open question 4).
  - **Guest page headline collapses to one key** (open question 4, decided 2026-08-22 — the
    editor owns the section heading, so the host `<h2>` becomes the screen-level title):
    add `rsvp.edit.title` = **"Your reply"**, one value for *both* the attending and declined
    states. Its es/fr values are the ones already shipped for `rsvp.edit.titleDeclined`, whose
    English is already "Your reply" — copy them across verbatim, no new translation needed.
    `titleAttending`/`titleDeclined` are **not** deleted here (T268 sweeps them) and
    `declinedSub` is **unchanged**. There is deliberately no status-driven variant: the eyebrow
    (`rsvp.edit.eyebrow`, "CONFIRMED") and the `seatsHeld`/`declinedSub` subtitle already carry
    the status, and only two states are reachable anyway — `screens/rsvp/rsvp.html:3` renders
    `app-rsvp-edit` only when `isDecided()`.
  - Any en string **not** taken verbatim from the DS table is a proposal in the DS
    voice** (sentence case, direct address, no emoji — `../wedding-ui-design/README.md`
    §"Content fundamentals"), not settled copy: get the user's confirmation on the English before
    commissioning es/fr, since a re-word after translation costs three files twice.
  - es/fr are real translations, not English placeholders; the three files stay structurally
    identical (same key set). Existing keys are **not** deleted here — the sweep is T268.
  - `pnpm typecheck && pnpm lint && pnpm test` green; `pnpm gen:api:check` still clean.
- **Refs:** in-repo ADR W-0003 §Decision.4, §Decision.7; ADR W-0002 §Decision.3; DS
  `ui_kits/wedding-app/RSVPEditor.jsx` (`RSVP_PERSPECTIVE` L10–15, `rsvpIssues` L34–47);
  `src/app/core/helper/{rsvp-draft.ts,partner-account.ts,index.ts}`;
  `src/app/core/pipe/plural-translate.pipe.ts`; `public/i18n/{en,es,fr}.json`

### T265 — Build the shared `app-rsvp-editor` component (no call sites yet)

- **Status:** done (uncommitted) — 2026-08-22. New `src/app/shared/rsvp-editor/rsvp-editor.{ts,
  html,scss,spec.ts}` (~1,230 lines); imported by no screen, as designed. Verified: nothing
  outside the new directory was touched, all 18 referenced i18n keys exist, no local type is
  exported and none restates an API model, no inline template/styles, no hex/raw-role tokens/
  `prefers-color-scheme`; typecheck clean, 28/28 tests pass, lint shows only the 4 known
  `shared/modal/` errors.
- **Owner:** agent (implementer)
- **Depends on:** T264
- **Context:** The DS component is `RSVPEditor.jsx` — read it end to end before starting, then
  read ADR W-0003 for what is excluded. This task builds the component and nothing else: it is
  imported by no screen when the PR lands, which keeps the migration diffs (T266/T267) readable.
  Compose the existing shared primitives — `app-avatar`, `app-pill`, `app-choice-card`,
  `input[app-input]` (already has the T255 disabled state), `textarea[app-textarea]` — do not
  re-author them.
- **Acceptance:**
  - New three-file component `src/app/shared/rsvp-editor/rsvp-editor.{ts,html,scss}`, standalone,
    `ChangeDetectionStrategy.OnPush`, selector `app-rsvp-editor`. No inline `template:`/`styles:`,
    no `style` attribute, no `ngStyle` (CLAUDE.md rules 1–2).
  - Public API is exactly: `draft = input.required<RsvpDraft>()`,
    `perspective = input<…>('owner')` typed by a local `'owner' | 'couple'` union,
    `showStatus = input(false)`, `noteReadonly = input(false)`, and
    `draftChange = output<RsvpDraft>()` emitting a new `RsvpDraft` on every edit. No `roster`, no
    `showNote`, no `showAdd` (ADR W-0003 §Decision.6 and §"Explicitly out of scope"); no
    `onOpenProfile` **in this task** — it arrives with T269. The component performs **no** HTTP
    write and holds no dirty/saved state — the host saves.
  - Renders, in DS order: the attendance row (three `app-choice-card`s, only when `showStatus()`);
    the party **section heading** from `rsvp.editor.perspective.<p>.party`; the party meta line —
    `rsvp.editor.perspective.<p>.partyMeta` left, `rsvp.editor.total` right;
    one accordion card per participant (`partner1`, `partner2` if present, then each child), the
    first expanded by default, expansion state internal; the add-partner (hidden when `partner2`
    exists) and add-child links; and the note.
  - **The note honours `noteReadonly()`** (open question 2, decided 2026-08-22 — the couple must
    not be able to overwrite words a guest wrote to them). False (the guest): a
    `textarea[app-textarea]` bound to `partner1.options.comments` with
    `rsvp.editor.perspective.owner.notePlaceholder`. True (the couple): the note renders as
    **static text, not a disabled input** — no textarea in the DOM, nothing focusable — and when
    `comments` is empty the empty state `rsvp.editor.perspective.couple.notePlaceholder` ("No
    note left.") shows in the muted text style. This is a documented, deliberate deviation from
    the DS, which makes the couple's note editable. `noteReadonly()` never suppresses the note
    itself — the couple always *sees* it.
  - Each expanded card shows: first/last name inputs (child: first name + a 2-digit numeric age
    field), a remove control for everyone except `partner1`, diet chips, allergy chips, and a
    custom-allergy entry field — catalog chips from `WeddingConfigResponseDto.dietaryPreferences`
    / `.allergies` resolved to the current language, writing `options.dietaryPreferenceIds` /
    `options.allergyIds`. The collapsed card shows avatar, name (or
    `rsvp.editor.person.newGuest`), a role `app-pill`, and the DS summary line (age · diets ·
    allergies, else `noMealDetails`).
  - **Custom allergies are multi-entry** (open question 3, decided 2026-08-22 — this *replaces*
    the single free-text field both surfaces have today, and supersedes ADR W-0003 §Decision.5):
    a text input where Enter (and blur on a non-empty value) commits the trimmed text as its own
    chip, each chip individually removable, writing `options.customAllergies` as a **real
    multi-element array**. Empty and whitespace-only entries are ignored; a duplicate of an
    existing entry on the same person is ignored (case-insensitive, trimmed) rather than added
    twice. Committing an entry must not submit the surrounding form. Existing single-element
    `customAllergies` data renders as one chip, no migration needed.
  - Custom-allergy chips are visually distinguishable from catalog allergy chips — a catalog chip
    is a toggle (`aria-pressed`), a custom chip is a removable entry (its own `aria-label` from
    `rsvp.editor.person.customAllergy.remove`) — so the two are not mistaken for one control.
  - The party section heading is a **real heading element**, not a styled `div` — semantic level
    chosen to fit the host's outline (the guest screen's `<h2>` and the modal's title are both
    level 2, so `<h3>` here), so the section is reachable by heading navigation (CLAUDE.md rule
    14). It is the *only* place either surface names the party section: the couple's
    `You` / `Partner` / `Children` group headings do not come back — the per-card role pill
    replaces them (ADR W-0003 §Consequences).
  - The role pill reads `rsvp.editor.perspective.<p>.primaryHint` for `partner1` and
    `rsvp.editor.kind.{partner,child}` otherwise — so the same card reads "You" for a guest and
    "Main guest" for the couple, with **no** English literal anywhere in the template and no
    perspective `switch` returning strings in TypeScript.
  - Name lock (ADR W-0002 §Decision.3) is preserved: when `partnerHasAccount()` is true the two
    name inputs render as static text with the `shared.partner.nameManaged` hint, and the
    corresponding setters return early so a programmatic call cannot rename another guest's
    account. Remove is still allowed.
  - The component owns its catalog read (the singleton `WeddingConfigResponseDto` collection,
    `getByKey('')` — the identical read both hosts do today) so the hosts can drop theirs. Any
    internal view type (person card, resolved catalog option) stays **private to this file**, is
    not exported, and restates no API model — `RsvpDto`, `RsvpDtoAdultsPartner1Options` and the
    `RsvpDraft` family are imported (Hard rule 15).
  - Styling from `src/styles/_tokens.scss` semantic aliases only — no hex, no raw
    `--accent`/`--sub`/`--line`, no `@media (prefers-color-scheme: …)`, no new breakpoint. Cards
    stay flat (1px `--border-hairline`, no shadow). Chip markup stays internal to this component —
    do **not** add a shared `app-chip-toggle` (ADR W-0003 §Decision.8).
  - Accessibility: every chip is a `type="button"`; **catalog** chips (diet, allergy) are toggles
    carrying `aria-pressed`, while a **custom-allergy** chip is a remove control carrying an
    `aria-label` and **no** `aria-pressed` — a toggle state on a delete control would be an a11y
    defect. *(Corrected 2026-08-22: the first draft said "every chip carries `aria-pressed`",
    contradicting the custom-chip criterion above it; caught during T265 implementation.)*
    The card header
    carries `aria-expanded`; the remove control carries `aria-label` from `shared.remove`;
    keyboard-operable throughout (CLAUDE.md rule 14).
  - Unit spec covering at least: the participant total tracks the draft; toggling a diet chip
    emits a `draftChange` with that id added and the original draft object untouched; an
    account-holding `partner2` renders no name input; `showStatus()` false renders no attendance
    row; the `owner` and `couple` perspectives request different `party`/`primaryHint`/`partyMeta`
    keys, and the rendered heading text differs between the two; `noteReadonly()` true renders no
    `textarea` and shows the empty state when `comments` is blank; committing two custom allergies
    yields a two-element `customAllergies` array, a duplicate is ignored, and removing the first
    leaves the second.
  - Component validates against the design spec (`../wedding-ui-design/ui_kits/wedding-app/RSVPEditor.jsx`);
    exclusions listed in ADR W-0003 are absent by design, not by omission.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** in-repo ADR W-0003; ADR W-0002 §Decision.3–4; DS `RSVPEditor.jsx`;
  `src/app/shared/{avatar,pill,choice-card,input,textarea}/`;
  `src/app/core/helper/{rsvp-draft.ts,partner-account.ts}`; `src/styles/_tokens.scss`;
  existing implementations to mine (then delete in T266/T267):
  `src/app/screens/rsvp-edit/rsvp-edit.{ts,html,scss}`,
  `src/app/screens/guest-manager/modal/manage-rsvp-modal.{ts,html,scss}`

### T266 — Migrate the guest screen (`app-rsvp-edit`) onto `app-rsvp-editor`

- **Status:** done (uncommitted) — 2026-08-22. **44 insertions, 590 deletions** across
  `rsvp-edit.{ts,html,scss}` (382→124, 174→50, 274→110) plus a new `rsvp-edit.spec.ts`. Verified:
  the shared component, i18n files and `TASKS.md` were not touched; `<h2>` reads the single
  `rsvp.edit.title`; editor bound `perspective="owner"` with no `showStatus`/`noteReadonly`;
  `titleAttending`/`titleDeclined` still present for T268. One new SCSS rule
  (`app-rsvp-editor { margin-top: 22px }`) carries the deleted `.cards` spacing.
  **Not verified by the agent:** hand-check at mobile/desktop widths in all three themes — no
  browser available; needs a human pass on `pnpm start`.
- **Owner:** agent (implementer)
- **Depends on:** T265
- **Context:** `ScreenRSVPEdit.jsx` is now 55 lines: a header, `<RSVPEditor perspective="owner">`,
  "Change my answer", and a footer whose message comes from the shared validation helper. This
  task makes `app-rsvp-edit` the same shape. It is a net **deletion** — roughly 180 lines of TS,
  110 of template and 150 of SCSS move into the component built by T265. The guest gains catalog
  allergy chips alongside the custom-allergy entry field, and that field becomes multi-entry
  (open question 3); both are expected, not regressions.
- **Acceptance:**
  - `rsvp-edit.html` renders the header, `<app-rsvp-editor [draft]="draft()" perspective="owner"
    (draftChange)="onDraftChange($event)" />` (no `showStatus`), the "Change my answer" button and
    the footer. The editor is still not rendered for a `declined` RSVP — that stays a host decision.
  - `rsvp-edit.ts` keeps only: the `rsvp` input, the draft signal and its resync `effect`, the
    header `effect`, `dirty`/`saving`/`saveFailed`, `save()`, `onChangeAnswer()`, `seatsHeld` and
    the footer message. **Deleted**: `PersonCard`, `PersonKind`, `cards`, `unnamedCount`,
    `openKey`/`isOpen`/`toggleOpen`, `kindLabelKey`, `fullName`, `initial`, `dietLabel`,
    `allergiesText`, `summaryFor`, every per-person setter, `toggleDiet`, `setAllergies`,
    `setNote`, `noteText`, `canAddPartner`, `addPartner`, `addChild`, `removePerson`,
    `updateOptions`, `childIndex`, `inputValue`, the `weddingConfig`/`dietaryOptions` catalog read
    and the now-unused imports (`Avatar`, `Pill`, `TextInput`, `TextareaInput`,
    `TranslateLanguageService`, `WeddingConfigResponseDto`, `partnerHasAccount`,
    `withPersonOptions`, …).
  - The footer gate now uses `unnamedAdultCount(draft())` (T264) with
    `rsvp.editor.unnamed.*` via `PluralTranslatePipe`; save stays disabled while it is > 0 and the
    saved / unsaved / error states are unchanged.
  - `rsvp-edit.scss` keeps only host layout, header, "Change my answer", footer and the desktop
    card wrapper. **Deleted**: `.cards`, `.card`, `.card-head`, `.info`, `.name-row`, `.name`,
    `.summary`, `.chevron`, `.card-body`, `.row`, `.name-hint`, `.remove-btn`, `.label`,
    `.options-label`, `.diet-chips`, `.chip`, `.add-row`, `.add-link`, `.note-label` and the
    `textarea[app-textarea]` rule.
  - The party section heading now comes from the editor
    (`rsvp.editor.perspective.owner.party`) — assert the rendered text, not just the binding.
  - **The host `<h2>` becomes the screen-level title** (open question 4, decided 2026-08-22):
    it renders the single key `rsvp.edit.title` ("Your reply") in **both** the attending and
    declined states, so the `@if`/ternary that chose between `titleAttending` and `titleDeclined`
    for the heading is **deleted**. The section heading "Your party" now belongs to the editor.
    Verify in the running app that "Your party" appears exactly **once** on the guest screen.
    `declinedSub`, `seatsHeld` and the eyebrow are unchanged and still carry the status. This
    task changes no i18n file — T264 added `rsvp.edit.title`.
  - The two headings are distinct strings and neither repeats the other: the host says which
    record this is ("Your reply"), the editor labels the list below it ("Your party") — they
    answer different questions (ADR W-0003 §Decision.9).
  - Behaviour verified by hand at mobile and desktop widths in all three themes: expanding a card,
    editing names, toggling diet and allergy chips, typing the free-text allergy, adding/removing a
    partner and a child, the note, and a successful save round-trip; a locked partner's name is
    still read-only with its hint.
  - No new local type; no hardcoded colour/spacing/radius; no `pnpm gen:api` (the DTO is unchanged).
  - `pnpm typecheck && pnpm lint && pnpm test` green (lint: the known pre-existing
    `shared/modal/` errors only, unchanged).
- **Refs:** in-repo ADR W-0003 §Decision.2; DS `ui_kits/wedding-app/ScreenRSVPEdit.jsx`;
  `src/app/screens/rsvp-edit/rsvp-edit.{ts,html,scss}`; `src/app/screens/rsvp/rsvp.html`
  (call site — should need no change)

### T267 — Migrate the couple's manage-RSVP modal onto `app-rsvp-editor` (desktop + mobile)

- **Status:** done (uncommitted) — 2026-08-22. **48 insertions, 618 deletions** across
  `manage-rsvp-modal.{ts,html,scss}` (399→175, 229→52, 188→25) and `_shared-modal-form.scss`
  (pruned `.choice-row`, verified no other consumer referenced it), plus a new
  `manage-rsvp-modal.spec.ts`. Bound `perspective="couple" [showStatus]="true"
  [noteReadonly]="true"`; `.group-label` headings gone; footer gate moved to
  `unnamedAdultCount()`. Verified: shared component, i18n and `rsvp-edit/` untouched;
  `src/environments/release.ts`, regenerated as a side effect of one `pnpm build`, was reverted
  to its committed value. **Not verified by the agent:** hand-check at mobile/desktop widths in
  all three themes — no browser available.

> **Post-T266/T267 combined verification (coordinator, 2026-08-22):** both migrations together are
> **92 insertions / 1,208 deletions**. `pnpm typecheck` clean, `pnpm test` 35/35 across 7 files,
> `pnpm lint` shows only the 4 known `shared/modal/` errors. No collision between the two parallel
> agents: each stayed inside its own screen directory.
- **Owner:** agent (implementer)
- **Depends on:** T265
- **Context:** `ScreenGuestManager` and `ScreenGuestManagerMobile` both now render
  `<RSVPEditor perspective="couple" showStatus roster=… onOpenProfile=… />` in their edit branch —
  in this repo that is the single responsive `app-manage-rsvp-modal` (there is no separate mobile
  component), and `roster`/`onOpenProfile` are out of scope per ADR W-0003. **This is a visible UI
  change on the couple side**: flat always-open cards under `You` / `Partner` / `Children`
  headings become the same accordion the guest sees, with the role pill replacing the headings
  (ADR W-0003 §Consequences). The couple gains the multi-entry custom-allergy field (open
  question 3) and **loses the ability to edit the guest's note**, which becomes read-only on this
  surface (open question 2) — both are deliberate. Independent of T266;
  if both are in flight, expect no file overlap beyond `public/i18n/*.json`, which T264 already
  froze.
- **Acceptance:**
  - `manage-rsvp-modal.html`'s body is `<app-rsvp-editor [draft]="draft()" perspective="couple"
    [showStatus]="true" [noteReadonly]="true" (draftChange)="onDraftChange($event)" />` plus the existing
    "no RSVP yet" empty state and the save-failed alert. Modal chrome (`app-modal`, eyebrow,
    `app-decor-fish`, footer buttons) is untouched.
  - `manage-rsvp-modal.ts` keeps only: `open()`/`close()`/`goBack()`, the `userId` signal, the
    `rsvp` lookup and resync `effect`, `draft`, `saving`/`saveFailed`, `save()`, `guestFullName`,
    `modalTitle` and the footer message. **Deleted**: `PersonKind`, `PersonCard`, `CatalogOption`,
    `cards`, `partnerCard`, `childCards`, `mainCard`, `participantsCount`, `partnerNameOk`,
    `statuses`, `setStatus`, `isStatus`, every per-person setter, `toggleDiet`, `toggleAllergy`,
    `setNote`, `noteText`, `addPartner`, `removePartner`, `addChild`, `removeChild`,
    `childIndex`, `inputValue`, `toCatalog`, the `weddingConfig` catalog read and the now-unused
    imports (`NgTemplateOutlet`, `ChoiceCard`, `TextInput`, `TextareaInput`,
    `TranslateLanguageService`, `WeddingConfigResponseDto`, `partnerHasAccount`,
    `toggleOptionId`, `withPersonOptions`, …).
  - The footer gate switches from `partnerNameOk()` to `unnamedAdultCount(draft()) === 0` (T264),
    with the message from `rsvp.editor.unnamed.*` via `PluralTranslatePipe`. This is a deliberate
    widening: the main guest's own missing name now blocks the save too, and an account-holding
    partner no longer can (their name is read-only). Save still disabled while the gate is unmet.
  - `manage-rsvp-modal.scss` keeps only `.footer-note`, `.summary-empty`, `.form-error` and any
    remaining modal-body spacing. **Deleted**: `.rsvp-section`, `.section-head`, `.section-title`,
    `.section-count`, `.group-label`, `.person-card`, `.person-head`, `.person-name`,
    `.person-role`, `.person-fields`, `.child-fields`, `.locked-fields`, `.name-hint`,
    `.remove-btn`, `.add-link`, `.pill-label`, `.pill-row`, `.pill-toggle`, `.pill-empty`,
    `.choice-row`. If `_shared-modal-form.scss` is left with rules only this file used, prune them
    in the same PR.
  - The party section heading now comes from the editor and reads **"The party"**
    (`rsvp.editor.perspective.couple.party`) — assert the rendered text. It replaces both the
    old `guest_manager.rsvp.participantsSection` title and the `You` / `Partner` / `Children`
    group headings; no heading is duplicated against the modal's own title (the guest's name).
  - Verified by hand at mobile and desktop widths in all three themes: open a guest profile →
    Manage RSVP, change the attendance answer, expand/collapse participants, edit names and ages,
    toggle diet and allergy chips, type a free-text allergy, add/remove a partner and a child,
    edit the note, save, and confirm the list row and `StatisticService` counts update; "Back"
    still returns to the profile modal.
  - Existing guest-manager behaviour is otherwise unchanged — one row per couple, counts still
    from `StatisticService`, no change to `guest-manager.{ts,html,scss}` beyond imports if any.
  - No new local type; no hardcoded colour/spacing/radius; no `pnpm gen:api`.
  - `pnpm typecheck && pnpm lint && pnpm test` green (lint: the known pre-existing
    `shared/modal/` errors only, unchanged).
- **Refs:** in-repo ADR W-0003 §Decision.2, §Consequences; DS
  `ui_kits/wedding-app/ScreenGuestManager.jsx` (edit branch, L303–315) and
  `ScreenGuestManagerMobile.jsx` (L208–219);
  `src/app/screens/guest-manager/modal/manage-rsvp-modal.{ts,html,scss}`,
  `src/app/screens/guest-manager/modal/_shared-modal-form.scss`,
  `src/app/screens/guest-manager/guest-manager.html` (L267, call site — should need no change)

### T268 — Phase K sweep: retire the orphaned i18n keys and prove the duplication is gone

- **Status:** done (uncommitted) — 2026-08-22. **30 leaf strings removed per locale** across 17
  subtrees, each grep-verified dead (0 references in `src/`, specs included) before deletion. The
  `children` trap fired exactly as predicted: `guest_manager.rsvp.{you,partner}` were dead and
  went, `guest_manager.rsvp.children` is still used by `guest-profile-modal.html:103` and stayed.
  Dynamic key construction audited — no concatenated/interpolated key reaches a deleted namespace.
  Verified independently by the coordinator: all three files valid JSON, diff is deletions only
  (the two apparent additions are trailing-comma changes on last-in-object keys), key-set parity
  vs. `HEAD` unchanged, and **all 283 literal i18n keys referenced in `src/` resolve** except
  three pre-existing ones (below). Duplication proof: `.chip`/`.name-hint`/`.remove-btn`/
  `.add-link`, the `PersonCard`/`PersonRole`/`CatalogOption` view types, the draft mutations and
  the wedding-config catalog read each now have exactly **one** declaration, in
  `src/app/shared/rsvp-editor/`. Also amended the ADR with a `## Status update` section and
  trimmed three dead stub entries from `manage-rsvp-modal.spec.ts`.

> **Phase K complete (T264–T269), 2026-08-22.** Net effect: `rsvp-edit` {ts,html,scss} 382/174/274
> → 124/50/110 and `manage-rsvp-modal` 399/229/188 → 197/53/25 — **1,646 → 559 lines** across the
> two hosts, against 984 in the shared editor. Final state: `pnpm typecheck` clean, `pnpm test`
> 41/41 across 7 files, `pnpm lint` only the 4 known `shared/modal/` errors, `pnpm gen:api:check`
> no drift. **Nothing is committed** and **nothing has been verified in a browser** — every
> implementer flagged the same gap, so the hand-check at mobile/desktop widths across all three
> themes is the one outstanding acceptance criterion for T266 and T267.
>
> **Pre-existing issues surfaced by the sweep — NOT Phase K regressions, not fixed, no task
> opened yet:**
> 1. `config-manager.html:810,835,838` references `common.add`, `common.cancel`, `common.close`.
>    There is no `common` namespace in any locale file, and there was none at `HEAD` either — that
>    screen renders raw key strings today. Worth its own bug task.
> 2. After T267, `guest_manager.form.{age,allergies,childName,dietary,notes}`,
>    `guest_manager.action.{addPartner,addChild}` and `guest_manager.modal.commentsPlaceholder`
>    grep to zero references. They were outside T268's enumerated removal list so were correctly
>    left alone; a follow-up sweep could retire them (`guest_manager.form.{firstName,lastName}`
>    are still live, so the namespace cannot go wholesale).
> 3. `.remove-btn`/`.add-link` also exist in `rsvp-create.scss`, `.remove-btn` in
>    `config-manager.scss`, and `.summary-empty` in both `manage-rsvp-modal.scss` and
>    `guest-profile-modal.scss` — all unchanged from `HEAD`, on screens outside Phase K's two
>    surfaces. A genuine consolidation-task signal.
- **Owner:** agent (implementer)
- **Depends on:** T266, T267
- **Context:** T264 deliberately added the `rsvp.editor.*` namespace without removing anything, so
  the two migrations could land independently. Once both are in, a pile of keys is unreferenced
  and the old copy lives twice — which is how the next drift starts. This is a verification task:
  every deletion must be justified by a grep showing zero references, and nothing in it may change
  rendered behaviour.
- **Acceptance:**
  - Removed from all three `public/i18n/{en,es,fr}.json`, each verified unreferenced by a
    repo-wide grep of `src/` (report the grep in the PR): `rsvp.edit.{addPartner,addChild,noteLabel,notePlaceholder}`,
    `rsvp.edit.kind.*`, `rsvp.edit.person.*`, `rsvp.edit.footer.unnamed.*`,
    `guest_manager.rsvp.{attending,you,partner,participantsSection,total,mainGuest,partnerNameRequired}`,
    `guest_manager.rsvp.choice.*`. Keys still used elsewhere (e.g. `guest_manager.rsvp.summary`,
    `…manage`, `…participants`, `…children`, `…dietary`, `…none`, `…saveFailed`,
    `guest_manager.form.*`, `rsvp.edit.{eyebrow,titleAttending,titleDeclined,seatsHeld,declinedSub,changeAnswer,footer.saved,footer.unsaved,error}`)
    **stay**. Do not delete a key on the strength of its name.
  - The group-heading trio is the trap that rule exists for, so it is spelled out here: the shared
    editor's `party` heading + role pills retire the `You` / `Partner` / `Children` headings, and
    `guest_manager.rsvp.you` and `…partner` are used **only** at `manage-rsvp-modal.html:38,54`
    and so die — but `guest_manager.rsvp.children` is *also* used at
    `guest-profile-modal.html:103` (the RSVP summary stat) and **survives**. Grep each one; do
    not delete the set as a set.
  - `rsvp.edit.{titleAttending,titleDeclined}` are **retired here** — T264 replaced both with the
    single `rsvp.edit.title` ("Your reply") and T266 deleted the branch that chose between them.
    Confirm by grep that neither key has any remaining reference before deleting. Do **not** also
    delete `rsvp.edit.declinedSub`, `seatsHeld`, `eyebrow` or `title`: they are live host copy.
  - `rsvp.edit.*` allergy-note copy retired by the multi-entry change (T265, open question 3):
    grep for the old single-field placeholder key on both surfaces and remove it once the
    `rsvp.editor.person.customAllergy.*` set has replaced it.
  - The three files remain structurally identical (same key set) and valid JSON; the app renders no
    `MISSING` / raw-key text on any of the touched screens in any of the three languages.
  - A grep-backed statement in the PR that the RSVP-editing markup now exists **once**: no
    `.chip`/`.pill-toggle` chip-toggle rule outside `shared/rsvp-editor/rsvp-editor.scss`, no
    second `PersonCard`/`PersonKind` declaration, no second `toggleDiet`/`addChild`/`removeChild`
    implementation, no second wedding-config catalog read for diet/allergy options.
  - `src/app/core/helper/rsvp-draft.ts`'s doc comment is updated to name the shared editor as the
    consumer (it currently describes "the two editors that exist for it"), and ADR W-0003 gets a
    short `## Status update` line recording that Phase K landed. No other doc edits.
  - Zero behaviour change: no template restructuring, no styling change, no new component.
  - `pnpm typecheck && pnpm lint && pnpm test` green; `pnpm gen:api:check` still clean.
- **Refs:** in-repo ADR W-0003; `public/i18n/{en,es,fr}.json`;
  `src/app/core/helper/rsvp-draft.ts`; T256 (which added `rsvp.edit.footer.unnamed.*`, retired here)

### T269 — Couple: "Open their profile" from a locked partner name

> **Run order note (2026-08-22):** T269 runs **before** T268, despite the numbering. T269 *adds*
> `rsvp.editor.person.openProfile` to `public/i18n/*.json` while T268 *deletes* orphaned keys from
> the same three files — running them concurrently would collide, and sweeping last means T268
> greps a codebase in its final state.

- **Status:** done (uncommitted) — 2026-08-22. `openProfile = output<string>()` on the shared
  editor, guarded by `perspective() === 'couple' && !!card.accountId` and re-checked in the
  emitter; real `<button>` inside the existing `.name-hint`; re-emitted by `manage-rsvp-modal` to
  `guest-manager.openGuestProfile()` — the same path the guest-list row and `(back)` already use,
  no new parent path. One key added to each i18n file (`+1/-0`, nothing removed or re-worded):
  en "Open their profile", es "Abrir su perfil", fr "Ouvrir son profil".
  **Unsaved-edit decision: discard**, chosen deliberately because the adjacent "Back" button
  already discards via the same swap; `onOpenProfile()` resets the draft from the cached `RsvpDto`
  rather than relying on refetch, and a spec asserts reopening shows the stored reply.
  SCSS: `.add-link`'s accent-text-button body lifted into a local `%accent-link` placeholder that
  `.profile-link` also extends — tokens only. Verified: guest screen untouched (binds nothing,
  renders no trigger, asserted in spec); typecheck clean, 41/41 tests, 4 known lint errors.
- **Owner:** agent (implementer)
- **Depends on:** T267
- **Context:** Phase K open question 1, decided 2026-08-22 — build it. DS `RSVPEditor.jsx` L166
  renders an "Open their profile" action next to the "Name managed by their own guest account."
  hint in the `couple` perspective, and `ScreenGuestManager` wires it to swap the manage-RSVP
  overlay back to that partner's profile. Every piece already exists in this repo
  (`app-guest-profile-modal`, the parent overlay swap in `guest-manager.html`) — only the link is
  missing. It is scheduled **after** T267 so the migration lands first and this is a small,
  reviewable addition rather than noise inside a large diff. Note the deliberate asymmetry: this
  is a couple-only affordance on a shared component, so the guest side binds nothing.
- **Acceptance:**
  - `app-rsvp-editor` gains `openProfile = output<string>()` emitting the linked guest's id. It is
    the **only** perspective-specific action on the component; the trigger renders solely when
    `perspective() === 'couple'` **and** `partnerHasAccount()` is true for that card.
  - The trigger is a real `button` (not a styled `div`), keyboard-operable, with an accessible
    name from a new i18n key `rsvp.editor.person.openProfile` in all three
    `public/i18n/{en,es,fr}.json` — en "Open their profile". It sits with the
    `shared.partner.nameManaged` hint, per the DS.
  - `app-manage-rsvp-modal` re-emits it to `guest-manager`, which swaps the manage-RSVP overlay
    for `app-guest-profile-modal` on that guest — the same swap the parent already performs from
    the guest list. The guest screen (`app-rsvp-edit`) binds nothing and renders no trigger.
  - Unsaved-edit behaviour is explicit and documented in the task's PR description: either block
    the swap while `dirty` is true, or discard — do not silently drop pending edits without
    saying which was chosen.
  - Unit spec: `couple` + account-holding partner renders the trigger and emits the right id;
    `couple` + plus-one partner renders none; `owner` renders none even for a linked partner.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** DS `ui_kits/wedding-app/RSVPEditor.jsx` L166, `ScreenGuestManager.jsx`;
  in-repo ADR W-0003 §Decision.6; ADR W-0002 §Decision.3;
  `src/app/screens/guest-manager/{guest-manager.html,modal/guest-profile-modal.ts,modal/manage-rsvp-modal.ts}`

> **Phase K decisions (answered by the user, 2026-08-22).** All four open questions are resolved;
> the wording for the guest `<h2>` was confirmed in the same round. Recorded here because the
> task bodies cite them by number.
>
> 1. **"Open their profile" from a locked name — BUILD IT.** Scheduled as **T269**, after T267,
>    so it lands as a small reviewable addition rather than inside the migration diff.
> 2. **The couple's note is READ-ONLY.** A deliberate, documented deviation from the DS, which
>    makes it editable: the couple must not be able to overwrite words a guest wrote to them.
>    They still always see the note; "No note left." becomes an empty state, not a placeholder.
>    Implemented as `noteReadonly` on the shared component (T265), set by T267.
> 3. **Custom allergies become MULTI-ENTRY guest-typed chips.** Each entry is its own element of
>    `options.customAllergies`, matching how the contract types the field, and individually
>    removable. This **supersedes ADR W-0003 §Decision.5** (single-element array) and *replaces*
>    the free-text field on both surfaces — it is new UI in T265, not a port of what exists.
>    Existing single-element data renders as one chip; no migration.
> 4. **The editor owns the party section heading on both surfaces; the guest `<h2>` is
>    re-pointed.** "Your party" moves into the editor (`<h3>`), and the host heading collapses to
>    one new key `rsvp.edit.title` = **"Your reply"** for both the attending and declined states —
>    reusing the es/fr already shipped for `titleDeclined`, so no new translation is commissioned.
>    `titleAttending`/`titleDeclined` retire in T268. Deliberately **not** a status-driven
>    headline: the eyebrow ("CONFIRMED") and the subtitle already carry the status.
>
> **Copy sign-off (user, 2026-08-22).** The three `rsvp.editor.person.customAllergy.*` English
> strings authored during T264 — label "Anything else?", placeholder "Type an allergy and press
> Enter…", remove "Remove {{name}}" — are **approved as shipped**. They are settled copy now, not
> proposals; es/fr are already in place. Do not re-word them.
>
> Nothing in Phase K is blocked. **Still true, and still binding:** no further user-facing copy
> may be re-worded on an implementer's initiative — if a string looks wrong while building, flag
> it, do not change it.

## Phase L — The `kind` discriminator (live save bug) + the DS status-button rework

> Two independent upstream changes landed, and they are **not** equally urgent.
>
> **B — the API grew a `kind` discriminator on RSVP participants, and this repo is broken by it.**
> **`kind` is a `partner2` concern only — not a party-wide one.** This was rescoped by the API on
> 2026-08-23, *after* the first draft of this phase, and the narrowing is significant enough that
> anything you may remember about "every participant carries a `kind`" is now wrong:
>
> - `adults.partner2` is a discriminated union whose **both** variants require `kind`
>   (`'guest' | 'plus-one' | 'child'`), and whose second variant has **no `id`**. This is the whole
>   of the change as far as this repo is concerned.
> - `adults.partner1` has **no `kind`** (unchanged — the contract omits it for the primary guest).
> - **`children[]` no longer carries `kind` at all.** `RsvpChildrenParticipantSchema` now omits it
>   alongside `lastName`, so a child is `{ firstName, age, options? }`. There is nothing to stamp
>   on a child, and nothing in this phase may add one.
>
> **The committed generated client is one hunk stale.** `pnpm gen:api:check` reports drift in
> exactly one file — `src/app/core/api/model/rsvp-dto-children-inner.ts` loses its `kind` field and
> its `KindEnum` namespace (10 deletions); nothing else in the client moves. Regenerating is
> therefore **T270's first step**, not an optional hygiene item: it deletes four of the ten
> `typecheck` errors on its own.
>
> **Blocking dependency, check before regenerating:** the hub contract
> (`../wedding-architecture/contracts/openapi.json`) carries this re-sync **uncommitted**, as does
> `wedding-api/src/common/documents/rsvp.ts`. Do not run `pnpm gen:api` against a contract that is
> still moving — confirm the hub commit has landed (or that the user says to proceed against the
> working tree) and reference it in the PR.
>
> **`pnpm typecheck` is red at `HEAD`** — not in the brief that opened this phase, and worth
> stating plainly: 10 errors before regeneration, **6 after**, and every survivor is partner2's.
> Four sites read `.id` off a union whose second member does not have one
> (`core/helper/partner-account.ts:29`, `core/helper/rsvp-draft.ts:71`,
> `screens/invitee/invitee.ts:86`, `screens/rsvp/rsvp.ts:65`) and two are `rsvp-create.ts`'s
> `Omit<>`-derived `PartnerDraft` literals missing `kind` (L62, L77). T270 is therefore a
> build-restoring task, not only a payload fix — do not start anything else in this phase before
> it lands.
>
> **Read `docs/decisions/W-0004-rsvp-participant-kind-discriminator.md` first.** It pins the
> discriminator rule, why no legacy handling is implemented, why `partnerHasAccount()` stays a
> `boolean` rather than becoming a type predicate, and why the two `as unknown as
> RsvpDtoAdultsPartner2` casts are deleted rather than kept. It amends ADR W-0002 §Decision.1.
>
> **A — the design system reworked the RSVP status buttons** (`../wedding-ui-design`, commit
> `24e1259`). `RSVPEditor` gains `statusPending` (default `false`): "Pending" renders only when it
> is set, so the couple keeps three answers and the guest gets two. A muted reassurance line
> appears under the answer row when the answer is "no". And `ScreenRSVPEdit` changes materially:
> the editor now renders **always**, with `showStatus`, so a declined guest edits their status
> inline; "Change my answer" is gone; the eyebrow becomes `RSVP · CONFIRMED` / `RSVP · DECLINED`
> and the glyph `✓`/`—` follows the status.
>
> **One DS change is deliberately not adopted.** `ScreenRSVPEdit.jsx` L18 also makes the `<h2>`
> status-driven ("Your party" when attending, "Your reply" when declined). This repo does not
> follow it: Phase K decision 4 and ADR W-0003 §Decision.9 moved "Your party" *into* the editor,
> so adopting the DS literally would print "Your party" twice on the same screen. The host `<h2>`
> stays the single `rsvp.edit.title` = "Your reply" in both states. The status-driven **eyebrow**
> *is* adopted — that is what decision 4 said carries the status.
>
> Sequence: **T270 → T271 → T274 → T272 → T273.** B before A, because the save bug is live and the
> fix is in `core/helper`, which the DS work sits on top of. T274 (the "declining never prunes the
> party" invariant) is numbered last but **runs fourth**, before the two UI tasks: T272 ships the
> DS's promise that nothing is lost, and that promise has to be true before it is printed. T272
> and T273 both edit `public/i18n/{en,es,fr}.json` and are strictly serial — do **not** run them in
> parallel.
>
> **External dependency — the user owns it. Do not write a task for it and do not propose a fix.**
> Upstream, `z.discriminatedUnion('kind', [RsvpUserSchema, RsvpParticipantSchema])` still gives
> both members the same three-value `kind` enum. Zod v4 throws `Duplicate discriminator value
> "guest"` the first time that union is exercised (`zod/v4/core/schemas.js` L1152, reproduced
> against the real `zod@4.4.3`), so **any** payload containing a `partner2` fails server-side no
> matter what this repo sends. Sending `kind` is necessary but not sufficient. Recorded here only
> so the consequence for this phase is unambiguous: **no task may be gated on a live save round
> trip against a running API.** T270's proof is the payload shape, asserted in unit tests.

> **Phase L decisions (answered by the user, 2026-08-23).** All four open questions are resolved
> and **nothing in Phase L is blocked.** Recorded here because the task bodies cite them by number.
>
> 1. **Declining must never destroy the party — this is an invariant, not a preference.** The
>    user's answer was about the *model*, not the button: "a re-reply can hide the rest of the
>    participants but not the model behind. it should stay intact so 're-accepting' has to show
>    all the previously entered participants." So: `partner2` and `children`, with their meal
>    details, survive a decline in the draft, in the PATCH payload **and** in the stored document,
>    and switching back to "With joy" re-renders every participant the guest had entered. Removing
>    someone stays an explicit act. This is **T274**, and it is a real bug fix — `rsvp-create`'s
>    `submit()` drops `partner2` on a "sadly no" today. The DS's new reassurance line states this
>    promise in words, so the copy and the behaviour must agree before T272 prints it.
> 2. **A declined guest may edit their party — yes.** The host stops hiding the editor; the answer
>    row and the party are both live while declined. **Read with decision 1**, the two look like
>    they pull in different directions ("a re-reply can hide the rest"), so the DS settles it: in
>    `RSVPEditor.jsx` the party meta, the participant cards and the add links (L228–238) sit
>    **outside** the `showStatus` block and outside any status test, and `ScreenRSVPEdit.jsx` L26
>    renders the editor unconditionally. **The cards stay visible while declined.** Hiding them is
>    permitted by decision 1 but is *not* implemented — the binding half of that answer is the
>    non-destruction, which T274 guarantees.
> 3. **No legacy `kind` handling — the backend already migrated the stored documents.** `kind` is
>    always present on the wire, so `partnerHasAccount()` is `kind === 'guest'` with **no `id`
>    fallback** and `toRsvpDraft()` needs no defaults. ADR W-0004 §Decision.3 records the removed
>    rule and why, so nobody reintroduces it as a "safety" branch.
> 4. **The app header follows the status too.** One key pair drives both the on-screen eyebrow and
>    the `HeaderService` effect, so the chrome and the page can never disagree; a declined guest's
>    header reads "RSVP · DECLINED".
>
> **Still binding, unchanged from Phase K:** no user-facing copy may be re-worded on an
> implementer's initiative — flag it, do not change it.

### T270 — Regenerate the API client and carry `kind` on `partner2`

- **Status:** done (`462b933`, `cc868d2`) — 2026-08-23. Regeneration confirmed as the predicted
  single hunk (`rsvp-dto-children-inner.ts` loses `kind`/`KindEnum`; nothing else moved), committed
  alone. `AdultDraft` gained an optional `kind` typed off the generated
  `RsvpDtoAdultsPartner2OneOf.KindEnum`; `toRsvpDraft`/`fromRsvpDraft` carry it with no defaulting
  and no cast to the union (the old `as unknown as RsvpDtoAdultsPartner2` casts and their
  now-false `// reason:` comments are gone); a partner typed into `rsvp-create`/`rsvp-editor` is
  stamped `'plus-one'`; `children` untouched. `partnerHasAccount()` kept its `id`-based semantics
  behind an `in` check (discriminator switch is T271, deliberately out of scope here). Verified
  independently: `pnpm typecheck` clean, `pnpm lint` only the 4 known `shared/modal/` errors,
  `pnpm test` 46/46 (5 new specs in `rsvp-draft.spec.ts`). No live save round-trip attempted — the
  external Zod discriminator defect is out of this repo's scope (ADR W-0004).
- **Owner:** agent (implementer)
- **Depends on:** the hub contract re-sync landing in `../wedding-architecture` (see the preamble)
- **Context:** The live save bug, and the reason `pnpm typecheck` is red at `HEAD`. Two things are
  wrong and they must be fixed in that order: the committed client is one hunk behind the
  re-synced contract (children lost their `kind`), and the two write paths that build `partner2`
  do not send its `kind`. Regenerating first is not housekeeping — it deletes four of the ten
  `typecheck` errors, and hand-fixing them instead would mean writing code against a model the
  contract no longer has. **`children` are out of scope entirely: a child is
  `{ firstName, age, options? }` and carries no `kind` — do not add one, anywhere, in any form.**
  This is deliberately one PR even though it spans `core/api`, `core/helper`, one screen and the
  shared editor: a partial fix does not compile. Model change only — no visible UI change, no i18n
  change.
- **Acceptance:**
  - **First commit, on its own: `pnpm gen:api`.** The only file that changes is
    `src/app/core/api/model/rsvp-dto-children-inner.ts`, which loses its `kind` field and its
    `KindEnum` namespace (10 deletions). If anything else moves, stop and report — the contract
    moved under you. Reference the hub commit that carries the re-sync in the PR, and state that
    `pnpm gen:api:check` is clean afterwards. Nothing in `src/app/core/api/` is hand-edited
    (CLAUDE.md folder ownership).
  - `AdultDraft` in `src/app/core/helper/rsvp-draft.ts` gains an **optional** `kind`, typed with
    the **generated** `RsvpDtoAdultsPartner2OneOf.KindEnum` — **no hand-written
    `'guest' | 'plus-one' | 'child'` union anywhere** (CLAUDE.md Hard rule 15). Optional because
    the one type serves both adult slots and `adults.partner1` carries no `kind`; the doc comment
    records the invariant the type cannot express — *`kind` is a `partner2` field; `partner1`
    never has one and `fromRsvpDraft` never emits one for it*. **`ChildDraft` is not touched and
    gains nothing.** `EMPTY_RSVP_DRAFT` is unchanged.
  - `toRsvpDraft()` reads `partner2.kind` straight through — **no defaulting, no `??`, no
    inference** (decision 3: the backend migrated the stored documents, so `kind` is always on the
    wire; ADR W-0004 §Decision.3 records why a fallback must not be added back). It reads
    `partner2.id` via an `in` check (`'id' in p ? p.id : undefined`), the only narrowing the union
    supports. Its `children` mapping is unchanged.
  - `fromRsvpDraft()` emits `kind` on `partner2` and **omits it on `partner1` and on every
    child**. **Both `as unknown as RsvpDtoAdultsPartner2` casts and their now-false `// reason:`
    comments** (`rsvp-draft.ts` L93–103, `rsvp-create.ts` L292–300) are deleted: the object is
    built as `…OneOf` when an `id` is carried forward and `…OneOf1` when not, and assigns to the
    union with no cast. The finished diff contains no `as unknown as`, no `any` and no
    `@ts-expect-error` for this model.
  - `screens/rsvp-create/rsvp-create.ts` compiles and sends `kind` **for the partner only**: its
    `Omit<>`-derived `PartnerDraft` inherits the required field, so `EMPTY_DRAFT.partner` (L62)
    and `toCreateDraft()` (L77) supply it and `submit()` sends it — a typed-in partner is
    `'plus-one'`, and a server-linked `partner2` carried forward from `rsvp.adults.partner2` is
    passed through untouched, never re-stamped. Its `ChildDraft`, `toggleWithChildren()`,
    `addChild()` and the `children` payload need **no change** — they satisfy the regenerated
    type again.
  - `shared/rsvp-editor/rsvp-editor.ts`: `addPartner()` stamps `'plus-one'` on the draft it
    creates. `addChild()` is **unchanged**. No other change to the component.
  - The four `.id` reads compile without casts: `core/helper/partner-account.ts:29`,
    `core/helper/rsvp-draft.ts:71`, `screens/invitee/invitee.ts:86`, `screens/rsvp/rsvp.ts:65`.
    `partnerHasAccount()` keeps its **`id`-based semantics** in this task — the discriminator
    switch is T271, and mixing the two would hide which change caused a behaviour difference.
  - `rsvp-draft.spec.ts` covers: a `partner2.kind` present on the DTO survives `toRsvpDraft` →
    `fromRsvpDraft` unchanged; a plus-one `partner2` serialises with `kind: 'plus-one'` and **no
    `id` key at all**; a linked `partner2` keeps both its `id` and `kind: 'guest'`; `partner1`
    never carries `kind`; and **a serialised child has no `kind` property** — a guard against
    re-adding one out of symmetry. Fixtures in `partner-account.spec.ts`, `rsvp-editor.spec.ts`,
    `manage-rsvp-modal.spec.ts` and `rsvp-edit.spec.ts` are updated only where the compiler
    demands it, with no assertion changed.
  - `pnpm typecheck && pnpm lint && pnpm test` green. **`typecheck` is red before this task** —
    10 errors at `HEAD`, 6 after the regeneration commit, 0 at the end; report those three numbers
    in the PR. Lint: the 4 known `shared/modal/` errors only. Do **not** claim a verified
    end-to-end save — see the external dependency in the phase preamble.
- **Refs:** in-repo ADR W-0004 (whole document), ADR W-0002 §Decision.1;
  `src/app/core/api/model/rsvp-dto-adults-partner2{,-one-of,-one-of1}.ts`,
  `rsvp-dto-children-inner.ts` (regenerated here); `src/app/core/helper/rsvp-draft.ts`;
  `src/app/screens/rsvp-create/rsvp-create.ts`; `src/app/shared/rsvp-editor/rsvp-editor.ts`;
  `wedding-api/src/common/documents/rsvp.ts`; hub `contracts/openapi.json`, ADR-0024

### T271 — Move `partnerHasAccount()` onto `kind` (no `id` fallback)

- **Status:** done (`db05a48`) — 2026-08-23. `partnerHasAccount()` is now
  `partner?.kind === RsvpDtoAdultsPartner2OneOf.KindEnum.GUEST`, no `id` fallback, no `??`
  default, signature and three input types unchanged, still a plain `boolean` (both reasons from
  ADR W-0004 §Decision.4 in the doc comment). `partner1` now answers `false` where the old `id`
  rule answered `true` — stated in the doc comment; no caller passes `partner1`. Call sites
  confirmed unchanged in shape by grep (`rsvp-draft.ts` `unnamedAdultCount`, `rsvp-editor.ts`
  `nameLocked`/`accountId`/`partner2NameLocked`, `rsvp-create.ts` L176, `guest-profile-modal.html`,
  `guest-manager.html`); a `kind: 'guest'` partner now locks their name with no `id`, while "Open
  their profile" still gates on `canOpenProfile()`'s `accountId` check. `partner-account.spec.ts`
  rewritten per the acceptance list; two stale "empty/blank id" cases removed. ADR W-0002 not
  edited. Verified independently: `pnpm typecheck` clean, `pnpm lint` only the 4 known
  `shared/modal/` errors, `pnpm test` 47/47.
- **Owner:** agent (implementer)
- **Depends on:** T270
- **Context:** ADR W-0002 §Consequences predicted this task word for word: "`partnerHasAccount` is
  the single place to change if the contract ever gains a real discriminator (e.g. a `kind`
  field), instead of five call sites." It has, so this is that one change — the helper's body and
  doc comment, nothing else. Its five callers (`rsvp-editor`'s `nameLocked`/`accountId`,
  `rsvp-create` L173, `unnamedAdultCount`, and the guest-manager modals through the editor) keep
  their shape. Kept separate from T270 on purpose: T270 makes the app compile and send the right
  bytes without changing any behaviour, and this task changes exactly one behaviour, so a
  regression has one suspect.
- **Acceptance:**
  - `partnerHasAccount()` returns `true` when `kind === 'guest'` and `false` otherwise — including
    for an explicit `'plus-one'` or `'child'` **carrying a stale `id`**, and for a missing `kind`.
    **There is no `id` fallback and no `??` default** (decision 3: the backend migrated the stored
    documents; ADR W-0004 §Decision.1, §Decision.3). The body should end up a one-liner.
  - It stays a plain `boolean`, **not** a `partner is …OneOf` type predicate — and the doc comment
    gives the two reasons, because "the union has a discriminator now, so narrow on it" is the
    obvious wrong move here (ADR W-0004 §Decision.4): (a) openapi-generator gives **both** union
    members the same full three-value `KindEnum`, so neither has a unit-typed discriminator and
    `kind === 'guest'` eliminates neither member — a predicate would be an unchecked assertion,
    not a narrowing; (b) the helper also accepts `AdultDraft` and the profile partner type, so
    narrowing to a generated API interface would be unsound at the sites that pass one. Its
    signature and its three accepted input types are unchanged. No new `type`/`interface`.
  - **`partner1` now answers `false`** where the `id` rule answered `true` (it carries no `kind`).
    No caller passes `partner1` — `unnamedAdultCount` asks only about `partner2` and the editor
    hard-codes `nameLocked: false` for the primary card — so this changes no behaviour, but it is
    stated in the doc comment and in the PR so it is not later mistaken for a regression.
  - The doc comment's description of the old model ("an OpenAPI `anyOf` whose **only**
    discriminator is the presence of `id`", the merge-artifact paragraph) is rewritten to the
    current one and points at ADR W-0004. **ADR W-0002 itself is not edited** — W-0004 already
    records that it amends §Decision.1, and a superseded ADR is amended by reference, never
    rewritten in place (hub coordination protocol).
  - Behaviour at the call sites is stated explicitly in the PR, backed by a grep of
    `partnerHasAccount(`: a `kind: 'guest'` partner locks their name even with no `id`, while the
    couple's "Open their profile" jump still requires a real `accountId` (`rsvp-editor.ts` L193,
    `canOpenProfile()`) — a locked name without an id renders the hint and no link.
  - `partner-account.spec.ts` covers: `kind: 'guest'` with no `id` → true; `kind: 'plus-one'`
    **with** an `id` → false (the id no longer wins); no `kind` at all, with or without an `id` →
    false; `null`/`undefined` → false; and the
    `UserProfileListResponseDtoProfilesInnerGuestInfoPartner` variant (still a merged interface)
    with `kind: 'guest'` → true. The two existing "empty/blank `id`" cases are **replaced**, not
    kept — they tested a rule that no longer exists.
  - No template, SCSS or i18n file is touched.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** in-repo ADR W-0004 §Decision.1, §Decision.4; ADR W-0002 §Decision.1, §Consequences;
  `src/app/core/helper/{partner-account.ts,partner-account.spec.ts,rsvp-draft.ts}`;
  `src/app/shared/rsvp-editor/rsvp-editor.ts` (L192–193, L307–309);
  `src/app/screens/rsvp-create/rsvp-create.ts` L173

### T272 — `app-rsvp-editor`: `statusPending` input + the "sadly no" reassurance line

- **Status:** done (`742f9ba`) — 2026-08-23. `statusPending = input(false)`; `statuses` is now a
  `computed` yielding `[attending, pending, declined]` when true, `[attending, declined]` when
  false, still off `RsvpDto.StatusEnum`. `showDeclinedHint` computed gates a new `.declined-hint`
  line — `showStatus() && status === DECLINED` — composed via `perspectiveKey('declinedHint')`,
  no English literal, no perspective `switch`. `manage-rsvp-modal.html` gained
  `[statusPending]="true"` next to `[showStatus]="true"`; no other call site touched. New
  `perspective.{owner,couple}.declinedHint` key added to all three `public/i18n/*.json` — English
  verified verbatim from the DS line, es/fr real translations, key sets symmetric. Verified
  independently: `pnpm typecheck` clean, `pnpm lint` only the 4 known `shared/modal/` errors,
  `pnpm test` 52/52.
- **Owner:** agent (implementer)
- **Depends on:** T271
- **Context:** DS `RSVPEditor.jsx` L107, L217–227 (commit `24e1259`). The answer row splits in
  two: "With joy" / "Sadly no" always render under `showStatus`, and "Pending" renders **only**
  when the new `statusPending` flag is set. Both guest-manager screens pass
  `showStatus statusPending`; the guest screen passes `showStatus` alone. A muted reassurance line
  appears under the row when the answer is "no", with different wording per perspective. This task
  is the component change **plus** the couple's call site, so the couple's editor is unchanged in
  behaviour when it lands — the guest side arrives in T273. It edits `public/i18n/*.json`; T273
  does too, so the two are strictly serial.
- **Acceptance:**
  - `app-rsvp-editor` gains `statusPending = input(false)`. The hard-coded `statuses` array
    becomes a `computed` that yields `[attending, pending, declined]` when `statusPending()` is
    true and `[attending, declined]` when it is false — the DS order is preserved, and the values
    still come from `RsvpDto.StatusEnum`, never from a local union.
  - A draft whose status is `pending` while `statusPending()` is false renders the row with
    **neither** answer selected. The editor does **not** silently rewrite the draft on render —
    it emits only in response to a user action (this is a controlled component, ADR W-0003
    §Decision.1).
  - A reassurance line renders under the answer row when — and only when — `showStatus()` is true
    and the draft's status is `declined`. Copy comes from a new per-perspective key
    `rsvp.editor.perspective.<p>.declinedHint`; the component composes it exactly as it composes
    the other perspective keys (`perspectiveKey('declinedHint')`), with no English literal in the
    template and no perspective `switch` in TypeScript.
  - New key in **all three** `public/i18n/{en,es,fr}.json`, purely additive, key sets identical
    afterwards. English is **verbatim from the DS** (L225), so it needs no copy sign-off:
    `perspective.owner.declinedHint` = "Your party and meal details are kept — switch back any
    time and nothing is lost."; `perspective.couple.declinedHint` = "Party and meal details are
    kept — switching back changes nothing else." es/fr are real translations in each file's
    existing voice. No existing string is re-worded (standing rule, end of Phase K).
  - Styling per the DS: small muted text (`t.$text-micro`, `var(--text-muted)`, `line-height:
    1.5`) in `rsvp-editor.scss`, semantic aliases only — no hex, no raw `--sub`, no new
    breakpoint, no inline style.
  - `manage-rsvp-modal.html` binds `[statusPending]="true"` alongside its existing
    `[showStatus]="true"`, so the couple still sees three answers. **No other call site changes in
    this task** — the guest screen still passes no `showStatus` until T273.
  - `rsvp-editor.spec.ts` covers: `showStatus` + `statusPending` false → two choice cards, and
    the `rsvp.editor.choice.pending` label is absent from the DOM; `statusPending` true → three;
    `showStatus` false → no row and no hint whatever the status; status `declined` + `showStatus`
    → the hint renders and its text is the *perspective's* string (assert `owner` and `couple`
    differ); status `attending` or `pending` → no hint. `manage-rsvp-modal.spec.ts` asserts the
    couple still gets three answers.
  - Component validates against the design spec
    (`../wedding-ui-design/ui_kits/wedding-app/RSVPEditor.jsx` L217–227).
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** DS `ui_kits/wedding-app/RSVPEditor.jsx` (commit `24e1259`, L107 signature, L217–227
  render), `ScreenGuestManager.jsx` L307, `ScreenGuestManagerMobile.jsx` L206; in-repo ADR W-0003
  §Decision.1, §Decision.4; `src/app/shared/rsvp-editor/rsvp-editor.{ts,html,scss,spec.ts}`;
  `src/app/screens/guest-manager/modal/manage-rsvp-modal.{html,spec.ts}`;
  `public/i18n/{en,es,fr}.json`

### T273 — Guest RSVP screen: inline status editing, status-driven eyebrow, no "Change my answer"

- **Status:** done (`4d045c4`) — 2026-08-23. `app-rsvp-editor` renders unconditionally with
  `[showStatus]="true"`, no `statusPending`; the `@if (draft().status !== 'declined')` wrapper is
  gone, so the party stays visible while declined (no status conditional added around it). "Change
  my answer" removed end to end — `rsvp-edit.{html,scss,ts}`'s button/SCSS/output, and
  `screens/rsvp/`'s `(changeAnswer)` binding, `onChangeAnswer()`, and the `forceCreate` signal
  (incl. `&& !forceCreate()`); `onSubmitted()`/`(submitted)` also removed as dead once
  `forceCreate` no longer needs resetting (flagged explicitly — not in the original acceptance
  list, but entailed). `app-rsvp-create` confirmed still reachable for a `pending` record, asserted
  in new `rsvp.spec.ts`. Eyebrow split into `rsvp.edit.eyebrow.{confirmed,declined}` across all
  three i18n files, consumed by both the template and the `HeaderService` effect. Check glyph
  follows status via `[class.declined]`, no inline style. `<h2>` deliberately untouched — stays
  `rsvp.edit.title`, the DS's status-driven `<h2>` is a documented non-adoption (ADR W-0003
  §Decision.9). **Manual cross-browser/theme verification not performed — no browser available in
  this environment**, stated plainly rather than claimed. Verified independently: `pnpm typecheck`
  clean, `pnpm lint` only the 4 known `shared/modal/` errors, `pnpm test` 60/60.
- **Owner:** agent (implementer)
- **Depends on:** T272 (and, in run order, T274 — this screen ships the promise T274 makes true)
- **Context:** DS `ScreenRSVPEdit.jsx` is now 55 lines and materially different: the editor
  renders **always**, with `showStatus` (and without `statusPending`, so the guest gets two
  answers — a guest may not park their own reply back on "pending"); the "Change my answer" button
  is gone; the eyebrow reads `RSVP · CONFIRMED` / `RSVP · DECLINED`; the glyph is `✓` in the
  accent when attending and `—` muted when declined. This is the visible half of Phase L and the
  only task in it that changes what a guest sees. It also removes a navigation path — decisions 1,
  2 and 4 (above) settle that and are cited per criterion below.
- **Acceptance:**
  - `rsvp-edit.html` renders `<app-rsvp-editor … [showStatus]="true">` **unconditionally** —
    the `@if (draft().status !== 'declined')` wrapper and its comment are deleted (decision 2).
    `statusPending` is **not** bound, so the guest sees exactly "With joy" and "Sadly no", and
    the T272 reassurance line appears when they choose "Sadly no".
  - **The participant cards stay visible while declined** — the editor is rendered whole, not
    trimmed. The DS settles this rather than leaving it to taste: in `RSVPEditor.jsx` the party
    meta line, the cards and the add links (L228–238) sit **outside** the `showStatus` block and
    outside any status test, and `ScreenRSVPEdit.jsx` L26 renders the editor unconditionally.
    Decision 1 permits hiding them but does not ask for it, and its binding half — that nothing is
    destroyed — is T274's, not this task's. Do **not** add a status conditional around the party.
  - "Change my answer" is removed end to end (decision 1's UI half): the button and `.change-answer`
    SCSS rule in `rsvp-edit.{html,scss}`, `onChangeAnswer()` and the `changeAnswer` output in
    `rsvp-edit.ts`, and in the parent `screens/rsvp/`: the `(changeAnswer)` binding,
    `Rsvp.onChangeAnswer()` and the `forceCreate` signal — including the `&& !forceCreate()`
    condition in `rsvp.html` L3. `rsvp.edit.changeAnswer` is deleted from all three i18n files
    after a grep proves it dead. **`app-rsvp-create` must stay reachable** for a `pending` record
    (`rsvp.html` L5–7): assert it, in the spec and in the PR description.
  - The eyebrow becomes status-driven (decision 4). The leaf key `rsvp.edit.eyebrow` is
    replaced by `rsvp.edit.eyebrow.confirmed` / `rsvp.edit.eyebrow.declined` in all three i18n
    files; **both** consumers move to the pair — the template eyebrow *and* the `HeaderService`
    effect in `rsvp-edit.ts` L77–80 — so the app header and the page can never disagree. English
    comes verbatim from the DS (`ScreenRSVPEdit.jsx` L17): "CONFIRMED" / "DECLINED". es/fr for
    `.confirmed` are today's `rsvp.edit.eyebrow` values copied across verbatim (no new
    translation); `.declined` is newly translated. Values stay in the shipped register —
    `%eyebrow` already applies `text-transform: uppercase`, so do not change the casing of the
    existing string while moving it.
  - The check glyph follows the status: `✓` in `var(--brand-accent)` when attending, `—` in
    `var(--text-muted)` when declined. Implemented with a class binding
    (`[class.declined]="…"`) and a rule in `rsvp-edit.scss` — **no inline `style`, no `ngStyle`**
    (CLAUDE.md rule 2). It stays `aria-hidden="true"`: the status is already announced by the
    eyebrow and the subtitle.
  - **The `<h2>` is not touched.** It stays the single `rsvp.edit.title` ("Your reply") in both
    states. The DS's status-driven `<h2>` (`ScreenRSVPEdit.jsx` L18, "Your party" when attending)
    is a **deliberate non-adoption**, recorded in the PR description: Phase K decision 4 and ADR
    W-0003 §Decision.9 moved "Your party" into the editor, so following the DS here would render
    it twice. `declinedSub` and `seatsHeld` are unchanged and still carry the status.
  - `rsvp-edit.spec.ts` covers: a `declined` RSVP now renders `app-rsvp-editor` (it previously
    did not); the editor receives `showStatus` true and `statusPending` false/unset; the eyebrow
    reads the `.declined` key when declined and `.confirmed` when attending; the glyph element
    carries the declined class and renders `—`; no "Change my answer" control exists in the DOM;
    the existing save / dirty / unnamed-gate assertions still pass unchanged. Add or extend an
    `app-rsvp` assertion that a `pending` RSVP still routes to `app-rsvp-create`.
  - The three i18n files stay structurally identical (same key set) and valid JSON; no screen
    renders a raw key in any of the three languages.
  - Verified by hand at mobile and desktop widths in all three themes: switch "With joy" ⇄ "Sadly
    no" and watch the eyebrow, subtitle, glyph and reassurance line change together; edit the
    party while declined; save, reload, and confirm the whole party is still listed (the T274
    invariant, seen from the guest's side — if this fails, T274 did not land or regressed). If no
    browser is available, say so plainly rather than marking it done.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** DS `ui_kits/wedding-app/ScreenRSVPEdit.jsx` (commit `24e1259`, L13–28); in-repo ADR
  W-0003 §Decision.2, §Decision.9; Phase K decision 4 (above);
  `src/app/screens/rsvp-edit/rsvp-edit.{ts,html,scss,spec.ts}`;
  `src/app/screens/rsvp/{rsvp.ts,rsvp.html}`; `public/i18n/{en,es,fr}.json`; hub SPEC J2.5

### T274 — Declining an RSVP must never drop the party

> **Run order note (2026-08-23):** T274 is numbered last but runs **fourth** — after T271 and
> **before** T272/T273. T272 prints the DS line "Your party and meal details are kept — switch
> back any time and nothing is lost"; that sentence must be true before it ships. Numbered here
> rather than inserted mid-phase because the phase's numbering was already published.

- **Status:** done (`f797c4f`) — 2026-08-23. `submit()` now branches on `d.attending === 'no'`
  first: `partner2 = rsvp.adults.partner2` and `children = rsvp.children` verbatim, `status` the
  only field that changes. The `d.attending === 'yes'` branch keeps the prior
  `withPartner`/`withChildren` gating unchanged, so explicit removal still removes. Added the named
  regression spec (`it('keeps the party on a declined save')`) and a draft-layer round-trip spec
  (attending → decline → attending, partner2/children/options identical throughout) to
  `rsvp-draft.spec.ts`. Guest-manager side verified by inspection, not changed:
  `manage-rsvp-modal.ts:188` saves via `...fromRsvpDraft(this.draft())` unconditionally; grep for
  `status === 'declined'` / `StatusEnum.DECLINED` across `src/` turns up only a status-dropdown
  option list (`rsvp-editor.ts:143`), an `attendingFromStatus` read, and this task's own `status`
  assignment — no branch anywhere prunes participants. `pnpm typecheck && pnpm lint && pnpm test`
  green (the 4 pre-existing `shared/modal/` lint errors only, per CLAUDE.md's carve-out).
- **Owner:** agent (implementer)
- **Depends on:** T270 (it edits the same two write paths; landing after avoids a conflict)
- **Context:** Phase L decision 1, and a real data-loss bug rather than a nicety. Declining is a
  change of *answer*, not a deletion of the party — the guest must be able to switch back and find
  everyone they entered, with their meal details. `fromRsvpDraft()` already behaves (it emits
  `partner2` and `children` whatever the status), so the fix is one path plus two regression
  guards. `rsvp-create.submit()` is the offender: `partner2` and `children` are both gated on
  `d.attending === 'yes'`, so a "sadly no" sends `adults: { partner1 }` with the `partner2` key
  absent — which replaces the stored `adults` object and destroys a server-linked partner. Note
  the asymmetry that makes this easy to misdiagnose: `children` survives the same code path *by
  accident*, because an omitted top-level key leaves the stored array untouched (the API's
  `RsvpDocumentSchema` deliberately has no default on `children`), while `adults` is sent and so
  is replaced. Fixing only what is visibly broken would leave the two halves inconsistent again.
- **Acceptance:**
  - `rsvp-create.submit()` carries the party forward on a decline: when `d.attending === 'no'`,
    `adults.partner2` and `children` are sent as whatever the RSVP already holds
    (`rsvp.adults.partner2`, `rsvp.children`), not `undefined`. Only `status` changes.
  - **Explicit removal still removes.** Un-ticking "With my partner" or "With children" *while
    attending*, and the editor's per-card remove control, are unchanged — the preservation rule
    applies to the decline path alone. Today's single `d.attending === 'yes' && d.withPartner`
    condition conflates the two; separate them rather than widening one.
  - `fromRsvpDraft()` is covered by a **named regression spec** — `it('keeps the party on a
    declined save')` or equivalent — asserting that a draft with a `partner2` and two children,
    status `declined`, still serialises both, with their `options` intact. It passes before the
    change; that is the point. It exists so a future "a declined RSVP has no party" simplification
    fails loudly.
  - A round-trip spec for the invariant, at the draft layer where it can be asserted without a
    live API: draft with a full party → set status `declined` → `fromRsvpDraft` →
    `toRsvpDraft` of the resulting DTO → set status back to `attending` → the party is identical
    (same partner, same children, same `dietaryPreferenceIds`/`allergyIds`/`customAllergies`).
  - The guest-manager side is verified by inspection, not changed: the couple's modal saves
    through `fromRsvpDraft()` and so already preserves — say so in the PR, with the grep that
    shows no other `status === 'declined'` branch prunes participants anywhere in `src/`.
  - No UI change, no i18n change, no new type, no `pnpm gen:api`.
  - `pnpm typecheck && pnpm lint && pnpm test` green. Do **not** claim a verified server round
    trip — the upstream Zod defect in the phase preamble still blocks any `partner2` save.
- **Refs:** in-repo ADR W-0004 §Decision.6; Phase L decision 1; DS `RSVPEditor.jsx` L225 (the
  promise being made); `src/app/screens/rsvp-create/rsvp-create.ts` (`submit()`, L286–311);
  `src/app/core/helper/{rsvp-draft.ts,rsvp-draft.spec.ts}`;
  `wedding-api/src/common/documents/rsvp.ts` (why an omitted `children` survives but a sent
  `adults` does not)

> **Phase L reopens, 2026-08-23, same day it closed.** The external Zod duplicate-discriminator
> defect that T270–T274 were built around (phase preamble, "External dependency — the user owns
> it") is **fixed upstream** — the same day, by the same author who owned it. The fix changes the
> generated client's shape in ways that break every `KindEnum` reference T270/T271 wrote. This is
> not a new defect and not scope creep on the couple's or guest's side: it is the follow-through
> that ADR W-0004's "Recorded external dependency" section always said would be needed once the
> dependency resolved. **ADR W-0004 has already been amended** (a new "Amendment (2026-08-23)"
> section plus inline superseded-notes on §Decision.2, §Decision.4, the Context note, and the
> "Recorded external dependency" section, which is now marked resolved) — read it before starting
> T275; it settles the reasoning so T275 does not have to re-argue it.

### T275 — Follow the upstream Zod-discriminator fix: `kind` degrades to `string`, `partner1` gains `attending?`

- **Status:** done (`3f0b718`, `5dc71a6`) — 2026-08-23. Regeneration matched the tripwire exactly
  (verified independently): `partner1` gained `attending?`; both partner2 variants' `kind` became
  plain `string` with their `KindEnum` namespaces gone; the profile-partner `AnyOf`/`AnyOf1`/merged
  files swapped which carries `id`/`attending` and lost their own `KindEnum` block the same way.
  All eleven call sites across the eight named files switched to direct `'guest'`/`'plus-one'`
  string-literal comparison/assignment; `AdultDraft.kind` retyped plain optional `string`; the
  now-unused `RsvpDtoAdultsPartner2OneOf` import dropped everywhere it was only used for
  `.KindEnum`. Both "needs no code change" claims confirmed by grep, not assumed: the split
  profile-partner variants have zero consumers outside `core/api/`, and nothing reads or writes
  `partner1.attending` anywhere in `src/`. No behaviour, `.html`, or `.scss` change. Baseline
  `pnpm typecheck` at true `HEAD` was 0 errors (the committed client still matched the code
  written against it); 0 after too — the regeneration and the fix landed as two atomic, each
  individually clean commits. Verified independently: `pnpm typecheck` clean, `pnpm lint` only the
  4 known `shared/modal/` errors, `pnpm test` 60/60, `pnpm gen:api:check` clean.
- **Owner:** agent (implementer)
- **Depends on:** T270, T271, T272, T273, T274 — **all done**, landed 2026-08-23. This task does
  not build on any incomplete work; it is a pure follow-up to a shape change in a dependency T270
  already integrated once.
- **Context:** The API fixed the Zod bug the phase preamble flagged as out of scope by giving each
  `adults.partner2` variant its own `z.literal('guest')` / `z.literal('plus-one')` instead of
  sharing a three-value enum. The hub contract (`../wedding-architecture/contracts/openapi.json`)
  is re-synced to match. This is good news for the save path and bad news for this repo's types,
  for a specific and slightly counter-intuitive reason recorded in ADR W-0004's amendment:
  openapi-generator turns a Zod `z.enum([...])` into a generated `KindEnum` namespace, but it has
  **no code path that emits any type at all** for a Zod `z.literal(...)` — JSON Schema represents
  it as `const`, and the generator's output for a `const` field is plain `kind: string`. So making
  the schema *more* precise upstream makes the generated TypeScript *less* precise: the `KindEnum`
  namespace disappears from the client altogether, on both `RsvpDtoAdultsPartner2OneOf` and
  `…OneOf1`, and every reference this repo has to
  `RsvpDtoAdultsPartner2OneOf.KindEnum.{GUEST,PLUS_ONE}` (11 sites across 8 files, all written in
  T270/T271) stops compiling. Separately, `adults.partner1` gained an optional
  `attending?: boolean` it never had — a narrower `omit` upstream (`kind` only, not `kind` +
  `attending`), not a field this repo asked for or needs to read or write; ADR W-0004's amendment
  records this as settled dead weight, not an open question. And the **non-discriminated** union
  behind the profile-partner type had its two members reordered (unaffected by the Zod fix — that
  union was never discriminated), which swaps which generated interface name — `…AnyOf` vs.
  `…AnyOf1` — carries which shape; confirmed by grep to have zero positional consumers in this
  repo, so it is a rename with no code impact, stated for the record rather than left for the next
  reader to rediscover. This task is a type-following exercise, not a feature: it changes how
  `kind` is spelled and compared, not what any screen does or shows.
- **Acceptance:**
  - **First commit, on its own: `pnpm gen:api`,** against the hub contract with the re-sync landed
    (confirm the hub commit before regenerating — same rule as T270's blocking-dependency note; do
    not assume today's working tree already reflects a committed regeneration, even if it looks
    like it does). State the hub commit referenced in the PR. **Tripwire — the expected diff
    shape:**
    - `rsvp-dto-adults-partner1.ts` gains one field: `attending?: boolean;`.
    - `rsvp-dto-adults-partner2-one-of.ts` and `…-one-of1.ts`: `kind` changes from the generated
      enum type to `kind: string;`, and the `export namespace RsvpDtoAdultsPartner2OneOf { … }` /
      `…OneOf1` `KindEnum` blocks are deleted entirely (not renamed, not narrowed — gone).
    - `user-profile-list-response-dto-profiles-inner-guest-info-partner-any-of.ts` and `…-any-of1.ts`
      swap which one carries `id`/`attending` (the guest shape) vs. neither (the plus-one shape);
      the merged `user-profile-list-response-dto-profiles-inner-guest-info-partner.ts` loses its
      own `KindEnum` block the same way the partner2 variants do.
    - Nothing else moves. If the actual diff differs from this shape in kind (not just in which
      exact files list which fields), **stop and report** — do not adapt the rest of the task to a
      different-shaped diff without asking. `pnpm gen:api:check` clean afterwards. Nothing in
      `src/app/core/api/` is hand-edited (CLAUDE.md folder ownership).
  - **`AdultDraft.kind`** (`core/helper/rsvp-draft.ts`) is retyped from
    `RsvpDtoAdultsPartner2OneOf.KindEnum` (removed) to plain **`string`**, still **optional** —
    matching the type the generated `…OneOf`/`…OneOf1` interfaces themselves now give the field.
    This is **not** a new hand-written type and does not trigger CLAUDE.md Hard rule 15: it is the
    same generated-field type, carried over, not a locally invented union. The doc comment is
    updated to stop citing `KindEnum` (ADR W-0004 §Decision.2's superseded-note has the replacement
    wording).
  - **Every `RsvpDtoAdultsPartner2OneOf.KindEnum.GUEST` / `.PLUS_ONE` reference becomes a direct
    string-literal comparison or assignment against `'guest'` / `'plus-one'`** — the values the
    contract's `const`s actually carry. This is a plain equality/assignment against a field already
    typed `string` by the generated client, not a redeclared type, so Hard rule 15 does not apply;
    do **not** invent a local `type Kind = 'guest' | 'plus-one'` (or similar) to feel safer about
    it — ADR W-0004's amendment explains why that would be the wrong move, and if anyone still
    disagrees after reading it, that is a stop-and-ask, not a unilateral call. Fix, file by file:
    - `core/helper/rsvp-draft.ts`: the doc comment (L35) drops the `KindEnum` citation; the type
      decl (L40) becomes `kind?: string;`; the two `fromRsvpDraft()` sites (L109, L115) drop the
      `as RsvpDtoAdultsPartner2OneOf.KindEnum` cast — narrow only the optionality
      (`string | undefined` → `string`, since the wire type's `kind` is required on both variants),
      by whatever idiomatic means (`as string`, `!`, or restructuring); no `as unknown as`.
    - `core/helper/rsvp-draft.spec.ts` (L67, L89): fixtures use `'guest'` in place of
      `RsvpDtoAdultsPartner2OneOf.KindEnum.GUEST`.
    - `core/helper/partner-account.ts`: the doc comment (L24, "three-value `KindEnum`") is updated
      per ADR W-0004's amendment; the comparison (L39) becomes `partner?.kind === 'guest'`.
    - `core/helper/partner-account.spec.ts` (L19, L30, L52): `'guest'` / `'plus-one'` in place of
      the `RsvpDtoAdultsPartner2OneOf.KindEnum.*` and
      `UserProfileListResponseDtoProfilesInnerGuestInfoPartner.KindEnum.GUEST` fixtures.
    - `shared/rsvp-editor/rsvp-editor.ts` (L442, `addPartner()`): stamps `'plus-one'`.
    - `shared/rsvp-editor/rsvp-editor.spec.ts` (L184, L207, L229, L238): fixtures use `'guest'` /
      `'plus-one'`.
    - `screens/rsvp-create/rsvp-create.ts` (L65, L82, L301 — `EMPTY_DRAFT.partner`,
      `toCreateDraft()`, `submit()`'s `typedPartner`): all three stamp `'plus-one'`.
    - `screens/guest-manager/modal/manage-rsvp-modal.spec.ts` (L90): fixture uses `'guest'`.
    - In every one of the eight files above, drop the now-unused `RsvpDtoAdultsPartner2OneOf`
      import if nothing else in that file still references the type (confirmed by grep: today it
      is imported in exactly these eight files and used **only** for `.KindEnum` access in every
      one — no file uses `RsvpDtoAdultsPartner2OneOf` as a type annotation elsewhere, so the import
      is fully removable in all eight, not just some). An unused import is both a lint failure and
      dead weight; do not leave it "just in case."
  - **The profile-partner union swap needs no code change.** State in the PR the grep that proves
    it: `UserProfileListResponseDtoProfilesInnerGuestInfoPartnerAnyOf` / `…AnyOf1` are referenced
    nowhere in `src/app/` outside the generated model files themselves — the only consumer of the
    profile partner shape is `partnerHasAccount()`, via the merged
    `UserProfileListResponseDtoProfilesInnerGuestInfoPartner` type, reading `.kind`, never a split
    variant and never by structural position. If the grep turns up a consumer this task's recon
    missed, stop and report before writing around it.
  - **`RsvpDtoAdultsPartner1` gaining `attending?: boolean` needs no code change**, per ADR
    W-0004's amendment: nothing in this app may start reading or writing `attending` on `partner1`
    as part of this task — `fromRsvpDraft()`'s `partner1` object literal is unchanged and stays
    that way. This is stated so nobody "completes the picture" by wiring it up as a drive-by.
  - **No behaviour change beyond the type mechanics.** `partnerHasAccount()`'s logic
    (`kind === 'guest'`, no `id` fallback), `fromRsvpDraft()`'s shape (what fields it emits and
    when), and every screen's rendering are unchanged — this task only changes how `kind` is typed,
    compared and imported. If a diff touches an `.html` or `.scss` file, that is out of scope and a
    sign something went sideways.
  - `pnpm typecheck && pnpm lint && pnpm test` green at the end. State the before/after
    `typecheck` error count in the PR (recon for this task found the working tree already failing
    to compile against a client shaped like the tripwire above, from the 11 sites listed, but did
    not run the compiler to get an exact count — get the real number from `HEAD` before touching
    anything, the same way T270 did). Lint clean except the 4 known `shared/modal/` errors
    (CLAUDE.md's carve-out).
- **Refs:** in-repo ADR W-0004 (whole document, particularly "Amendment (2026-08-23)"); ADR
  W-0002 §Decision.1 (superseded by W-0004, unaffected by this task); CLAUDE.md Hard rule 15;
  `src/app/core/api/model/rsvp-dto-adults-partner1.ts`,
  `rsvp-dto-adults-partner2-{one-of,one-of1}.ts`,
  `user-profile-list-response-dto-profiles-inner-guest-info-partner{,-any-of,-any-of1}.ts`
  (regenerated here); `src/app/core/helper/{rsvp-draft.ts,rsvp-draft.spec.ts,partner-account.ts,
  partner-account.spec.ts}`; `src/app/shared/rsvp-editor/rsvp-editor.{ts,spec.ts}`;
  `src/app/screens/rsvp-create/rsvp-create.ts`;
  `src/app/screens/guest-manager/modal/manage-rsvp-modal.spec.ts`;
  `wedding-api/src/common/documents/rsvp.ts`; hub `contracts/openapi.json`

## Phase M — Confirmed party removal (DS `ConfirmDialog`, commit `ccea99a`)

> The design system added a **shared confirmation modal** and gave it exactly one consumer:
> `ui_kits/wedding-app/RSVPEditor.jsx`, where removing a partner or a child now goes through it
> (`confirmRemove` state at L120, the trigger at L165, the dialog at L240–249). This repo's
> `app-rsvp-editor` still removes immediately and silently — one tap on `.remove-btn` and a
> participant plus all their meal and allergy detail is gone from the draft, on both the guest's
> own reply and the couple's manage-RSVP modal. Phase M closes that gap and lands the reusable
> dialog the DS clearly intends to use again.
>
> **Re-baselined 2026-08-23 to DS commit `ccea99a` — the phase is unblocked.** Phase M was first
> written against DS `35b8aa7`, where the component lived at `ui_kits/wedding-app/ConfirmDialog.jsx`
> with no typings and no prompt, and painted its confirm button with a `--danger` token that did not
> exist anywhere in the DS. That gap was escalated as **T276**, and the user's 2026-08-23 ruling —
> *the destructive action gets a destructive colour, so nothing starts until the token lands* — held
> the phase. **`ccea99a` lands the token.** The ruling is therefore **satisfied, not reversed**: T277
> and T278 are `todo`, and they build the danger tone as specified rather than an accent stand-in.
>
> The same commit also promotes the component out of the prototype kit into a **new
> `components/overlays/` group** — `ConfirmDialog.{jsx,d.ts,prompt.md}` plus
> `confirm-dialog.card.html` demoing both tones across all three themes — and **deletes**
> `ui_kits/wedding-app/ConfirmDialog.jsx`. Every "the JSX says X at line N" citation in the first
> draft of this phase pointed at that deleted file; the decisions below are restated against the new
> ones and are the ones to follow. (The DS report accompanying `ccea99a` describes the old file as
> never having had a `tone` prop or a `--danger` reference, which does not match the committed
> `35b8aa7` in this checkout; the likeliest cause is drift between the cloud design project and the
> local clone, there is precedent in `.design-sync/NOTES.md`, and it changes nothing about the work.
> Cite the new files and move on.)
>
> Sequence: **T276** (escalation — **resolved**, kept as the record) → **T277** (mirror the tokens +
> build `app-confirm-dialog`, no call sites) → **T278** (wire it into `app-rsvp-editor`). T277 and
> T278 are split because T277 is the only task that touches `src/styles/_tokens.scss` and
> `src/app/shared/modal/` — the latter being the folder with CLAUDE.md's standing lint carve-out and
> four other call sites — and that diff deserves to be readable on its own.
>
> **Decisions, settled here so no task has to re-argue them:**
>
> 1. **`ConfirmDialog.prompt.md` is the primary spec**, with `ConfirmDialog.d.ts` as the prop
>    contract and `ConfirmDialog.jsx` as the reference implementation — the normal DS trio, and all
>    three must be read before starting. (This is what the first draft of Phase M could not say: at
>    `35b8aa7` there was no prompt and no typings, and the JSX was all there was.) The prompt is
>    four short paragraphs and every one of them is prescriptive — **its rules are acceptance
>    criteria, not colour commentary**; T277 restates each as a testable line. What still does *not*
>    get ported is the JSX's `style={{…}}` objects: the DS ships no per-component stylesheet, so
>    those are its delivery mechanism, not its intent. Every value lands in `confirm-dialog.scss`
>    from `src/styles/_tokens.scss` (CLAUDE.md hard rules 1–3).
> 2. **Compose, do not re-author.** `app-modal`'s own source calls its `sm` size "compact ~360px
>    confirm dialog" (`modal.ts:21`), and `button[app-btn]`'s primary/ghost pair already *is* the
>    prompt's filled/outlined pill pair — compare `button.scss` (pill radius, `--brand-accent` fill,
>    `--on-accent` text, hairline ghost border, `opacity .85` hover) against `ConfirmDialog.jsx`
>    L18–19 line for line. `app-confirm-dialog` is therefore a **thin composition** of `app-modal` +
>    two `app-btn`s, owning only the message paragraph, the button row, the danger tone, Escape and
>    focus. Writing a second backdrop/panel would restate `--scrim` and `--shadow-modal` and undo
>    the point of T249 / hub ADR-0025.
>    - **One deliberate adaptation, stated so it is not mistaken for an oversight:** the prompt's
>      closing sentence — *"The dialog positions itself `absolute inset:0`, so its nearest
>      positioned ancestor must be the app frame, not the page"* — is a constraint of the
>      prototype's device frame, not of the product. `app-modal`'s backdrop is
>      `position: fixed; inset: 0`, pinned to the viewport, which is the correct production
>      translation and the **only** one that survives decision 6's nested case: an `absolute` panel
>      inside `manage-rsvp-modal` would be clipped by `.modal-body`'s `overflow-y: auto`. Do not
>      chase the prototype here.
> 3. **After `ccea99a` the JSX's values are already tokens,** and the mapping this repo needs is
>    almost entirely inside `app-modal`/`app-btn` already: `var(--scrim)` (backdrop),
>    `var(--shadow-modal)` (panel), `var(--surface-card)`, `var(--border-hairline)`,
>    `var(--radius-card)`, `var(--radius-pill)`, `var(--text-muted)` (message) — every one of them
>    present in `src/styles/_tokens.scss` today and already used by `app-modal`. Two adjustments:
>    - the JSX's title and cancel-label colour is `var(--text-body)`, which in **this** repo is
>      spelled `--text-body-color` (the documented naming drift at `_tokens.scss:57–71`).
>      `app-modal`'s `.modal-title` and `app-btn`'s ghost variant already resolve to that same ink,
>      so there is nothing to write.
>    - `--danger` / `--on-danger` are **new** and must be mirrored — decision 4. So "net new colour
>      CSS in this phase" is no longer *none*: it is exactly those two mirrored variables plus the
>      single rule that applies them to the confirm button's danger tone. Nothing else.
> 4. **`--danger` and `--on-danger` now exist.** T276 escalated the gap; the DS resolved it in
>    `ccea99a` (`../wedding-ui-design/tokens/colors.css:62–72`): `--danger: #a8443c;` and
>    `--on-danger: var(--surface);`, **theme-invariant**, deliberately *outside* the `--status-*`
>    group, and deliberately a single token with **no `--warning`/`--success` sibling**. Full
>    rationale and contrast figures are in T276's resolution. Consequences for this phase:
>    - T277 mirrors both into `src/styles/_tokens.scss` as its first step — **two variables, no
>      theme maps, no ramp.**
>    - **`tone` is built from the start**, `'accent' | 'danger'`, matching `ConfirmDialog.d.ts`.
>      Mind the default: the `.d.ts` says **`'accent'`** (`tone?: 'accent' | 'danger'` — *"'accent'
>      (default) is for benign confirmations"*), so danger is **opt-in**, and T278's RSVP removal
>      opts in with `tone="danger"` exactly as `RSVPEditor.jsx:242` does. Do not flip the default to
>      danger to save a binding; the DS chose which way round this fails safe.
>    - A danger fill pairs with **`--on-danger`, never `--on-accent`**, even though the two resolve
>      identically today (both `var(--surface)`). Shipping the second token *is* the DS's stated
>      guard against that drift; using `--on-accent` on a danger fill defeats it.
>    - Still forbidden: hardcoding `#a8443c`, declaring a local danger colour, or inventing a
>      `--warning`/`--success` sibling "for symmetry" — the token's own comment says there is none.
> 5. **Escape and the focus trap belong to `app-confirm-dialog`, not to `app-modal`.** Teaching
>    `app-modal` to close on Escape would silently change four other dialogs — including
>    `guest-create-modal` and `guest-profile-modal`, long editing forms where Escape would throw
>    typed work away. Exactly **two** strictly-additive changes go into `src/app/shared/modal/`
>    (T277): a `showClose` input, and an `aria-labelledby` wiring for the title that already
>    renders. The **4 known pre-existing lint errors in that folder stay exactly as they are** —
>    same count, same lines (CLAUDE.md rule 11's carve-out).
> 6. **Scope is the shared editor's party removal, nothing else.** `app-rsvp-editor` has exactly
>    two call sites — `screens/rsvp-edit/` (rendered by `screens/rsvp/`, the guest's own reply) and
>    `screens/guest-manager/modal/manage-rsvp-modal` (the couple). Both inherit the confirmation
>    from T278 and **both must be verified**. The couple's is **a dialog inside a dialog** — the
>    editor is projected into `app-modal[size="xl"]`'s body slot, whose `.modal-body` is
>    `overflow-y: auto` — which is the one genuinely risky part of this phase. T278 carries the
>    tripwires.
> 7. **Every other destructive control keeps today's behaviour.** Out of scope, explicitly: the
>    custom-allergy chip `✕` (`removeCustomAllergy`), `rsvp-create`'s remove-child button (a
>    different screen, nothing persisted yet), the guest-manager and config-manager remove/delete
>    controls. Also out of scope: the DS's `!p.hasAccount` guard at `RSVPEditor.jsx:165`, which
>    hides remove entirely for a linked partner — this repo deliberately keeps remove available
>    there (`rsvp-editor.html:56–59`, "Remove stays allowed", ADR W-0002 §Decision.3). Revisiting
>    that is a separate decision, not a drive-by "align with the DS".
>    The prompt's opening line draws the same boundary from the other side and is worth quoting
>    when the next "should this be confirmed too?" comes up: *"Use it when an action is irreversible
>    or destroys data; never for information, success or 'are you sure you want to save'."* This
>    component is not a general-purpose alert.
> 8. **Initial focus goes to the confirm button, per the DS — with one guard this repo adds.** The
>    prompt is explicit (*"The confirm button takes focus on mount"*) and the reference implements
>    it (`ConfirmDialog.jsx:10`, `querySelector('button[data-confirm]').focus()`). This
>    **supersedes** the first draft of T277, which focused cancel. Recording why, because the
>    reasoning cuts both ways: WAI-ARIA APG suggests focusing the *least* destructive action in a
>    confirmation, and the DS went the other way so the dialog answers in one keystroke. The DS is
>    the source of truth for component behaviour, so it wins — **but** focusing the destructive
>    button opens a concrete hazard the prototype cannot hit, and T277 must close it: a keyboard
>    user who activates `.remove-btn` with **Enter** fires `click` on `keydown`, focus lands on the
>    confirm button while the key is still down, and an auto-repeat `keydown` then activates
>    *confirm* — one held key, participant gone, no dialog seen. T277 carries the guard and the
>    regression spec. Escape, the scrim and a visible, never-dimmed cancel button remain the ways
>    out (decision 5, and the prompt's "never dim or hide it").
>
> **Working-tree note (2026-08-23):** the tree is dirty — `angular.json`, `screens/invitee/`,
> `screens/rsvp/`, `screens/rsvp-create/` and a new untracked `rsvp-create.spec.ts`. **None** of
> those files is touched by this phase (T277: `src/styles/_tokens.scss` + `shared/modal/` + a new
> `shared/confirm-dialog/`;
> T278: `shared/rsvp-editor/` + `public/i18n/`), so there is no conflict — but do not fold any of
> those unrelated changes into a Phase M commit.
>
> **No contract change, no hub escalation for the code, no `pnpm gen:api`, no new API type.**

### T276 — [ESCALATION → hub/DS] Add a `--danger` semantic colour token

- **Status:** **resolved by DS commit `ccea99a`** (2026-08-23) — the tokens shipped. Kept as the
  record of the escalation; the in-repo mirror is the first step of **T277**, which is now
  unblocked. The user's 2026-08-23 ruling (*wait for the token rather than ship the confirm button
  in `--brand-accent`*) is **satisfied, not reversed**.
- **Owner:** system-architect (decision) → wedding-web implementer (mirror, in T277)
- **Depends on:** —
- **Resolution (2026-08-23, DS `ccea99a` "feat: add ConfirmDialog component for destructive
  actions"):** both tokens landed in `../wedding-ui-design/tokens/colors.css:62–72`, in the `:root`
  semantic-alias block immediately after `--scrim`:
  - **`--danger: #a8443c;`** and **`--on-danger: var(--surface);`**
  - **Theme-invariant** — one value across terracotta, mauve and verdeagua, commented in the
    `--status-provisional` style. Rationale, from the token's own comment: a destructive colour that
    harmonises with the theme reads decorative, which is the same argument `--scrim` and
    `--status-provisional` already make. One value clears all three palettes — clearly hotter and
    darker than terracotta's `#c97155`, separating on chroma *and* lightness from mauve's dusty
    `#b08a92` (the only close call), and reading as an alarm against verdeagua's `#7aaea2`/`#f5f7f4`.
  - **Contrast:** 5.9:1 vs. white (WCAG AA for normal text, as a fill under `--on-danger`; fails
    AAA) and 5.4:1 against the lightest `--bg` — so it is also usable as destructive *label* text,
    not only as a fill.
  - **`--on-danger` exists deliberately** even though it resolves to the same `var(--surface)` as
    `--on-accent` today: pairing a danger fill with a token named "on-*accent*" is exactly the
    semantic drift that lets a wrong value ship, and it gives one place to change if `--danger` ever
    darkens. **Consume `--on-danger` on danger fills, never `--on-accent`.**
  - **One token, no ramp** — there is no `--warning` and no `--success`, and the comment says so
    explicitly. `--danger` is also deliberately **outside** the `--status-*` group: those label a
    data state on a chip (`--status-cancelled` is grey `--sub`, not red), whereas `--danger` paints
    an interactive affordance the user is about to trigger.
  - Enforced upstream: `_adherence.oxlintrc.json` lists both in the allowed-token set and pins
    `<ConfirmDialog>`'s `tone` to `'accent' | 'danger'`.
  - **For `src/styles/_tokens.scss`: two variables, no theme maps, no ramp** — see T277's first
    acceptance criterion for placement.
  - One neutral note for the record: the DS report accompanying `ccea99a` states the previous
    `ConfirmDialog.jsx` never referenced `--danger`, which does not match `35b8aa7` as committed in
    this checkout (its L9 is quoted below). Most likely cloud-vs-local drift, precedent in
    `.design-sync/NOTES.md`. It has no bearing on the work; the new files are the spec.
- **Why escalated (original, 2026-08-23; kept as written, past tense):** DS
  `ui_kits/wedding-app/ConfirmDialog.jsx:9` — at commit `35b8aa7`, a file **deleted** by `ccea99a` —
  read `tone === 'danger' ? 'var(--danger, #a8443c)' : 'var(--accent)'`, but `--danger` was
  **defined nowhere**: not in `../wedding-ui-design/tokens/colors.css`, not in `tokens/spacing.css`,
  not in this repo's `src/styles/_tokens.scss`. The two occurrences in the whole DS tree were that
  line and its copy inside `_ds_bundle.js`, so the prototype rendered the literal `#a8443c`. Adding
  a new semantic colour to the shared token contract (and its mirror in `_tokens.scss`) is a
  **design-system change** — per CLAUDE.md ("design system changes … escalate") that is out of the
  web-architect's authority, exactly as T249 was for `--scrim`/`--shadow-*`. Hence: escalate, do not
  invent a danger colour in-repo. **Resolved as above.**
- **What the hub/DS was asked to decide** (all three answered above): whether `--danger` becomes a
  real token and whether it is theme-invariant or per-theme; whether a paired `--on-danger` is
  needed or `--on-accent` suffices; and whether `tone` implies a fuller status ramp
  (danger/warning/success) rather than one token.
- **Unblocks:** **T277** — mirror `--danger` + `--on-danger` into `src/styles/_tokens.scss` the same
  way T219/T241/T249's mirrors did (first acceptance criterion of T277, not a separate task), then
  build `app-confirm-dialog` **with** its `tone` input per decision 4, and let T278's RSVP-removal
  call site pass `tone="danger"`.
- **Refs:** DS commit `ccea99a`; `../wedding-ui-design/tokens/colors.css:62–72`;
  `../wedding-ui-design/components/overlays/ConfirmDialog.{prompt.md,d.ts,jsx}`;
  `../wedding-ui-design/_adherence.oxlintrc.json` (allowed-token set, `tone` union);
  `src/styles/_tokens.scss`; T249 + hub ADR-0025 (the precedent for this escalation shape);
  `../wedding-architecture/.agent/authority.md`; CLAUDE.md hard rule 3

### T277 — Mirror `--danger`/`--on-danger` + build the shared `app-confirm-dialog` (no call sites yet)

- **Status:** done (`a7c9aff`) — 2026-08-23. Corrected from a stale `todo` on
  2026-08-25 while starting T279: `src/app/shared/confirm-dialog/` (`.ts/.html/.scss/.spec.ts`)
  and the `--danger`/`--on-danger` mirror in `src/styles/_tokens.scss` both landed in `a7c9aff`,
  the same commit that wired T278 into `app-rsvp-editor` — the status line just never got updated
  to reflect it. Verified by hand: all four files exist, `_tokens.scss:92-93` carries the two
  tokens after `--status-final` per this task's spec, and `confirm-dialog.spec.ts` covers the
  acceptance criteria below. (T278's own status line is *also* stale — still `todo` — but
  correcting it is out of scope here; flagged for a follow-up, not fixed in this pass.)
- **Owner:** agent (implementer)
- **Depends on:** T276 (resolved)
- **Context:** Read, in this order: `../wedding-ui-design/components/overlays/ConfirmDialog.prompt.md`
  (the spec — four paragraphs, all of them binding), `ConfirmDialog.d.ts` (the prop contract), then
  `ConfirmDialog.jsx` (24 lines, the reference implementation), and finally Phase M decisions 1–5
  and 8 above, which settle what to port, what to adapt and what to ignore. Do **not** go looking
  for `ui_kits/wedding-app/ConfirmDialog.jsx` — `ccea99a` deleted it. This task mirrors two tokens,
  builds the component and the two additive `app-modal` inputs it needs, and wires it to
  **nothing**: T278 is the first call site. Follow `.agent/skills/design-component-author.md`.
- **Acceptance:**
  - **First: mirror the two tokens into `src/styles/_tokens.scss`** — `--danger: #a8443c;` and
    `--on-danger: var(--surface);`, **exactly two variables, no theme maps, no ramp** (T276's
    resolution). Place them at the **end of the semantic-alias `:root` block**, after
    `--status-final` (today's `_tokens.scss:85`), which is where the DS's `colors.css` ordering puts
    them relative to the aliases; carry a condensed version of the DS comment — theme-invariant,
    not a `--status-*`, no `--warning`/`--success` sibling — in the same house style as the existing
    `--status-provisional` comment. **Note the pre-existing divergence and do not "fix" it:** this
    repo mirrored `--scrim` into the *elevation* block (`_tokens.scss:127`) rather than the colour
    block where the DS keeps it, a T249-era choice; moving it is out of scope for this task.
    Nothing else in `_tokens.scss` changes.
  - New `src/app/shared/confirm-dialog/confirm-dialog.{ts,html,scss,spec.ts}` — standalone,
    `selector: 'app-confirm-dialog'`, `ChangeDetectionStrategy.OnPush`, **three separate files**,
    no `template:`/`styles:` (hard rule 1), no `style` attribute or `ngStyle` anywhere (hard
    rule 2). Imported by path (`@app/shared/confirm-dialog/confirm-dialog`), matching how
    `app-pill`/`app-avatar` are consumed; do **not** add it to `shared/index.ts`, which only
    re-exports the four screen-level singletons.
  - **API (signals, hard rule 5), matching `ConfirmDialog.d.ts` name for name:**
    `open = input(false)`; `title = input.required<string>()`; `message = input<string>('')`;
    `confirmLabel = input.required<string>()`; `cancelLabel = input.required<string>()`;
    `tone = input<'accent' | 'danger'>('accent')`; `confirm = output<void>()`;
    `cancel = output<void>()`. Two deliberate departures from the `.d.ts`, both forced by this
    repo's rules and neither to be "corrected" back:
    - the label inputs are **required with no default** — the `.d.ts`'s `'Confirm'`/`'Cancel'`
      defaults are hardcoded English and would violate hard rule 8;
    - all four text inputs take **already-resolved strings**, as `app-modal`'s `title` does
      (`manage-rsvp-modal.html:1`); the component imports no `TranslatePipe` and owns no i18n keys,
      so the copy stays with whoever opens it.
    `tone`'s **default is `'accent'`**, per the `.d.ts` and the reference (`ConfirmDialog.jsx:3`) —
    danger is opt-in. Do not default it to `'danger'`.
  - **Tone (decision 4).** `tone="danger"` fills the confirm button with `var(--danger)` and its
    label with `var(--on-danger)`; `'accent'` leaves `app-btn`'s own `--brand-accent`/`--on-accent`
    untouched. Implement as a class binding on the confirm button plus one rule in
    `confirm-dialog.scss` — no `style` attribute, no `ngStyle` (hard rule 2). **`--on-accent` must
    not appear in the danger rule**, and `#a8443c` must not appear anywhere in the diff. The
    **cancel button is never toned**: it stays hairline-ghost in both tones (prompt: *"Never make
    cancel the filled one, and never dim or hide it"*).
  - Template composes the existing chrome, and nothing else:
    `<app-modal [open]="open()" size="sm" [dismissable]="true" [showClose]="false"
    [title]="title()" (close)="cancel.emit()">`, the message as a `<p>` in the default content slot
    (rendered only when `message()` is non-empty, per `ConfirmDialog.jsx:16`), and the two buttons
    projected into `[modal-actions]`.
  - **Buttons:** cancel first (`app-btn [primary]="false"`), confirm second (`app-btn`, default
    primary + the tone class), both `type="button"`, side by side and **equal width** (`flex: 1`,
    `ConfirmDialog.jsx:17–19`). `.modal-actions` is `display:flex; justify-content:flex-end`, so
    project **one wrapper element** that spans the row rather than fighting the justify — the
    wrapper, the two `flex: 1` children, the danger rule and the message paragraph's type
    (`--text-muted`, the existing small-body size/line-height; no new sizes) are the entire contents
    of `confirm-dialog.scss`. Gap from the spacing scale, not a literal.
  - **The cancel button is never `disabled` and never conditionally hidden** — there is no input
    that could remove it. The prompt makes this a rule, and it is the escape hatch that decision 8's
    focus placement leans on.
  - **All three dismissals emit `cancel`** — Escape, a scrim/backdrop click, and the cancel button
    (prompt: *"Escape, a scrim click and the cancel button all call `onCancel` — the host must treat
    it as a real dismissal"*). One output, three paths, no "how did it close" discrimination.
  - **Escape cancels, scoped.** The reference uses a `window` keydown listener
    (`ConfirmDialog.jsx:5–9`); this repo narrows it to a listener on the component's own host, so it
    only fires while focus is inside the dialog — which decision 8's focus placement guarantees —
    and it calls `stopPropagation()` so it can never also reach a host `app-modal` or a
    screen-level `(keydown.escape)` such as `config-manager`'s. A `window` listener would close the
    dialog from anywhere on the page and, nested inside `manage-rsvp-modal`, is the shortest route
    to closing the wrong thing. `app-modal` itself is **not** taught Escape (decision 5).
  - **Focus, concretely testable (decision 8 — this supersedes the earlier "focus cancel" draft):**
    - On open, focus moves to the **confirm** button, per the prompt (*"The confirm button takes
      focus on mount"*) and `ConfirmDialog.jsx:10`. Implement with a `viewChild` ref + an `effect()`
      on `open()`, not a lifecycle hook + `setTimeout`.
    - **Accidental-activation guard (this repo's addition, decision 8).** Focusing the destructive
      button must not let the keystroke that *opened* the dialog also confirm it: a keyboard user
      activating `.remove-btn` with Enter fires `click` on `keydown`, and a held/auto-repeated Enter
      would then land on the freshly-focused confirm button. Close it — swallow activations of the
      confirm button that arrive from a key that was already down when the dialog mounted (e.g.
      ignore `keydown`-driven activation until the first `keyup`, or defer the `focus()` to after
      the current event has finished dispatching). Implementer's choice of mechanism; what is
      **not** optional is the named regression spec below. If no mechanism works cleanly without a
      timer, stop and report rather than shipping a plain `focus()` — do **not** silently move focus
      to cancel instead, that is a DS deviation and needs the user, not a workaround.
    - **Focus trap:** with `showClose` false there are exactly two focusable elements; Tab from the
      confirm button wraps to cancel and Shift+Tab from cancel wraps to confirm. Nothing behind the
      dialog — host page or host modal — can receive keyboard focus while it is open.
    - **Focus restore is split, deliberately:** the dialog captures `document.activeElement` when it
      opens and restores it on **cancel** (Escape, backdrop, or the cancel button) — the trigger is
      still there. On **confirm** it restores nothing, because the trigger is usually the control
      that the confirmed action destroys; the host decides where focus goes (T278 does).
  - **Accessibility (hard rule 14):** `role="dialog"` + `aria-modal="true"` come from `app-modal`.
    The dialog gets an accessible **name** from the new `aria-labelledby` wiring below. For the
    **description**, set `[attr.aria-describedby]` on *both buttons* to the message paragraph's id
    — `app-modal` owns the `role="dialog"` element so the description cannot be attached there
    without a third new input, and with only two focusable elements this guarantees a keyboard/SR
    user hears the consequence on each. Leave a one-line comment saying so, so a later reviewer
    does not "fix" it into thin air.
  - **Exactly two additive changes to `src/app/shared/modal/`** (decision 5), and no others:
    - `showClose = input(true)` on `Modal`; `modal.html`'s close button renders when
      `dismissable() && showClose()`. Backdrop dismissal is untouched, so the DS's "backdrop
      cancels, but there is no ×" behaviour is expressible without disabling dismissal.
    - The existing `<h2 class="modal-title">` gets a stable unique id and the `role="dialog"`
      element gets `[attr.aria-labelledby]` pointing at it **when `title()` is set**, and nothing
      when it is not. Generate the id per instance (e.g. off Angular's `inject(APP_ID)`-free
      `crypto.randomUUID()` or a module-level counter) — two modals must never collide.
  - **The other four `app-modal` call sites are unchanged**: `guest-create-modal`,
    `guest-profile-modal`, `manage-rsvp-modal`, `login`. `showClose` defaults `true` so their ×
    stays; `aria-labelledby` is a pure addition. Their existing specs must pass **untouched** — if
    a spec needs editing to stay green, stop and report, because that means the change was not
    additive.
  - **The 4 known lint errors in `src/app/shared/modal/` are unchanged** — same count, same rules,
    same lines. Do not fix them; do not add a fifth.
  - Unit spec (`confirm-dialog.spec.ts`) covers: nothing rendered when `open` is false; title,
    message and both labels render when open; the message `<p>` is absent when `message` is empty;
    clicking confirm emits `confirm` exactly once and never `cancel`; clicking cancel emits
    `cancel`; Escape emits `cancel`; a backdrop click emits `cancel`; **no `.modal-close` element
    exists** in the DOM; after opening, `document.activeElement` is the **confirm** button; Tab from
    confirm lands on cancel; the cancel button is not `disabled` in either tone; the confirm button
    carries the danger class only when `tone="danger"` and the cancel button never does; both
    buttons carry `aria-describedby` resolving to the message paragraph's id. Plus one **named
    regression spec** for decision 8's guard — `it('does not confirm from the keystroke that opened
    it')` or equivalent — dispatching a `keydown`-driven activation on the trigger and asserting
    `confirm` did not fire.
  - No new `type`/`interface` that restates an API model (hard rule 15 — this component has no API
    surface at all); no `pnpm gen:api`; `pnpm gen:api:check` still clean.
  - `pnpm typecheck && pnpm lint && pnpm test` green — lint clean **except** the 4 known
    `shared/modal/` errors (CLAUDE.md rule 11's carve-out). No `pnpm test:e2e`: it does not exist
    (T263).
  - Verified by hand in **all three themes** — the danger fill is theme-invariant by design, so the
    check is that it still reads as an alarm (not as decoration) on each backdrop; the DS's
    `components/overlays/confirm-dialog.card.html` demos exactly this, both tones × three themes,
    and is the reference to compare against. If no browser is available, say so plainly rather than
    claiming it (T273/T275 precedent).
- **Refs:** DS commit `ccea99a`;
  `../wedding-ui-design/components/overlays/ConfirmDialog.prompt.md` (**the spec**),
  `ConfirmDialog.d.ts` (prop contract), `ConfirmDialog.jsx` (reference, 24 lines),
  `confirm-dialog.card.html` (both tones × three themes);
  `../wedding-ui-design/tokens/colors.css:62–72`; Phase M decisions 1–5 and 8; T276's resolution;
  hub ADR-0025 (`--scrim`, `--shadow-modal`, no OS dark mode);
  `.agent/skills/design-component-author.md`; `src/styles/_tokens.scss`;
  `src/app/shared/modal/modal.{ts,html,scss}`; `src/app/shared/button/button.{ts,scss}`;
  new `src/app/shared/confirm-dialog/`

### T278 — `app-rsvp-editor`: confirm before removing a partner or a child

- **Status:** todo — blocked only on T277 landing first (T276 is resolved)
- **Owner:** agent (implementer)
- **Depends on:** T277
- **Context:** Today `.remove-btn` (`rsvp-editor.html:94–103`) calls `removePerson(card.key)`
  (`rsvp-editor.ts:455`) and the participant — with every diet id, allergy id and custom allergy
  they carry — is out of the draft on the first tap, on a 38px target that sits directly beside the
  name inputs. The DS put a confirmation in front of it (`ui_kits/wedding-app/RSVPEditor.jsx:165`
  opens it, L240–249 renders it, unchanged in shape by `ccea99a` apart from gaining
  `tone="danger"`). This task moves the existing mutation behind that confirmation and changes
  nothing about what the mutation does.
- **Acceptance:**
  - `rsvp-editor.ts` gains `pendingRemoval = signal<PersonKey | null>(null)` and three methods:
    `requestRemove(key)` (sets it, ignoring `partner1` and any unrecognised key — the same early
    `return` the current `removePerson` already has, kept so a programmatic call cannot drop the
    primary guest), `confirmRemove()` (does **verbatim** what today's `removePerson` body does —
    `partner2: undefined` / `children.filter` / the `openKey` reset / one `draftChange.emit` — then
    clears the signal), and `cancelRemove()` (clears it, emits nothing). **The draft mutation logic
    is not rewritten**; if the diff changes what `confirmRemove` emits, that is out of scope.
  - `rsvp-editor.html`: `.remove-btn`'s `(click)` calls `requestRemove(card.key)`; everything else
    about that button — position, `aria-label`, the `×` glyph, its `.scss` — is untouched.
    `<app-confirm-dialog>` renders **once**, at the end of the template (its panel is
    fixed-position, so the DS's placement between the add-links and the note is immaterial), driven
    by `pendingRemoval()`.
  - **`tone="danger"` is bound**, matching `RSVPEditor.jsx:242`. This is the one destructive call
    site in the app and the reason T276 was escalated at all; T277 defaults `tone` to `'accent'`, so
    an unbound `tone` here would silently ship the wrong colour and still look plausible. Assert the
    binding in the spec.
  - **All three dismissals mean "keep them".** `(cancel)` — Escape, scrim click, or the Keep button
    — clears `pendingRemoval` and emits nothing; there is no path where a dismissal removes anyone.
  - **Copy, from `RSVPEditor.jsx:242–246`, English verbatim.** New keys in **all three**
    `public/i18n/{en,es,fr}.json` under a new `rsvp.editor.remove` block, keeping each file's
    existing style and ordering:
    - `titlePartner` — "Remove the partner?" (used for `partner2`)
    - `titleChild` — "Remove this child?" (used for `child:*`)
    - `message` — "{{name}} will be taken off the RSVP, along with their meal and allergy details.
      This cannot be undone once saved." The **`{{name}}` parameter is required**; translators keep
      it and may reposition it within the sentence, but must not drop it or split the string.
    - `fallbackPartner` — "This partner"; `fallbackChild` — "This child". Used as `{{name}}` when
      the person has no name yet, matching the DS's
      `rsvpFullName(p) || (kind === 'child' ? 'This child' : 'This partner')`.
    - `keep` — "Keep", the cancel label. Deliberately **not** `shared.cancel` ("Cancel"): the DS
      chose a word that names the outcome, and es/fr should do the same ("Conservar" / "Garder"
      register, translator's call) rather than reusing "Cancelar"/"Annuler".
    - The **confirm label reuses the existing `shared.remove`** ("Remove" / "Eliminar" /
      "Supprimer") — do not add a fourth spelling of the same word. It satisfies the prompt's rule
      that `confirmLabel` *names the action* ("Remove", "Delete", "Revoke") so the buttons read
      without the title; `shared.confirm` ("Confirm"/"Confirmar") would not.
    es/fr are real translations, not English placeholders; the three files stay structurally
    identical (same key set) and valid JSON. No existing key is deleted or re-worded.
    **Note on which English is authoritative:** `ConfirmDialog.prompt.md`'s worked example shows a
    differently-worded RSVP message (*"They will be taken off the RSVP … This **can** be undone
    until you save."*). That is documentation illustrating the prop, not the call site. Take the
    copy from `RSVPEditor.jsx:244` as specified above — it keeps the person's name, which is the
    whole point of the interpolation, and both phrasings state the same fact from opposite sides
    (removal only becomes permanent on save; both this repo's hosts persist behind an explicit
    Save). Do not blend the two.
  - Title selection is by card kind, not by key string parsing at the call site: `titleChild` for
    `card.role === 'child'`, `titlePartner` otherwise. `message` is built with
    `TranslateService.instant`/the `translate` pipe with `{ name: fullName(card) || <fallback> }`.
  - **Focus after a confirmed removal** (T277 leaves this to the host, because the trigger is
    gone): `h3.party-title` gains `tabindex="-1"` — so it is never in the tab order — and receives
    focus when `confirmRemove()` completes, putting the user back at the top of the section that
    just changed. A `.party-title:focus { outline: none; }` rule is permitted if the programmatic
    ring looks wrong; leaving the default ring is equally acceptable. On **cancel**, do nothing —
    T277 already restores focus to the `.remove-btn` that opened the dialog.
  - **Both call sites verified — this is where the risk is.** `app-rsvp-editor` is used by
    `screens/rsvp-edit/` (the guest, rendered by `screens/rsvp/`) and by
    `screens/guest-manager/modal/manage-rsvp-modal` (the couple), where it is projected into
    `app-modal[size="xl"]`'s body slot. For the **nested** case check, by hand:
    - the confirm's scrim covers the whole viewport, including the host modal's panel;
    - the confirm's panel is **not clipped** by `.modal-body`'s `overflow-y: auto`;
    - clicking the confirm's backdrop or pressing Escape closes **only** the confirm — the
      manage-RSVP modal stays open and no unsaved edit is lost;
    - the couple's "Save changes" / "Back" footer buttons are not reachable by Tab while the
      confirm is open.
    **Tripwire:** if the confirm renders *behind* the host modal or is clipped, **stop and report**.
    Do not start a `z-index` war, do not re-parent it with a portal, and do not introduce
    `@angular/cdk`'s `Dialog`/`Overlay` or any third-party dialog (hard rule 12) to work around it.
  - The **doubled scrim** when nested (`--scrim` over `--scrim`, ~0.45 over 0.45) is expected and
    accepted for now; do not add a lighter "nested" scrim variant — that would be a DS decision.
  - `rsvp-editor.spec.ts` extends (existing assertions stay green): clicking `.remove-btn` on a
    child emits **no** `draftChange` and renders `app-confirm-dialog`; confirming emits exactly one
    `draftChange` with that child gone and the others intact; cancelling emits none and closes the
    dialog, leaving the party unchanged; the same three for `partner2`; removing the currently-open
    card still resets `openKey`; the dialog receives `titleChild` for a child and `titlePartner` for
    the partner; the message carries the person's full name, and the `fallbackChild` /
    `fallbackPartner` string when they are unnamed; and `tone` is bound to `'danger'`.
  - **Nothing else in the editor changes.** `removeCustomAllergy` (the allergy chip `✕`),
    `addPartner`, `addChild`, the status row, the note, the accordion and `rsvp-editor.scss`
    (beyond the optional `.party-title:focus` rule) are untouched. The `.remove-btn` still renders
    for a `nameLocked` partner — do **not** adopt the DS's `!p.hasAccount` guard (decision 7). No
    confirmation is added to `rsvp-create`'s remove-child button, the guest-manager deletes, or the
    config-manager remove buttons.
  - No new API type and no local restatement of one (hard rule 15); no `pnpm gen:api`;
    `pnpm gen:api:check` still clean. No `.html`/`.scss` change outside
    `src/app/shared/rsvp-editor/`.
  - `pnpm typecheck && pnpm lint && pnpm test` green — lint clean **except** the 4 known
    `shared/modal/` errors. Verified by hand at mobile and desktop widths in all three themes, on
    both call sites; if no browser is available in the environment, **say so plainly** rather than
    claiming it (T273/T275 precedent).
- **Refs:** DS commit `ccea99a`; `ui_kits/wedding-app/RSVPEditor.jsx` (L120 `confirmRemove`, L165
  the trigger, L240–249 the dialog incl. `tone="danger"` at L242);
  `../wedding-ui-design/components/overlays/ConfirmDialog.{prompt.md,d.ts,jsx}`;
  Phase M decisions 4, 6, 7, 8; in-repo ADR W-0003
  (the shared editor's boundary), ADR W-0002 §Decision.3 ("Remove stays allowed");
  `src/app/shared/rsvp-editor/rsvp-editor.{ts,html,scss,spec.ts}`;
  `src/app/shared/confirm-dialog/` (T277); `src/app/core/helper/rsvp-draft.ts` (`PersonKey`);
  `public/i18n/{en,es,fr}.json`; `src/app/screens/rsvp-edit/rsvp-edit.html`,
  `src/app/screens/guest-manager/modal/manage-rsvp-modal.html` (the two call sites to verify)

---

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

## Phase O — In-app notifications + transient toasts (DS `7db5d1c`)

> The design system shipped its **notification and toast surface**: `navigation/NotificationBell`,
> `overlays/NotificationDialog`, `overlays/Toast`, `overlays/ToastStack`, two new `core/Icon`
> glyphs (`bell`, `check`), five new `AppHeader` props that mount the bell **left of the account
> cluster**, and two reference cards (`notification-bell.card.html`, `toast.card.html`). The API
> half has been live for a while and is already in the generated client — `NotificationsService`
> with `notificationsControllerListV1()`, `…MarkReadV1({ id })`, `…ReadAllV1()` and
> `…UnreadCountV1()`, plus `NotificationDto` / `NotificationListResponseDto` /
> `UnreadCountDto` / `ReadAllResponseDto`. Nothing in this app consumes any of it today: there is
> no bell, no dropdown, no detail modal, and no toast infrastructure at all. Phase O closes that.
>
> **No contract change, no `pnpm gen:api`, no hub escalation for the code.** `pnpm gen:api:check`
> must stay clean throughout; every task below asserts it rather than regenerating.
>
> **Decisions, settled here so no task has to re-argue them:**
>
> 1. **The four `.prompt.md` files are the spec**, the `.d.ts` files are the prop contracts, the
>    `.jsx` files are reference implementations and the two `.card.html` files are the visual
>    reference. Read all of them before starting. What does **not** get ported is the JSX's
>    `style={{…}}` objects — the DS ships no per-component stylesheet, so those are its delivery
>    mechanism, not its intent. Every value lands in a `.scss` file from `src/styles/_tokens.scss`
>    (CLAUDE.md hard rules 1–3). Same rule Phase M decision 1 set for `ConfirmDialog`.
> 2. **No portal, no `data-overlay-host`.** The DS commit added `data-overlay-host` to both app
>    frames in `ui_kits/wedding-app/AppShell.jsx` because `NotificationBell` portals the dialog into
>    the closest such ancestor and `ToastStack` positions itself `absolute inset:0` against the
>    prototype's device frame. **That is a constraint of the prototype, not of the product** — the
>    identical adaptation is already recorded and shipped as Phase M decision 2: `app-modal`'s
>    backdrop is `position: fixed; inset: 0`, pinned to the viewport, which is the correct
>    production translation. So: `app-notification-dialog` composes `app-modal` and needs no portal;
>    `app-toast-stack` is `position: fixed`, not `absolute`. **Do not add a `data-overlay-host`
>    attribute anywhere in this repo, and do not write a `ViewContainerRef`/CDK-style portal.**
> 3. **Stacking order is already decided by the existing chrome.** In `private-layout.scss` the
>    header is `z-index: 20` and `.tab-bar` is `z-index: 10` (private-layout's `.tab-bar` class wins
>    on specificity over `tab-bar.scss`'s own `:host { z-index: 30 }` — verify this rather than
>    trusting either file alone). `app-modal`'s backdrop is `z-index: 1000`. So: the bell dropdown
>    sits **inside** the header's stacking context (DS uses 50; any value works, it is scoped), and
>    `app-toast-stack` takes **`z-index: 70`** — the DS's own number, above both chrome layers and
>    below every modal, so a dialog always covers a toast and never the reverse.
> 4. **The DS `Notification` shape is not the API shape, and the API wins (hard rule 15).**
>    `NotificationBell.d.ts` declares `read?: boolean` and a closed
>    `type?: 'rsvp'|'schedule'|'album'|'travel'|'seating'|'system'` union. The contract gives
>    `status: 'unread'|'read'` (`NotificationDto.StatusEnum`) and a deliberately **open**
>    `type: string` (`wedding-api/src/common/documents/notification.ts:47-51`: *"Deliberately a
>    plain string, not an enum … types are enumerated as they are added"*). Every component in this
>    phase consumes **`NotificationDto` directly**. Unread is
>    `n.status === NotificationDto.StatusEnum.UNREAD`, never a local `read` boolean. **No local
>    `interface Notification`, no `type NotificationType = '…' | '…'`, no re-export wrapper.** A
>    `const TYPE_ICON: Record<string, IconName>` presentation lookup keyed by the open string, with
>    a fallback, is *not* a type redeclaration and is the intended mechanism.
> 5. **The DS's six type names do not exist in this system.** The only producer of notification
>    records today is the milestone announcement fan-out
>    (`wedding-api/src/modules/milestones/announcement.service.ts:286-289`), which sets
>    `type = templateId = announcementType`. The real values are therefore
>    `MilestoneDto.AnnouncementTypeEnum`'s four: **`save-the-date`, `invitation`, `rsvp-reminder`,
>    `menu-selection-reminder`**. Map those to DS glyphs — `save-the-date` → `calendar`,
>    `invitation` → `mail`, `rsvp-reminder` → `mail`, `menu-selection-reminder` → `edit` — with
>    **`info` as the fallback for any unknown string**, exactly as `NotificationBell.jsx:91` does
>    (`TYPE_ICON[n.type] || 'info'`). A record with an unrecognised type must render, never blank
>    and never throw. Do **not** hand-write a union of the four values (decision 4); read them from
>    `MilestoneDto.AnnouncementTypeEnum` if a compile-time reference is wanted at all.
> 6. **`title` and `body` are optional on the wire and are empty on every record written today.**
>    `NotificationDto.title?`/`body?` are optional by contract, and the API's own DTO doc says why
>    (`wedding-api/src/modules/notifications/dto/notification.dto.ts:25-29`): *"ADR-0028 §2's
>    catalogue has no in-app slice, so most records carry only `templateId` + `data` and the client
>    renders from those … the web design that consumes this has not been done yet, so v1 hands over
>    both and lets it choose."* The announcement fan-out passes neither. **So a naive port of the DS
>    renders five blank rows.** T282 escalates this; T283 lands the interim in-repo answer
>    (**ADR W-0005**): a small client-side copy catalogue keyed by `templateId`, used **only** when
>    the record carries no `title`/`body` — the frozen snapshot on the record always wins when
>    present. This is the choice the API explicitly delegated, not a workaround, and it costs one
>    i18n block to reverse if the hub later ships an in-app catalogue slice.
> 7. **No "All notifications" screen, and no footer link.** The DS prompt gates the footer on a
>    destination existing (*"pass `onViewAll` when a full list screen exists"*) and none does. It is
>    also not buildable today: the generated `notificationsControllerListV1()` takes **no**
>    parameters at all — no cursor, no limit — even though the response carries `nextCursor`. So the
>    client can read exactly one page. The bell stays a peek. If a full list is ever wanted, the
>    missing query parameters are a **contract change and a hub escalation**, not something to work
>    around here.
> 8. **The read receipt is the dialog open, and only that.** `onRead(id)` fires **once**, on an
>    **unread** record, **when its detail opens** — not on hover, not on opening the dropdown, not
>    from a button. `NotificationDialog` must never grow a "mark as read" control. The endpoint is
>    **`PATCH /v1/notifications/{id}`** (`notificationsControllerMarkReadV1`), not the
>    `POST /notifications/{id}/read` the DS prompt writes — the generated client is authoritative
>    and the DS prose is describing the shape, not the route.
> 9. **Toasts get built, mounted and given exactly one real producer in this phase.** The DS is
>    explicit that a toast *tells* and never asks, that it always lives in a `ToastStack`, that
>    there is **one stack per screen mounted in the app shell** so a toast survives navigation, and
>    that the live list is **capped at three**. The one honest producer inside this phase's own
>    surface is a **failed** mark-read / mark-all-read write (`tone="danger"`, `role="alert"`, no
>    auto-hide — the DS's own rule for a failure the user must be able to reach). **No existing
>    screen's success/error UX changes in this phase** — no RSVP-saved toast, no milestone toast, no
>    replacing anyone's inline `actionError`. Those are later, deliberate calls.
> 10. **Type scale: snap to the repo's tokens, do not invent sizes.** The DS JSX uses 9 / 10 / 10.5 /
>    11 / 11.5 / 12 / 12.5 / 13 / 15 / 19 px literals. This repo's scale has no half-pixels. Use
>    this mapping and nothing else — it is binding, so no task has to re-derive it:
>    | DS px | Where | Token |
>    |---|---|---|
>    | 9, uppercase ls .14em | badge count; dialog kicker label | `--text-label` (10) |
>    | 10, uppercase ls .08em | toast `meta` | `--text-micro` (11) |
>    | 10.5 | row timestamp; dialog kicker timestamp | `--text-micro` (11) |
>    | 11 | "Mark all read" | `--text-micro` (11) |
>    | 11.5 | row body (2-line clamp) | `--text-micro` (11) |
>    | 12 | toast action button | `--text-caption` (12) |
>    | 12.5 | dropdown empty state | `--text-caption` (12) |
>    | 13 | row title; toast title/body; dialog body; dialog buttons | `--text-body` (13) |
>    | 15, serif | dropdown header "Notifications" | `--text-body-lg` (15) + `--font-serif` |
>    | 19, serif | dialog title | `--text-display-sm` (22) via `app-modal`'s `.modal-title` |
>    The 19 → 22 jump is a **deliberate divergence**: the dialog composes `app-modal`, whose title
>    is `--text-display-sm`, and matching every other dialog in the app beats a 3px DS match.
>    Serif below 28px contradicts `_tokens.scss`'s own `--font-serif` comment but matches both the
>    DS and existing precedent (`screen-header.scss`'s `.menu-name` is serif at `$text-body-lg`) —
>    follow the precedent.
> 11. **Every colour, radius and shadow this phase needs is already mirrored.** Audited against
>    `src/styles/_tokens.scss` at HEAD: `--surface-card`, `--surface-chip`, `--border-hairline`,
>    `--brand-accent`, `--on-accent`, `--text-muted`, `--text-body-color`, `--scrim`,
>    `--shadow-overlay`, `--shadow-modal`, `--status-provisional`, `--danger`, `--on-danger`,
>    `--radius-md`, `--radius-card`, `--radius-pill`, `--space-*`, `--transition-fast` — **all
>    present, nothing to mirror, no token escalation.** Two spelling notes: the DS's `--text-body`
>    *colour* is this repo's `--text-body-color` (the documented drift at `_tokens.scss:57-71`), and
>    `Toast.jsx`'s `provisional` on-colour is the raw `var(--surface)` — use the semantic
>    `--surface-card` here, per hard rule 3. There is no `--on-provisional` token in the DS; that is
>    a **DS gap, noted but not blocking** (see T284).
> 12. **i18n keys are camelCase in this repo, not kebab-case.** CLAUDE.md says hierarchical
>    kebab-case; `public/i18n/*.json` has said camelCase since the beginning (`configManager`,
>    `consentBanner`, `emptyNoMilestones`, `myProfile`). **Follow the files.** The one exception is
>    sub-keys that mirror an API string verbatim (`save-the-date`, `rsvp-reminder`, …) — those stay
>    kebab because the value is the lookup key, exactly like `agendaStatus.planned` mirrors an API
>    enum. Do not rename existing keys, and do not "fix" CLAUDE.md as part of this phase.
> 13. **Two more CLAUDE.md staleness notes, so nobody chases them.** There is no `src/app/features/`
>    directory (screens live in `src/app/screens/`, shared components in `src/app/shared/`, the
>    shell in `src/app/layouts/private-layout/`), and there is no `SPEC.md` in this repo. Neither is
>    this phase's job to fix. New components go in `src/app/shared/<kebab-name>/`; they are imported
>    by path (`@app/shared/…`), **not** added to `shared/index.ts`, which only re-exports the four
>    screen-level singletons (T277 precedent).
>
> Sequence: **T282** (escalation — non-blocking, recorded) → **T283** (foundation: two glyphs, ADR
> W-0005, every Phase O i18n key) → **T284** (`app-toast` + `app-toast-stack`, no call sites) →
> **T285** (`ToastCenterService` + one stack mounted in the shell) → **T286**
> (`NotificationCenterService`, no UI) → **T287** (`app-notification-dialog`, no call sites) →
> **T288** (`app-notification-bell` + header integration) → **T289** (first real toast producer).
> T284/T285 and T286/T287 are independent of each other and can land in either order; T288 needs
> T286 and T287; T289 needs T285 and T288.

### T282 — [ESCALATION → hub] In-app notifications arrive with no renderable content
- **Status:** todo — **escalated, non-blocking.** T283 lands an interim in-repo answer under
  ADR W-0005 so the phase is not held; if the hub rules differently, exactly one i18n block and one
  lookup change.
- **Owner:** system-architect (decision) → wedding-web implementer (mirror, in T283)
- **Depends on:** —
- **The gap, concretely:**
  - `NotificationDto.title` and `NotificationDto.body` are **optional** on the contract
    (`contracts/openapi.json`, `NotificationDto.required` is `[id, createdAt, type, templateId,
    status]`).
  - Hub **ADR-0028 §2**'s template catalogue is addressed by `(templateId, channel, locale)` where
    the live channels are **email and SMS only** — there is **no in-app slice**. The API's own DTO
    doc states the consequence and hands the problem to the web:
    *"most records carry only `templateId` + `data` and the client renders from those … the web
    design that consumes this has not been done yet, so v1 hands over both and lets it choose"*
    (`wedding-api/src/modules/notifications/dto/notification.dto.ts:25-29`).
  - The only producer today, the milestone announcement fan-out
    (`wedding-api/.../announcement.service.ts:286-289`), passes **neither** `title` nor `body`.
    So every notification currently in the system would render as a blank row in the DS bell.
  - Secondary gap, same escalation: `notificationsControllerListV1()` exposes **no cursor and no
    limit parameter** despite the response carrying `nextCursor`, so the client can read exactly
    one page. A full "All notifications" screen is not buildable without a contract change (Phase O
    decision 7).
- **The question for the hub:** should an **in-app slice** join the `(templateId, channel, locale)`
  catalogue (ADR-0028 §2) so the API returns rendered `title`/`body` per the recipient's
  `preferredLang` — or is in-app rendering permanently the web's job, with `templateId` + `data` as
  the intended interface? Either answer is workable; the second is what the DTO doc currently
  implies and what T283 assumes.
- **Interim rule (in force until the hub says otherwise), recorded as in-repo ADR W-0005 in T283:**
  the record's own `title`/`body` **always win when present** (they are a frozen snapshot); when
  absent, the web renders copy from a small client-side catalogue keyed by `templateId`, translated
  through `ngx-translate` like any other UI string. An unknown `templateId` falls back to generic
  copy plus the type label — it must render, never blank, never throw.
- **Refs:** hub ADR-0019 (notification records), hub ADR-0028 §2 (template catalogue, no in-app
  slice), hub ADR-0030 §9 (the four announcement types);
  `wedding-api/src/modules/notifications/dto/notification.dto.ts:25-29`;
  `wedding-api/src/common/services/notifications/notifier.service.ts:68-84`;
  `wedding-api/src/modules/milestones/announcement.service.ts:278-293`;
  `src/app/core/api/model/notification-dto.ts`; Phase O decisions 5–7

### T283 — Phase O foundation: `bell`/`check` glyphs, in-repo ADR W-0005, all Phase O i18n keys
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** No components in this task. It lands the two things every later task needs — the
  glyphs and the copy — plus the one written decision Phase O rests on. Precedent for the shape:
  T264 (*"Foundation: `rsvp.editor.*` i18n keys + shared helper"*) and T256.
- **Acceptance:**
  - **`src/app/shared/icons/icon.ts`:** add `bell` and `check` to the `IconName` union **and** to
    `PATHS`, copying the two path strings verbatim from
    `../wedding-ui-design/components/core/Icon.jsx:23-24`. Nothing else in the file changes.
    `check` has **no call site yet** and that is deliberate — the DS added both glyphs in the same
    commit and this file is a mirror of the DS set. **Explicitly not in scope:** swapping
    `screen-header.html:62`'s literal `✓` for the new glyph (a drive-by), and implementing the DS's
    `DOTS` map (`Icon.jsx:28`, the small solid dot on `info`/`warning`) which this repo's
    `icon.html` has never rendered — note it, leave it.
  - **New in-repo ADR `docs/decisions/W-0005-in-app-notification-rendering.md`** (W-0004 is taken —
    the RSVP participant `kind` discriminator). Follow the shape of W-0003/W-0004. It records, in
    the repo's own words, Phase O decisions 4, 5, 6 and 7: that components consume `NotificationDto`
    directly with no parallel local type; that `type` is an open string mapped to an icon with an
    `info` fallback; that the record's `title`/`body` win when present and a `templateId`-keyed
    client catalogue fills in when they are absent; and that there is no full-list screen because
    the client cannot paginate. It must state plainly that the catalogue is **interim**, name T282
    as the open escalation, and say what changes if the hub adds an in-app slice (delete the
    fallback branch, keep the i18n block as dead copy or remove it — one file either way).
  - **Every Phase O i18n key, in all three `public/i18n/{en,es,fr}.json`**, real translations, the
    three files structurally identical (ESP is the default per CLAUDE.md, so write the Spanish
    first and translate outward — do not ship English strings in `es.json`). camelCase keys per
    Phase O decision 12. The exact set, and nothing beyond it:
    - `notifications.title` — dropdown header ("Notificaciones")
    - `notifications.ariaLabel` — bell label at zero unread
    - `notifications.ariaLabelUnread` — bell label with `{{count}}` unread
    - `notifications.markAllRead`
    - `notifications.empty` — DS copy: *"Nothing new — we'll tell you here."*
    - `notifications.ago.now` / `.minutes` / `.hours` / `.days` — relative-time strings, `{{count}}`
      interpolated (`NotificationBell.jsx:10-20`). Beyond 7 days the row shows a formatted date, not
      a translated string — no key for that.
    - `notifications.typeLabel.save-the-date` / `.invitation` / `.rsvp-reminder` /
      `.menu-selection-reminder` / `.fallback` — the dialog kicker label
      (`NotificationDialog.jsx:7`'s `TYPE_LABEL`, retargeted onto this system's real types per
      decision 5). `.fallback` is the DS's `'Wedding'` default.
    - `notifications.template.<templateId>.title` and `.body` for the same four ids, plus
      `notifications.template.fallback.title` / `.body` — the decision-6 catalogue. Copy must be
      short enough to read without scrolling (`NotificationDialog.prompt.md`) and must be honest
      about what happened ("Ya puedes reservar la fecha", "Falta tu confirmación", …) — **not**
      placeholder text and **not** "Notificación".
    - `notifications.errors.load` / `.markRead` / `.markAllRead` — used by T289's toast; land them
      here so all of Phase O's copy arrives in one commit.
    - `toast.dismiss` — the `✕` button's `aria-label` (`Toast.jsx:63`).
    - **Reuse, do not duplicate:** `shared.close` for the dialog's Close button. Do not add
      `notifications.close`.
  - **No component, no service, no template change** other than `icon.ts`. If a later task needs a
    key that is not on this list, it adds it in its own commit — this task does not speculate.
  - No new `type`/`interface` restating a generated API model (hard rule 15). No `pnpm gen:api`;
    `pnpm gen:api:check` still clean.
  - `pnpm typecheck && pnpm lint && pnpm test` green (lint clean except the 4 known
    `shared/modal/` errors, CLAUDE.md rule 11's carve-out). No `pnpm test:e2e` — it does not exist
    (T263).
- **Refs:** DS commit `7db5d1c`; `../wedding-ui-design/components/core/Icon.jsx:23-24,28`;
  `components/navigation/NotificationBell.jsx:8,10-20`;
  `components/overlays/NotificationDialog.jsx:6-7`; `components/overlays/Toast.jsx:63`;
  Phase O decisions 4–7 and 12; T282; `src/app/shared/icons/icon.{ts,html}`;
  `public/i18n/{en,es,fr}.json`; new `docs/decisions/W-0005-in-app-notification-rendering.md`

### T284 — Build `app-toast` + `app-toast-stack` (no call sites yet)
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T283 (`toast.dismiss` key)
- **Context:** Read `../wedding-ui-design/components/overlays/Toast.prompt.md` (the spec — every
  paragraph is prescriptive), `ToastStack.prompt.md`, both `.d.ts` prop contracts, both `.jsx`
  references and `toast.card.html` (all tones × both variants × nine placements × three themes).
  This task builds **two presentational components and wires them to nothing** — T285 mounts the
  stack, T289 is the first producer. Same shipping shape as T277. Follow
  `.agent/skills/design-component-author.md`.
- **Acceptance:**
  - New `src/app/shared/toast/toast.{ts,html,scss,spec.ts}` and
    `src/app/shared/toast-stack/toast-stack.{ts,html,scss}` — standalone, `OnPush`, selectors
    `app-toast` / `app-toast-stack`, **three separate files each**, no `template:`/`styles:`
    (hard rule 1), no `style` attribute and no `ngStyle` anywhere (hard rule 2). Imported by path;
    **not** added to `shared/index.ts` (decision 13).
  - **`app-toast` API (signals, hard rule 5), matching `Toast.d.ts` name for name:**
    `title = input<string>()`; `meta = input<string>()`; `icon = input<IconName>()`;
    `tone = input<'neutral' | 'accent' | 'provisional' | 'danger'>('neutral')`;
    `variant = input<'surface' | 'filled'>('surface')`; `translucent = input(false)`;
    `delay = input<number>()`; `dismissible = input(true)`; `close = output<void>()`. The body is
    **projected content** (`<ng-content>`), matching the `.d.ts`'s `children` — a `ProgressBar`, a
    thumbnail row or two lines of text must all be able to live there. The action is
    `actionLabel = input<string>()` + `action = output<void>()` rather than the `.d.ts`'s
    `{ label, onClick }` object, because outputs are the Angular idiom (hard rule 5) and an object
    input carrying a callback is not; **no label, no button**, exactly as the reference gates it.
    `icon` is typed as the repo's `IconName`, not `string` — `app-icon`'s `name` is
    `input.required<IconName>()` and widening it would be a regression.
  - **Tones carry meaning, not decoration** (`Toast.prompt.md` §Colour scheme). `variant="surface"`
    (default) keeps the `--surface-card` fill and tints **only the icon**: `neutral` →
    `--text-muted`, `accent` → `--brand-accent`, `provisional` → `--status-provisional`, `danger` →
    `--danger`. `variant="filled"` floods the toast in the tone colour with its on-colour text:
    `--on-accent` for neutral and accent, `--on-danger` for danger, and **`--surface-card`** for
    provisional (`Toast.jsx:9` writes the raw `var(--surface)`; use the semantic alias per hard
    rule 3 — there is no `--on-provisional` token in the DS, which is a **noted DS gap**, not
    something to invent a token for; if one ever lands, this is the one line that changes).
    Implement as class bindings + rules in `toast.scss`. `#a8443c` and every other literal colour
    must not appear in the diff.
  - **`tone="danger"` also switches the live region:** `role="alert"` + `aria-live="assertive"`;
    every other tone is `role="status"` + `aria-live="polite"` (`Toast.jsx:30-31`, hard rule 14).
  - **`delay`**: when set, auto-closes after N ms by emitting `close`. Must be cancelled on destroy
    (no timer outliving the component) and must not restart on unrelated input changes. Per the
    prompt: **never auto-hide a toast carrying an action or reporting a failure** — the component
    does not enforce this (it honours whatever `delay` it is given), but T285's service and T289's
    call site do, and the spec below covers it there.
  - **`dismissible`** renders the trailing `✕` with `aria-label` from the `toast.dismiss` key
    (hard rule 8 — the DS's hardcoded `"Dismiss"` is not shippable). It is a real `<button
    type="button">`, keyboard-reachable (hard rule 14).
  - **`translucent`** softens the fill via `color-mix(in oklab, …, transparent)` and adds
    `backdrop-filter: blur(10px)` — **with the `-webkit-` prefix**, because iOS Safari is a
    required target (hard rule 4). This is *"the only blur in the system"* and is allowed **only**
    over guest photography (the Album screen); it has no call site in this phase and that is
    correct. `color-mix` already appears in this repo (`tab-bar.scss:77`), so it is not a new
    dependency.
  - **Geometry from tokens:** `--radius-md` corner, `--shadow-overlay` (never `--shadow-modal` — a
    toast is not a modal panel, hub ADR-0025), 1px `--border-hairline` on `surface` and no border on
    `filled`, `max-width: 340px`, `width: 100%`, `pointer-events: auto`. Padding and gaps from the
    `--space-*` scale; type from Phase O decision 10's table. No hardcoded breakpoint (hard rule 4).
  - **`app-toast-stack` API:** `placement = input<ToastPlacement>('top-center')` over all nine
    `top|middle|bottom` × `start|center|end` values; `gap = input(10)`; `gutter = input<string>()`
    defaulting to `var(--space-4)`. Content is projected. `ToastPlacement` is a **UI-only** string
    union with no API counterpart, so hard rule 15 does not apply — declare it in `toast-stack.ts`
    and export it.
  - **The stack is `position: fixed` (decision 2), `inset: 0` with `pointer-events: none`**, a
    single flex column whose `justify-content`/`align-items` come from the placement, `z-index: 70`
    (decision 3), `max-height: 100%`, `overflow: hidden`. Clicks pass through everywhere except on
    a toast. Toasts never overlap and never resize each other. Do **not** write
    `position: absolute` and do **not** rely on a positioned ancestor.
  - **`gutter` is the only place a caller may pass a raw length** (`"16px 16px 80px"` to clear the
    mobile tab bar). Implement it as a CSS custom property set on the host via `[style.--…]`? **No**
    — hard rule 2 forbids style bindings. Instead: expose `gutter` as a `computed()` class or,
    simpler, give the stack a `clearsTabBar = input(false)` boolean whose `.scss` rule adds the tab
    bar's clearance (the shell's own `padding-bottom: 70px`, `private-layout.scss:7`) to a
    bottom-placed stack. **Take the boolean.** It is one class, it keeps every length in the
    stylesheet where the rules require it, and it is the only clearance this app actually has.
    Document the departure from `ToastStack.d.ts`'s free-form `gutter` in the component's doc
    comment so a reviewer does not "restore" it.
  - Unit spec (`toast.spec.ts`) covers: the title, `meta` and projected body render; no icon element
    when `icon` is unset; no action button when `actionLabel` is unset and the `action` output fires
    when it is clicked; the `✕` emits `close` and is absent when `dismissible` is false; `delay`
    emits `close` once after the interval (fake timers) and the timer is cleared on destroy;
    `tone="danger"` renders `role="alert"` and every other tone `role="status"`; the tone and
    variant class bindings land on the host for all four tones; the `✕`'s `aria-label` comes from
    the translation, not a literal.
  - No new `type`/`interface` restating a generated API model (hard rule 15 — these two components
    have **no** API surface). No `pnpm gen:api`; `pnpm gen:api:check` still clean.
  - `pnpm typecheck && pnpm lint && pnpm test` green (lint clean except the 4 known
    `shared/modal/` errors). No `pnpm test:e2e` — it does not exist (T263).
  - Verified by hand in **all three themes** against `toast.card.html`, which demos exactly this
    matrix. If no browser is available, say so plainly rather than claiming it (T273/T275
    precedent).
- **Refs:** DS commit `7db5d1c`;
  `../wedding-ui-design/components/overlays/Toast.prompt.md` (**the spec**), `Toast.d.ts`,
  `Toast.jsx`, `ToastStack.prompt.md`, `ToastStack.d.ts`, `ToastStack.jsx`, `toast.card.html`;
  Phase O decisions 1–3, 10, 11, 13; hub ADR-0025 (`--shadow-overlay` vs. `--shadow-modal`);
  `.agent/skills/design-component-author.md`; `src/styles/_tokens.scss`;
  `src/app/shared/icons/icon.ts`; `src/app/layouts/private-layout/private-layout.scss:7`;
  new `src/app/shared/toast/`, new `src/app/shared/toast-stack/`

### T285 — `ToastCenterService` + mount the one shell-level stack
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T284
- **Context:** `ToastStack.prompt.md`: *"One stack per screen — mount it in the app shell, not per
  route, so a toast survives navigation."* This task lands the seam and the mount. It ships
  **inert** — nothing calls it until T289 — which is deliberate and matches T277's precedent; do not
  invent a producer to "prove" it works, the spec proves it.
- **Acceptance:**
  - New `src/app/core/service/toast-center.service.ts`, `@Injectable({ providedIn: 'root' })`,
    signals-based (hard rule 5), exported from `src/app/core/service/index.ts`. **Name it
    `ToastCenterService`, not `ToastService`** — `@app/core` re-exports the whole generated client
    and a bare name risks the same collision T286 hits for real.
  - **Public API, small and closed:** a readonly `toasts` signal (the live list) and one `show(…)`
    entry point taking the toast's inputs (tone, variant, icon, title, meta, body, actionLabel,
    delay, dismissible) plus a `dismiss(id)`. The id is generated by the service; callers never
    supply one. The body is a **string** here — `app-toast`'s projected-content flexibility stays
    available to anyone rendering `<app-toast>` directly, but the service's convenience path does
    not need to marshal templates and must not try to.
  - **The list is capped at three** (`Toast.prompt.md` §Stacking): pushing a fourth **drops the
    oldest**, it never grows the column. **Order follows the placement**: newest **first** for
    `top-*`, newest **last** for `bottom-*` — so the newest toast is always nearest the screen edge
    the stack hugs. Since this app mounts one stack at one placement, the service reads that
    placement from a single constant rather than guessing; state the constant in a comment.
  - **The service enforces the two timing rules the component deliberately does not** (T284): a
    toast carrying an `actionLabel`, or with `tone === 'danger'`, gets **no `delay`** — the user
    must be able to reach it. Everything else defaults to a `delay` in the DS's 4000–6000 band.
    `dismissible` stays true whenever no `delay` is set.
  - **Exactly one `<app-toast-stack>` in the app**, rendered by
    `src/app/layouts/private-layout/private-layout.html` (the authenticated shell — where the
    header and tab bar already live), iterating `toasts()` with `@for` and one `<app-toast>` per
    entry, each wired to `(close)="dismiss(id)"`. Placement: **`bottom-center`** with the tab-bar
    clearance flag set — mobile-first, and every producer this phase has is a confirmation/failure
    of something the user just did, which is precisely the DS's `bottom-center` case
    (`Toast.prompt.md` §Placement). Do **not** add a second stack, and do **not** mount one in
    `app.html` (the public/auth screens are out of scope).
  - **No stack outside the private layout, and no toast on a public route.** If a toast is ever
    wanted on `/login`, that is a separate decision.
  - **No polling, no global error hook, no interceptor wiring.** This service does not subscribe to
    anything; producers call it.
  - Unit spec for the service: `show()` appends and returns/registers an id; `dismiss(id)` removes
    exactly that one; a fourth `show()` drops the oldest and the list stays at three; a
    `tone="danger"` or `actionLabel` toast is stored with **no** `delay`; ordering matches the
    configured placement.
  - `pnpm typecheck && pnpm lint && pnpm test` green (lint clean except the 4 known
    `shared/modal/` errors). No `pnpm test:e2e` — it does not exist (T263).
- **Refs:** `../wedding-ui-design/components/overlays/ToastStack.prompt.md`,
  `Toast.prompt.md` §Stacking/§Placement/§Timing; Phase O decisions 2, 3, 9;
  `src/app/core/service/index.ts`; `src/app/layouts/private-layout/private-layout.{html,scss,ts}`;
  `src/app/shared/toast/`, `src/app/shared/toast-stack/`;
  new `src/app/core/service/toast-center.service.ts`

### T286 — `NotificationCenterService`: the signals read/write model over the generated client
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T283 (ADR W-0005, the `templateId` catalogue keys)
- **Context:** No UI in this task. It builds the one place that talks to
  `NotificationsService` (generated) and exposes signals the bell can bind to. Splitting it out
  keeps T288's diff to markup + wiring, and keeps the refresh policy reviewable on its own.
- **Acceptance:**
  - New `src/app/core/service/notification-center.service.ts`,
    `@Injectable({ providedIn: 'root' })`, exported from `src/app/core/service/index.ts`.
    **The name matters:** the generated client's class is already called `NotificationsService` and
    `src/app/core/index.ts` re-exports `./api`, so a second `NotificationsService` would collide in
    the barrel. `NotificationCenterService` it is.
  - **Not `@ngrx/data`,** and the doc comment must say why: two of the four endpoints
    (`unread-count`, `read-all`) are aggregates rather than entity CRUD, the write is a
    server-driven state flip rather than a client-authored patch, there is no create/delete, and the
    read model is a single unpaginated page (decision 7). A plain signals service is the honest
    shape — precedent: `StatisticService`, and `MilestoneDataService.send()/clearAnnouncement()` for
    "non-CRUD sub-action goes straight at the generated client".
  - **State:** `notifications` (readonly signal of `NotificationDto[]`), `unreadCount` (readonly
    signal `number`), `loading`, and an error signal. **`unreadCount` is read from
    `notificationsControllerUnreadCountV1()`**, not derived by counting the list — the contract
    describes that endpoint as *"cheap, and intended to drive a badge without fetching the list"*
    and the list is one page, so counting it would under-report.
  - **Refresh policy, and nothing more than this:**
    - the count is fetched **once on first use** (the bell's mount) and re-fetched after every
      successful write;
    - the list is fetched **lazily on the first dropdown open** and re-fetched on **every**
      subsequent open;
    - **no polling, no `setInterval`, no websocket, no visibility/focus listener.** Explicitly out
      of scope for this phase — it is a battery-and-cost decision with no requirement behind it, and
      adding one silently would be scope creep. Say so in the doc comment.
  - **Never fires for an anonymous user.** Everything here is driven by the bell, which lives only
    in `app-screen-header` inside `PrivateLayout`. Do not call this service from `App` or any
    public route, and do not add an `APP_INITIALIZER`.
  - **`markRead(id)`** calls `notificationsControllerMarkReadV1({ id })` — **`PATCH
    /v1/notifications/{id}`**, per decision 8, *not* the `POST …/read` the DS prompt names.
    Optimistic: flip that record's `status` to `NotificationDto.StatusEnum.READ` and decrement the
    count immediately, then reconcile. On failure, **revert both** and surface the error (T289
    turns it into a toast). It is idempotent server-side, so a double call is safe — but the caller
    must still only fire it **once, on an unread record** (decision 8).
  - **`markAllRead()`** calls `notificationsControllerReadAllV1()`. Optimistic: flip every record
    and zero the count. On failure, **re-read the truth from the server** (list + count) rather than
    reverting from memory, and surface the error. `0 updated` is a **normal answer, not an error**
    (the contract says so explicitly).
  - **Ordering:** the API documents newest-first. Sort defensively by `createdAt` descending anyway
    (`NotificationBell.jsx:36` does; it is five rows) and let the consumer slice.
  - **Hard rule 15 is the sharp edge here.** Consume `NotificationDto` throughout. No local
    `Notification` interface, no `read: boolean`, no `type` union, no re-declared status enum —
    import `NotificationDto.StatusEnum` (Phase O decision 4). If a UI-only shape genuinely seems
    needed, stop and report rather than declaring one.
  - **Rendering helpers live here too**, since they are pure functions of a `NotificationDto` and
    the bell and the dialog both need them: `iconFor(n)` (decision 5's `Record<string, IconName>`
    with the `info` fallback), `typeLabelKeyFor(n)`, and `titleKeyFor(n)` / `bodyKeyFor(n)`
    implementing ADR W-0005 — **the record's own `title`/`body` win when present**, the
    `templateId` catalogue fills in when they are absent, and an unknown `templateId` lands on
    `notifications.template.fallback.*`. Never blank, never a thrown lookup.
  - Unit spec: the count comes from the count endpoint and not from `notifications().length`; the
    list is not fetched until asked for; `markRead` flips optimistically, calls the client once, and
    reverts on error; `markRead` on an already-read record is a no-op (the *caller's* guard is
    T288's, but assert the service is safe); `markAllRead` zeroes the count and re-reads on failure;
    `0 updated` is treated as success; an unknown `type` resolves to the `info` icon and an unknown
    `templateId` to the fallback copy; a record carrying its own `title` uses it in preference to
    the catalogue.
  - No `pnpm gen:api`; `pnpm gen:api:check` still clean — the endpoints and models already exist,
    verify rather than regenerate.
  - `pnpm typecheck && pnpm lint && pnpm test` green (lint clean except the 4 known
    `shared/modal/` errors). No `pnpm test:e2e` — it does not exist (T263).
- **Refs:** hub ADR-0019; Phase O decisions 4–8; in-repo ADR W-0005 (T283); T282 (open escalation);
  `src/app/core/api/api/notifications.service.ts`, `src/app/core/api/model/notification-dto.ts`,
  `notification-list-response-dto.ts`, `unread-count-dto.ts`, `read-all-response-dto.ts`;
  `src/app/core/data/milestone-data.service.ts` (non-CRUD sub-action precedent);
  `src/app/core/service/statistic.service.ts` (signals-service precedent);
  `src/app/core/service/index.ts`; new `src/app/core/service/notification-center.service.ts`

### T287 — Build `app-notification-dialog` (no call sites yet)
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T283 (glyphs + i18n), T286 (the rendering helpers)
- **Context:** Read `../wedding-ui-design/components/overlays/NotificationDialog.prompt.md` (the
  spec — six lines, all binding), `NotificationDialog.d.ts` and `NotificationDialog.jsx` (45 lines).
  Same modal grammar as `ConfirmDialog`, so the same answer applies: **compose `app-modal`, do not
  re-author a scrim and a panel** (Phase M decision 2, Phase O decision 2). T288 is the first call
  site.
- **Acceptance:**
  - New `src/app/shared/notification-dialog/notification-dialog.{ts,html,scss,spec.ts}` —
    standalone, `OnPush`, `selector: 'app-notification-dialog'`, three separate files, no
    `template:`/`styles:`, no `style` attribute or `ngStyle`. Imported by path; not added to
    `shared/index.ts`.
  - **API:** `open = input(false)`; `notification = input<NotificationDto | null>(null)`;
    `actionLabel = input<string>()`; `action = output<void>()`; `close = output<void>()`. The
    notification is a **`NotificationDto`**, not the DS's `Notification` (decision 4). Renders
    nothing when `notification()` is null — matching the `.d.ts`'s *"render conditionally —
    null/undefined renders nothing"*.
  - **Composes `app-modal`** with `size="sm"`, `[dismissable]="true"`, `[title]` bound to the
    resolved title, and `(close)` forwarded. That gives `role="dialog"`, `aria-modal="true"`,
    `aria-labelledby`, the `--scrim` backdrop, `--shadow-modal`, `--radius-card` and backdrop
    dismissal for free. **Escape** is added by this component the way `ConfirmDialog` does it — a
    host-scoped `(keydown.escape)` with `stopPropagation()`, **not** a `window` listener (Phase M
    decision 5, and the reason is the same: this dialog opens from the header, which is inside the
    private shell, and a `window` listener would close the wrong thing).
  - **The kicker line** above the title (`NotificationDialog.jsx:29-33`): type icon in
    `--brand-accent`, the uppercase type label (`--text-label`, `letter-spacing: .14em`,
    `--text-muted`), and the **full** timestamp right-aligned (`--text-micro`, `--text-muted`).
    Project it into `app-modal`'s existing `[modal-eyebrow]` slot rather than inventing a new one —
    that slot exists for exactly this (`modal.html:18`, added for the guest-profile overlay). The
    timestamp is formatted day + month + time in the **currently selected app language**, via the
    existing `TranslateLanguageService.currentLang()` and `Intl`/`DatePipe` — **not** the browser's
    locale, which is what `NotificationDialog.jsx:12`'s `toLocaleString(undefined, …)` would give.
  - **Body text is shown in full** (`--text-body`, `--text-muted`, generous line-height), never
    clamped — the clamp is the *dropdown's* behaviour, not the dialog's. The resolved title and
    body come from T286's helpers: the record's own values when present, the `templateId` catalogue
    otherwise (ADR W-0005).
  - **`Close` is always present**, using the existing `shared.close` key. A **second, accent
    button appears only when `actionLabel()` is set** and emits `action`; with no label there is
    exactly one button. Both are `button[app-btn]` (`[primary]="false"` for Close, default primary
    for the action), side by side and equal width, projected as one wrapper into `[modal-actions]`
    — the same arrangement `confirm-dialog.html` uses, for the same `justify-content: flex-end`
    reason.
  - **There is no "mark as read" button, ever** (`NotificationDialog.prompt.md`: *"The open **is**
    the read receipt — never add a 'mark as read' button here"*). This component performs **no**
    API call of any kind and injects `NotificationCenterService` only for the pure rendering
    helpers. The read receipt is T288's, fired when the dialog is opened.
  - **Accessibility (hard rule 14):** initial focus goes to the **Close** button
    (`NotificationDialog.jsx:22` focuses `button[data-close]`) — note that this is the *opposite* of
    `ConfirmDialog`'s confirm-first rule and it is correct: nothing here is destructive and Close is
    the safe default, so **none** of Phase M decision 8's auto-repeat guard is needed or wanted.
    Tab cycles within the dialog. Focus restores to the trigger on close.
  - Unit spec: nothing renders when `open` is false or `notification` is null; the kicker icon,
    label and full timestamp render; the title and body render from the record when it carries them
    and from the catalogue when it does not; **no element in the DOM has "mark as read" semantics**
    (assert the button count is 1 without `actionLabel` and 2 with it); the action button is absent
    without `actionLabel` and emits `action` when present; Escape, the backdrop and Close all emit
    `close`; Close has focus after open; an unknown `type` renders the `info` glyph and the fallback
    label rather than throwing.
  - No new `type`/`interface` restating a generated API model (hard rule 15). No `pnpm gen:api`;
    `pnpm gen:api:check` still clean.
  - `pnpm typecheck && pnpm lint && pnpm test` green (lint clean except the 4 known
    `shared/modal/` errors — and **do not add a fifth**; this task touches `shared/modal/` only if
    something is genuinely missing, and if it is, stop and report rather than editing that folder
    opportunistically). No `pnpm test:e2e` — it does not exist (T263).
  - Verified by hand in **all three themes** against `notification-bell.card.html`'s "Show detail
    modal" button. If no browser is available, say so plainly.
- **Refs:** DS commit `7db5d1c`;
  `../wedding-ui-design/components/overlays/NotificationDialog.prompt.md` (**the spec**),
  `NotificationDialog.d.ts`, `NotificationDialog.jsx`;
  `components/navigation/notification-bell.card.html:50,53`; Phase O decisions 1, 2, 4, 8, 10, 11;
  Phase M decisions 2 and 5 (compose-don't-re-author; host-scoped Escape); in-repo ADR W-0005;
  `src/app/shared/modal/modal.{ts,html}` (`[modal-eyebrow]`, `[modal-actions]`),
  `src/app/shared/confirm-dialog/` (the composition precedent), `src/app/shared/button/`,
  `src/app/core/service/notification-center.service.ts`;
  new `src/app/shared/notification-dialog/`

### T288 — Build `app-notification-bell` and mount it in the header
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T286, T287
- **Context:** Read `../wedding-ui-design/components/navigation/NotificationBell.prompt.md` (the
  spec — every bullet is an acceptance criterion), `NotificationBell.d.ts`, `NotificationBell.jsx`
  (118 lines), `notification-bell.card.html` (all three badge states, mobile and wide headers) and
  `AppHeader.jsx:11-18` (the placement). The component and its only call site ship together: the
  bell's placement *is* part of its spec, and a bell with no header is untestable in situ.
- **Acceptance:**
  - New `src/app/shared/notification-bell/notification-bell.{ts,html,scss,spec.ts}` — standalone,
    `OnPush`, `selector: 'app-notification-bell'`, three separate files, no `template:`/`styles:`,
    no `style` attribute or `ngStyle`. Imported by path; not added to `shared/index.ts`.
  - **The bell owns no data.** It injects `NotificationCenterService` (T286) and renders
    `app-notification-dialog` (T287). Its only inputs are presentational (`size`, defaulting to
    30px, per `NotificationBell.d.ts`); everything else comes from the service.
  - **Badge:** the unread count, `9+` past nine, **gone at zero** — no badge, no dot, no empty
    circle (`NotificationBell.prompt.md`). `--brand-accent` fill, `--on-accent` text,
    `--text-label` type, a 1.5px `--surface-card` ring so it reads against the header, positioned
    top-right of the button. The button's `aria-label` is `notifications.ariaLabel` at zero and
    `notifications.ariaLabelUnread` with `{{count}}` otherwise (hard rule 8 — the DS's hardcoded
    English is not shippable), plus `aria-haspopup="menu"` and a live `aria-expanded`.
  - **Dropdown:** absolutely positioned under the button (`top: calc(100% + 10px); right: 0`),
    `--surface-card` on a `--border-hairline` hairline, `--radius-md`, **`--shadow-overlay`** —
    **not** `--shadow-modal`: it is a dropdown, and hub ADR-0025 assigns `--shadow-overlay` to
    dropdowns and menus. (`NotificationBell.jsx:72` writes `--shadow-modal` with an inline
    fallback; that is the prototype leaning on whichever token happened to exist. Follow ADR-0025,
    and note the deviation in a comment.) Width 316px capped to the viewport so it never overflows
    on an iPhone SE (hard rule 4 — do this with `max-width`, not a media query).
  - **Content: the five most recent, newest first** — `limit` default 5 (`NotificationBell.d.ts`),
    sliced from the service's already-sorted list. A header row with the `notifications.title`
    label and, **only while something is unread**, a "Mark all read" text button
    (`NotificationBell.prompt.md`: *"`onMarkAllRead` shows only while something is unread"`) wired
    to `markAllRead()`. Empty list → the `notifications.empty` line, centred, `--text-caption`,
    `--text-muted`.
  - **Rows:** each is a `<button role="menuitem">` — a leading type icon, the title on one line
    (ellipsised), a relative timestamp, and the body clamped to **two** lines. **Unread rows carry
    `--surface-chip`, a `--brand-accent` icon, a bold (600) title and a trailing 6px accent dot;
    read rows are transparent, `--text-muted` icon, weight 400, no dot.** Title/body/icon all come
    from T286's helpers (ADR W-0005), so a record with no `title` renders catalogue copy, not a
    blank line. Relative time uses the `notifications.ago.*` keys; past seven days it shows a
    formatted date in the **app's** current language, not the browser's.
  - **Opening a row opens the detail, and *that* is the read receipt** (decision 8): close the
    dropdown, open `app-notification-dialog` with that record, and call
    `NotificationCenterService.markRead(id)` **exactly once and only when the record is unread**.
    Not on hover. Not when the dropdown opens. Not from inside the dialog. The spec below pins all
    three.
  - **Dismissal:** a click outside the bell closes the dropdown, and Escape closes it. Both scoped
    the way `screen-header`'s existing account menu does it (`@HostListener('document:click')` +
    `stopPropagation()` on the toggle) rather than a second, different mechanism — and Escape while
    the **dialog** is open must close the dialog, not the (already closed) dropdown.
  - **No "All notifications" footer link** (decision 7): there is no destination and the client
    cannot paginate. Do not add the row, do not add a `viewAll` output "for later", and do not
    create a notifications screen. If one is ever wanted it starts with a hub escalation (T282).
  - **Header integration** — `src/app/shared/screen-header/{screen-header.ts,html,scss}`:
    `<app-notification-bell>` renders **left of the account cluster**, inside an inline-flex wrapper
    with a `--space-1`-scale gap and `flex-shrink: 0` (`AppHeader.jsx:11-18`). It sits between the
    existing `.header-meta` role label and `.account` inside `.end`. **Never in the tab bar, never
    as a screen tile** (`NotificationBell.prompt.md`). This is the **only** structural change to the
    header: the monogram, the desktop nav, the role label and the whole account menu are untouched,
    and `screen-header.spec.ts` (if present) must pass without edits — if it needs editing, the
    change was not additive; stop and report.
  - **Both header layouts** must be checked: mobile (transparent chrome, no nav) and ≥900px
    (`--surface-card` + hairline, nav present). The header is `position: fixed; z-index: 20` and the
    tab bar resolves to `z-index: 10` (decision 3), so the dropdown paints above page content
    without any z-index change to `private-layout.scss` — **verify this rather than pre-emptively
    raising anything**, and if a short viewport does put the dropdown over the tab bar, report it
    rather than silently editing the shell's stacking.
  - Unit spec: no badge at zero unread; the badge shows the count at 1–9 and `9+` at 10; opening the
    dropdown does **not** call `markRead`; hovering a row does **not** call `markRead`; clicking an
    unread row calls `markRead` **once** with that id and opens the dialog; clicking an already-read
    row opens the dialog and calls `markRead` **zero** times; re-opening the same unread row after a
    successful read calls it zero more times; "Mark all read" is absent at zero unread, present
    otherwise, and calls `markAllRead()`; at most five rows render however many the service holds;
    an outside click and Escape both close the dropdown; **there is no "All notifications" element
    in the DOM**; a record with no `title` renders catalogue copy rather than an empty row.
  - No new `type`/`interface` restating a generated API model (hard rule 15). No `pnpm gen:api`;
    `pnpm gen:api:check` still clean.
  - `pnpm typecheck && pnpm lint && pnpm test` green (lint clean except the 4 known
    `shared/modal/` errors). No `pnpm test:e2e` — it does not exist (T263).
  - Verified by hand in **all three themes**, on a narrow viewport and ≥900px, against
    `notification-bell.card.html` (which demos all-read / one-unread / all-unread side by side). If
    no browser is available, say so plainly.
- **Refs:** DS commit `7db5d1c`;
  `../wedding-ui-design/components/navigation/NotificationBell.prompt.md` (**the spec**),
  `NotificationBell.d.ts`, `NotificationBell.jsx`, `notification-bell.card.html`,
  `components/navigation/AppHeader.jsx:11-18`; Phase O decisions 2–8, 10, 11, 13;
  hub ADR-0025 (`--shadow-overlay` for dropdowns); in-repo ADR W-0005;
  `src/app/shared/screen-header/screen-header.{ts,html,scss}`,
  `src/app/layouts/private-layout/private-layout.scss`,
  `src/app/core/service/notification-center.service.ts`,
  `src/app/shared/notification-dialog/`; new `src/app/shared/notification-bell/`

### T289 — First real toast: surface notification write failures
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T285, T288
- **Context:** The toast infrastructure ships inert in T285. This closes the loop with the one
  honest producer inside Phase O's own surface: a **failed** `markRead` or `markAllRead`. The DS
  prompt names this case exactly — *"`danger` a failure (also switches the live region to
  `role="alert"`) … no auto-hide when the toast … reports a failure — the user must be able to
  reach it"*. Small task, deliberately.
- **Acceptance:**
  - When `NotificationCenterService.markRead(id)` fails, the optimistic flip reverts (T286) **and**
    a toast is shown: `tone="danger"`, `icon="warning"`, title from `notifications.errors.markRead`,
    **no `delay`** (never auto-hide a failure), `dismissible` true. Same for `markAllRead()` with
    `notifications.errors.markAllRead`, after its re-read-the-truth recovery.
  - When the **list** fetch fails, `notifications.errors.load` is shown **inside the dropdown**, not
    as a toast — a failure the user is already looking at does not need a second surface, and the
    DS's own rule is one idea per toast. (`notifications.errors.load` was landed in T283 for this.)
  - **Where the call lives:** the service exposes the failure, the **bell** raises the toast — or
    the service injects `ToastCenterService` directly. Implementer's call, but pick one and say why
    in a comment; do not do both. Whichever way, `NotificationCenterService` must stay unit-testable
    without a real toast stack mounted.
  - **Nothing else in the app gains a toast in this task.** No RSVP-saved toast, no milestone toast,
    no replacing `screens/milestones`' `actionError`, no global HTTP error interceptor toast. Each
    of those is a separate, deliberate UX decision (Phase O decision 9).
  - Unit spec: a failing `markRead` reverts the optimistic flip **and** produces exactly one
    `tone="danger"` toast with no `delay`; a failing `markAllRead` does the same with its own copy;
    a **successful** write produces **no** toast (the badge dropping is the feedback); a failing
    list fetch produces **no** toast and renders the in-dropdown error instead.
  - `pnpm typecheck && pnpm lint && pnpm test` green (lint clean except the 4 known
    `shared/modal/` errors). No `pnpm test:e2e` — it does not exist (T263).
- **Refs:** `../wedding-ui-design/components/overlays/Toast.prompt.md` (§Colour scheme, §Timing);
  Phase O decision 9; `src/app/core/service/toast-center.service.ts`,
  `src/app/core/service/notification-center.service.ts`,
  `src/app/shared/notification-bell/`; `public/i18n/{en,es,fr}.json`

### Deliberately out of scope for Phase O
- **The `ScreenHome.jsx` couple-only "The plan so far" milestone-progress card**, added in the same
  DS commit `7db5d1c`. It is a dashboard feature with its own data question (which milestone counts
  as progress, and against what) and shares nothing with the notification work but a commit hash.
  If it is wanted, it is its own task against `src/app/screens/dashboard/` — not a rider here.
- **A full "All notifications" screen** — no destination, and the generated client exposes no
  pagination parameters (decision 7). Blocked on a contract change; escalate via T282.
- **Push notifications, polling, websockets, or any background refresh** (decision 6 of T286).
- **Toasts anywhere else in the app** (decision 9), and **`translucent`** in particular, which is
  allowed only over Album photography and has no call site.
- **Swapping `screen-header.html:62`'s literal `✓` for the new `check` glyph**, and implementing the
  DS `Icon` `DOTS` map — both noted in T283, both drive-bys.
- **Fixing CLAUDE.md's stale `src/app/features/` table, its `SPEC.md` reference, or its kebab-case
  i18n claim** (decisions 12 and 13). Real, recorded, not this phase's job.

## Phase P — Last seen in the guest list (hub ADR-0035, DS `717120b`)

### T290 — The relative-day label helper + ES/EN/FR copy
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** `pnpm gen:api` after wedding-api T223 lands in the contract
- **Acceptance:**
  - A small pure helper turning the API's raw `YYYY-MM-DD` into the displayed label: **"Today",
    "Yesterday", "Last week", "Last month"**, falling back to an **absolute date** for older values,
    and **"Never signed in"** when the value is absent/`null`.
  - **All phrasing lives here, never on the server.** The API ships a date and no label (hub
    ADR-0035 §6) — which is exactly what makes this ordinary translation work. Keys in
    `public/i18n/{en,es,fr}.json`; **do not** build a sentence by lower-casing a label the way the
    DS's `ProfileCard.jsx` does (`Last seen ${lastSeen.toLowerCase()}`) — that is an English grammar
    assumption and it will not survive ES/FR. Each locale gets whole phrases.
  - **There is no time of day.** The DS's `ScreenConfigManager` mocks render `'Today, 09:12'`; that
    field does not exist in the data and must not be invented or faked (hub ADR-0035 §1).
  - Bucket boundaries are computed against the **displayed date only** — the server already resolved
    the `Europe/Madrid` day, so do **not** re-timezone it or reconstruct an instant from it.
  - Unit spec covering each bucket, the absolute-date fallback, the absent value, and all three
    locales.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** hub ADR-0035 §6; `../wedding-ui-design` `717120b`; `public/i18n/{en,es,fr}.json`

### T291 — Guest-list column + guest-detail row
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T290
- **Acceptance:**
  - A read-only **"Last seen"** column on the admin guest list and the matching row in the guest
    detail view, per DS `ScreenGuestManager.jsx` / `ScreenGuestManagerMobile.jsx`. Mobile carries the
    field too — as a secondary line under the status tag — so it is **not** dropped on small screens.
  - Wired to the DS `ProfileCard`'s sanctioned `lastSeen` prop, which takes a **pre-formatted label**
    (or `null` for never) — the component does not format, T290 does. It renders behind
    `ProfileCard`'s couple-only `showContact` gate, whose meaning `717120b` widened to "email, phone
    and last-seen".
  - **Read-only everywhere.** No edit control, no clear button, no sort or filter in this task
    (deferred, hub ADR-0035 §10) — and never an input, because the API ignores the field on write.
  - **Admin surfaces only.** It must appear on **no** guest-facing screen, including the guest's own
    profile — the generated client will not carry it there, and nothing should reintroduce it.
  - The DS mocks derive values from row id (`SEEN[r.id % SEEN.length]`, and `status === 'no' && id %
    3 === 0 → 'Never'`). That is **placeholder wiring, not a rule** — it is not a finding that
    declined guests never sign in, and it must not be reproduced.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** hub ADR-0035 §6/§10; `SPEC.md` J4; `../wedding-ui-design` `717120b`
  (`ScreenGuestManager.jsx`, `ScreenGuestManagerMobile.jsx`, `components/data-display/ProfileCard.jsx`);
  in-repo T290

### Deliberately out of scope for Phase P
- **Sorting or filtering the guest list by last seen** — additive later if the couple asks (hub
  ADR-0035 §10). A filter that *acts* on inactivity ("email everyone inactive 30 days") is
  permanently out: it would turn an observation into an automated trigger, which nothing in this
  system has.
- **Any guest-facing surface**, including showing guests their own date (hub ADR-0035 §6).
- **A last-seen column in the CSV export** — deliberately absent, and the API does not provide it.
- **Presenting last seen as evidence that someone read an announcement.** It is not a read receipt
  and may not be labelled or grouped as one (hub ADR-0035 §8).
- **The DS `ScreenConfigManager` couple-account screen**, which renders a `lastSeen` with a time of
  day. Not scoped by ADR-0035, and its time component does not exist.
