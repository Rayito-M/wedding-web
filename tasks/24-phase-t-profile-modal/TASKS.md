## Phase T — "My profile" becomes an account-dropdown modal (`wedding-ui-design` `76aa9fa`)

> **Why this phase exists.** The second half of DS commit `76aa9fa`: `ScreenProfile.jsx` is deleted
> and replaced by `ProfileModal.jsx`, opened from the avatar/account dropdown and mounted at the
> shell level as an overlay — centered dialog on desktop, bottom sheet on mobile, closes on Escape
> or backdrop click. There is no `/profile` route any more. This repo's one shell-level mount point
> is `private-layout` (there is no separate `AppShell` component); it already mounts one shell-level
> overlay this same way — the toast stacks, via `ToastCenterService` (Phase O, T285) — which is this
> phase's structural precedent for a `ProfileModalService`.
>
> **A pre-existing DS/API contradiction, not a new one this phase introduces:** `ProfileModal.jsx`
> renders email/phone as editable-looking `Input`s, but `UpdateUserProfileDto` has no fields for
> them — `UserProfileDataService.update()`'s own doc comment already says they're read-only
> server-side. The current `profile.ts`/`.html` scaffold already resolved this (editable-looking,
> never sent). T303 carries that resolution over verbatim; it does not re-litigate it.

### T303 — Build `app-profile-modal` (no call sites yet)
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T298 (nickname field + copy)
- **Why:** mirrors T284's "build the component standalone first" precedent — get the chrome and
  fields right in isolation before wiring it into the shell.
