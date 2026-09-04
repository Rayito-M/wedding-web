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
  `.agents/skills/design-component-author.md`.
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
  `.agents/skills/design-component-author.md`; `src/styles/_tokens.scss`;
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
