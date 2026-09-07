## Phase O — Hygiene batch (no ADR; this is maintenance, not a decision)

> Three unrelated, pre-existing findings from earlier phases, batched into one hygiene sweep rather
> than left to be re-discovered piecemeal: T370's un-unit-tested milestone computeds
> (`tasks/30-phase-n-navigation-five-cap/TASKS.md`), the `guest-manager-scrolled-header.spec.ts`
> flake root-caused-but-not-fixed by T364/T366 (`tasks/30-phase-n-navigation-five-cap/reports
> /T364.json` `risks[1]`, `reports/T366.json` `risks[0]`), and the i18n key-set drift T365 filed as
> a risk (`reports/T366.json` `risks[1]`). **This is a maintenance task — no visual changes, no new
> features; every parity spec is exactly as green after as before.**
>
> **Phase O is done when, and only when, all three of the following hold — nothing else enters this
> phase:**
>
> 1. `src/app/screens/dashboard/dashboard.spec.ts` exists and covers the countdown/`daysToGo` logic,
>    the RSVP-statistics bindings, and T370's milestone computeds (empty list, all-reached, mixed,
>    undated milestones).
> 2. `e2e/layout/guest-manager-scrolled-header.spec.ts` is green on all 5 Playwright projects (was
>    failing on all 5 since Phase N), fixed at the mechanism (`private-layout.ts`'s `onMainScroll()`)
>    rather than at the spec.
> 3. `public/i18n/{es,en,fr}.json` are key-set identical, with `rsvp.hub.detail.declinedSub` present
>    and translated in all three (it was missing from all three), and every other found drift
>    resolved (translated in if used, deleted if orphaned).

### T371 — Hygiene batch: dashboard unit coverage, the scrolled-header flake, i18n drift
- **Status:** done — 2026-09-07. All three items closed; `npx ng test --watch=false` 611/611 (baseline
  603 + 8 new dashboard specs, 0 failing); full local Playwright 270 passed / 0 failed / 20 skipped
  (was 265/5/20 before this task's fix — see report for the full accounting of why the suite's shape
  has grown well past the "~150 passed" figure this task was drafted against); `pnpm lint` 5
  documented pre-existing ESLint errors unchanged, stylelint and ds fidelity clean; `pnpm build`
  clean.
- **ADR:** none — repo hygiene, no cross-cutting decision
- **Acceptance:**
  1. **`dashboard.spec.ts`** (`src/app/screens/dashboard/`) — unit spec following the repo's
     component-mount convention (`milestones.spec.ts`/`invitee.spec.ts`'s own TestBed/DOM-assertion
     pattern, not protected-member reach-in): `DashboardService.daysToGo()`/`daysTranslationKey()`
     against the hardcoded `WEDDING_DATE`; `StatisticService.guestStatistics()`/`repliedPercent()`
     bindings in `.stats-card`; and T370's `milestonesReachedCount`/`OpenCount`/`OvercountCount`/
     `Percent`/`upcomingMilestones` computeds across empty, all-reached, mixed, and undated
     (`plannedDate: ''`) fixtures — the last one also stands as a regression guard against a
     `DatePipe` crash on an empty date, confirmed not to occur (`value === ''` short-circuits to
     `null` in Angular's own `DatePipe.transform`).
  2. **`guest-manager-scrolled-header.spec.ts`** — root cause (confirmed, not re-diagnosed):
     `private-layout.ts`'s `onMainScroll()` read
     `this.screenChrome.head() ? false : (scrollTop > 0)`, forcing `.scrolled` to `false` on any
     route with a registered pinned head — which `/guests` always has. That ternary (commit
     `535428d`, undocumented) predates hub ADR-0043's decoupling of pinning from scroll ownership:
     when `headPinned`/`footPinned` still decided who scrolled, a pinned head implied `main` was
     `overflow-y: clip` and never moved, so the `false` branch was inert. ADR-0043 (T352) made
     `main` `/guests`'s real scroller (it declares no `screenScroll`) while `/guests` kept its
     pinned head, turning the same line into a standing defect. **Fixed the mechanism**: removed
     the `screenChrome.head()` branch entirely — `.scrolled` now follows `main`'s own `scrollTop`
     on every route, pinned head or not. The spec's own expectation was correct throughout; nothing
     in it changed.
  3. **i18n drift**:
     - `rsvp.hub.detail.declinedSub` (used by `delegate-edit.html`, commit `289bd39`, missing from
       all three locales) — added in ES/EN/FR, third-person (the delegate is reading about someone
       else's reply, not their own — distinct from the guest's own first-person
       `rsvp.edit.declinedSub`), gender-neutral in ES ("Nos dijeron…"/"podrán", 3rd-person-plural
       reported-speech construction) and FR (impersonal "On nous a dit qu'il ne sera pas possible…"
       — no gendered pronoun refers to the subject, since no guest's gender is stored, hub
       CLAUDE.md hard rule 18(c)'s same reasoning applied to phrasing).
     - Full key-set comparison across `public/i18n/{es,en,fr}.json` (flatten every leaf path, diff
       the three sets) found 10 further pre-existing mismatched paths, all confirmed orphaned by
       grep (`shared.bride`/`shared.groom`/`welcome.location`/`welcome.couple.{bride,groom,quote}`
       in `en.json` only; `grenade`/`spain`/`guest_manager.header.headCount`/`welcome.tagline` in
       `es.json`/`fr.json` only) — none referenced by any template or `.ts` file, all deleted. The
       three files are now key-set-identical (764 keys each), reproduced by the same comparison
       script after the edit.
- **Non-goals:** no visual change, no new feature, no touching `src/app/screens/rsvp/rsvp.html` or
  `src/environments/release.ts` (pre-existing uncommitted work, out of scope and never staged).
- **Refs:** `tasks/30-phase-n-navigation-five-cap/reports/T364.json`,
  `tasks/30-phase-n-navigation-five-cap/reports/T366.json`, hub ADR-0043, hub ADR-0039 §6/CLAUDE.md
  hard rule 18(c) (gender-neutral delegate copy)
