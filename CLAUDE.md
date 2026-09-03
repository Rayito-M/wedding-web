# CLAUDE.md — wedding-web Agent Memory

> Loaded into every Claude Code session in this repo. Keep it short, factual, current.
> Update in the same commit as any convention change.

## This repo is part of a four-repo system

**Always read first:** `../wedding-architecture/README.md`, then `SPEC.md`, then this file.

- **`../wedding-architecture`** — system-wide decisions, glossary, API contract. **Read for any cross-cutting context.**
- **`../wedding-ui-design`** — design system: tokens, components, guidelines. **Read before implementing any component.**
- **`../wedding-api`** — NestJS backend; exposes the API this SPA consumes.
- **`.` (this repo)** — Angular 22 SPA implementation.

The architecture hub may edit this file, `TASKS.md`, `.agents/skills/`, and cross-refs as part of a coordinated change. See `../wedding-architecture/.agent/authority.md`. **Never** application code.

## Project

Angular 22 single-page app. Standalone components, signals-first, zoneless (no change detection zones). Guests and admins sign in via Twilio SMS OTP or Google/Apple (hub ADR-0013); the API is at `../wedding-api`. The design system (`../wedding-ui-design/`) is the source of truth for all styling and component behavior — this repo consumes design tokens and implements components per the spec.

## Tech stack (do not change without an ADR — hub if cross-cutting, in-repo if tactical)

- **Runtime:** Node.js 20 LTS, pnpm
- **Framework:** Angular 22 (standalone components, no NgModules)
- **Language:** TypeScript 5 strict, no `any` without `// reason:`
- **Styling:** CSS custom properties only — all values from `../wedding-ui-design/tokens/`; no hardcoded colors, spacing, or radii
- **Signals:** `input()`, `output()`, `effect()`, `computed()` — modern reactive API
- **Forms:** template-driven or reactive forms with `FormGroup`, `FormControl` + signals adapters where available
- **i18n:** `ngx-translate` (ESP default, ENG/FRA switchable at runtime)
- **HTTP:** Angular `HttpClient`; token sent as `Authorization: Bearer` header (set by an HTTP interceptor)
- **Auth guard:** route guard checks for a valid session token; `/login` is the fallback
- **Testing:** Vitest (unit, via `ng test` — Angular 22's default builder; there is no Jasmine or
  Karma dependency). **No e2e suite exists yet** — Playwright is intended but has never been set
  up (no dependency, no config, no `e2e/` directory). See TASKS.md T263. Do not write acceptance
  criteria that gate on `pnpm test:e2e` until it exists.
- **Build:** `ng build` produces a static SPA for S3 + CloudFront (hub ADR-0012)

## Commands

- Install: `pnpm install`
- Dev: `pnpm start` (ng serve on localhost:4200)
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Test (unit): `pnpm test`
- Test (e2e): _not available — no such script; see T263_
- Build: `pnpm build` (production static build → `dist/`)
- **Regenerate API client** → `pnpm gen:api` (from `../wedding-architecture/contracts/openapi.json`, override via `OPENAPI_SOURCE`; committed, never hand-edited; requires a JVM — see README)
- **API client drift check** → `pnpm gen:api:check` (regenerates to a temp dir, diffs against `src/app/core/api/`)

## Folder ownership rules

| Folder | Purpose | May agents add files? |
|---|---|---|
| `src/app/core/` | Singletons: auth, HTTP, services | With caution |
| `src/app/core/api/` | Generated API client (committed, never edited) | No — `pnpm gen:api` only |
| `src/app/shared/components/` | Reusable component library | Yes, per design spec |
| `src/app/shared/pipes/` | Custom pipes (translate, number format, etc.) | Yes |
| `src/app/features/` | Feature modules (invitation, RSVP, admin, etc.); each folder is a bounded context | Yes, within one feature |
| `public/` | HTML, redirects, favicon,Static images, i18n JSON files | With caution |

## Hard rules (do not violate)

