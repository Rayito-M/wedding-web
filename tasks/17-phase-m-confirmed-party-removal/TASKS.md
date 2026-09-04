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
  **nothing**: T278 is the first call site. Follow `.agents/skills/design-component-author.md`.
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
  `.agents/skills/design-component-author.md`; `src/styles/_tokens.scss`;
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