- **Acceptance:**
  - New `src/app/shared/profile-modal/{profile-modal.ts,.html,.scss}`, composing `app-modal` the
    same way `NotificationDialog`/`ConfirmDialog` do — never re-authoring backdrop/panel/Escape from
    scratch — with `size="lg"` (`Modal`'s existing 520px dialog is the closest built-in size to the
    DS's 540px; **do not add a new `Modal` size variant** for a 20px difference without asking
    first), plus its own `(keydown.escape)` host binding scoped to itself, exactly like
    `ConfirmDialog`/`NotificationDialog` already do (Phase M decision 5).
  - Fields, per DS `ProfileModal.jsx`: first name, last name, nickname (max 8 chars, same clamp
    pattern as T299/T300), email, phone, preferred language — plus a link out to People for
    role/relation (`routerLink="/people"`, read-only here). View/edit toggle mirrors the current
    `profile.ts`'s `editing()` signal; `Btn` actions "Edit profile" / "Save changes" + "Cancel".
  - Inputs/outputs: `open = input(false)`, `profile = input<UserProfileDto | null>(null)`,
    `save = output<{ firstName: string; lastName: string; nickname?: string; preferredLang:
    UserProfileDto.PreferredLangEnum }>()` (only the fields this form can actually change — email/
    phone excluded, see below), `close = output<void>()`. No `HttpClient`, no
    `EntityCollectionService` — this task wires no call site (T304/T305's job), same as T284/T287.
  - **Email/phone (flag, don't silently resolve):** preserve **exactly** what `profile.ts`/`.html`
    already do today — visually editable-looking fields per the DS, but their values are never part
    of what `save` emits. Do not silently make them newly submittable against a field the API
    ignores on write, and do not silently drop them from the view either.
  - ES/EN/FR for every label, placeholder, hint, and the close button's `aria-label` (hard rule 8).
  - Unit tests: Escape and backdrop click both emit `close`; `save` emits only the writable fields,
    never email/phone; the People link is a real `routerLink`, not a `(click)` handler.
  - Full pre-merge gate green.
- **Refs:** DS `76aa9fa` → `ProfileModal.jsx`, `ProfileModal.d.ts`;
  `src/app/shared/modal/{modal.ts,modal.scss}` (`size="lg"`, 520px);
  `src/app/shared/notification-dialog/notification-dialog.ts` (composition + Escape precedent);
  `src/app/screens/profile/{profile.ts,profile.html}` (email/phone behaviour to carry over
  verbatim); T284 (standalone-component precedent)

### T304 — `ProfileModalService`, wire the account dropdown, mount in the shell, retire `/profile`
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T303
- **Acceptance:**
  - New `ProfileModalService` (`src/app/core/service/profile-modal.service.ts`) — an injectable,
    signals-based open/close state shared between `ScreenHeader` and `PrivateLayout`, the same DI +
    signals pattern `ToastCenterService` (T285) already establishes for a shell-level overlay with no
    shared ancestor component to wire through `@Output`/`@ViewChild`.
  - `screen-header.html`'s "My profile" row (~line 44-52) changes from `<a routerLink="/profile"
    (click)="goToProfile($event)">` to a click handler that calls `ProfileModalService.open()`
    instead of navigating, while still closing the dropdown menu — replace `goToProfile()`'s body
    accordingly (drop `RouterLink` from that row if nothing else on it needs it).
  - `private-layout.html` mounts `app-profile-modal` at the shell level, conditionally on
    `ProfileModalService`'s open signal — the same pattern already used for the toast stacks.
    `private-layout.ts`'s class doc ("Also mounts the app's toast stacks (T285)…") is extended to
    mention this too.
  - `app.routes.ts`'s `path: 'profile'` entry (~line 200-214) is removed. `src/app/screens/profile/`
    is deleted outright — before deleting, confirm (and say so in the PR) that nothing else still
    references it, including the item below.
  - **`people.ts`/`people.html`'s "isMine" card** (`[routerLink]="isMine(person) ? '/profile' :
    null"`, `goToProfile()`) currently routes to `/profile` too, which breaks once the route is
    gone. Change it to call `ProfileModalService.open()` instead of navigating. Keep the existing
    (hardcoded, `person.id === 'u3'`) `isMine` gating unchanged — fixing that placeholder to use the
    real signed-in user's id is a separate, pre-existing gap, out of scope here.
  - Verify the `**` wildcard route (`app.routes.ts`, already `redirectTo: ''`) catches a stale
    bookmark/link to `/profile` with no further change needed, and say so in the PR.
  - Unit tests: clicking "My profile" opens the modal without a `Router.navigate` call; the modal is
    absent from the DOM until opened; `/profile` no longer resolves to a profile screen.
  - Full pre-merge gate green.
- **Refs:** DS `76aa9fa` → the DS's shell mount point, `ProfileModal.jsx`;
  `src/app/core/service/toast-center.service.ts` (service-pattern precedent, T285);
  `src/app/shared/screen-header/{screen-header.ts,screen-header.html}`;
  `src/app/layouts/private-layout/{private-layout.ts,private-layout.html}`; `src/app/app.routes.ts`;
  `src/app/screens/people/{people.ts,people.html}`

### T305 — Wire "Save changes" to the real profile-update endpoint
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T304
- **Acceptance:**
  - Wherever `ProfileModalService`'s consumer ends up owning the write (`private-layout.ts`, or a
    thin host the service itself exposes — implementer's call, document it in the PR) resolves the
    signed-in user's `UserProfileDto` the same way `screen-header.ts` already does
    (`LoginService.currentUserClaims()?.sub` against the `EntityNamesEnum.USER_PROFILE` collection)
    and passes it into the modal's `profile` input.
  - The modal's `save` output calls `UserProfileDataService.update()` (via
    `EntityCollectionService.update()`, matching `guest-profile-modal.ts:273-278`'s call shape) with
    `id`, `role` (required by the DTO, carried forward unchanged), `firstName`, `lastName`,
    `nickname` — email/phone are never included, per T303's preserved behaviour.
  - A failed save surfaces without crashing the modal — reuse whichever of this app's existing
    failed-write patterns is the closer fit (`guest-profile-modal.ts`'s `console.error` + stay-in-
    edit-mode, or `rsvp-edit.ts`'s `saveFailed` signal + inline message) and say which was picked
    and why.
  - A successful save exits edit mode (not the whole modal) and shows the same translated "Saved."
    confirmation the current `profile.ts` scaffold has.
  - Unit tests: `save` triggers `UserProfileDataService.update()` with exactly the writable fields;
    a failed update leaves the modal in edit mode with an error shown; a successful one exits edit
    mode.
  - Full pre-merge gate green.
- **Refs:** DS `76aa9fa` → `ProfileModal.jsx`; `src/app/core/data/user-profile-data.service.ts`;
  `src/app/screens/guest-manager/modal/guest-profile-modal.ts` (`saveProfile()` call-shape
  precedent)

### Deliberately out of scope for Phase T
- **Editable email/phone.** `UpdateUserProfileDto` has no fields for them — the same contract limit
  the old `profile.ts` scaffold already respected. Making them writable is a hub/API contract
  change, not a `wedding-web` task.
- **A new `Modal` size variant for the DS's exact 540px.** `size="lg"` (520px) is the closest
  existing size; do not add a fourth size for a 20px difference without asking first (T303).
- **Fixing `people.ts`'s hardcoded `person.id === 'u3'` "isMine" placeholder** to use the real
  signed-in user's id. T304 only redirects where that placeholder already pointed; making the
  placeholder itself correct is a separate, pre-existing gap that predates this phase.
