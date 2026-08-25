import { ChangeDetectionStrategy, Component, computed, inject, signal, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { map } from 'rxjs';
import { DataServiceError, EntityCollectionService, EntityServices } from '@ngrx/data';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  EntityNamesEnum,
  HeaderService,
  MilestoneDto,
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

/**
 * Couple-only preparation timeline (hub ADR-0029, T279): every milestone,
 * date-ascending, with a "Today" marker, tick-off, and full CRUD — all
 * persisted server-side. Guest-facing kind, audience, channels, message body
 * and send are explicitly **not** built here (hub ADR-0030 is T280's).
 *
 * Layout follows `ScreenMilestones.jsx` / `ScreenMilestonesMobile.jsx` for
 * **chrome only** (date-ascending rows, the dot-rail timeline, the "Today"
 * marker, the desktop detail pane / mobile bottom sheet) — one template,
 * switched purely by CSS (`@media (min-width: 900px)`), same approach as
 * `people` / `seating-plan` / `config-manager`.
 */
@Component({
  selector: 'app-milestones',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppErrorComponent,
    AppLoadingComponent,
    Btn,
    ConfirmDialog,
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

  private readonly milestoneCollection: EntityCollectionService<MilestoneDto> = inject(
    EntityServices,
  ).getEntityCollectionService<MilestoneDto>(EntityNamesEnum.MILESTONE);

  private readonly weddingConfigCollection: EntityCollectionService<WeddingConfigResponseDto> =
    inject(EntityServices).getEntityCollectionService<WeddingConfigResponseDto>(
      EntityNamesEnum.WEDDING_CONFIG,
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
  }

  private fetchMilestones(): void {
    this.loadError.set(null);
    this.milestoneCollection.getAll().subscribe({
      error: (error: unknown) => this.loadError.set(this.errorMessage(error)),
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
    this.titleTouched.set(false);
    this.dateTouched.set(false);
    this.submitAttempted.set(false);
    this.formError.set(null);
    this.panel.set({ kind: 'view', id });
  }

  protected closePanel(): void {
    this.panel.set({ kind: 'closed' });
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
      // `MilestoneDataService.add()` builds `CreateMilestoneDto` from only
      // `title`/`plannedDate`/`reached`. `kind` is never sent (this app only
      // ever creates `internal` milestones; T280 owns `guest-facing`).
      const draft: MilestoneDto = {
        id: '',
        version: 0,
        title: this.formTitle(),
        plannedDate: this.formDate(),
        kind: 'internal',
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
      })
      .subscribe({
        next: () => this.saving.set(false),
        error: (error: unknown) => {
          this.saving.set(false);
          this.formError.set(this.errorMessage(error));
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

  // ── Shared helpers ────────────────────────────────────────────────────────

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private errorMessage(error: unknown): string {
    const status = (error as DataServiceError | undefined)?.error?.status as number | undefined;
    const key = status === 409 ? 'milestones.error.conflict' : 'milestones.error.generic';
    return this.translateService.instant(key);
  }
}
