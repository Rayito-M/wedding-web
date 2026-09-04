## Phase X — The layout layer (hub ADR-0041, amended by ADR-0042)

> `wedding-web` has a token layer (`_tokens.scss`) and a component library, and nothing between
> them. 9,883 lines of SCSS across 71 files, of which 412 lines (4%) are shared; 45% of dimensional
> values are raw `px`; three unnamed breakpoints; 13 files declare their own scroll container. Every
> screen re-derives its own page shell. This phase adds the missing layer and enforces it.
> Sequence matters: T340 → T341 → **T263** → **T348** → T345 → T347 → T342 → T343 (+ T349) →
> **T350** → T344.
> **T263 (Playwright) moved ahead of T348 on 2026-09-04**, from "any time before T349 needs it".
> T348's load-bearing acceptance bullet is a test that fails against current `main`, and its fix is
> an `IntersectionObserver` sentinel — JSDOM implements neither real layout nor intersection, so
> without the harness that bullet can only be met by mocking the observer, which rebuilds the exact
> blind spot T348 exists to close. T263 is not in this phase; it is a prerequisite pulled in from
> Phase J.
> T348 is not optional and not deferrable: T341 ships a known regression on `/guests`
> and T348 is its fix. Nothing in this phase releases without it. T345 sits out of numeric order
> deliberately: it shares T341's mechanism (a screen's chrome is declared on its route, hub
> ADR-0042) and the two land as one PR series.

### T340 — `_layout.scss`: page shells, scroll ownership, named breakpoints
- **Status:** done — `screen-scroll` ships as a **mixin**, not the `%placeholder` named below. Sass
  cannot `@extend` a top-level placeholder from inside a media query, and hub ADR-0042 §4 requires
  exactly that (`milestones` is flow on mobile, shell at `$bp-lg`; the ADR named `seating-plan` here
  until 2026-09-04 and was wrong — the deviation stands on the corrected screen, re-derived rather
  than re-asserted). Reproduced empirically before
  deviating; the acceptance text authorized it. Hub ADR-0041 §3/§Implications and ADR-0042 §4
  corrected to match (hub `321a257`). `%truncating-flex-child` uses plain `overflow: hidden` — hub
  ADR-0041 §4 was scoped the same day to layout containers only, so **T342's lint rule must carry
  that exemption** or it will flag this primitive.
- **Target release:** 1.2.0
- **Owner:** unassigned
- **Why:** hub **ADR-0041 §2/§6**, as amended by **ADR-0042 §2/§4**. Nothing in the repo owns what a
  screen shell *is*, so each screen invents one. `_primitives.scss` is deliberately scoped to atoms
  ("not behavior-bearing UI", its own header comment) and is the wrong home for structure.
- **Scope corrected 2026-09-03.** This task was written under ADR-0041 alone. ADR-0042 then moved the
  page shell and the pinned regions *into the layout*, so two of the three placeholders originally
  listed here no longer have an owner in this file. They are struck below rather than silently
  built — building them would produce a second, unused way to declare a shell.
- **Acceptance:**
  - New `src/styles/_layout.scss`, a sibling of `_primitives.scss`, with a header comment stating
    its contract exactly as `_primitives.scss` states its own — including that the *shell* lives in
    `private-layout.scss` and this file holds only what a screen itself can apply
  - `$bp-md: 640px`, `$bp-lg: 900px`, `$bp-xl: 1024px` and a `respond-to($bp)` mixin. This is the
    highest-value half of the task: 34 media queries currently spell three literals by hand
  - `%screen-scroll` — the single scrolling region. **Must compose inside `respond-to()`**, because
    per ADR-0042 §4 the flow/shell choice is per breakpoint, not per screen: `milestones` is flow on
    mobile and shell at `$bp-lg` — `:host` takes `height: 100%` and `.list` its `overflow-y: auto`
    only inside that media query. (This bullet named `seating-plan` until 2026-09-04; that screen is
    shell at every breakpoint. The requirement is unchanged.)
  - `%truncating-flex-child` — `min-width: 0` plus the ellipsis discipline of ADR-0041 §5. This is
    the guest-manager footer defect generalised: 47 `overflow: hidden` sites against 33
    `min-width: 0` sites says it recurs. Naming it is what lets T342 lint for it
  - Emits nothing unless extended — verified by a production build showing no growth in the global
    stylesheet (2,472 bytes at the time of writing)
- **Struck by ADR-0042 — do not build:**
  - ~~`%app-screen` (viewport-filling shell)~~ — under ADR-0042 §2 the screen does not own a shell;
    `private-layout` does, and `main` yields to it. Any screen-side viewport box would be a second
    declaration of the same thing
  - ~~`%screen-footer` (pinned bar)~~ — the pinned *box* is the layout's `.screen-foot` slot and its
    CSS belongs in `private-layout.scss` (T341). What a screen projects into it needs only
    `%truncating-flex-child` above
