import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { map } from 'rxjs';
import { DataServiceError, EntityCollectionService, EntityServices } from '@ngrx/data';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  AudienceListResponseDtoItemsInner,
  AudiencesService,
  EntityNamesEnum,
  HeaderService,
  MilestoneDataService,
  MilestoneDto,
  PluralTranslatePipe,
  TranslateLanguageService,
  WeddingConfigResponseDto,
  todayInMadrid,
} from '@app/core';
import { LangCode } from '@app/model';
import { Btn } from '@app/shared/button/button';
import { ConfirmDialog } from '@app/shared/confirm-dialog/confirm-dialog';
import { AppErrorComponent } from '@app/shared/error/error';
import { TextInput } from '@app/shared/input/input';
import { AppLoadingComponent } from '@app/shared/loading/loading';
import { Pill } from '@app/shared/pill/pill';
import { StatusPill } from '@app/shared/status-pill/status-pill';

/** The app's fixed language set (hub ADR-0009) — same order used for the
 *  disclosure fields regardless of which one is "primary" for a given admin. */
const LANGS: readonly LangCode[] = ['es', 'en', 'fr'];

type MilestoneStatus = 'reached' | 'at-risk' | 'not-reached';

/** i18n keys for the status pill, by derived {@link MilestoneStatus}. */
const STATUS_LABEL_KEYS: Record<MilestoneStatus, string> = {
  reached: 'milestones.status.reached',
  'at-risk': 'milestones.status.atRisk',
  'not-reached': 'milestones.status.notReached',
};

/** What the detail pane / mobile sheet is currently showing. */
type PanelState = { kind: 'closed' } | { kind: 'create' } | { kind: 'view'; id: string };

/** How a milestone's row/detail "second line" reads relative to today
 *  (hub ADR-0029 §4.2's `atRisk` stays the API's own derived value — this is
 *  purely a display concern layered on top of `plannedDate`/`reached`). */
type RelativeKind = 'reached' | 'today' | 'upcoming' | 'overdue';

/** Parses a plain `YYYY-MM-DD` (no time component) into its numeric parts. */
function parseIsoDate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

/** Whole calendar days from `fromIso` to `toIso` (positive when `toIso` is
 *  later) — both are plain `YYYY-MM-DD` business dates, so this anchors both
 *  to UTC midnight rather than constructing a local-timezone `Date`, keeping
 *  the count immune to the browser's own timezone/DST. */