1. **Component files are always separate: `<name>.ts`, `<name>.html`, `<name>.scss`** (Angular 22 style — no `.component` suffix). Never use `template:` or `styles:` inline. Rationale: readability, testability, clarity of concerns.
2. **No inline styles or `style` attributes.** All CSS goes in the `.scss` file; use class selectors or `[class.<name>]="condition"` in the template.
3. **All styling comes from the design system.** Read `../wedding-ui-design/readme.md`, `tokens/`, and the component `*.prompt.md` before writing CSS. Never invent colors, spacing, or radii — use the CSS custom properties from `src/styles/_tokens.scss` (mirrors the DS tokens). Prefer the semantic aliases (`--surface-card`, `--text-muted`, `--brand-accent`, `--border-hairline`, `--on-accent`, and — once mirrored per hub ADR-0025 — `--scrim`, `--shadow-overlay`, `--shadow-modal`) over raw roles (`--surface`, `--sub`, `--accent`, `--line`). **Theming axis (hub ADR-0025):** `data-theme` on the document root is the **sole** theming mechanism (values `terracotta` [default], `mauve`, `verdeagua` — all light). **Never** use `@media (prefers-color-scheme: dark)` — the app does not theme off OS preference. In-flow cards stay flat (1px hairline, no shadow); shadows are only for off-flow overlays (`--shadow-overlay` for dropdowns/menus/sticky header, `--shadow-modal` for dialog panels, `--shadow-knob` for the toggle).
4. **No hardcoded responsive breakpoints.** The design is mobile-first; desktop is a natural progression. Test on iOS Safari (iPhone SE, 12, 14) and Chrome Android (current major).
5. **Use signals, not RxJS operators.** Prefer `input()`, `output()`, `effect()`, `computed()` over `@Input/@Output` and `subscribe()`.
6. **HTTP calls include `Authorization: Bearer <token>` by default.** The auth interceptor does this; never manually add headers for token auth.
7. **No environment-specific feature flags.** If a feature is environment-dependent, manage it via an API endpoint or config service, not `environment.ts`.
8. **i18n is mandatory for all user-facing text.** Mark strings in the template via `i18n="@@key"` and `i18n-title`, or use the `translate` pipe. No hardcoded Spanish/English/French mixed.
9. **Forms validate on blur, submit on Enter or button click.** No real-time validation feedback noise; errors appear on submit or focus-out.
10. **Authentication state is in a signals-based auth service,** not localStorage. Session tokens are held in memory; reload clears them (acceptable for v1, low-stakes data).
11. **Before merging:** `pnpm typecheck && pnpm lint && pnpm test` all pass. (`pnpm test:e2e` will
    join this list once T263 stands Playwright up; it does not exist today. Known exception: 4
    pre-existing lint errors in `src/app/shared/modal/` — leave them unchanged unless the task is
    to fix them.)
12. **No third-party UI libraries** (Material, Bootstrap, etc.) — the design system is the single source; components are hand-built per spec.
13. **Images:** no raster photography; use `PhotoPlaceholder` component (from design system) or inline SVG illustrations. All images responsive and optimized.
14. **Accessibility:** WCAG 2.1 AA minimum. Semantic HTML, `aria-label` where needed, keyboard navigation on all interactive elements.
15. **Never recreate generated API types.** The generated client in `src/app/core/api/` is the single source of truth for API models. Local `type`/`interface`/`enum`/string-union redeclarations of anything that maps to an API model (DTO fields, enums like side/kind/status/role/lang, request/response shapes) are prohibited — import the generated type instead. Before declaring such a type, grep `src/app/core/api/model/` for an existing definition. Hand-copied types silently drift when the client is regenerated (`pnpm gen:api`). A genuine exception (the generated type is truly unsuitable for a specific UI concern) requires stopping to ask the user for approval first, with a clear synthetic explanation: which API type exists, why it can't be used, and the proposed local type. Never create the parallel type silently.
16. **`lastSeen` (hub ADR-0035, widened by ADR-0036) is couple-only and read-only, on any surface.** `GuestDto`/`GuestListResponseDto` (`GET /v1/guests`) and `UserProfileDto`/`UserDto` (`GET /v1/profile`, `GET /v1/users`) all carry the field structurally, but the API only ever *populates* it when the caller is bride/groom — everyone else gets `undefined`, indistinguishable from "this admin-visible account never signed in". **Never infer visibility from whether `person.lastSeen` is set.** Gate any UI that renders it (including the bare "Never signed in" state) on an explicit "is the signed-in user the couple" signal (`LoginService.isCouple`) — never on the field's presence, and never render it at all for a non-couple viewer, including a guest looking at their own profile. Never build an input, edit control, or clear button for it: the API ignores the field on write. Never label or group it as evidence that an announcement was read, or as a signal a filter/automation acts on — it is a liveness signal, not a read receipt and not a trigger (ADR-0035 §7/§8/§10).
17. **The app is in production (v1.0.0, 2026-08-28) and this bundle is not redeployed with the API** (hub ADR-0037 §7). The SPA is static on CloudFront, so a guest can be running an hour-old — or a week-old — bundle against a newer API. Two consequences. **(a)** After `pnpm gen:api`, a compile error against the regenerated client is not just a local fix: it means the contract changed under a client that is *already live in guests' browsers*, and the API is required to keep serving the old shape for at least 24 hours from the web deploy. Do not assume "both sides ship together" — they never do here. **(b)** When the API returns the **distinguishable too-old-client error**, surface a **reload prompt** in ES/EN/FR from the central HTTP error interceptor — never a broken screen, never the generic error state, never a raw status code. Reloading must actually fetch a fresh bundle, not just change route. Do **not** build version polling, heartbeats or a background update check; the trigger is an error on a call the user already made (T294).
18. **Delegation UI: the couple grants it, and the family tie is only ever shown from the subject's side** (hub ADR-0039). Four rules, and each one contradicts something the design system draws — the mocks are not the spec here. **(a) There is no guest-side grant.** `ProfileModal`'s picker and its *"The couple can also set this up on your behalf"* line describe a screen that is **cut**; a guest sees who answers for them **read-only**, and the only editable control lives in the couple's guest profile editor — desktop **and** mobile, which `ScreenGuestManagerMobile.jsx` does not draw. **(b) Picking a name is never enough.** `kind` is required, from exactly `father | mother | brother | sister`, so the grant flow has a mandatory second step that no mock draws; build it from existing primitives. No free text, no "other", and never reuse the guest `relation.link` options (33 values, different concept). **(c) Never invert the tie.** On the *delegate's* RSVP hub, render the subject's **name** and the reply's state and **no relation line** — `ScreenRSVPHub.jsx`'s `meta={d.relation}` and its *"My parents"* / *"My grandmother"* strings correspond to nothing the API returns, and the inverse is unrenderable in ES and FR because nobody's gender is stored. Render the kind only where it is stored: the couple's guest manager and the subject's own profile. **(d) One delegation, one person.** A card may still be titled with two names when a linked couple shares one RSVP — that is the party label from the RSVP's own adults, not a plural delegation.

