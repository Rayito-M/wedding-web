# ADR W-0001: API client generation and data-access layer

> In-repo (wedding-web) ADRs use a `W-` prefix so their numbers never collide with hub
> ADRs (which are plain `NNNN`). This is the first in-repo ADR; it establishes the
> `docs/decisions/` location for tactical decisions that stay inside `wedding-web`.

- **Status:** accepted
- **Date:** 2026-07-16
- **Deciders:** wedding-web architect (this repo)
- **Scope:** wedding-web (in-repo) — **with one cross-cutting flag, see "Hub escalation"**

## Context

Today `wedding-web` has no real API integration: `src/app/core/*.service.ts` are
signal-backed **mock** services (`GuestService`, `RsvpService`, `DashboardService`,
`ConfigurationService`) and `src/app/core/api/` does not yet exist. We need to stand up
the real data layer against the contract defined in the hub.

Three things must be decided together, because they compose into one pipeline:

1. **Where the API model comes from.** Hub ADR-0005 already answers this: the canonical
   contract is `../wedding-architecture/contracts/openapi.json`, written by
   `wedding-api`, read by `wedding-web` via `gen:api`. We are not reopening that — we are
   implementing it.
2. **Which tool turns the contract into an Angular client.** Hub ADR-0005 §Decision.3 and
   `contracts/README.md` currently *name* `openapi-typescript-codegen`. The product owner
   has directed us to use **openapi-generator** (`typescript-angular` generator) instead,
   because it emits idiomatic Angular `@Injectable` services (HttpClient + `Observable`,
   `providedIn: 'root'`), a `Configuration`, and typed models — a better fit for a
   DI-first Angular 22 app than the framework-agnostic fetch client the other tool emits.
3. **How the app talks to the API at runtime.** The product owner has directed us to use
   **@ngrx/data** to manage the connection — but only for **REST entity collections**.
   RPC-style / non-entity endpoints (auth OTP, RSVP append, reports, the config
   singleton) must call the generated client directly through a thin service, not through
   an entity repository.

Constraint in tension: CLAUDE.md **Hard Rule #5** ("use signals, not RxJS operators;
prefer signals over `subscribe()`"). @ngrx/data and the generated client are
Observable-centric. This ADR must define the boundary where Observables become signals so
the signals-first rule holds at the component layer.

## Decision

### 1. Contract source of truth (reaffirms hub ADR-0005)

`gen:api` reads `../wedding-architecture/contracts/openapi.json` (override via the
`OPENAPI_SOURCE` env var for non-sibling checkouts) and writes to `src/app/core/api/`.
The generated client is **committed and never hand-edited** (CLAUDE.md folder-ownership
rule). A `gen:api:check` script regenerates to a temp dir and diffs against the committed
output to catch drift in CI (the `contracts/README.md` drift gate).

### 2. Client generator: openapi-generator `typescript-angular` (replaces openapi-typescript-codegen)

- Tooling: `@openapitools/openapi-generator-cli` (Node wrapper; requires a JVM/Java
  runtime available in dev and CI — documented as a prerequisite).
- Generator: `typescript-angular`, configured for Angular 22, `providedIn: 'root'`
  services, interface models, kebab-case file naming, single-request-parameter objects.
- Output: one `@Injectable` service per OpenAPI tag + typed models, into
  `src/app/core/api/`. Services use Angular `HttpClient`, so the existing auth
  interceptor attaches `Authorization: Bearer <token>` automatically (Hard Rule #6 — no
  per-call headers).
- This is the single source of endpoint URLs, params, and request/response shapes. No
  layer above it re-declares a path or a model.

**This switch changes a fact that hub ADR-0005 and `contracts/README.md` state
explicitly.** See "Hub escalation" below — it is the one part of this ADR that is not
purely in-repo.

### 3. Runtime data access: @ngrx/data for entities only

