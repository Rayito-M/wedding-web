# CLAUDE.md — wedding-web Agent Memory

> Loaded into every Claude Code session in this repo. Keep it short, factual, current.
> Update in the same commit as any convention change.

## This repo is part of a four-repo system

**Always read first:** `../wedding-architecture/README.md`, then `SPEC.md`, then this file.

- **`../wedding-architecture`** — system-wide decisions, glossary, API contract. **Read for any cross-cutting context.**
- **`../wedding-ui-design`** — design system: tokens, components, guidelines. **Read before implementing any component.**
- **`../wedding-api`** — NestJS backend; exposes the API this SPA consumes.
- **`.` (this repo)** — Angular 22 SPA implementation.

The architecture hub may edit this file, `TASKS.md`, `.agent/skills/`, and cross-refs as part of a coordinated change. See `../wedding-architecture/.agent/authority.md`. **Never** application code.

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
- **Testing:** Jasmine (unit), Playwright (e2e)
- **Build:** `ng build` produces a static SPA for S3 + CloudFront (hub ADR-0012)

## Commands

- Install: `pnpm install`
- Dev: `pnpm start` (ng serve on localhost:4200)
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Test (unit): `pnpm test`
- Test (e2e): `pnpm test:e2e`
- Build: `pnpm build` (production static build → `dist/`)
- **Regenerate API client** → `pnpm gen:api` (from `../wedding-architecture/contracts/openapi.json`; committed, never hand-edited)

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
3. **All styling comes from the design system.** Read `../wedding-ui-design/readme.md`, `tokens/`, and the component `*.prompt.md` before writing CSS. Never invent colors, spacing, or radii — use the CSS custom properties from `src/styles/_tokens.scss` (mirrors the DS tokens; theme keys `d|e|f`). Prefer the semantic aliases (`--surface-card`, `--text-muted`, `--brand-accent`, `--border-hairline`, `--on-accent`…) over raw roles (`--surface`, `--sub`, `--accent`, `--line`).
4. **No hardcoded responsive breakpoints.** The design is mobile-first; desktop is a natural progression. Test on iOS Safari (iPhone SE, 12, 14) and Chrome Android (current major).
5. **Use signals, not RxJS operators.** Prefer `input()`, `output()`, `effect()`, `computed()` over `@Input/@Output` and `subscribe()`.
6. **HTTP calls include `Authorization: Bearer <token>` by default.** The auth interceptor does this; never manually add headers for token auth.
7. **No environment-specific feature flags.** If a feature is environment-dependent, manage it via an API endpoint or config service, not `environment.ts`.
8. **i18n is mandatory for all user-facing text.** Mark strings in the template via `i18n="@@key"` and `i18n-title`, or use the `translate` pipe. No hardcoded Spanish/English/French mixed.
9. **Forms validate on blur, submit on Enter or button click.** No real-time validation feedback noise; errors appear on submit or focus-out.
10. **Authentication state is in a signals-based auth service,** not localStorage. Session tokens are held in memory; reload clears them (acceptable for v1, low-stakes data).
11. **Before merging:** `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` all pass.
12. **No third-party UI libraries** (Material, Bootstrap, etc.) — the design system is the single source; components are hand-built per spec.
13. **Images:** no raster photography; use `PhotoPlaceholder` component (from design system) or inline SVG illustrations. All images responsive and optimized.
14. **Accessibility:** WCAG 2.1 AA minimum. Semantic HTML, `aria-label` where needed, keyboard navigation on all interactive elements.

## Conventions

- **Component files:** always three separate files — `<name>.ts` (logic), `<name>.html` (template), `<name>.scss` (styles). Never inline via `template:` or `styles:`.
- **Component naming:** folder + file share the kebab-case name (e.g. `shared/stat-tile/stat-tile.ts`); always standalone; selector is `app-<name>`, or an attribute selector on a native element when the component is a styled native (e.g. `button[app-btn]`, `input[app-input]`).
- **CSS organization:** one `.scss` file per component; all styling there, never `style` attributes or inline `ngStyle`.
- **Imports:** absolute via `@/` alias mapped to `src/app/`; no `../../..`.
- **Signals usage:** prefer `input()` for props, `output()` for events, `effect()` for side effects.
- **API integration:** auto-generated models from OpenAPI; never duplicate type definitions.
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
- **How to build a component from the design system** → `.agent/skills/design-component-author.md`
- **Design tokens & component reference** → invoke skill `wedding-design` (from `../wedding-ui-design/`)

## When in doubt

Stop and ask. Do not invent new components, styling, or flows. Before changing a visual pattern, check the design system; before adding a feature, check `SPEC.md` in the hub. If the change feels cross-cutting (affects both repos, changes a glossary term, changes auth or API shape), it's a **hub ADR** — escalate to the system-architect role.

## Skills available in this repo

- **design-component-author** (`.agent/skills/design-component-author.md`) — step-by-step guide for implementing a component from the design system spec, including validation against the reference.
- **wedding-design** (imported from `../wedding-ui-design/SKILL.md`) — design system reference tool; use it to understand tokens, see component examples, or prototype UI mocks.