- **Non-goals:** no screen migrated yet (that is T343); no visual change of any kind; no change to
  `_primitives.scss` — atoms stay there, structure comes here
- **Refs:** hub ADR-0041 §2, §5, §6; hub ADR-0042 §2, §4; `src/styles/_primitives.scss` (T247),
  `src/styles/_tokens.scss`

### T341 — The layout owns the pinned regions; `main` stays the one scroller
- **Status:** done — step 1 (de-scaffold) landed as `34c8a12`. The mechanism (route-data flags,
  `ScreenChromeService` head **and** foot, `AppScreenHead`/`AppScreenFoot`), the shared
  `ScreenChromeHarness` test harness, `private-layout`'s pinning (`main`/`.screen-scroll`), and the
  `guest-manager` migration all land together in the rest of this series, with the moved pinning-
  contract test in `layouts/private-layout/screen-chrome.spec.ts`. Not done here: `guest-manager`
  verified on a real phone in French — that needs a human with a device, not an agent; see the T341
  report for the rest of the acceptance list checked off with evidence.
- **Device-verified 2026-09-03 — and it failed first.** Pinning did not work at all in a browser
  while all 556 tests passed: the head and foot scrolled away with the rows. Two CSS defects in
  `private-layout.scss`, fixed in `9474809` — `main` was missing `min-height: 0` (a flex item's
  automatic minimum size is zero only for a *scroll container*, and `clip` is deliberately not one,
  so ADR-0041 §4's `hidden` → `clip` change silently revived it), and `.screen-scroll.pinned` never
  overrode `display: contents`, so the mixin applied to no box. Re-verified after the fix: pinning
  holds, and flow screens are unaffected by `main`'s now-unconditional `min-height: 0`. The first
  defect generalises — see hub **ADR-0041 §4** and **T347**, which converts 47 more sites.
- **One check did not exercise its target.** The French footer looked correct only because a
  fully-loaded list sets `hasMore()` false, so the hint span renders empty and the row carries one
  string instead of two. The truncation defect is untouched and moves to **T348**.
- **Scope corrected 2026-09-03 (second time).** Two bullets left this task. The repo-wide sweep —
  the 47 `overflow: hidden` sites and the per-breakpoint classification of the 13 scroller-declaring
  files — is now **T347**: it touches ~13 screens, which contradicted this task's own guest-manager
  scope and made it impossible to prompt honestly. And phone verification is narrowed to
  `guest-manager`, because the other three screens named in that bullet are migrated by T343, not
  here. What remains is one coherent piece of work: the mechanism, the harness, and one screen.
- **Target release:** 1.2.0
- **Owner:** unassigned
- **Depends on:** T340
- **Sequenced with:** T345 (same mechanism — both put a screen's chrome on its route — and the two
  land as one PR series; numbered apart only because T342–T344 were filed first)
- **Why:** hub **ADR-0042**, which amends ADR-0041 §3. `private-layout`'s `main` is
  `overflow-y: auto` while 12 other files declare scrollers of their own. The guest manager had
  three nested scroll containers on one axis, and `overflow: hidden` on its shell let focus and
  `scrollIntoView()` slide the pinned header and footer out of place with no gesture able to restore
  them. The fix is **not** to give every screen a shell — that would take the app from one scroll
  container to 23. Pinning and scroll ownership are separable, and the layout owns the pinning.
- **Prototype gate — PASSED 2026-09-03.** The `TemplateRef`-across-injectors question is settled:
  the projected template is marked dirty through the signal graph with no `markForCheck()`, and the
  guarded clear is both necessary and sufficient. Evidence and the zoneless confirmation are
  recorded in hub ADR-0042 §Gate outcome. The mechanism files
  (`core/service/screen-chrome.service.ts`, `core/directive/`, `private-layout`) are de-scaffolded
  (`34c8a12`) and T340 landed (`81ea900`), so the rest of this task builds on both directly — see the
  acceptance list below.
- **Acceptance:**
  - **De-scaffold the spike before building on it.** It wraps a single `.stat-group` rather than the
    whole header, deliberately, to dodge the assertion below. Drop that wrap so `guest-manager` is
    untouched again, keep the three mechanism files, and re-point the proving tests at the throwaway
    stub screens the teardown case already uses — the mechanism ships without a half-migrated real
    screen hanging off it
  - **A shared test harness for projected chrome, decided once here.** A screen that projects its
    head does not render it when mounted standalone, so screen-level DOM assertions about it fail.
    All four screens in T343 will hit this; each inventing its own workaround is how four patterns
    get born. Provide one harness (a host that supplies `ScreenChromeService` and renders the slot),
    document it in the file header, and use it from the guest-manager spec
  - **Move `guest-manager.spec.ts:1137`, do not patch it.** `expect(…querySelector('.header'))
    .not.toBeNull()` — commented *"the header … stays on screen"* — is asserting the **pinning
    contract**, which under ADR-0042 §2 belongs to `private-layout`. It becomes a layout test. Any
    sibling assertion in the same shape moves with it
  - The **foot slot** (`*appScreenFoot`) is built here with tests. Same mechanism as the head, so no
    separate gate, but it is currently unproven rather than proven — it does not ship untested
  - `RouteChromeData` gains `headPinned?` and `footPinned?` beside the existing `tabBar` / `topNav` /
    `moto` (ADR-0042 §1)
  - `ScreenChromeService` — signals holding a head and a foot `TemplateRef`; **no NgRx slice**
    (ADR-0042 §3). Clears are guarded (`if (this._head() === t)`), because the incoming screen
    registers before the outgoing one is destroyed
  - `*appScreenHead` / `*appScreenFoot` structural directives register on construction and clear via
    `DestroyRef.onDestroy` — registration and teardown co-located, never split
  - `private-layout` renders the slots and yields: `main` keeps `overflow-y: auto`, and takes the
    paired `hidden` → `clip` only when the active route pins something, in which case
    `.screen-scroll` is the one scroller. `display: contents` on that wrapper keeps flow screens
    untouched
  - `data-shell` / `main:has()` from ADR-0041 §3 are **not** implemented — withdrawn by ADR-0042 §5
  - `guest-manager` sheds `:host { height: 100% }`, the `.guest-manager` shell block,
    `.table-container` entirely, and the `flex`/`min-height`/`overflow` triad on `.table-body`;
    its `<header class="header">` and `.list-footer` move into the two slots
  - `guest-manager` manually verified on a real phone in **French** (the longest locale) — the
    other three screens of T343 are verified there, not here, because this task does not migrate them
- **Non-goals:** no change to `main`'s 52px/58px header and tab-bar clearance — those are measured
  values, see `private-layout.scss`. The doubled header on `guest-manager` (its own `<header>` under
  the layout's `app-screen-header`) is *surfaced* by this task but removed in T343.
- **Refs:** hub ADR-0042 §1–§5; hub ADR-0041 §3 (as amended), §4;
  `src/app/core/guard/route-chrome-data.ts`, `src/app/layouts/private-layout/`

### T345 — The nav derives from the route tree, and stops failing open
- **Status:** done — `RouteChromeData` is now a discriminated union (`NonNavRouteChromeData` /
  `NavRouteChromeData`) so a `tabBar: true`/`topNav: true` route without `navLabel` fails to
  `satisfies RouteChromeData` (reproduced: `{ id: 'x', tabBar: true }` → `TS1360`, "Property
  'navLabel' is missing"). `nav-tabs.ts`'s `collect()` walks `routes` once, emitting a `NavTab`
  per route whose `data.tabBar`/`data.topNav` is set, with `link`/`roles`/`labelKey` all read off
  that same `RouteChromeData` object — `NAV_TABS` (hand-written array), `rolesForLink()` and
  `chromeDataByPath` are gone. `tab-bar.ts` and `screen-header.ts` (the latter out-of-scope but
  forced — it imported the same two deleted symbols in the same shape) filter on `tab.roles`
  directly. The fail-open regression (`rolesForLink()` returning `undefined` — "no restriction" —
  on a path miss) was reproduced against the pre-fix code before the fix landed: see the T345
  report for the exact repro and its output.
- **Target release:** 1.2.0
- **Owner:** unassigned
- **Sequenced with:** T341 (same mechanism, same PR series)
- **Why:** hub **ADR-0042 §6**. `shared/nav-tabs.ts` hand-writes `link` and `labelKey` for eleven
  entries whose routes already exist, and derives only `roles` back out of the route tree by path.
  That lookup **fails open**: `rolesForLink()` returns `undefined` on a miss and `tab-bar.ts:44`
  reads `undefined` as *no role restriction*. Rename a route path and the couple-only preparation
  timeline appears in every guest's nav — exactly what hub **ADR-0029 §4.7** forbids — with nothing
  failing loudly. This is the reason to do the task; the de-duplication is a bonus.
- **Acceptance:**
  - `RouteChromeData` gains `navLabel` (the i18n key for the nav entry — distinct from `title`,
    which names the page), and becomes a discriminated union so a `tabBar: true` or `topNav: true`
    route **cannot compile** without one (ADR-0042 §7). A missing label is invisible, not broken,
    so the compiler has to catch it
  - `nav-tabs.ts` keeps a `collect()` walk emitting one `NavTab` per route whose data sets `tabBar`
    or `topNav`, composing `link` from the route tree and carrying `roles` on the tab itself
  - `NAV_TABS` (the hand-written array), `rolesForLink()` and `chromeDataByPath` are **deleted**
  - `tab-bar.ts` filters on `tab.roles` directly; `overflows` / `primaryTabs` / `restTabs` and the
    More sheet are untouched, because `NavTab` keeps its shape
  - Order stays an explicit constant — a route cannot know it is third, and declaration order exists
    for matching, not navigation — but shrinks to a list of ids (ADR-0042 §6)
  - A test asserts the guest role sees no `milestones`, `guests`, `seating` or `config` entry. This
    is the regression the task exists to prevent; it must fail against the current code
  - Both `home` entries (`/me`, `/dashboard`) still resolve, and role filtering still renders exactly
    one
- **Non-goals:** no change to `RouteConfigService.isRouteEnabled()` — it shares the path-drift
  exposure but fails *closed* (tab hidden), so it is benign and out of scope
- **Watch:** `nav-tabs.ts` already imports `routes`, so this adds no new coupling and `loadComponent`
  keeps screens lazy — but nothing in `core/` may import `tab-bar`, or the cycle closes.
- **Refs:** hub ADR-0042 §6, §7; hub ADR-0029 §4.7; `src/app/shared/nav-tabs.ts`,
  `src/app/shared/tab-bar/tab-bar.ts`

### T349 — A layout-regression spec per migrated screen, so a device stops being the only check
- **Status:** todo
- **Target release:** 1.2.0
- **Owner:** unassigned
- **Depends on:** T263 (the Playwright harness and its layout tier)
- **Sequenced with:** T343 — each screen's spec lands in the **same PR** as that screen's migration,
  not in a batch afterwards. A spec written after the fact is written against what the code does;
  written alongside, it is written against what the screen is supposed to do.
- **Why:** this phase moves layout, and layout is the one thing JSDOM does not compute. Two
  production defects escaped T341 with 556 tests green — pinning that never worked in a browser
  (`9474809`) and a dead scroll handler (T348) — and both were found in minutes on a device. Three
  more screens migrate in T343. Without this, "a human checks" is the only gate, and it will be
  skipped exactly once.
- **Acceptance:**
  - One spec per screen T343 migrates — `config-manager`, `milestones`, `seating-plan` — plus
    `guest-manager`, plus `people` from **T350**, asserting the invariants that actually broke:
      - the pinned head and foot do not move while the scroll region scrolls
      - `main.scrollHeight <= main.clientHeight` on a pinned route (the `min-height: 0` trap)
      - the screen's *own* scroll affordance still works — for `guest-manager`, that reaching the
        bottom loads the next page, which is the T348 regression and must be covered here so it
        cannot silently return
  - **Each spec is proven by failing first.** Check it out against the commit before its fix and
    watch it fail; a layout spec that has never failed is asserting the DOM it was written from
  - At least one spec runs at a **narrow viewport in French** — the locale-plus-width combination no
    English-only check reaches. **Use 320px, not 360–375px**, and do not expect to write a
    fail-first spec for the footer: T348 established (deviations + `risks[0]` in its report) that the
    historical defect was *wrapping*, not horizontal overflow, and does not reproduce at 360–375px
    with settled fonts at any realistic guest count. Gate any font-sensitive measurement on
    `document.fonts.ready`; an unsettled measurement looked like it reproduced at 360px and did not
    hold up. The truncation fix is correct and shipped regardless — see hub ADR-0041 §5 as corrected
  - Specs live beside the harness from T263, not inside `src/`
  - **Fix the parallel-load flake first, and note it is worse than first recorded.** Re-measured
    twice on `main` with T347 landed (2026-09-04), after T348 grew the suite: it is **25 cases, not
    8**. It false-**passes** — one case passed against deliberately-broken CSS that it fails
    correctly alone — *and* it false-**fails**: `guest-list-scroll.spec.ts:55` failed in both
    full-suite runs with `no scrollable ancestor found above .table-row`, on **Pixel 7 (Chrome
    Android)** in one run and **Desktop Chrome** in the other, while passing deterministically when
    run alone under either project. **The moving project is the tell** — a real regression pins to
    one. A suite that is unreliable in both directions is worse than none: it will be believed when
    green and dismissed when red. Find the race (most likely measuring before the list has settled,
    or four projects sharing one `webServer`) before adding four more specs to the same runner
- **Non-goals:** no full user-journey coverage — this is a geometry tier, deliberately narrow.
  **And no CI:** `wedding-web` has no `.github/` workflow today, so this suite is local-only and
  the task must say so plainly rather than implying a gate that does not run. Wiring CI is a
  separate decision with its own cost
- **Refs:** T263; hub ADR-0041 §4 (the `clip` flex-item trap), hub ADR-0042 §Consequences;
  `tasks/reports/T341.json`

### T348 — Give a screen back scroll observation and scroll control
- **Status:** done — `IntersectionObserver` sentinel (`.scroll-sentinel`, guest-manager.ts
  constructor) restores auto-load; `ScreenChromeService.scrollResetRequest()` +
  `PrivateLayout`'s reset `effect()` restore scroll-to-top on filter/search/sort.
  `guest-manager.ts`'s `onListScroll`/`resetWindow` rewritten onto both, the T341 gap comments
  removed. `%truncating-flex-child` applied to `.list-footer-info`/`.list-footer-hint`. New
  `e2e/layout/guest-list-scroll.spec.ts` (observation + control, proven failing against the
  pre-fix code and passing after) and `e2e/layout/footer-truncation.spec.ts` (single-line
  invariant at 320×568 in French — could not reproduce a genuine fail-before/pass-after
  difference in this environment once `document.fonts.ready` settles; ships as a forward-looking
  regression guard, not a proof — see the T348 report). Real-device verification not attempted
  (no browser/device access in this environment); see the report's acceptance list.
- **Target release:** 1.2.0
- **Owner:** unassigned
- **Depends on:** T341, and **T263** (the Playwright harness) — see below: without it this task's
  central acceptance bullet cannot honestly be met.
- **Why:** hub **ADR-0042 §Consequences** ("a screen that gives up its scroller loses both scroll
  observation and scroll control"). `guest-manager` bound `(scroll)` to `.table-body` to auto-load
  the next page near the bottom, and wrote `.table-body.scrollTop = 0` to jump to the top on a
  filter/search/sort change. T341 correctly made `.table-body` stop scrolling, so the handler never
  fires and the write is a no-op. The visible "Load more" button still works, so it degrades rather
  than breaks — but on a 104-guest list the couple now scrolls to the bottom and nothing happens.
  **The test suite cannot see this**: `guest-manager.spec.ts` dispatches synthetic scroll events on
  `.table-body` with mocked geometry, which JSDOM never exercises through real layout.
- **Acceptance:**
  - **Observation, without a channel:** near-bottom auto-load works again via an
    `IntersectionObserver` on a sentinel element. Intersection resolves against the viewport whoever
    scrolls, so the screen never needs to know which ancestor is the scroller — this is what makes it
    the right shape for every screen T343 migrates
  - **Control, with one:** `ScreenChromeService` gains the ability for a screen to ask for its scroll
    region to be reset to the top, and `private-layout` implements it. The layout owns the scroller,
    so it owns scrolling it — a screen asking for this is the same shape as a screen handing over a
    head template (ADR-0042 §2)
  - `guest-manager`'s `onListScroll` and `resetWindow` are rewritten onto both, and the doc comments
    T341 left at each call site describing the gap are removed — not amended, removed, because the
    gap is gone
  - **The French footer truncation, still unfixed.** `.list-footer-info` / `.list-footer-hint` have
    no `min-width: 0` and no ellipsis: the fix was reverted in `e340cff`, and T341 moved the footer
    into the pinned slot without re-applying it. `_layout.scss` now carries
    `%truncating-flex-child`, built for exactly this case, and this screen does not use it
    (`grep -c truncating-flex-child guest-manager.scss` → 0). Apply it to both spans. **It cannot be
    device-verified until the footer holds two strings at once** — the hint renders only when
    `hasMore()` is true, so a fully-loaded list hides it and the row fits trivially. Verify with a
    guest list longer than one page, in French, at 360–375px
  - **A test that fails against current `main`, in Playwright — not in Vitest.** The existing scroll
    tests pass while the feature is broken, and that is the actual defect. Reproducing it under
    JSDOM is not possible honestly: JSDOM implements neither real layout nor `IntersectionObserver`,
    so a unit test here could only assert against a mocked observer — which is the same blind spot
    in a new costume. This bullet is why **T263 was pulled ahead of this task** (2026-09-04)
  - Verified in a real browser at `/guests` with more than one page of guests: scrolling to the
    bottom loads the next page, and changing a filter returns the view to the top
- **Non-goals:** no change to the pinning mechanism, the slots, or the `.screen-scroll` structure —
  this adds a channel and an observer, it does not revisit ADR-0042 §2
- **Refs:** hub ADR-0042 §Consequences; `tasks/reports/T341.json` `risks[0]`;
  `src/app/screens/guest-manager/guest-manager.ts` (`onListScroll`, `resetWindow`)

### T347 — The `overflow` audit and the per-breakpoint scroller classification
- **Status:** done — own recount: 51 `overflow: hidden` declarations/29 files (47 real,
  4 comment mentions), 14 auto/scroll files (not 13). 25 sites paired `hidden` → `clip`
  directly plus `%card-shell` (`_primitives.scss`, propagates to 4 consumers via
  `@extend`); every converted flex item got an explicit `min-height`/`min-width: 0`.
  3 sites kept plain `hidden` with a comment (`%sr-only` + its guest-manager duplicate,
  `notification-bell`'s `-webkit-line-clamp` snippet — a third category beyond the ADR's
  two amendments, flagged in the report). All 12 non-excluded auto/scroll files got a
  header comment classifying flow/shell per breakpoint. **Finding:** `seating-plan.scss`
  and `people.scss` are shell at every breakpoint in the current source, contradicting
  ADR-0042 §2's own worked example for seating-plan — flagged in `reports/T347.json`
  `risks[]`, not resolved here. See `reports/T347.json` for full acceptance evidence.
- **Target release:** 1.2.0
- **Owner:** unassigned
- **Depends on:** T341 (the mechanism must exist before a file can be classified against it)
- **Why:** hub **ADR-0041 §4** and **ADR-0042 §4**. Carved out of T341 on 2026-09-03: it is a
  repo-wide sweep across ~13 screens, which sat badly inside a task otherwise scoped to
  `private-layout` and one screen. Sequenced before **T343**, which migrates four screens and wants
  this classification already written down.
- **Acceptance:**
  - Every `overflow: hidden` intended as a clip becomes the paired `hidden` → `clip` declaration.
    The 47 current sites are **audited, not blanket-replaced** — a site that genuinely wants a
    scrollable-but-scrollbar-less box keeps `hidden` and gains a comment saying why
  - **Every converted site that is a flex item gains an explicit `min-height: 0`** (or
    `min-width: 0` on the inline axis). A flex item's automatic minimum size is zero only when it is
    a *scroll container*: `hidden` makes one, `clip` does not. Converting therefore revives
    `min-height: auto` and the item stops shrinking below its content. Not theoretical — it is
    precisely how `private-layout`'s `main` broke in T341, growing to the full height of a 104-row
    list so the pinned head and foot scrolled away with the rows, with every test passing because
    JSDOM computes no layout. **A `hidden` → `clip` conversion with no `min-*: 0` beside it is a
    defect this task must not ship 47 times.**
  - **ADR-0041 §4 was scoped on 2026-09-03 and the audit must honour it:** the rule governs *layout
    containers*, boxes establishing a scrolling context a focus event could shift. A single-line,
    `nowrap`, ellipsizing text child is not one and keeps plain `hidden` — see
    `%truncating-flex-child` in `_layout.scss` for the canonical case
  - Each of the 13 scroller-declaring files is classified flow or shell **per breakpoint** in its
    header comment — `seating-plan` is flow on mobile and shell at ≥900px, with both its scrollers
    already inside that media query
  - No visual change: this task writes comments and pairs declarations, it does not restructure
- **Non-goals:** no screen migrated onto the layout layer — that is T343
- **Refs:** hub ADR-0041 §4 (as scoped, hub `321a257`), hub ADR-0042 §4; `src/styles/_layout.scss`

### T342 — stylelint, because guidance alone already failed once
- **Status:** todo
- **Target release:** 1.2.0
- **Owner:** unassigned
- **Depends on:** T340 (rules must have something to point at)
- **Why:** hub **ADR-0041 §7**. `_primitives.scss` has existed since T247 and 54 of 71 files ignore
  it. There is no stylelint in this repo today; `pnpm lint` checks TS and templates only.
- **Acceptance:**
  - stylelint added and wired into `pnpm lint`. **There is no CI gate to wire it to** —
    `wedding-web` has no `.github/` workflow, so `pnpm lint` is run by hand before merge, on
    the same terms T349 already states for the e2e suite. Say so plainly rather than implying a
    gate that does not run. Note `pnpm lint` is `ng lint`, Angular's ESLint builder — stylelint
    is a **second binary in that script**, not a plugin to the existing one
  - Rules: no raw `px` for spacing/font-size (tokens only), no bare `@media (min-width:` (use
    `respond-to()`), no unpaired `overflow: hidden`
  - **The unpaired-`hidden` rule encodes hub ADR-0041 §4's *positive* definition, not an exemption
    list.** §4 was restated on 2026-09-04, after T347 found a second legitimate shape within two
    days of the first: the rule governs **boxes that establish a scrolling context a focus event
    could shift** — a container whose content can exceed it and whose descendants can take focus or
    be a `scrollIntoView()` target. Scope the rule to that, by the declarations that reveal it.
    The two known shapes outside it are worked examples, not the closed set the rule is built from:
    - `%truncating-flex-child` (`_layout.scss`) — recognisable by `text-overflow` and/or
      `white-space: nowrap` on the same box. Deliberately ships plain `overflow: hidden`
    - `%sr-only` (`_primitives.scss`) and its hand-duplicate `guest-manager.scss`'s
      `.partner-account-note` — recognisable by `clip-path` on a `1px` box. `overflow: hidden` is
      part of the visually-hidden technique itself, T347 left both as plain `hidden` with a comment,
      and pairing them to `clip` has no cross-browser record
    A rule that can only reach these through per-site ignore comments has not encoded §4 and should
    not ship. If a third shape appears that the positive definition cannot express, that is a hub
    question — escalate it rather than appending a third special case here
  - **`_layout.scss` and `_tokens.scss` are exempt from the raw-`px` rule.** They are where the
    literals are *defined* — `$bp-md: 640px`, the type scale, the spacing scale. A rule that flags
    its own token source is misconfigured
  - Existing violations are baselined, not auto-fixed — a blanket rewrite of 1,037 literals across a
    live app is exactly the kind of change ADR-0041 §8 says not to make in one cut
- **Refs:** hub ADR-0041 §7

### T343 — Migrate the four oversized screens onto the layer
- **Status:** todo
- **Target release:** 1.2.0
- **Owner:** unassigned
- **Depends on:** T340, T341
- **Why:** hub **ADR-0041 §Consequences**. config-manager (1,049 lines), guest-manager (777),
  milestones (753) and seating-plan (545) are 31% of all CSS in the repo and are exactly the four
  screens that breach the 8 KB `anyComponentStyle` budget.
- **Acceptance:**
  - Migrated in descending size order — config-manager, guest-manager, milestones, seating-plan —
    **one screen per PR**, each independently shippable and revertible (ADR-0041 §8: this is a live
    app, never one cut-over)
  - Each screen classified flow or shell **per breakpoint, measured against its own source** — not
    against an ADR sentence. Applied with the `screen-scroll()` mixin (`%app-screen` and
    `%screen-footer` were struck by hub ADR-0042 §2 and do not exist) rather than re-authored
  - **Corrected premise, 2026-09-04 (hub ADR-0042 §Context ¶2 / §Consequences).** The ADR named
    `seating-plan` as the per-breakpoint case and this task inherited that. It is false:
    `seating-plan` is `height: 100%; overflow: hidden` on `:host` and `.seating-plan`
    unconditionally, its only `@media` opens at line 490, and its 217/306 scrollers are panes
    (`.unassigned-body`, `.tables`) inside an already-shell screen. **Migrate it as an
    unconditional shell** — `headPinned: true` on its route, `screen-scroll()` outside any
    `respond-to()`. `config-manager` is the same shape (`:host` at 14–15, `@media` at 928).
    **`milestones` is the real per-breakpoint screen**: `:host` is `display: block` at base and
    takes `height: 100%` only at 663, with `.list` scrolling at 681 inside the `@media` at 659; its
    unconditional `overflow-y: auto` at 486 is `.detail-body`, a pane. Re-measure each screen before
    migrating it — this task's list was wrong once already
  - Each drops below the 8 KB budget
  - No visual change intended: each PR is checked against the previous build in all three themes and
    all three locales, at 360px and at ≥900px
  - **Each screen's T349 layout-regression spec lands in the same PR as that screen's migration**,
    not batched afterwards. Written alongside, a spec asserts what the screen is supposed to do;
    written after, it asserts whatever the code ended up doing
  - **Each screen is checked in a real browser before its PR is called done.** Two production
    defects escaped T341 with 556 unit tests green — pinning that never worked, and a dead scroll
    handler — because JSDOM computes no layout. This phase moves layout; that is exactly the blind
    spot. `npx playwright test e2e/layout` plus a look at the screen itself
  - **Watch for the scroll-ownership consequence on every screen, not just guest-manager**
    (hub ADR-0042 §Consequences): a screen giving up its scroller loses scroll *observation* and
    scroll *control*. `milestones` and `config-manager` each declare three scrollers and
    `seating-plan` two, so any of them binding a `(scroll)` handler or writing `scrollTop` will hit
    what T348 had to repair. Check before migrating, not after
  - **Two inherited `min-height: 0` gaps land with the screen that owns them** (T347 `risks[1]`,
    flagged inline at both sites, deliberately not fixed there — T347 was comments-and-pairs only).
    `config-manager.scss`'s `.modal-dialog .modal-body` and `milestones.scss`'s `.detail-body` are
    both `flex: 1; overflow-y: auto` in a flex column without `min-height: 0`. Same class as hub
    ADR-0041 §4's flex-item trap, on the `auto` side rather than the `hidden`→`clip` side
- **Non-goals:** the other 67 files are not in scope — they migrate opportunistically when next
  touched, and get no task of their own. `people` is the one exception and has its own task (T350),
  because it carries a live nested-scroller defect rather than a size problem
- **Refs:** hub ADR-0041 §2, §Consequences; hub ADR-0042 §Context ¶2, §Consequences

### T350 — `people` stops nesting a scroller inside `main`
- **Status:** todo
- **Target release:** 1.2.0
- **Owner:** unassigned
- **Depends on:** T341 (the route-data flags and `main`'s yielding must exist), T343 (migrate the
  four over-budget screens first, so the pattern is settled before it is applied to a fifth)
- **Why:** hub **ADR-0042 §Consequences** (added 2026-09-04), hub **ADR-0041 §Context/§3**. This is
  the defect ADR-0041 was written to eliminate, sitting on a screen no task in any phase owned.
  `.people` declares `height: 100%; overflow-y: auto` (`people.scss:19–20`) at **every** breakpoint —
  its only `@media` opens at 266 — while `/people`'s route data (`app.routes.ts:136–141`) sets
  `tabBar`, `topNav` and `navLabel` but neither `headPinned` nor `footPinned`. `main` therefore
  keeps `overflow-y: auto`, and the screen nests a second scroll container inside it: **two scroll
  containers competing for one axis**, in every locale and at every width.
- **How it was missed, which is the part worth keeping:** T343's screen list was drawn by size — the
  four screens over the 8 KB `anyComponentStyle` budget. `people` is ~300 lines and comfortably under
  it. **Nested scroll ownership does not correlate with stylesheet size**, so the heuristic that
  built T343's list could not have found this. Its own header comment names `seating-plan` as the
  precedent it follows, and it followed it faithfully — including the part that was wrong.
- **The screen is flow, not shell.** It pins nothing: its header scrolls away with the content
  today, and there is no toolbar or result count to keep in view. So the fix is to **delete the
  screen's scroll ownership**, not to declare it shell in route data. That is the single-scroller
  rule being applied, not a new behaviour being chosen — hub ADR-0042 §Consequences rules on this
  explicitly, and the task is not authorized to reach the opposite conclusion without escalating.
- **Acceptance:**
  - `.people` drops `height: 100%` and `overflow-y: auto`; `:host` drops `height: 100%`. `main`
    becomes the screen's only scroller. `/people`'s route data is **unchanged** — no `headPinned`,
    no `footPinned`
  - Verified that no code on the screen watches or drives its own scrolling before the change lands
    (`grep` for `(scroll)`, `scrollTop`, `scrollIntoView`, `scrollTo` in `people.ts`/`people.html`).
    This is the hub ADR-0042 §Consequences trap that cost T348 a repair on `guest-manager`; if
    anything is found, it uses the `IntersectionObserver` sentinel and `ScreenChromeService` that
    T348 already built, not a new mechanism
  - **A real browser, not just the suite.** Two production defects escaped T341 with 556 tests
    green because JSDOM computes no layout. Check at 360px and ≥900px, all three themes, all three
    locales — and specifically that `scrollPositionRestoration` on back-navigation and the fixed
    header's 52px clearance now behave as they do on other flow screens, since those are what the
    nested scroller was quietly breaking
  - Its T349 layout-regression spec lands in the **same PR**, on the same terms as every T343
    screen: proven by failing first against the commit before the fix
- **Non-goals:** no restyling, no token migration, no `respond-to()` conversion of the `@media` at
  266 — this task removes one nested scroller and nothing else. `people` is not over budget and is
  not a T343 screen; if it wants the rest of the layer it gets it opportunistically, like the other
  66 files
- **Refs:** hub ADR-0042 §Context ¶2, §Consequences, §Implications; hub ADR-0041 §3, §Implications;
  `tasks/28-phase-x-layout-layer/reports/T347.json` `risks[2]`

### T344 — `anyComponentStyle` becomes an error
- **Status:** todo
- **Target release:** 1.2.0
- **Owner:** unassigned
- **Depends on:** T343 (all four screens under budget first)
- **Why:** hub **ADR-0041 §7**. The budget has been a warning long enough that four screens grew
  through it unnoticed. A warning nobody fails on is documentation, not a budget.
- **Acceptance:**
  - `angular.json` production budgets: `anyComponentStyle` gains `maximumError: "8kB"`
  - A production build passes clean
  - Hub `ARCHITECTURE.md` § Performance budgets updated to drop the "currently a warning" caveat
- **Refs:** hub ADR-0041 §7; hub `ARCHITECTURE.md` § Performance budgets

---