function daysBetween(fromIso: string, toIso: string): number {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  const fromUtc = Date.UTC(from.y, from.m - 1, from.d);
  const toUtc = Date.UTC(to.y, to.m - 1, to.d);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

/**
 * Couple-only preparation timeline (hub ADR-0029, T279): every milestone,
 * date-ascending, with a "Today" marker, tick-off, and full CRUD — all
 * persisted server-side.
 *
 * T280 (hub ADR-0030) adds the guest-facing half on top: a create-time
 * `kind` choice, a PATCH-only announcement type/audience configuration for a
 * guest-facing milestone, and the send button — a create-once sub-resource
 * behind a blast-radius confirmation, idempotent per milestone, with an
 * explicit (never automatic) "mark as not sent" as the only way back to
 * sendable. Message body, channel picker, auto-send toggle, a schedule/send-
 * date picker and any delivered-of-total figure are decided **out**
 * (ADR-0030 §3/§6/§7/§11f) — never built here, even though the design kit
 * renders them.
 *
 * Layout follows `ScreenMilestones.jsx` / `ScreenMilestonesMobile.jsx` for
 * **chrome only** (date-ascending rows, the dot-rail timeline, the "Today"
 * marker, the desktop detail pane / mobile bottom sheet, the audience-chip
 * and send-button visual treatment) — one template, switched purely by CSS
 * (`@media (min-width: 900px)`), same approach as `people` / `seating-plan` /
 * `config-manager`.
 */
@Component({
  selector: 'app-milestones',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppErrorComponent,
    AppLoadingComponent,
    Btn,
    ConfirmDialog,
    DatePipe,
    Pill,
    PluralTranslatePipe,
    StatusPill,
    TextInput,
    TranslatePipe,
  ],
  templateUrl: './milestones.html',
  styleUrl: './milestones.scss',
})
export class Milestones {
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);
  private readonly translate = inject(TranslateLanguageService);
  private readonly milestoneDataService = inject(MilestoneDataService);
  private readonly audiencesApi = inject(AudiencesService);

  private readonly milestoneCollection: EntityCollectionService<MilestoneDto> = inject(
    EntityServices,
  ).getEntityCollectionService<MilestoneDto>(EntityNamesEnum.MILESTONE);

  private readonly weddingConfigCollection: EntityCollectionService<WeddingConfigResponseDto> =
    inject(EntityServices).getEntityCollectionService<WeddingConfigResponseDto>(
      EntityNamesEnum.WEDDING_CONFIG,
    );

  /** `MilestoneDto.KindEnum` re-exposed for the template (create-time kind
   *  choice and the read-only kind display — hub ADR-0030 §11a: `kind` is
   *  not patchable, so it is a form field only in `panel().kind === 'create'`). */
  protected readonly KindEnum = MilestoneDto.KindEnum;
  /** The fixed announcement-type catalogue, read off the generated enum —
   *  never hand-listed, so a widened contract (`pnpm gen:api`) is the only
   *  way this list grows (hub ADR-0030 §9). */
  protected readonly announcementTypes: MilestoneDto.AnnouncementTypeEnum[] = Object.values(
    MilestoneDto.AnnouncementTypeEnum,
  );

  protected readonly milestones: Signal<MilestoneDto[]> = toSignal(
    this.milestoneCollection.entities$,
    { initialValue: [] },
  );
  protected readonly milestonesLoaded: Signal<boolean> = toSignal(this.milestoneCollection.loaded$, {
    initialValue: false,
  });

  /** Singleton resource: the collection holds at most one document. */
  protected readonly weddingConfig: Signal<WeddingConfigResponseDto | undefined> = toSignal(
    this.weddingConfigCollection.entities$.pipe(map((configs) => configs[0])),
    { initialValue: undefined },
  );
  protected readonly weddingConfigLoaded: Signal<boolean> = toSignal(
    this.weddingConfigCollection.loaded$,
    { initialValue: false },
  );

  protected readonly ready = computed(() => this.milestonesLoaded() && this.weddingConfigLoaded());

  /** `GET /v1/audiences` (hub ADR-0030 §11e) — the four live-counted
   *  audiences, fetched once on load. Deliberately **not** folded into
   *  `ready()`: audiences are only needed for the guest-facing announcement
   *  section, and a failure here must not block the (much more common)
   *  internal-only timeline. Not an @ngrx/data entity — read-only, no
   *  CRUD — matching `entity-metadata.ts`'s own rule for what gets one. */
  protected readonly audiences = signal<AudienceListResponseDtoItemsInner[]>([]);
  protected readonly audiencesLoaded = signal(false);

  /** Set only when the initial list fetch itself failed — gates the
   *  full-screen `app-error` state (with retry), distinct from a mutation
   *  failure (`actionError`), which never blocks the screen. */
  protected readonly loadError = signal<string | null>(null);

  /** Surfaced for any failed mutation (tick, create, rename, re-date,
   *  delete) — hub ADR-0029 §5: "a failed write must be surfaced", never
   *  swallowed and never shown as saved. Dismissible; does not block the list. */
  protected readonly actionError = signal<string | null>(null);

  /** Whether the seed *could* have run — the seed requires a wedding date on
   *  the CONFIG row (hub ADR-0029 §4.1). Distinct from "the couple deleted
   *  everything": both render an empty list, but only this one explains
   *  itself via the config manager rather than offering to create one. */
  protected readonly hasWeddingDate = computed(() => !!this.weddingConfig()?.date);

  protected readonly sortedMilestones = computed(() =>
    [...this.milestones()].sort((a, b) => (a.plannedDate < b.plannedDate ? -1 : 1)),
  );

  // ── Header counters (DS `ScreenMilestones.jsx:103` chrome) — reached /
  //    at-risk / not-reached across *every* milestone regardless of kind
  //    (hub ADR-0030 §4: `reached` keeps one meaning for both kinds; a
  //    successful send sets it, same as a manual tick) — derived from the
  //    same in-memory list the row/rail already renders, no extra fetch.
  //    Mutually exclusive and mirror `milestoneStatus()`'s own precedence
  //    (reached first, then at-risk, then not-reached). ────────────────────
  protected readonly reachedCount = computed(
    () => this.milestones().filter((m) => m.reached).length,
  );
  protected readonly atRiskCount = computed(
    () => this.milestones().filter((m) => !m.reached && m.atRisk).length,
  );
  protected readonly notReachedCount = computed(
    () => this.milestones().filter((m) => !m.reached && !m.atRisk).length,
  );

  /** Today's calendar date in Europe/Madrid (hub ADR-0029 §4.2) — never the
   *  browser's own timezone. */
  protected readonly todayIso = computed(() => todayInMadrid());

  /** Index of the first milestone dated *later* than today — the "Today"
   *  marker renders immediately before it, or at the end when every
   *  milestone is in the past (`findIndex` returns `-1`, which the template
   *  reads as "insert after the last row"). */
  protected readonly todayIndex = computed(() =>
    this.sortedMilestones().findIndex((m) => m.plannedDate > this.todayIso()),
  );

  // ── Detail pane / mobile sheet ──────────────────────────────────────────

  protected readonly panel = signal<PanelState>({ kind: 'closed' });

  protected readonly selectedMilestone = computed<MilestoneDto | null>(() => {
    const state = this.panel();
    if (state.kind !== 'view') return null;
    return this.sortedMilestones().find((m) => m.id === state.id) ?? null;
  });

  protected readonly primaryLang = this.translate.currentLang;
  protected readonly otherLangs = computed(() => LANGS.filter((l) => l !== this.primaryLang()));

  protected readonly formTitle = signal<Record<LangCode, string>>({ es: '', en: '', fr: '' });
  /** Locales the admin has typed into directly — once a locale is
   *  customized, further edits to the primary field stop mirroring into it
   *  (hub ADR-0031: one typed title pre-fills all three; the couple edits
   *  the other two "only if they care", and doing so must stick). */
  protected readonly customizedLocales = signal<ReadonlySet<LangCode>>(new Set());
  protected readonly showOtherLocales = signal(false);
  protected readonly formDate = signal('');

  /** Create-only (hub ADR-0030 §11a: `kind` is not patchable) — defaults to
   *  `internal` so an admin has to make a deliberate switch, never an
   *  accidental one. */
  protected readonly formKind = signal<MilestoneDto.KindEnum>(MilestoneDto.KindEnum.INTERNAL);
  /** Announcement configuration (guest-facing only, PATCH-only — hub
   *  ADR-0030 §11c). `null` means "not chosen yet"; bundled into the same
   *  Save as title/date rather than persisted per-click, matching how a
   *  rename/re-date already works here (hard rule 9: no autosave noise). */
  protected readonly formAnnouncementType = signal<MilestoneDto.AnnouncementTypeEnum | null>(null);
  protected readonly formAudience = signal<MilestoneDto.AudienceEnum | null>(null);

  protected readonly titleTouched = signal(false);
  protected readonly dateTouched = signal(false);
  protected readonly submitAttempted = signal(false);

  protected readonly titleInvalid = computed(() => !this.formTitle()[this.primaryLang()].trim());
  protected readonly dateInvalid = computed(() => !this.formDate());
  protected readonly showTitleError = computed(
    () => this.titleInvalid() && (this.titleTouched() || this.submitAttempted()),
  );
  protected readonly showDateError = computed(
    () => this.dateInvalid() && (this.dateTouched() || this.submitAttempted()),
  );

  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  // ── Delete confirmation (T277's `app-confirm-dialog`, tone="danger") ────

  protected readonly pendingDeleteId = signal<string | null>(null);
  protected readonly pendingDelete = computed<MilestoneDto | null>(() => {
    const id = this.pendingDeleteId();
    if (!id) return null;
    return this.sortedMilestones().find((m) => m.id === id) ?? null;
  });
  protected readonly deleting = signal(false);

  // ── Send confirmation (hub ADR-0030 §6, T277's `app-confirm-dialog`) ────

  protected readonly sendConfirmOpen = signal(false);
  protected readonly sending = signal(false);

  // ── "Mark as not sent" confirmation (hub ADR-0030 §7, tone="danger") ────

  protected readonly pendingClearId = signal<string | null>(null);
  protected readonly clearingAnnouncement = signal(false);

  constructor() {
    inject(HeaderService).set(this.translateService.instant('milestones.headerMeta'));

    this.milestoneCollection.loaded$.subscribe((loaded) => {
      if (!loaded) this.fetchMilestones();
    });
    // `.load()`, not `.getByKey()`: only `QUERY_LOAD`/`QUERY_ALL` flip the
    // collection's `loaded$` to true (`ngrx-data`'s `queryByKeySuccess` sets
    // `loading: false` but never `loaded: true`) — `weddingConfigLoaded()`
    // above depends on that flag to gate `ready()`. Singleton resource,
    // always the same document, matching `config-manager.ts`'s own `.load()`.
    this.weddingConfigCollection.load();
    this.fetchAudiences();
  }

  private fetchMilestones(): void {
    this.loadError.set(null);
    this.milestoneCollection.getAll().subscribe({
      error: (error: unknown) => this.loadError.set(this.errorMessage(error)),
    });
  }

  /** Re-reads the whole collection (the only granularity the contract offers
   *  — no single-milestone `GET`, `MilestoneDataService.getById()`'s own
   *  comment) after a send/clear-announcement, and after a `409` on either
   *  that or a plain edit (hub ADR-0030 §6/§7): "re-read and tell the couple
   *  what happened", never a silent retry. */
  private refetchMilestones(): void {
    this.milestoneCollection.getAll().subscribe();
  }

  /** Non-fatal by design: the announcement section simply stays gated behind
   *  `audiencesLoaded()` (send disabled, no chip counts) until this
   *  succeeds — the much more common internal-only timeline must not break
   *  because `GET /v1/audiences` did. */
  private fetchAudiences(): void {
    this.audiencesApi.audiencesControllerListV1().subscribe({
      next: (response) => {
        this.audiences.set(response.items);
        this.audiencesLoaded.set(true);
      },
    });
  }

  protected retryLoad(): void {
    this.fetchMilestones();
  }

  /** The "no wedding date" empty state's link to the config manager
   *  (hub ADR-0029 §4.1). A `<button app-btn>`, not `<a routerLink>` styled
   *  to match — `app-btn`'s selector is `button[app-btn]` (native `<button>`
   *  only), so an anchor never instantiates the component at all. */
  protected goToConfig(): void {
    void this.router.navigate(['/config']);
  }

  // ── Row helpers ──────────────────────────────────────────────────────────

  protected milestoneStatus(m: MilestoneDto): MilestoneStatus {
    if (m.reached) return 'reached';
    if (m.atRisk) return 'at-risk';
    return 'not-reached';
  }

  protected statusLabelKey(m: MilestoneDto): string {
    return STATUS_LABEL_KEYS[this.milestoneStatus(m)];
  }

  protected titleFor(m: MilestoneDto): string {
    return m.title[this.primaryLang()];
  }

  /** Whether `m`'s detail is the one currently open — drives the card's
   *  "selected" border (DS `ScreenMilestones.jsx`: `on = sel && sel.id ===
   *  m.id`), independent of hover/focus. */
  protected isSelected(id: string): boolean {
    const state = this.panel();
    return state.kind === 'view' && state.id === id;
  }

  /** Card second line (defect #3): relative to today in Europe/Madrid — never
   *  re-derives `atRisk` itself, which stays the API's own authoritative
   *  value; this only decides which phrasing today's date implies. */
  protected relativeKind(m: MilestoneDto): RelativeKind {
    if (m.reached) return 'reached';
    const diff = daysBetween(this.todayIso(), m.plannedDate);
    if (diff === 0) return 'today';
    return diff > 0 ? 'upcoming' : 'overdue';
  }

  /** Absolute day count for the 'upcoming'/'overdue' phrasings — meaningless
   *  (and unused) for 'reached'/'today'. */
  protected relativeDays(m: MilestoneDto): number {
    return Math.abs(daysBetween(this.todayIso(), m.plannedDate));
  }

  // ── Audience / announcement-type helpers (hub ADR-0030 §8/§9) ───────────
  // The audience set itself is never hand-listed anywhere below — every
  // chip and every count comes from `audiences()` (`GET /v1/audiences`), so
  // the two dropped chips ("Travelling from abroad", "Table hosts") cannot
  // appear: they have no backing entry to iterate over (§8).

  protected audienceEntry(
    id: MilestoneDto.AudienceEnum | undefined,
  ): AudienceListResponseDtoItemsInner | null {
    if (!id) return null;
    return this.audiences().find((a) => a.id === id) ?? null;
  }

  protected audienceSize(id: MilestoneDto.AudienceEnum | undefined): number | null {
    return this.audienceEntry(id)?.size ?? null;
  }

  protected audienceReachableSize(id: MilestoneDto.AudienceEnum | undefined): number | null {
    return this.audienceEntry(id)?.reachableSize ?? null;
  }

  protected announcementTypeLabel(type: MilestoneDto.AnnouncementTypeEnum): string {
    return this.translateService.instant('milestones.announcementType.' + type);
  }

  protected audienceLabel(id: MilestoneDto.AudienceEnum): string {
    return this.translateService.instant('milestones.audience.' + id);
  }

  /** Whether `m` is guest-facing and legally sendable right now (hub
   *  ADR-0030 §6's five disable conditions, in order): not guest-facing, no
   *  type, no audience, an empty audience, or already sent. */
  protected canSend(m: MilestoneDto): boolean {
    if (m.kind !== MilestoneDto.KindEnum.GUEST_FACING) return false;
    if (!m.announcementType) return false;
    if (!m.audience) return false;
    if (m.announcement) return false;
    const size = this.audienceSize(m.audience);
    return size !== null && size > 0;
  }

  /** Tick/untick, persisted immediately (hub ADR-0029 §4.2/§5) — independent
   *  of the title/date form below, so toggling from the list never leaves a
   *  stale value behind in an open detail pane. */
  protected toggleReached(m: MilestoneDto, event: Event): void {
    event.stopPropagation();
    this.actionError.set(null);
    // `EntityCollectionService.update()` takes a flat `Partial<T>` (must
    // include `id`) — `MilestoneDataService.update()` is what wraps it as
    // `{ id, changes }` before calling the API (matches `rsvp-edit.ts`).
    this.milestoneCollection.update({ id: m.id, version: m.version, reached: !m.reached }).subscribe({
      error: (error: unknown) => this.actionError.set(this.errorMessage(error)),
    });
  }

  protected dismissActionError(): void {
    this.actionError.set(null);
  }

  // ── Panel open/close ─────────────────────────────────────────────────────

  protected openCreate(): void {
    this.formTitle.set({ es: '', en: '', fr: '' });
    this.customizedLocales.set(new Set());
    this.showOtherLocales.set(false);
    this.formDate.set('');
    // Defaults to internal every time a fresh create panel opens — never
    // carries over a previous "guest-facing" choice (hub ADR-0030: a real,
    // deliberate choice each time, not a sticky default).
    this.formKind.set(MilestoneDto.KindEnum.INTERNAL);
    this.formAnnouncementType.set(null);
    this.formAudience.set(null);
    this.titleTouched.set(false);
    this.dateTouched.set(false);
    this.submitAttempted.set(false);
    this.formError.set(null);
    this.panel.set({ kind: 'create' });
  }

  protected openView(id: string): void {
    const m = this.sortedMilestones().find((item) => item.id === id);
    if (!m) return;
    this.formTitle.set({ ...m.title });
    // Existing milestones already carry (possibly distinct) real translations
    // for every locale — mark every non-primary one customized up front so
    // editing the primary field never silently overwrites them.
    this.customizedLocales.set(new Set(this.otherLangs()));
    this.showOtherLocales.set(false);
    this.formDate.set(m.plannedDate);
    this.formAnnouncementType.set(m.announcementType ?? null);
    this.formAudience.set(m.audience ?? null);
    this.titleTouched.set(false);
    this.dateTouched.set(false);
    this.submitAttempted.set(false);
    this.formError.set(null);
    this.panel.set({ kind: 'view', id });
  }

  protected closePanel(): void {
    this.panel.set({ kind: 'closed' });
  }

  /** Create-only kind switch (hub ADR-0030 §11a — `kind` is not patchable,
   *  so this only ever runs while `panel().kind === 'create'`). */
  protected setKind(kind: MilestoneDto.KindEnum): void {
    this.formKind.set(kind);
  }

  // ── Title form (hub ADR-0031: one typed title, pre-fills all three) ─────

  protected onPrimaryTitleInput(value: string): void {
    const primary = this.primaryLang();
    const customized = this.customizedLocales();
    this.formTitle.update((title) => {
      const next = { ...title, [primary]: value };
      for (const lang of LANGS) {
        if (lang !== primary && !customized.has(lang)) next[lang] = value;
      }
      return next;
    });
  }

  protected onOtherTitleInput(lang: LangCode, value: string): void {
    this.customizedLocales.update((set) => new Set(set).add(lang));
    this.formTitle.update((title) => ({ ...title, [lang]: value }));
  }

  protected toggleOtherLocales(): void {
    this.showOtherLocales.update((open) => !open);
  }

  protected touchTitle(): void {
    this.titleTouched.set(true);
  }

  protected touchDate(): void {
    this.dateTouched.set(true);
  }

  // ── Submit (create or rename/re-date) ────────────────────────────────────

  /** Native `(submit)`, not `(ngSubmit)` — this form uses plain signals, not
   *  `NgForm`/`ngModel`, so pulling in `FormsModule` just for the event
   *  rename would be an unused dependency. The browser's own native
   *  behaviour already gives Enter-in-a-field submit (hard rule 9) for free;
   *  `preventDefault()` only stops the default full-page form navigation. */
  protected onFormSubmit(event: Event): void {
    event.preventDefault();
    this.submit();
  }

  protected submit(): void {
    this.submitAttempted.set(true);
    if (this.titleInvalid() || this.dateInvalid() || this.saving()) return;

    const state = this.panel();
    if (state.kind === 'closed') return;

    this.formError.set(null);
    this.saving.set(true);

    if (state.kind === 'create') {
      // Placeholder envelope fields (`id`/`version`/`atRisk`) are ignored —
      // `MilestoneDataService.add()` builds `CreateMilestoneDto` from
      // `title`/`plannedDate`/`reached`/`kind`. `announcementType`/`audience`
      // are never sent here (hub ADR-0030 §11c): a new guest-facing
      // milestone always starts unconfigured, configured afterwards by
      // `update()` below.
      const draft: MilestoneDto = {
        id: '',
        version: 0,
        title: this.formTitle(),
        plannedDate: this.formDate(),
        kind: this.formKind(),
        reached: false,
        atRisk: false,
      };
      this.milestoneCollection.add(draft).subscribe({
        next: (created) => {
          this.saving.set(false);
          this.panel.set({ kind: 'view', id: created.id });
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.formError.set(this.errorMessage(error));
        },
      });
      return;
    }

    const existing = this.selectedMilestone();
    if (!existing) {
      this.saving.set(false);
      return;
    }
    this.milestoneCollection
      .update({
        id: existing.id,
        version: existing.version,
        title: this.formTitle(),
        plannedDate: this.formDate(),
        // `undefined` for an internal milestone (never populated by
        // `openView()` for one) drops the keys entirely over real HTTP —
        // never risks the 422 that setting them on a non-guest-facing
        // milestone would trigger server-side (hub ADR-0030 §11c).
        announcementType: this.formAnnouncementType() ?? undefined,
        audience: this.formAudience() ?? undefined,
      })
      .subscribe({
        next: () => this.saving.set(false),
        error: (error: unknown) => {
          this.saving.set(false);
          this.formError.set(this.errorMessage(error));
          // Hub ADR-0030 §6: a 409 on an edit means someone else changed
          // this milestone first — re-read rather than leaving the couple
          // looking at a form built from a version that no longer exists.
          if (this.isConflict(error)) this.refetchMilestones();
        },
      });
  }

  // ── Delete (permanent — hub ADR-0029 §4.8) ──────────────────────────────

  protected requestDelete(id: string): void {
    this.actionError.set(null);
    this.pendingDeleteId.set(id);
  }

  protected cancelDelete(): void {
    this.pendingDeleteId.set(null);
  }

  protected confirmDelete(): void {
    const id = this.pendingDeleteId();
    if (!id || this.deleting()) return;
    this.deleting.set(true);
    this.milestoneCollection.delete(id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDeleteId.set(null);
        const state = this.panel();
        if (state.kind === 'view' && state.id === id) this.closePanel();
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        this.pendingDeleteId.set(null);
        this.actionError.set(this.errorMessage(error));
      },
    });
  }

  protected deleteDialogMessage(): string {
    const m = this.pendingDelete();
    if (!m) return '';
    return this.translateService.instant('milestones.delete.message', { title: this.titleFor(m) });
  }

  // ── Send the announcement (hub ADR-0030 §6) ─────────────────────────────
  // `POST /v1/milestones/{id}/announcement` — a create-once sub-resource,
  // never an RPC verb the client invents (§11d). No quick-send path exists:
  // `requestSend()` only ever opens the confirmation; `confirmSend()` is the
  // only call site that actually sends.

  /** Opens the blast-radius confirmation — refuses if `canSend()` says no,
   *  so a disabled button can never be routed around from a stale click. */
  protected requestSend(): void {
    const m = this.selectedMilestone();
    if (!m || !this.canSend(m)) return;
    this.actionError.set(null);
    this.sendConfirmOpen.set(true);
  }

  protected cancelSend(): void {
    this.sendConfirmOpen.set(false);
  }

  /** States the blast radius before anything is sent (hub ADR-0030 §6): the
   *  milestone name, the announcement type, the audience, the recipient
   *  count, the reachable count, and that it goes out immediately. Built
   *  from the *saved* milestone and the last-fetched `audiences()` counts —
   *  not from the in-progress form selection, which may not be saved yet. */
  protected sendConfirmMessage(): string {
    const m = this.selectedMilestone();
    if (!m?.announcementType || !m.audience) return '';
    return this.translateService.instant('milestones.announcement.sendConfirm.message', {
      title: this.titleFor(m),
      type: this.announcementTypeLabel(m.announcementType),
      audience: this.audienceLabel(m.audience),
      recipientCount: this.audienceSize(m.audience) ?? 0,
      reachableCount: this.audienceReachableSize(m.audience) ?? 0,
    });
  }

  protected confirmSend(): void {
    const m = this.selectedMilestone();
    if (!m || this.sending()) return;
    this.sendConfirmOpen.set(false);
    this.sending.set(true);
    this.milestoneDataService.send(m.id, m.version).subscribe({
      next: () => {
        this.sending.set(false);
        // The response is the send fact/counts, not the updated
        // `MilestoneDto` (no new `version` in it) — re-read rather than
        // hand-assemble the cache entry from a shape that doesn't carry one.
        this.refetchMilestones();
      },
      error: (error: unknown) => {
        this.sending.set(false);
        if (this.httpStatus(error) === 409) {
          // Hub ADR-0030 §7: either it was already sent, or someone else's
          // edit/send won the race. Never retried automatically — re-read
          // and say plainly what happened.
          this.actionError.set(this.translateService.instant('milestones.announcement.sendConflict'));
          this.refetchMilestones();
        } else {
          this.actionError.set(this.translateService.instant('milestones.error.generic'));
        }
      },
    });
  }

  // ── "Mark as not sent" (hub ADR-0030 §7) ─────────────────────────────────
  // `DELETE /v1/milestones/{id}/announcement` — unsends nothing; only lifts
  // the create-once block so the milestone can be sent again. Behind the
  // shared `app-confirm-dialog`, `tone="danger"` (T277/T278/T279 pattern) —
  // dismissing it must leave the milestone exactly as it was.

  protected requestClearAnnouncement(): void {
    const m = this.selectedMilestone();
    if (!m?.announcement) return;
    this.actionError.set(null);
    this.pendingClearId.set(m.id);
  }

  protected cancelClearAnnouncement(): void {
    this.pendingClearId.set(null);
  }

  protected confirmClearAnnouncement(): void {
    const id = this.pendingClearId();
    if (!id || this.clearingAnnouncement()) return;
    this.clearingAnnouncement.set(true);
    this.milestoneDataService.clearAnnouncement(id).subscribe({
      next: () => {
        this.clearingAnnouncement.set(false);
        this.pendingClearId.set(null);
        this.refetchMilestones();
      },
      error: () => {
        this.clearingAnnouncement.set(false);
        this.pendingClearId.set(null);
        this.actionError.set(this.translateService.instant('milestones.error.generic'));
      },
    });
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private errorMessage(error: unknown): string {
    const key = this.isConflict(error) ? 'milestones.error.conflict' : 'milestones.error.generic';
    return this.translateService.instant(key);
  }

  /** For errors coming through @ngrx/data (`milestoneCollection.add()` /
   *  `.update()` / `.delete()`), which wrap the underlying HTTP error as
   *  `DataServiceError.error`. */
  private isConflict(error: unknown): boolean {
    return this.httpStatus((error as DataServiceError | undefined)?.error) === 409;
  }

  /** For errors coming straight off the generated API client
   *  (`MilestoneDataService.send()` / `.clearAnnouncement()`, called
   *  directly rather than through @ngrx/data) — a plain `HttpErrorResponse`,
   *  not wrapped in `DataServiceError`. */
  private httpStatus(error: unknown): number | undefined {
    return (error as HttpErrorResponse | undefined)?.status;
  }
}
