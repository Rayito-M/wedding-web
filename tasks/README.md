# TASKS — wedding-web

> Atomic, agent-sized tasks. One task = one PR. Tasks numbered T2xx to avoid collision with `wedding-api` (T1xx).
> Status: `todo` | `in-progress` | `blocked` | `done`.
>
> An implementer agent reports a finished task as a single JSON object validating against
> `../wedding-architecture/.agent/contracts/task-report.schema.json` — measured from command output and `git status --short`, never
> asserted. `files.deleted` and `out_of_scope_touched` are required and an empty array is a claim,
> not an omission.
>
> Note: hub ADR-0011 (superseded) once reserved T260–T263 for messaging work that hub ADR-0014 cut
> from scope. Those reservations were never written, and **all four numbers have since been reused
> for live tasks** — T260/T261 (linked-partner RSVP rules), T262 (`app.spec.ts` TestBed repair),
> T263 (stand up Playwright). Corrected 2026-09-03: the previous wording called them "void", which
> invited someone tidying up to delete four real tasks. Nothing here is void.

---

---

## How this is organised

One directory per phase, in the order the phases were worked. Each holds that phase's `TASKS.md`
verbatim and a `reports/` directory for the JSON an implementer writes when it finishes a task
(`../wedding-architecture/.agent/contracts/task-report.schema.json`).

**This file is the index, and it exists because task numbers are global.** ADRs and the other repo
cite them bare — "`wedding-web` T341" — and nothing in a number says which phase holds it. One
`grep` here answers that; without it, splitting the file would only have traded one long file for a
directory you have to search.

Directories carry an ordinal prefix as well as the phase letter. Four sections predate the lettering
(the two visual-refresh passes, the CSS-hygiene pass, and the scope-cuts note), so letters alone
neither sort nor uniquely name them.

---

## Phases

| # | Phase | Tasks |
|---|---|---|
| `01-phase-a-app-managed-auth` | Phase A — App-managed auth (hub ADR-0013) | 4 |
| `02-phase-b-aws-hosting` | Phase B — AWS hosting (hub ADR-0012) | 1 |
| `03-phase-c-contract-sync` | Phase C — Contract sync (hub ADR-0005 amendment 2026-07-15) | 1 |
| `04-phase-d-api-client-and-data-layer` | Phase D — API client generation + data-access layer (in-repo ADR W-0001) | 9 |
| `05-phase-e-rsvp-crud-migration` | Phase E — RSVP CRUD migration (hub ADR-0022) | 1 |
| `06-phase-f-diet-menu` | Phase F — Diet & menu (hub ADR-0024) | 3 |
| `07-scope-cuts` | Scope cuts (hub ADR-0014) — do not build | 0 |
| `08-visual-refresh` | Phase — Visual refresh (DS update; re-baselined 2026-07-31 to commit `90246bd`) | 16 |
| `09-visual-refresh-rebaseline` | Phase — Visual-refresh re-baseline to DS `90246bd` (2026-07-31) | 6 |
| `10-css-hygiene` | Phase — Cross-screen CSS hygiene (in-repo, no hub dependency) | 9 |
| `11-phase-g-analytics-consent` | Phase G — Analytics consent (hub ADR-0027) | 3 |
| `12-phase-h-error-tracking` | Phase H — Error tracking (hub ADR-0026) | 1 |
| `13-phase-i-type-hygiene` | Phase I — Type hygiene (CLAUDE.md Hard rule 15) | 1 |
| `14-phase-j-partner-account-vs-plus-one` | Phase J — Partner: "own guest account" vs. "plus-one" (DS re-sync, in-repo ADR W-0002) | 9 |
| `15-phase-k-one-shared-rsvp-editor` | Phase K — One shared RSVP editor (DS `RSVPEditor`, in-repo ADR W-0003) | 6 |
| `16-phase-l-kind-discriminator` | Phase L — The `kind` discriminator (live save bug) + the DS status-button rework | 6 |
| `17-phase-m-confirmed-party-removal` | Phase M — Confirmed party removal (DS `ConfirmDialog`, commit `ccea99a`) | 3 |
| `18-phase-n-preparation-timeline` | Phase N — Couple's preparation timeline (hub ADR-0029, accepted) | 3 |
| `19-phase-o-notifications-and-toasts` | Phase O — In-app notifications + transient toasts (DS `7db5d1c`) | 8 |
| `20-phase-p-last-seen` | Phase P — Last seen in the guest list (hub ADR-0035, DS `717120b`) | 4 |
| `21-phase-q-the-stale-bundle-problem` | Phase Q — The stale bundle problem (hub ADR-0037, accepted) | 1 |
| `22-phase-r-design-system-update` | Phase R — Design-system update (`wedding-ui-design` 8699c8c) | 3 |
| `23-phase-s-guest-nickname-field` | Phase S — Guest nickname field (`wedding-ui-design` `76aa9fa`) | 5 |
| `24-phase-t-profile-modal` | Phase T — "My profile" becomes an account-dropdown modal (`wedding-ui-design` `76aa9fa`) | 3 |
| `25-phase-u-shared-profile-fields` | Phase U — Shared profile-editing fields, nickname cap raised to 30, edit-mode jump | 8 |
| `26-phase-v-partner-profile-editing` | Phase V — Partner-account profile editing from both RSVP surfaces | 16 |
| `27-phase-w-guest-manager-scroll` | Phase W — Guest manager: infinite scroll + sort re-sync (`wedding-ui-design` `6a76eba`) | 10 |
| `28-phase-x-layout-layer` | Phase X — The layout layer (hub ADR-0041, amended by ADR-0042) | 10 |
| `29-phase-z-task-file-ergonomics` | Phase Z — Task-file ergonomics (no ADR; this is tooling, not a decision) | 1 |