Add `@ngrx/store`, `@ngrx/effects`, `@ngrx/entity`, `@ngrx/data`. Bootstrap in
`app.config.ts` (store devtools gated on `isDevMode()` — no `environment.ts` feature
flags, Hard Rule #7).

**Exactly these resources get an @ngrx/data repository** (they are the true CRUD
collections in hub ADR-0015):

| Entity | Collection | Why a repository |
|---|---|---|
| `Guest` | `/v1/guests` (incl. `me` id) | list/get/create/update/delete collection |
| `AgendaItem` | `/v1/agenda-items` | any-guest read, admin CRUD collection |
| `Venue` | `/v1/venues` | any-guest read, admin CRUD collection |
| `Hotel` | `/v1/hotels` | any-guest read, admin CRUD collection |

**These are explicitly NOT repositories** — they call the generated client through a thin
direct service (the "repository concept only for REST entities" rule):

| Surface | Endpoint(s) | Why not an entity repository |
|---|---|---|
| Auth | `/v1/auth/otp/request`, `/v1/auth/otp/verify`, `/v1/auth/social` | RPC actions, no resource identity |
| RSVP | `/v1/guests/:id/rsvp` (GET latest, POST append) | append-only sub-resource, no id-addressable collection at this path |
| RSVP report | `/v1/rsvps` (`?format=csv`) | read-only aggregate report, not an editable collection |
| Config | `/v1/config` (GET, PATCH) | singleton, not a collection |

Each entity delegates its HTTP to a **custom `EntityCollectionDataService<T>`** that calls
the corresponding generated Angular service (registered via
`EntityDataService.registerServices(...)`), rather than @ngrx/data's default
URL-guessing data service. This keeps the generated client as the one source of URLs and
request typing, while @ngrx/data provides caching, selectors, and optimistic updates.

### 4. Signals boundary (satisfies Hard Rule #5)

RxJS is **confined to `src/app/core/` (the data layer)**. Components never inject an
`EntityCollectionService`, never inject a generated service, and never `.subscribe()`.

- **Entities:** each entity gets a **facade** in `src/app/core/data/` that wraps its
  `EntityCollectionService` and exposes state as signals via `toSignal()` (`entities`,
  `loading`, `error`) plus imperative command methods (`load()`, `add()`, `update()`,
  `remove()`). Components inject the facade, read signals, call commands.
- **RPC / non-entity services:** wrap the generated client; expose reads as signals
  (`toSignal`) and imperative actions as methods that return a `Promise` via
  `firstValueFrom(...)`. No raw `Observable` crosses into a component.

This keeps templates signal-first while letting @ngrx/data and the generated client speak
their native Observable dialect underneath.

## Alternatives considered

- **Keep `openapi-typescript-codegen`** (hub ADR-0005 as written). Framework-agnostic
  fetch client; would need hand-written Angular wrappers for DI and interceptors. Rejected
  per product-owner direction and worse Angular ergonomics.
- **@ngrx/data default data services** (root URL + `HttpUrlGenerator`, ignore generated
  services for transport). Simpler wiring, but re-declares paths and loses the generated
  request typing — two sources of truth. Rejected; we delegate to the generated services.
- **Repositories for everything, including RSVP/auth/config.** Forces append-only,
  report, singleton, and RPC surfaces into a CRUD-collection shape they do not have.
  Rejected — this is exactly the boundary the product owner drew.
- **`async` pipe in templates instead of `toSignal`.** Allowed by conventions, but a
  facade + `toSignal` keeps a single signals-first idiom and satisfies Hard Rule #5
  without per-template subscription management.

## Consequences

- Positive: one generated client is the single source of endpoint/shape truth; entity
  caching, selectors, and optimistic updates come free from @ngrx/data.
- Positive: components stay signal-first; RxJS never leaks past `core/`.
- Positive: the entity-vs-RPC split is explicit and enforceable in review.
- Negative: adds @ngrx/store/effects/entity/data and their RxJS surface (contained to the
  data layer) plus a devtools bundle (dev-only).
- Negative: openapi-generator needs a JVM in dev and CI — a new toolchain prerequisite.
- Negative: the tool switch requires a hub amendment before it is legitimate (below).
- Follow-up: tasks T206–T214 in `TASKS.md`.

## Hub escalation (the one cross-cutting part)

Decisions 1, 3, and 4 are purely in-repo (Angular runtime architecture) — this ADR owns
them. **Decision 2 is not fully in-repo:** switching the named codegen tool contradicts
hub ADR-0005 §Decision.3 and the "Who reads this file" section of
`contracts/README.md`, both of which name `openapi-typescript-codegen`. Per CLAUDE.md
("if the change feels cross-cutting… it's a hub ADR") and `../wedding-architecture/.agent/authority.md`,
this repo's architect **cannot** edit those hub files.

Required hub action (system-architect role, in `wedding-architecture`): amend ADR-0005
(and `contracts/README.md`) so the web-side generator is either named as
`openapi-generator` or generalized to "an OpenAPI→Angular client generator, tool choice
delegated to wedding-web (see in-repo ADR W-0001)". Until that amendment lands, task T207
(which installs the tool and rewrites the convention) is **blocked**. This ADR records the
in-repo design so the implementer can move the instant the hub gate opens.

## Implications per repo

- `wedding-web`: this ADR; new `src/app/core/api/` (generated), `src/app/core/data/`
  (facades + custom entity data services + entity metadata), RPC services; `gen:api` /
  `gen:api:check` scripts; @ngrx deps; `app.config.ts` provider bootstrap; mock services
  retired.
- `wedding-architecture`: **amend ADR-0005 + `contracts/README.md`** to reflect the
  generator switch (owned by the system-architect; blocks T207).
- `wedding-api`: none. No contract shape change; the API keeps writing the same
  `openapi.json`.

## Open questions

- **Package runner:** CLAUDE.md and the hub say `pnpm gen:api`, but this repo's
  `package.json` currently declares `"packageManager": "npm@11.17.0"` and Angular 22 (not
  21). Tasks below use the `gen:api` **script name** and stay runner-agnostic; the
  implementer should confirm npm-vs-pnpm and align CLAUDE.md in the same PR (or raise it).
  - **Resolved (T207, 2026-07-17): pnpm.** The repo had already migrated
    (`"packageManager": "pnpm@11.3.0"`, `pnpm-lock.yaml`/`pnpm-workspace.yaml` committed,
    `package-lock.json` removed); CLAUDE.md's pnpm commands were already correct, and
    `README.md` now documents pnpm + the JVM prerequisite for `gen:api`.

## References

- Hub ADR-0005 (OpenAPI contract in hub; amended 2026-07-15) — **needs a further
  amendment for the generator switch.**
- Hub ADR-0015 (resource-oriented API) — defines which resources are CRUD collections.
- Hub ADR-0013 (app-managed auth) — Bearer token via interceptor; auth is RPC.
- Hub ADR-0014 (scope cut) — no gallery/photos; `album.service` is out of scope.
- CLAUDE.md Hard Rules #5, #6, #7; folder-ownership table.
- `../wedding-architecture/.agent/authority.md` — why the tool switch escalates.