## Conventions

- **Component files:** always three separate files — `<name>.ts` (logic), `<name>.html` (template), `<name>.scss` (styles). Never inline via `template:` or `styles:`.
- **Component naming:** folder + file share the kebab-case name (e.g. `shared/stat-tile/stat-tile.ts`); always standalone; selector is `app-<name>`, or an attribute selector on a native element when the component is a styled native (e.g. `button[app-btn]`, `input[app-input]`).
- **CSS organization:** one `.scss` file per component; all styling there, never `style` attributes or inline `ngStyle`.
- **Imports:** absolute via `@/` alias mapped to `src/app/`; no `../../..`.
- **Signals usage:** prefer `input()` for props, `output()` for events, `effect()` for side effects.
- **API integration:** auto-generated models from OpenAPI. Never redeclare an API type locally — see Hard rule 15.
- **i18n keys:** hierarchical kebab-case (e.g., `auth.otp.request-code`, `rsvp.step-1.title`).
- **Event names:** `(myEvent)` in templates, `output<MyEventPayload>()` in code.
- **Async operations:** use `async` pipe in templates where possible; manual subscription only for complex flows.

## Glossary

**Lives in the hub.** Read `../wedding-architecture/GLOSSARY.md`. Do not duplicate terms here.

## Where to look first

- **Cross-cutting context** → `../wedding-architecture/SPEC.md` and `ARCHITECTURE.md`
- **System-wide decisions** → `../wedding-architecture/docs/decisions/`
- **Design guidance** → `../wedding-ui-design/readme.md` and component `*.prompt.md` files
- **Domain vocabulary** → `../wedding-architecture/GLOSSARY.md`
- **What the app does** → `SPEC.md` (this repo)
- **Current task** → `TASKS.md`
- **Generated API client** → `src/app/core/api/` (read-only)
- **Feature map** → `src/app/features/` folder structure
- **How to build a component from the design system** → `.agents/skills/design-component-author.md`
- **Design tokens & component reference** → invoke skill `wedding-design` (from `../wedding-ui-design/`)

## When in doubt

Stop and ask. Do not invent new components, styling, or flows. Before changing a visual pattern, check the design system; before adding a feature, check `SPEC.md` in the hub. If the change feels cross-cutting (affects both repos, changes a glossary term, changes auth or API shape), it's a **hub ADR** — escalate to the system-architect role.

## Skills available in this repo

- **design-component-author** (`.agents/skills/design-component-author.md`) — step-by-step guide for implementing a component from the design system spec, including validation against the reference.
- **wedding-design** (imported from `../wedding-ui-design/SKILL.md`) — design system reference tool; use it to understand tokens, see component examples, or prototype UI mocks.
