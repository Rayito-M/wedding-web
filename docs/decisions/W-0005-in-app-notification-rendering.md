# ADR W-0005: In-app notification rendering — API shape, open `type`, and an interim client copy catalogue

- **Status:** accepted, interim (superseded in part if the hub answers T282)
- **Date:** 2026-08-28
- **Deciders:** wedding-web architect (this repo)
- **Scope:** wedding-web (in-repo). No contract change, no glossary change, no design-system
  change, no `pnpm gen:api`.

## Context

The design system (`../wedding-ui-design`, commit `7db5d1c`) ships four notification/toast
components — `NotificationBell.jsx`, `NotificationDialog.jsx`, `Toast.jsx`, `ToastStack.jsx` — plus
the `bell`/`check` glyphs they need. The API already exposes the matching surface —
`notificationsControllerListV1()`, `…MarkReadV1({ id })`, `…ReadAllV1()`,
`…UnreadCountV1()`, and `NotificationDto` / `NotificationListResponseDto` — but nothing in this
app has consumed any of it before Phase O (T282–T289). This ADR is the record for the four
foundational decisions Phase O's task list calls "decisions 4, 5, 6 and 7", written in this
repo's own words before any component lands, so T284–T289 build against a settled answer rather
than re-arguing it task by task.

## Decision

1. **Components consume `NotificationDto` directly. No parallel local type.** The DS's own
   `NotificationBell.d.ts` models a `Notification` shape with `read?: boolean` and a closed
   `type?: 'rsvp' | 'schedule' | 'album' | 'travel' | 'seating' | 'system'` union. Neither survives
   the port: the contract gives `status: NotificationDto.StatusEnum` (`'unread' | 'read'`), not a
   boolean, and a deliberately **open** `type: string`
   (`wedding-api/src/common/documents/notification.ts:47-51` — *"Deliberately a plain string, not
   an enum … types are enumerated as they are added"*). CLAUDE.md hard rule 15 forbids restating a
   generated model, so no task in this phase may declare `interface Notification`,
   `type NotificationType = '…' | '…'`, or a re-export wrapper. Every component reads
   `NotificationDto` (list rows, dialog) or `NotificationListResponseDtoItemsInner` (the list
   response's item shape) as generated, and treats "unread" as
   `n.status === NotificationDto.StatusEnum.UNREAD`.

2. **`type` is an open string, mapped to an icon through a lookup with an `info` fallback — never a
   hand-written union.** The DS's six type names (`rsvp`, `schedule`, `album`, `travel`, `seating`,
   `system`) do not exist in this system. The only producer today, the milestone announcement
   fan-out (`wedding-api/src/modules/milestones/announcement.service.ts:286-289`), sets
   `type = templateId = announcementType`, so the real values in circulation are
   `MilestoneDto.AnnouncementTypeEnum`'s four: `save-the-date`, `invitation`, `rsvp-reminder`,
   `menu-selection-reminder`. A later task builds
   `const TYPE_ICON: Record<string, IconName> = { 'save-the-date': 'calendar', invitation: 'mail',
   'rsvp-reminder': 'mail', 'menu-selection-reminder': 'edit' }` with `TYPE_ICON[n.type] ?? 'info'`
   as the fallback, exactly as `NotificationBell.jsx:91` does it (`TYPE_ICON[n.type] || 'info'`). A
   record carrying an unrecognised `type` — including any value the four-member set above does not
   cover — must still render, with the fallback icon, never blank and never throwing. This lookup is
   a presentation table, not a type declaration, so hard rule 15 does not apply to it; the four
   string literals it is keyed on are read from `MilestoneDto.AnnouncementTypeEnum` if a
   compile-time reference is wanted at all, never hand-copied into a new union.

3. **The record's own `title`/`body` win when present. A `templateId`-keyed client catalogue fills
   in when they are absent.** `NotificationDto.title` and `.body` are optional on the contract, and
   the API's own DTO doc explains why and hands the problem to the client:

   > ADR-0028 §2's template catalogue is addressed by `(templateId, channel, locale)` where the
   > live channels are email and SMS only — there is no in-app slice. … most records carry only
   > `templateId` + `data` and the client renders from those … the web design that consumes this
   > has not been done yet, so v1 hands over both and lets it choose.
   > (`wedding-api/src/modules/notifications/dto/notification.dto.ts:25-29`)

   The one producer in this system today, the milestone announcement fan-out, passes **neither**
   `title` nor `body` — so a naive port of the DS renders a blank row for every notification that
   exists. This ADR's rule: render `n.title`/`n.body` if either is a non-empty string (the record is
   a frozen snapshot and always wins); otherwise look up `notifications.template.<templateId>.title`
   / `.body` in `public/i18n/{en,es,fr}.json`, keyed on the same four `templateId` values as
   decision 2 (`save-the-date`, `invitation`, `rsvp-reminder`, `menu-selection-reminder`); if
   `templateId` matches none of those, fall back to `notifications.template.fallback.title` /
   `.body`. The dialog's kicker label follows the same shape one level up —
   `notifications.typeLabel.<type>` with a `.fallback` of `"Wedding"`/`"Boda"`/`"Mariage"`, mirroring
   `NotificationDialog.jsx:7`'s `TYPE_LABEL` retargeted onto this system's real types. **This
   catalogue is interim** — see "Open escalation" below.

