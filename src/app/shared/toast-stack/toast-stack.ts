import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The nine Bootstrap-style positions `app-toast-stack` may sit at inside the
 * app frame (`ToastStack.d.ts`). UI-only — there is no API concept of a
 * screen position, so hard rule 15 (no local type restating a generated
 * model) does not apply; this is a genuinely local presentation type.
 */
export type ToastPlacement =
  | 'top-start'
  | 'top-center'
  | 'top-end'
  | 'middle-start'
  | 'middle-center'
  | 'middle-end'
  | 'bottom-start'
  | 'bottom-center'
  | 'bottom-end';

/**
 * Positioned container for `app-toast` — the only legal parent for one
 * (DS `overlays/ToastStack`, commit `7db5d1c`). Covers the app frame, lets
 * clicks through everywhere except on a toast, and keeps the column from
 * overlapping. One stack per screen, mounted in the app shell (T285), not
 * per route, so a toast survives navigation.
 *
 * `position: fixed`, not the DS reference's `position: absolute` (Phase O
 * decision 2 — the DS's `absolute inset:0` needs a `data-overlay-host`
 * ancestor that is a constraint of the prototype's device frame, not of this
 * production app; `app-modal`'s backdrop made the identical call, Phase M
 * decision 2).
 *
 * **Departure from `ToastStack.d.ts`'s free-form `gutter?: number | string`:**
 * this component has no `gutter` input. A caller-supplied length like
 * `"16px 16px 80px"` would have to land on the host as a raw style binding
 * (`[style.padding]`), which is exactly the "no inline styles" hard rule 2
 * forbids for arbitrary caller-supplied CSS text (unlike the narrow numeric
 * `[style.gap.px]` binding below, which has a real repo precedent —
 * `avatar.ts`, `progress-bar.ts` — for a single scalar dimension). The only
 * clearance this app actually has to give a toast is the mobile `TabBar`'s
 * own fixed height (`private-layout.scss:7`'s `padding-bottom: 70px`), so
 * `clearsTabBar` replaces `gutter` with the one boolean this app needs — the
 * base gutter itself (`var(--space-4)`) is not caller-configurable and lives
 * in `toast-stack.scss`. Do not "restore" a free-form `gutter` input.
 */
@Component({
  selector: 'app-toast-stack',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast-stack.html',
  styleUrl: './toast-stack.scss',
  host: {
    '[attr.data-placement]': 'placement()',
    '[class.clears-tab-bar]': 'clearsTabBar()',
    '[style.gap.px]': 'gap()',
  },
})
export class ToastStack {
  /** Where the column sits inside the app frame. Mobile: 'top-center' for
   *  news that arrives on its own, 'bottom-center' for confirmation of the
   *  guest's own action. Desktop: 'bottom-end'. 'middle-center' is for a
   *  single blocking-feeling failure only. */
  readonly placement = input<ToastPlacement>('top-center');
  /** Space between stacked toasts, px. Default 10 (`ToastStack.d.ts`). */
  readonly gap = input(10);
  /** Adds the mobile `TabBar`'s clearance to a bottom-placed stack so a
   *  toast never sits under it. No-op above the 900px breakpoint where the
   *  `TabBar` itself is hidden (`private-layout.scss`'s own breakpoint,
   *  reused here rather than a newly-invented one). See the class doc
   *  comment for why this replaces the DS's free-form `gutter`. */
  readonly clearsTabBar = input(false);
}