---

## Every task, by number

| Task | Title | Status | Phase |
|---|---|---|---|
| **T200** | Sign-in integration (app-managed auth) | todo | `01-phase-a-app-managed-auth` |
| **T201** | Sign-in UX + unmatched-identity page | todo | `01-phase-a-app-managed-auth` |
| **T202** | Admin gate via `role` claim | todo | `01-phase-a-app-managed-auth` |
| **T203** | Admin guest form: identity fields | todo | `01-phase-a-app-managed-auth` |
| **T204** | S3 + CloudFront deploy pipeline | todo | `02-phase-b-aws-hosting` |
| **T205** | Regenerate API client for typed response schemas | todo | `03-phase-c-contract-sync` |
| **T206** | [ESCALATION → hub] Amend ADR-0005 for the openapi-generator switch | ✅ done (hub ADR-0016 landed 2026-07-16 | `04-phase-d-api-client-and-data-layer` |
| **T207** | Add openapi-generator tooling + `gen:api` / `gen:api:check` scripts | ✅ done (2026-07-17) | `04-phase-d-api-client-and-data-layer` |
| **T208** | Generate the initial API client into `src/app/core/api/` | ✅ done (2026-07-17) | `04-phase-d-api-client-and-data-layer` |
| **T209** | Bootstrap @ngrx/store + effects + entity + data | ✅ done (2026-07-17) | `04-phase-d-api-client-and-data-layer` |
| **T210** | Entity metadata + repository-vs-direct boundary | todo | `04-phase-d-api-client-and-data-layer` |
| **T211** | Custom entity data services delegating to the generated client | todo | `04-phase-d-api-client-and-data-layer` |
| **T212** | Signals-first entity facades | todo | `04-phase-d-api-client-and-data-layer` |
| **T213** | RPC / non-entity client services with signal boundary | todo | `04-phase-d-api-client-and-data-layer` |
| **T214** | Retire mock services; migrate screens to the data layer | todo | `04-phase-d-api-client-and-data-layer` |
| **T215** | Migrate RSVP flows to the single-mutable CRUD resource | blocked (on wedding-api T190 contract  | `05-phase-e-rsvp-crud-migration` |
| **T216** | RSVP party editor + per-participant diet/allergy pickers | blocked (on wedding-api T191 contract  | `06-phase-f-diet-menu` |
| **T217** | Per-participant menu-selection view (Phase 2) | blocked (on wedding-api T191/T192) | `06-phase-f-diet-menu` |
| **T218** | Admin diet & menu catalog management | blocked (on wedding-api T191) | `06-phase-f-diet-menu` |
| **T219** | Re-sync design tokens to the DS update (default theme mauve → terracotta) | done | `08-visual-refresh` |
| **T220** | Album screen: desktop metadata line, filter/grid polish, motorcycle decor | done | `08-visual-refresh` |
| **T221** | Config manager screen: visual polish pass | done | `08-visual-refresh` |
| **T222** | Dashboard screen: drop extra stats-card decoration (small diff) | done (ref now legacy | `08-visual-refresh` |
| **T223** | Guest manager screen: mobile list layout + modal decoration | done (2026-07-31) | `08-visual-refresh` |
| **T224** | Invitee dashboard: drop emoji, componentize schedule rows (small diff) | superseded (2026-07-31 | `08-visual-refresh` |
| **T225** | RSVP screen: step eyebrow label + desktop card chrome | done | `08-visual-refresh` |
| **T226** | Schedule screen: date eyebrow badge + motorcycle decor | done | `08-visual-refresh` |
| **T227** | Travel screen: desktop two-column layout, eyebrow badge, motorcycle decor | done | `08-visual-refresh` |
| **T228** | Welcome screen: motorcycle decor over the Alhambra skyline | done | `08-visual-refresh` |
| **T229** | Scaffold new Seating plan screen (presentational only) | done | `08-visual-refresh` |
| **T230** | Private layout shell: verify + re-apply tokens (shared header + tab-bar) | done (b816c12 scope) | `08-visual-refresh` |
| **T231** | Alhambra illustration: fix flagpole, add missing flag, correct sun-dot position | done | `08-visual-refresh` |
| **T232** | Alhambra illustration: add missing roof-peak cross on Palacio de los Córdova | done | `08-visual-refresh` |
| **T233** | Login flow: DS-aligned copy/layout + branded callback screens | done | `08-visual-refresh` |
| **T234** | Header: wire up the missing Album nav destination + AccountMenu dropdown parity | done | `08-visual-refresh` |
| **T235** | Re-baseline the private shell to the rewritten `AppShell` (nav model + desktop chrome) | done (2026-07-31) | `09-visual-refresh-rebaseline` |
| **T236** | Role-driven Home: reconcile `dashboard` + `invitee` against the unified `ScreenHome` | done (Option A, visual-only, 2026-07-3 | `09-visual-refresh-rebaseline` |
| **T237** | Scaffold new People (guest directory) screen (presentational only) | done | `09-visual-refresh-rebaseline` |
| **T238** | Scaffold new Profile (own profile) screen (presentational only) | done | `09-visual-refresh-rebaseline` |
| **T239** | Schedule status: item status + overall provisional/final, guest home + schedule + config | done (2026-07-31) | `09-visual-refresh-rebaseline` |
| **T240** | Config manager: missing "The couple" section | done (2026-08-01) | `09-visual-refresh-rebaseline` |
| **T241** | Audit duplicated screen CSS + fix token violations (hygiene only, no restructure) | todo | `10-css-hygiene` |
| **T242** | Consolidate the duplicated status pill into one shared implementation | todo | `10-css-hygiene` |
| **T243** | Raw-role → semantic-alias sweep + travel inline-SVG extraction (token hygiene, mechanical) | todo | `10-css-hygiene` |
| **T244** | De-hardcode `shared/loading` + `shared/error` (rogue hex + OS dark-mode blocks) | todo | `10-css-hygiene` |
| **T245** | Shared `app-avatar` component (DS `core/Avatar`) — retire 3 re-authored copies | todo | `10-css-hygiene` |
| **T246** | Shared status-dot partial for the guest-manager feature | todo | `10-css-hygiene` |
| **T247** | Consolidate near-clone screen SCSS: dashboard≈invitee blocks + generic primitives | done | `10-css-hygiene` |
| **T248** | Breakpoint convention: document sanctioned tiers + reconcile the guest-manager outlier | todo | `10-css-hygiene` |
| **T249** | [ESCALATION → hub/DS] Add `--scrim` + `--shadow-card` design tokens | resolved by hub ADR-0025 (2026-08-01)  | `10-css-hygiene` |
| **T250** | Cookie consent banner + gated GA4 loading | done | `11-phase-g-analytics-consent` |
| **T251** | Privacy policy disclosure for Google Analytics | done | `11-phase-g-analytics-consent` |
| **T252** | Verify GA4 consent banner against the bundle/perf budget | done | `11-phase-g-analytics-consent` |
| **T253** | Integrate Sentry Angular SDK (error tracking, release tagging) | done | `12-phase-h-error-tracking` |
| **T254** | QA sweep: detect + remove type declarations that duplicate generated API types | todo | `13-phase-i-type-hygiene` |
| **T255** | `app-input`: disabled/read-only visual state (DS `core/Input`) | done (265a5d6) | `14-phase-j-partner-account-vs-plus-one` |
| **T256** | Shared `partnerHasAccount()` helper + all Phase J i18n keys | done (ecd863d) | `14-phase-j-partner-account-vs-plus-one` |
| **T257** | Guest manager row: partner line reads account vs. plus-one, on mobile too | done (18c12c1) | `14-phase-j-partner-account-vs-plus-one` |
| **T258** | Guest profile modal: "Partner" info row with account / plus-one suffix | done (0c01a25) | `14-phase-j-partner-account-vs-plus-one` |
| **T259** | Manage-RSVP modal (admin): lock a linked partner's name + require first/last name | done (154378e) | `14-phase-j-partner-account-vs-plus-one` |
| **T260** | RSVP edit (guest): lock a linked partner's name + "needs a first and last name" gate | done (bab91fe) | `14-phase-j-partner-account-vs-plus-one` |
| **T261** | RSVP create (guest): stop accepting edits to a linked partner's name (silent-discard bug) | done (1892d5a) | `14-phase-j-partner-account-vs-plus-one` |
| **T262** | Repair `app.spec.ts` TestBed: missing `EntityServices` provider (unblocks Phase J) | done | `14-phase-j-partner-account-vs-plus-one` |
| **T263** | Stand up the Playwright e2e suite (the gate CLAUDE.md has always promised) | done | `14-phase-j-partner-account-vs-plus-one` |
| **T264** | Foundation: `rsvp.editor.*` i18n keys + shared unnamed-adult validation helper | done (uncommitted) | `15-phase-k-one-shared-rsvp-editor` |
| **T265** | Build the shared `app-rsvp-editor` component (no call sites yet) | done (uncommitted) | `15-phase-k-one-shared-rsvp-editor` |
| **T266** | Migrate the guest screen (`app-rsvp-edit`) onto `app-rsvp-editor` | done (uncommitted) | `15-phase-k-one-shared-rsvp-editor` |
| **T267** | Migrate the couple's manage-RSVP modal onto `app-rsvp-editor` (desktop + mobile) | done (uncommitted) | `15-phase-k-one-shared-rsvp-editor` |
| **T268** | Phase K sweep: retire the orphaned i18n keys and prove the duplication is gone | done (uncommitted) | `15-phase-k-one-shared-rsvp-editor` |
| **T269** | Couple: "Open their profile" from a locked partner name | — | `15-phase-k-one-shared-rsvp-editor` |
| **T270** | Regenerate the API client and carry `kind` on `partner2` | done (462b933, cc868d2) | `16-phase-l-kind-discriminator` |
| **T271** | Move `partnerHasAccount()` onto `kind` (no `id` fallback) | done (db05a48) | `16-phase-l-kind-discriminator` |
| **T272** | `app-rsvp-editor`: `statusPending` input + the "sadly no" reassurance line | done (742f9ba) | `16-phase-l-kind-discriminator` |
| **T273** | Guest RSVP screen: inline status editing, status-driven eyebrow, no "Change my answer" | done (4d045c4) | `16-phase-l-kind-discriminator` |
| **T274** | Declining an RSVP must never drop the party | — | `16-phase-l-kind-discriminator` |
| **T275** | Follow the upstream Zod-discriminator fix: `kind` degrades to `string`, `partner1` gains `attending?` | done (3f0b718, 5dc71a6) | `16-phase-l-kind-discriminator` |
| **T276** | [ESCALATION → hub/DS] Add a `--danger` semantic colour token | resolved by DS commit ccea99a (2026-08 | `17-phase-m-confirmed-party-removal` |
| **T277** | Mirror `--danger`/`--on-danger` + build the shared `app-confirm-dialog` (no call sites yet) | done (a7c9aff) | `17-phase-m-confirmed-party-removal` |
| **T278** | `app-rsvp-editor`: confirm before removing a partner or a child | todo | `17-phase-m-confirmed-party-removal` |
| **T279** | Couple-only preparation timeline screen | done (uncommitted) | `18-phase-n-preparation-timeline` |
| **T280** | Guest-facing milestones: announcement type, audience, and the send button | todo | `18-phase-n-preparation-timeline` |
| **T281** | Milestones: "Start from the usual plan" seed button in the empty state | todo | `18-phase-n-preparation-timeline` |
| **T282** | [ESCALATION → hub] In-app notifications arrive with no renderable content | todo | `19-phase-o-notifications-and-toasts` |
| **T283** | Phase O foundation: `bell`/`check` glyphs, in-repo ADR W-0005, all Phase O i18n keys | todo | `19-phase-o-notifications-and-toasts` |
| **T284** | Build `app-toast` + `app-toast-stack` (no call sites yet) | todo | `19-phase-o-notifications-and-toasts` |
| **T285** | `ToastCenterService` + mount the one shell-level stack | todo | `19-phase-o-notifications-and-toasts` |
| **T286** | `NotificationCenterService`: the signals read/write model over the generated client | todo | `19-phase-o-notifications-and-toasts` |
| **T287** | Build `app-notification-dialog` (no call sites yet) | todo | `19-phase-o-notifications-and-toasts` |
| **T288** | Build `app-notification-bell` and mount it in the header | todo | `19-phase-o-notifications-and-toasts` |
| **T289** | First real toast: surface notification write failures | todo | `19-phase-o-notifications-and-toasts` |
| **T290** | The relative-day label helper + ES/EN/FR copy | done | `20-phase-p-last-seen` |
| **T291** | Guest-list column + guest-detail row | done | `20-phase-p-last-seen` |
| **T292** | People directory: show `lastSeen` for a couple viewer | done | `20-phase-p-last-seen` |
| **T293** | Guest manager: drop the `GuestLastSeenService` workaround | done | `20-phase-p-last-seen` |
| **T294** | Recognise the too-old-client error and offer a reload | todo | `21-phase-q-the-stale-bundle-problem` |
| **T295** | Venue name on every timeline row | done | `22-phase-r-design-system-update` |
| **T296** | Travel screen on real config data, with an address-driven embedded map | done | `22-phase-r-design-system-update` |
| **T297** | Config manager: edit every language at once, and flag key moments | done | `22-phase-r-design-system-update` |
| **T298** | Foundation: nickname i18n keys + `UserProfileDataService.update()` DTO-mapping fix | done | `23-phase-s-guest-nickname-field` |
| **T299** | Shared `app-rsvp-editor`: nickname, locked when the name is locked | done | `23-phase-s-guest-nickname-field` |
| **T300** | Guest manager: nickname in search, create form, and edit-profile form | done | `23-phase-s-guest-nickname-field` |
| **T301** | People directory: nickname in search + card | done | `23-phase-s-guest-nickname-field` |
| **T302** | Profile scaffold: nickname field (fixture only) | done | `23-phase-s-guest-nickname-field` |
| **T303** | Build `app-profile-modal` (no call sites yet) | done | `24-phase-t-profile-modal` |
| **T304** | `ProfileModalService`, wire the account dropdown, mount in the shell, retire `/profile` | done | `24-phase-t-profile-modal` |
| **T305** | Wire "Save changes" to the real profile-update endpoint | done | `24-phase-t-profile-modal` |
| **T306** | Fix `UpdateUserProfileDto` write path for the new contract shape | done | `25-phase-u-shared-profile-fields` |
| **T307** | Nickname max length: 8 → 30 in the RSVP editor and self-service RSVP create | done | `25-phase-u-shared-profile-fields` |
| **T308** | "Open their profile" from the RSVP editor lands in edit mode | done | `25-phase-u-shared-profile-fields` |
| **T309** | Build `app-relation-fields` (and move `app-guest-seg` to `shared/`) | done | `25-phase-u-shared-profile-fields` |
| **T310** | Build `app-profile-fields` (composes `app-relation-fields`) | done | `25-phase-u-shared-profile-fields` |
| **T311** | Migrate `guest-profile-modal` to `app-profile-fields` | done | `25-phase-u-shared-profile-fields` |
| **T312** | Migrate `profile-modal` ("My profile") to `app-profile-fields` | done | `25-phase-u-shared-profile-fields` |
| **T313** | Migrate `guest-create-modal` to `app-profile-fields`/`app-relation-fields` | done | `25-phase-u-shared-profile-fields` |
| **T314** | Guest manager "open their profile" jump: full-chain re-verification + close the integration-test gap | done | `26-phase-v-partner-profile-editing` |
| **T315** | `ProfileModalService`: accept an optional edit target | done | `26-phase-v-partner-profile-editing` |
| **T316** | `ProfileModal`: distinguish "My profile" from a partner's in the fixed header | done | `26-phase-v-partner-profile-editing` |
| **T317** | `PrivateLayout`: resolve, fetch and write the real edit target, not always self | done | `26-phase-v-partner-profile-editing` |
| **T318** | `rsvp-editor`: offer "Open their profile" in the `owner` perspective too | done | `26-phase-v-partner-profile-editing` |
| **T319** | `rsvp-edit`: wire "Open their profile" to the generalized `ProfileModalService` | done | `26-phase-v-partner-profile-editing` |
| **T320** | [ESCALATION → hub] RSVP solo decline: does it change audience / headcount semantics? | todo | `26-phase-v-partner-profile-editing` |
| **T321** | Foundation: `attending` on the draft, pure helpers, in-repo ADR W-0007, i18n keys | done | `26-phase-v-partner-profile-editing` |
| **T322** | `app-rsvp-editor`: per-person "Attending" toggle (any adult `canDeclineAlone` allows) | done | `26-phase-v-partner-profile-editing` |
| **T323** | `app-rsvp-editor`: "Not attending" pill and summary line | done | `26-phase-v-partner-profile-editing` |
| **T324** | `app-rsvp-editor`: party total line — "Attending: X of N" vs "Total: N" | done | `26-phase-v-partner-profile-editing` |
| **T325** | [blocked on T320] Reflect solo decline in count/audience-adjacent surfaces | blocked | `26-phase-v-partner-profile-editing` |
| **T326** | Widen solo decline to `partner1` (ADR W-0007 §Amendment) | done | `26-phase-v-partner-profile-editing` |
| **T327** | Restore the partner "Open their profile" jump in the `owner` perspective + repair stale spec doubles | todo | `26-phase-v-partner-profile-editing` |
| **T328** | Derive `RsvpDto.status` from the per-adult `attending` flags | todo | `26-phase-v-partner-profile-editing` |
| **T329** | Fix T328's roll-up: bidirectional sync + "absent flags are not evidence" | todo | `26-phase-v-partner-profile-editing` |
| **T330** | Guest manager: replace pagination with a growing list (scroll + "Load more") | done | `27-phase-w-guest-manager-scroll` |
| **T331** | Guest manager: align the sort affordance and the "Last seen" order with the DS | done | `27-phase-w-guest-manager-scroll` |
| **T332** | Guest manager: real ARIA table semantics so `aria-sort` becomes valid | done | `27-phase-w-guest-manager-scroll` |
| **T333** | Guest manager: remove the double-firing keydown bindings on native buttons | done | `27-phase-w-guest-manager-scroll` |
| **T334** | Guest manager: adopt a `limit` once the counts are server-side | blocked | `27-phase-w-guest-manager-scroll` |
| **T335** | Couple: grant and revoke a delegation, with the required kind (desktop + mobile) | done | `27-phase-w-guest-manager-scroll` |
| **T336** | Guest: read-only "who answers for you" on the profile modal | done | `27-phase-w-guest-manager-scroll` |
| **T337** | Delegate: the RSVP hub, names only, no relation line | done | `27-phase-w-guest-manager-scroll` |
| **T338** | One reading of a missing `attending`, and comments that match the schema | done | `27-phase-w-guest-manager-scroll` |
| **T339** | Can a plus-one decline? A required flag the editor cannot set | done | `27-phase-w-guest-manager-scroll` |
| **T340** | `_layout.scss`: page shells, scroll ownership, named breakpoints | done | `28-phase-x-layout-layer` |
| **T341** | The layout owns the pinned regions; `main` stays the one scroller | done | `28-phase-x-layout-layer` |
| **T342** | stylelint, because guidance alone already failed once | done | `28-phase-x-layout-layer` |
| **T343** | Migrate the four oversized screens onto the layer | todo | `28-phase-x-layout-layer` |
| **T344** | `anyComponentStyle` becomes an error | todo | `28-phase-x-layout-layer` |
| **T345** | The nav derives from the route tree, and stops failing open | done | `28-phase-x-layout-layer` |
| **T346** | Split `TASKS.md` into `tasks/<phase>/`, with an index | done | `29-phase-z-task-file-ergonomics` |
| **T347** | The `overflow` audit and the per-breakpoint scroller classification | done | `28-phase-x-layout-layer` |
| **T348** | Give a screen back scroll observation and scroll control | done | `28-phase-x-layout-layer` |
| **T349** | A layout-regression spec per migrated screen, so a device stops being the only check | todo | `28-phase-x-layout-layer` |
| **T350** | `people` stops nesting a scroller inside `main` | todo | `28-phase-x-layout-layer` |