4. **No full "All notifications" screen, and no footer link, in this phase.** The DS prompt gates
   the dropdown's footer row on a destination existing (*"pass `onViewAll` when a full list screen
   exists"*), and none does, for a structural reason rather than a scope choice: the generated
   `notificationsControllerListV1()` takes **no** parameters — no cursor, no limit — even though
   `NotificationListResponseDto` carries `nextCursor`. The client can therefore read exactly one
   page. The bell stays a peek at the most recent handful; a full list is a contract change
   (missing query parameters), not something to route around client-side. Recorded here as Phase O
   decision 7 in the task list's numbering.

## Open escalation

**T282**, filed alongside this ADR, asks the hub whether an in-app slice should join the
`(templateId, channel, locale)` template catalogue (hub ADR-0028 §2) so the API returns rendered
`title`/`body` per the recipient's `preferredLang`, or whether in-app rendering stays permanently
the client's job with `templateId` + `data` as the intended interface. This ADR assumes the second
answer only because it is what the DTO doc's own wording implies and because it is the answer this
phase can ship against today; it is **not** a claim that the second answer is architecturally
correct, and it is not this repo's call to make unilaterally in the first place.

**If the hub adds an in-app catalogue slice**, the change on this side is small by design:

- Delete the fallback branch in decision 3 — the client stops reading
  `notifications.template.<templateId>.*` and always renders `n.title`/`n.body`, which the API
  would now guarantee are populated (still applying the "record wins when present" half of the
  rule, since a frozen snapshot is still meaningful).
- The `notifications.template.*` i18n block becomes dead copy. It can be deleted in the same
  commit as the fallback branch, or left in place as inert keys — either is a one-file change, not
  a redesign. Nothing else in this ADR (decisions 1, 2, 4) is affected: the API shape consumption
  rule, the open `type` → icon lookup, and the no-full-list-screen rule all stand regardless of how
  T282 resolves.

## Consequences

- `notifications.template.<templateId>.{title,body}` copy must be written honestly, not as
  placeholder text — it is what every guest actually sees today, since the only producer sends no
  `title`/`body` at all. It is also short-lived by design (see "Open escalation"), so it is treated
  as disposable interim copy, not a permanent voice-and-tone commitment.
- Every consumer of `NotificationDto`/`NotificationListResponseDtoItemsInner` in this phase
  (T286's service, T287's dialog, T288's bell) reads the same two lookups — icon-by-type and
  copy-by-templateId — rather than each re-deriving its own fallback logic. A future task adding a
  fifth announcement type needs one new i18n block and one new lookup entry, not a new branch per
  consumer.
- No component, service or lookup table in this phase may assume `n.title`/`n.body` are always
  populated, or that `n.type`/`n.templateId` is one of the four known values — both assumptions
  are false today and this ADR's whole point is not encoding them into the types.

## References

- Hub: ADR-0019 (notification records), ADR-0028 §2 (template catalogue, no in-app slice),
  ADR-0030 §9 (the four announcement types)
- API: `wedding-api/src/modules/notifications/dto/notification.dto.ts:25-29`;
  `wedding-api/src/common/documents/notification.ts:47-51`;
  `wedding-api/src/common/services/notifications/notifier.service.ts:68-84`;
  `wedding-api/src/modules/milestones/announcement.service.ts:278-293`
- DS: `../wedding-ui-design/components/core/Icon.jsx:23-24` (glyphs);
  `components/navigation/NotificationBell.jsx` (list + `TYPE_ICON`);
  `components/overlays/NotificationDialog.jsx` (`TYPE_LABEL`); `components/overlays/Toast.jsx`
- In-repo: CLAUDE.md hard rule 15; `src/app/core/api/model/notification-dto.ts`,
  `notification-list-response-dto{,-items-inner}.ts`,
  `milestone-list-response-dto-items-inner.ts` (`AnnouncementTypeEnum`);
  `src/app/shared/icons/icon.ts`; `public/i18n/{en,es,fr}.json`
- Tasks: `TASKS.md` T282 (open escalation this ADR records), T283 (lands this ADR + the glyphs +
  the i18n block), T284–T289 (consume it)
