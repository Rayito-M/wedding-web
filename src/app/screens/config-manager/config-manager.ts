import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  Signal,
  OnInit,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { KeyValuePipe, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EntityCollectionService, EntityServices, DataServiceError } from '@ngrx/data';

import {
  CreateWeddingConfigDtoAgendaItemsInner,
  CreateWeddingConfigDtoDietaryPreferencesInner,
  CreateWeddingConfigDtoGoodToKnowInner,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf1,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf2,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf2EntriesInner,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf3,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf3EntriesInner,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf4,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf5,
  CreateWeddingConfigDtoHotelsInner,
  CreateWeddingConfigDtoVenuesInner,
  HeaderService,
  TranslateLanguageService,
  WeddingConfigResponseDto,
  byAgendaTime,
  EntityNamesEnum,
  isFirstLoad,
  extractAgendaTime,
  UserDto,
  CreateUserDto,
  LoginService,
  ToastCenterService,
  ulid,
  // `pnpm gen:api` (T279) deduped this structurally-identical `{es,en,fr}`
  // schema onto the milestone title's generated name instead of its own —
  // an openapi-generator naming artifact of adding the Milestone schemas,
  // not a shape change. Same `{es: string; en: string; fr: string}` shape
  // as the old `CreateWeddingConfigDtoAgendaItemsInnerTitle`.
  MilestoneListResponseDtoItemsInnerTitle,
} from '@app/core';
import { LangCode, LangDescriptionType, ThemeId } from '@app/model';
import { Btn } from '@app/shared/button/button';
import {
  CONFIG_SECTION_PARAM,
  isSectionId,
  SECTIONS,
  type SectionId,
} from '@app/shared/config-sections';
import { DecorFish } from '@app/shared/decor/fish';
import { TextInput } from '@app/shared/input/input';
import { Pill } from '@app/shared/pill/pill';
import { Toggle } from '@app/shared/toggle/toggle';

// Reuse the generated OpenAPI models directly (Hard Rule: "never duplicate type
// definitions") — this is the exact shape a future `PATCH /v1/config` would send
// (T211-T214, not built yet). This screen is UI-only, local component state.
type ConfigState = WeddingConfigResponseDto;
type Venue = CreateWeddingConfigDtoVenuesInner;
type MultiLangText = MilestoneListResponseDtoItemsInnerTitle;
type AgendaItem = CreateWeddingConfigDtoAgendaItemsInner;
type Hotel = CreateWeddingConfigDtoHotelsInner;
type DietTag = CreateWeddingConfigDtoDietaryPreferencesInner;
type TagCollection = 'dietaryPreferences' | 'allergies';

// ── Good to know (hub ADR-0046 §2/§8, T376) ─────────────────────────────────
// Aliases resolve to the generated union and its members (hard rule 15) — a
// regenerated client that reshapes a block is a compile error here, not drift.
type GoodToKnowBlock = CreateWeddingConfigDtoGoodToKnowInner;
type FaqEntry = CreateWeddingConfigDtoGoodToKnowInnerOneOf2EntriesInner;
type ContactEntry = CreateWeddingConfigDtoGoodToKnowInnerOneOf3EntriesInner;

/**
 * The closed block-type set of hub ADR-0046 §2, in the order the add row
 * offers them. Not a type redeclaration: the generator flattens each member's
 * `const`-typed `type` to a plain `string` (see `good-to-know.ts`'s identical
 * workaround), so there is no generated union to import — these are the same
 * string literals the renderer's `switch` already carries, held in one place
 * so the add row can iterate them. Growing this list is a breaking contract
 * change (§1) and never happens client-first.
 */
const GOOD_TO_KNOW_TYPES = [
  'dress-code',
  'gift',
  'faq',
  'contacts',
  'day-line',
  'note',
] as const;

/** `dress-code`, `gift` and `day-line` are at-most-once (§2); the add row
 *  stops offering one that exists rather than letting the API 400. */
const SINGLETON_BLOCK_TYPES: ReadonlySet<string> = new Set(['dress-code', 'gift', 'day-line']);

/** §2's bounds: at most 12 blocks; FAQ holds 3–10 entries, contacts 1–10. */
const GOOD_TO_KNOW_MAX_BLOCKS = 12;
const FAQ_MIN_ENTRIES = 3;
const FAQ_MAX_ENTRIES = 10;
const CONTACTS_MIN_ENTRIES = 1;
const CONTACTS_MAX_ENTRIES = 10;

/**
 * The block-type discriminants cannot narrow the generated union (the
 * generator flattens each `type` to `string`), so these casts *within* the
 * union — the same one-place workaround `good-to-know.ts` documents — are how
 * the template reaches a member's fields without a local copy of its shape.
 */
const asDressCode = (b: GoodToKnowBlock): CreateWeddingConfigDtoGoodToKnowInnerOneOf =>
  b as CreateWeddingConfigDtoGoodToKnowInnerOneOf;
const asGift = (b: GoodToKnowBlock): CreateWeddingConfigDtoGoodToKnowInnerOneOf1 =>
  b as CreateWeddingConfigDtoGoodToKnowInnerOneOf1;
const asFaq = (b: GoodToKnowBlock): CreateWeddingConfigDtoGoodToKnowInnerOneOf2 =>
  b as CreateWeddingConfigDtoGoodToKnowInnerOneOf2;
const asContacts = (b: GoodToKnowBlock): CreateWeddingConfigDtoGoodToKnowInnerOneOf3 =>
  b as CreateWeddingConfigDtoGoodToKnowInnerOneOf3;
const asDayLine = (b: GoodToKnowBlock): CreateWeddingConfigDtoGoodToKnowInnerOneOf4 =>
  b as CreateWeddingConfigDtoGoodToKnowInnerOneOf4;
const asNote = (b: GoodToKnowBlock): CreateWeddingConfigDtoGoodToKnowInnerOneOf5 =>
  b as CreateWeddingConfigDtoGoodToKnowInnerOneOf5;

/** All three locales carry non-blank text — what "complete" means for a
 *  required localized field (§5: all three required, not three *distinct*). */
const allFilled = (value: LangDescriptionType | undefined): boolean =>
  !!value && ['es', 'en', 'fr'].every((lang) => value[lang as LangCode].trim() !== '');

/** Every locale blank — an optional localized field the couple never wrote,
 *  dropped from the save payload rather than sent as three empty strings. */
const allBlank = (value: LangDescriptionType | undefined): boolean =>
  !value || ['es', 'en', 'fr'].every((lang) => value[lang as LangCode].trim() === '');

/** One row of the section's "cannot save yet" message list: which block (its
 *  1-based position and type, so the message can name it) and why. */
interface GoodToKnowIssue {
  readonly key: string;
  readonly n: number;
  readonly type: string;
}
// Agenda filter (T297) — local UI state only, not an API field: "key moments"
// reads the existing `highlight` boolean (see the phase note above T295 —
// DS `important` *is* `highlight`), it is not a value stored anywhere itself.
type AgendaFilter = 'all' | 'keyMoments' | 'optional';

// "The couple" section — bride/groom accounts from the userCollection (UserDto).
// Managed via EntityCollectionService; persisted to API when endpoint available.
type CoupleRole = 'bride' | 'groom';

const COUPLE_ROLES: readonly CoupleRole[] = ['bride', 'groom'];

// Column order for the always-visible, all-languages Agenda/Dietary editors
// (T297). Was `['fr', 'en', 'es']` only because the old tab bar had no notion
// of a primary language; now that the leftmost column is permanently visible
// rather than switched to, it should be the one the app treats as primary —
// so this now matches the app-wide default-language order (es-first, hub
// ADR-0009) instead of deliberately not matching it.
const EDIT_LANGS: readonly LangCode[] = ['es', 'en', 'fr'];

// The app's fixed language set (hub ADR-0009) — es default, en/fr switchable.
const APP_LANGUAGES: readonly LangCode[] = ['es', 'en', 'fr'];

const PRICE_TIERS: readonly Hotel['priceTier'][] = ['€', '€€', '€€€'];

interface ThemeSwatch {
  readonly id: ThemeId;
  readonly labelKey: string;
  readonly accent: string;
  readonly soft: string;
  readonly bg: string;
}

// Hex values mirror src/styles/_tokens.scss per-theme roles (--accent, --accent-2,
// --bg). Swatches must show every theme's colors at once, so — like the existing
// ThemeSelector — they can't rely on the currently active theme's CSS variables.
const THEME_SWATCHES: readonly ThemeSwatch[] = [
  {
    id: 'mauve',
    labelKey: 'configManager.themeName.mauve',
    accent: '#b08a92',
    soft: '#d6c5c8',
    bg: '#f8f6f2',
  },
  {
    id: 'terracotta',
    labelKey: 'configManager.themeName.terracotta',
    accent: '#c97155',
    soft: '#e6c779',
    bg: '#f8f6f2',
  },
  {
    id: 'verdeagua',
    labelKey: 'configManager.themeName.verdeagua',
    accent: '#7aaea2',
    soft: '#cfe3da',
    bg: '#f5f7f4',
  },
];

const emptyLangText = (): MultiLangText => ({ es: '', en: '', fr: '' });

/** Hour a freshly added agenda item starts at, until the admin edits it. */
const DEFAULT_AGENDA_TIME = '12:00';

//TOD: UID are manage by the backend, so we should not generate them on the frontend.
const uid = (): string => ulid();

function buildEmptyConfig(): ConfigState {
  return {
    id: '',
    version: 0,
    brideName: '',
    groomName: '',
    tagline: '',
    date: '',
    rsvpDeadline: '',
    country: '',
    city: '',
    themeId: 'terracotta',
    language: { es: '', en: '', fr: '' },
    venues: [],
    agenda: { status: 'provisional', items: [] },
    hotels: [],
    dietaryPreferences: [],
    allergies: [],
    menus: [],
  };
}

/**
 * Admin-only wedding configuration editor (8 sections: basics, the couple,
 * venues, agenda, stays, dietary, appearance, good to know). Edits are local
 * draft state until Save, which persists the whole document through the
 * `WeddingConfig` collection to `PATCH /v1/config` (`save()` below →
 * `wedding-config-data.service.ts`). See the design reference:
 * `ScreenConfigManager.jsx` / `ScreenConfigManagerMobile.jsx`.
 */
@Component({
  selector: 'app-config-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Btn, TextInput, Pill, Toggle, DecorFish, TranslatePipe, KeyValuePipe, NgTemplateOutlet],
  templateUrl: './config-manager.html',
  styleUrl: './config-manager.scss',
})
export class ConfigManager implements OnInit {
  private readonly translateService = inject(TranslateService);
  private readonly loginService = inject(LoginService);
  private readonly toastCenter = inject(ToastCenterService);
  /**
   * `WeddingConfigPublic` @ngrx/data collection (ADR W-0001 decisions 3–4):
   * store → custom data service → generated API client. RxJS stays inside
   * this service (Hard Rule #5); consumers only see signals.
   */
  private readonly weddingConfigCollection: EntityCollectionService<WeddingConfigResponseDto> =
    inject(EntityServices).getEntityCollectionService<WeddingConfigResponseDto>(
      EntityNamesEnum.WEDDING_CONFIG,
    );

  /** Singleton resource: the collection holds at most one document. */
  readonly weddingConfig: Signal<WeddingConfigResponseDto | undefined> = toSignal(
    this.weddingConfigCollection.entities$.pipe(map((configs) => configs[0])),
    { initialValue: undefined },
  );

  private readonly userCollection: EntityCollectionService<UserDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserDto>(EntityNamesEnum.USER);

  protected readonly coupleProfiles: Signal<{
    groom: UserDto | undefined;
    bride: UserDto | undefined;
  }> = toSignal(
    this.userCollection.entities$.pipe(
      map((users) => {
        const result = {
          groom: undefined as UserDto | undefined,
          bride: undefined as UserDto | undefined,
        };
        for (const user of users) {
          if (user.role === 'groom') result.groom = user;
          if (user.role === 'bride') result.bride = user;
          if (result.groom && result.bride) break; // early exit once both found
        }
        return result;
      }),
    ),
    { initialValue: { groom: undefined, bride: undefined } },
  );

  protected userToCreate: UserDto | null = null;

  private savedFlashTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly sections = SECTIONS;

  /** Two placeholder fields, for each `.grid-2` row of the loading form. */
  protected readonly pendingFieldPair = [0, 1];
  protected readonly editLangs = EDIT_LANGS;
  protected readonly appLanguages = APP_LANGUAGES;
  protected readonly priceTiers = PRICE_TIERS;
  protected readonly themeSwatches = THEME_SWATCHES;

  /**
   * The persisted document has not arrived yet, so `cfg()` below is still
   * `buildEmptyConfig()` — blank fields and version 0, which an editor must
   * not offer as if they were the wedding's real settings. The panel area
   * shows the in-place loader until the read lands; the section rail stays
   * usable and the toolbar keeps its (disabled) Save.
   */
  protected readonly loading = isFirstLoad(this.weddingConfigCollection);

  protected readonly cfg = signal<ConfigState>(this.weddingConfig() ?? buildEmptyConfig());

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** `?section=` (`CONFIG_SECTION_PARAM`) — the active section, driven by
   *  the URL rather than screen-private state (T364's section-controlled
   *  mode, hub ADR-0045 §3). This is what lets Manage's desktop `PlanRail`
   *  (`private-layout.ts`'s `onManageSection`) select a section from
   *  *outside* this component without a second mechanism: the mobile pill
   *  row below drives the exact same query param, so there is one source of
   *  truth for "which section is open" regardless of which control moved
   *  it — mirrors `travel.ts`'s own `?place=` `linkedSignal` pattern. */
  private readonly requestedSection: Signal<string | null> = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get(CONFIG_SECTION_PARAM))),
    { initialValue: null },
  );

  protected readonly section = linkedSignal<string | null, SectionId>({
    source: this.requestedSection,
    computation: (requested) => (isSectionId(requested) ? requested : 'basics'),
  });

  protected readonly agendaFilter = signal<AgendaFilter>('all');
  protected readonly dirty = signal(false);
  protected readonly savedFlash = signal(false);
  /**
   * True while the draft wedding date differs from the persisted one — drives
   * a one-line hint that the preparation timeline (T279) does **not** move
   * with it (hub ADR-0029 §4.3: milestone dates are absolute, computed once
   * at seed time; nothing here recomputes them, silently or otherwise). Not a
   * general "any field is dirty" flag — comparing directly against the
   * loaded `weddingConfig()` means it only lights up for an actual date edit.
   */
  protected readonly weddingDateChanged = computed(() => {
    const persisted = this.weddingConfig()?.date;
    return persisted !== undefined && this.cfg().date !== persisted;
  });
  protected readonly coupleRoles = COUPLE_ROLES;
  // Draft text for the inline "+ Add tag" chip input, per tag collection.
  protected readonly draftTag = signal<Record<TagCollection, string>>({
    dietaryPreferences: '',
    allergies: '',
  });

  protected readonly createModalOpen = signal(false);
  protected readonly createModalRole = signal<CoupleRole | null>(null);
  protected readonly createModalData = signal<Omit<CreateUserDto, 'role'>>({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    preferredLang: 'es',
  });
  protected readonly createModalLoading = signal(false);
  protected readonly createModalError = signal<string | null>(null);
  protected readonly createModalFieldErrors = signal<Record<string, string | null>>({
    firstName: null,
    lastName: null,
    email: null,
    phoneNumber: null,
  });

  protected readonly isCreateFormValid = computed(() => {
    const data = this.createModalData();
    const errors = this.createModalFieldErrors();
    return (
      data.firstName?.trim() &&
      data.lastName?.trim() &&
      !errors['firstName'] &&
      !errors['lastName'] &&
      !errors['email'] &&
      !errors['phoneNumber']
    );
  });

  protected readonly magicLinkLoading = signal<string | null>(null); // userId being invited
  protected readonly magicLinkError = signal<string | null>(null);
  protected readonly magicLinkSuccess = signal<{ userId: string; message: string } | null>(null);
  private magicLinkSuccessTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly statusKey = computed(() => {
    if (this.savedFlash()) return 'configManager.status.saved';
    // A half-built Good to know block withholds Save for the whole document
    // (one PATCH carries every section) — say so instead of showing a mutely
    // disabled button from another section.
    if (this.dirty() && this.saveBlocked()) return 'configManager.status.blocked';
    return this.dirty() ? 'configManager.status.dirty' : 'configManager.status.upToDate';
  });

  protected readonly saveLabelKey = computed(() =>
    this.dirty() ? 'configManager.actions.save' : 'configManager.actions.saved',
  );

  protected readonly itemStatuses: readonly AgendaItem['status'][] = [
    'planned',
    'confirmed',
    'cancelled',
  ];

  protected readonly scheduleStatuses: readonly ConfigState['agenda']['status'][] = [
    'provisional',
    'final',
  ];

  /** The schedule read in clock order via `byAgendaTime`, which also carries
   *  the half-typed-`time` and stability rules this tab depends on while an
   *  admin edits an hour. Display order only: every edit addresses its item by
   *  `id`, so reordering the view never mis-targets a write. */
  protected readonly agendaItems = computed(() => byAgendaTime(this.cfg().agenda.items));

  protected readonly agendaCounts = computed(() =>
    this.cfg().agenda.items.reduce(
      (acc, item) => ({ ...acc, [item.status]: acc[item.status] + 1 }),
      { planned: 0, confirmed: 0, cancelled: 0 },
    ),
  );

  /** All/Key moments/Optional counts for the agenda filter bar. */
  protected readonly agendaFilterCounts = computed(() => {
    const items = this.cfg().agenda.items;
    const keyMoments = items.filter((item) => item.highlight).length;
    return { all: items.length, keyMoments, optional: items.length - keyMoments };
  });

  // ── Good to know (hub ADR-0046 §8, T376) ──────────────────────────────────

  private readonly translateLanguage = inject(TranslateLanguageService);

  /** The one language typed by default; the other two sit behind the
   *  per-block disclosure (hub ADR-0031's ergonomics, the milestones-form
   *  precedent). */
  protected readonly goodToKnowLang = this.translateLanguage.currentLang;

  protected readonly goodToKnowOtherLangs = computed(() =>
    EDIT_LANGS.filter((lang) => lang !== this.goodToKnowLang()),
  );

  /** Stored order, verbatim — the couple's order is what guests read
   *  (ADR-0046 §3); never sorted or grouped by type. */
  protected readonly goodToKnowBlocks = computed<readonly GoodToKnowBlock[]>(
    () => this.cfg().goodToKnow ?? [],
  );

  /** What the add row offers: a singleton type already in the array is not
   *  offered again, and nothing is offered at the 12-block cap — the UI
   *  withholds the control rather than letting the API 400. */
  protected readonly addableBlockTypes = computed<readonly string[]>(() => {
    const blocks = this.goodToKnowBlocks();
    if (blocks.length >= GOOD_TO_KNOW_MAX_BLOCKS) return [];
    const present = new Set(blocks.map((block) => block.type));
    return GOOD_TO_KNOW_TYPES.filter(
      (type) => !(SINGLETON_BLOCK_TYPES.has(type) && present.has(type)),
    );
  });

  /** Template-facing copies of §2's entry caps — the add-entry buttons
   *  disappear at the ceiling instead of letting the API 400. */
  protected readonly faqMaxEntries = FAQ_MAX_ENTRIES;
  protected readonly contactsMaxEntries = CONTACTS_MAX_ENTRIES;

  /** Blocks whose EN/FR rows are disclosed (per block, not per field). */
  private readonly openLocaleBlocks = signal<ReadonlySet<string>>(new Set());

  protected isLocalesOpen(blockId: string): boolean {
    return this.openLocaleBlocks().has(blockId);
  }

  protected toggleBlockLocales(blockId: string): void {
    this.openLocaleBlocks.update((open) => {
      const next = new Set(open);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }

  /** The languages a localized field currently shows rows for: just the
   *  primary until the block's disclosure is open, then all three. */
  protected visibleLangs(blockId: string): readonly LangCode[] {
    return this.isLocalesOpen(blockId) ? EDIT_LANGS : [this.goodToKnowLang()];
  }

  /**
   * Why the draft cannot be saved yet, one row per offending block — the
   * "message that says what is missing" (T376): a block cannot be saved
   * half-built (ADR-0046 §2), FAQ holds 3–10 entries, contacts 1–10. Upper
   * bounds need no row here because the add controls disappear at the cap.
   */
  protected readonly goodToKnowIssues = computed<readonly GoodToKnowIssue[]>(() => {
    const issues: GoodToKnowIssue[] = [];
    this.goodToKnowBlocks().forEach((block, index) => {
      const issue = (key: string): void => {
        issues.push({ key, n: index + 1, type: block.type });
      };
      if (!allFilled(block.title)) issue('configManager.goodToKnow.issue.missingTitle');
      switch (block.type) {
        case 'dress-code': {
          const dressCode = asDressCode(block);
          const noteOk = allBlank(dressCode.note) || allFilled(dressCode.note);
          if (!allFilled(dressCode.headline) || !allFilled(dressCode.body) || !noteOk)
            issue('configManager.goodToKnow.issue.incomplete');
          break;
        }
        case 'gift': {
          // Every gift field is optional (§2) — only a *partially* localized
          // prose field blocks the save (all-blank ones are dropped from the
          // payload instead).
          const gift = asGift(block);
          const ok = [gift.intro, gift.reference, gift.bizumNote].every(
            (field) => allBlank(field) || allFilled(field),
          );
          if (!ok) issue('configManager.goodToKnow.issue.incomplete');
          break;
        }
        case 'faq': {
          const entries = asFaq(block).entries;
          if (entries.length < FAQ_MIN_ENTRIES)
            issue('configManager.goodToKnow.issue.faqTooFew');
          if (!entries.every((entry) => allFilled(entry.question) && allFilled(entry.answer)))
            issue('configManager.goodToKnow.issue.incomplete');
          break;
        }
        case 'contacts': {
          const entries = asContacts(block).entries;
          if (entries.length < CONTACTS_MIN_ENTRIES)
            issue('configManager.goodToKnow.issue.contactsTooFew');
          if (!entries.every((entry) => entry.firstName.trim() && allFilled(entry.purpose)))
            issue('configManager.goodToKnow.issue.incomplete');
          break;
        }
        case 'day-line': {
          const dayLine = asDayLine(block);
          if (
            !allFilled(dayLine.rsvpOpen) ||
            !allFilled(dayLine.rsvpClosed) ||
            !allFilled(dayLine.afterWedding)
          )
            issue('configManager.goodToKnow.issue.incomplete');
          break;
        }
        default:
          if (!allFilled(asNote(block).body)) issue('configManager.goodToKnow.issue.incomplete');
      }
    });
    return issues;
  });

  /** Save is withheld while any block is half-built — the whole document goes
   *  up in one PATCH, so an invalid block would take every section's edits
   *  down with it. */
  protected readonly saveBlocked = computed(() => this.goodToKnowIssues().length > 0);

  /** `agendaItems()` (clock order) narrowed by the selected `agendaFilter`. */
  protected readonly filteredAgendaItems = computed(() => {
    const items = this.agendaItems();
    switch (this.agendaFilter()) {
      case 'keyMoments':
        return items.filter((item) => item.highlight);
      case 'optional':
        return items.filter((item) => !item.highlight);
      default:
        return items;
    }
  });

  constructor() {
    inject(HeaderService).set(this.translateService.instant('configManager.headerMeta'));
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.savedFlashTimer);
      clearTimeout(this.magicLinkSuccessTimer);
    });
    this.weddingConfigCollection.load();
    this.userCollection.load();

    effect(() => {
      const apiConfig = this.weddingConfig();
      if (apiConfig && !this.dirty()) {
        this.cfg.set(apiConfig);
      }
    });
  }
  ngOnInit(): void {
    this.weddingConfigCollection.load();
  }
  /** Drives the URL, not just local state (T364) — `?section=` is what lets
   *  Manage's desktop `PlanRail` (outside this component entirely) and this
   *  screen's own mobile pill row agree on "which section is open" through
   *  one mechanism instead of two. `linkedSignal` above updates `section()`
   *  the moment the navigation resolves, same as `travel.ts`'s `?place=`. */
  protected selectSection(id: SectionId): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [CONFIG_SECTION_PARAM]: id },
      queryParamsHandling: 'merge',
    });
  }

  protected selectAgendaFilter(filter: AgendaFilter): void {
    this.agendaFilter.set(filter);
  }

  protected save(): void {
    // Defensive twin of the disabled buttons: a half-built Good to know block
    // must not reach the API (ADR-0046 §2's recorded consequence).
    if (this.saveBlocked()) return;
    this.weddingConfigCollection.update(this.sanitizedConfig()).subscribe({
      next: () => {
        this.dirty.set(false);
        this.savedFlash.set(true);
        clearTimeout(this.savedFlashTimer);
        this.savedFlashTimer = setTimeout(() => this.savedFlash.set(false), 1800);
      },
      error: (err) => {
        console.log('Failed to save wedding config:', err);

        // A danger toast stays until dismissed *by default*; the explicit
        // `delay` below opts out of that — this failure is recoverable (hit
        // Save again), so it auto-hides rather than sitting on the screen.
        this.toastCenter.show({
          tone: 'danger',
          variant: 'filled',
          icon: 'warning',
          title: this.translateService.instant('configManager.errors.save'),
          placement: 'top-center',
          delay: 5000, // 5s, not infinite (user can dismiss)
        });
      },
    });
  }

  private mutate(updater: (current: ConfigState) => ConfigState): void {
    this.cfg.update(updater);
    this.dirty.set(true);
  }

  protected setBasics(
    patch: Partial<
      Pick<
        ConfigState,
        'brideName' | 'groomName' | 'tagline' | 'date' | 'rsvpDeadline' | 'country' | 'city'
      >
    >,
  ): void {
    this.mutate((c) => ({ ...c, ...patch }));
  }

  protected setLanguageLabel(code: LangCode, value: string): void {
    this.mutate((c) => ({ ...c, language: { ...c.language, [code]: value } }));
  }

  // ── The couple (bride/groom accounts) — from userCollection ──

  protected findPerson(role: CoupleRole): UserDto | undefined {
    const profiles = this.coupleProfiles();
    return role === 'bride' ? profiles.bride : profiles.groom;
  }

  protected setPerson(id: string, patch: Partial<UserDto>): void {
    const profiles = this.coupleProfiles();
    const existing =
      profiles.bride?.id === id
        ? profiles.bride
        : profiles.groom?.id === id
          ? profiles.groom
          : undefined;
    if (existing) {
      const updated: UserDto = { ...existing, ...patch };
      this.userCollection.upsert(updated);
    }
  }
  protected addPerson(role: string): void {
    this.createModalRole.set(role as CoupleRole);
    this.createModalData.set({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      preferredLang: 'es',
    });
    this.createModalFieldErrors.set({
      firstName: null,
      lastName: null,
      email: null,
      phoneNumber: null,
    });
    this.createModalError.set(null);
    this.createModalOpen.set(true);
  }

  protected removePerson(id: string): void {
    this.userCollection.delete(id);
  }

  protected closeCreateModal(): void {
    this.createModalOpen.set(false);
    this.createModalRole.set(null);
    this.createModalData.set({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      preferredLang: 'es',
    });
    this.createModalError.set(null);
    this.createModalLoading.set(false);
  }

  protected setCreateModalField(field: keyof UserDto, value: string): void {
    this.createModalData.update((data) => ({ ...data, [field]: value }));
    this.validateCreateModalField(field, value);
  }

  protected validateCreateModalField(field: keyof UserDto, value: string): void {
    let error: string | null = null;

    if (field === 'email' && value.trim()) {
      if (!this.isValidEmail(value)) {
        error = 'Invalid email format';
      }
    } else if (field === 'phoneNumber' && value.trim()) {
      if (!this.isValidPhoneNumber(value)) {
        error = 'Invalid phone number format';
      }
    }

    this.createModalFieldErrors.update((errors) => ({
      ...errors,
      [field]: error,
    }));
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  private isValidPhoneNumber(phone: string): boolean {
    // International phone format: +XX XXXX XXXX... (+ followed by country code, then digits and spaces)
    const phoneRegex = /^\+?[1-9]\d{1,14}(\s|-)?\d*$/;
    return phoneRegex.test(phone.replace(/[\s()-]/g, ''));
  }

  protected submitCreateModal(): void {
    const role = this.createModalRole();
    const data = this.createModalData();
    if (!role || !data.firstName?.trim() || !data.lastName?.trim()) {
      this.createModalError.set('First and last names are required');
      return;
    }

    this.createModalLoading.set(true);
    this.createModalError.set(null);

    const newPerson: UserDto = {
      id: uid(),
      version: 0,
      role: role,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email?.trim() || undefined,
      phoneNumber: data.phoneNumber?.trim() || '',
      preferredLang: data.preferredLang,
    };

    this.userCollection.add(newPerson).subscribe({
      next: () => {
        this.createModalLoading.set(false);
        this.closeCreateModal();
      },
      error: (error: DataServiceError) => {
        this.createModalLoading.set(false);
        console.error('Failed to create account:', error);
        this.createModalError.set(
          error?.error?.error?.message?.message || 'Failed to create account',
        );
      },
    });
  }

  protected onCreateModalBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeCreateModal();
    }
  }

  protected coupleInitials(person: UserDto): string {
    const first = person.firstName.charAt(0) || '?';
    const last = person.lastName.charAt(0) || '';
    return (first + last).toUpperCase();
  }

  protected coupleFullName(person: UserDto): string | null {
    const name = [person.firstName, person.lastName].filter(Boolean).join(' ');
    return name || null;
  }

  /** "Send sign-in link" (active accounts) / "Resend invitation" (invited). */
  protected sendCoupleInvite(person: UserDto): void {
    if (!person.email) {
      this.magicLinkError.set('Email is missing for this account');
      return;
    }

    this.magicLinkLoading.set(person.id);
    this.magicLinkError.set(null);
    this.magicLinkSuccess.set(null);

    this.loginService
      .requestMagicLink(person.email)
      .then(() => {
        this.magicLinkLoading.set(null);
        this.magicLinkSuccess.set({
          userId: person.id,
          message: 'Sign-in link sent to ' + person.email,
        });
        clearTimeout(this.magicLinkSuccessTimer);
        this.magicLinkSuccessTimer = setTimeout(() => {
          this.magicLinkSuccess.set(null);
        }, 3000);
      })
      .catch((error) => {
        this.magicLinkLoading.set(null);
        this.magicLinkError.set(error?.message || 'Failed to send magic link');
      });
  }

  /** "Suspend access" (active → invited) / "Mark as active" (invited → active). */
  protected toggleCoupleStatus(person: UserDto): void {
    void person; // TODO: Implement via API endpoint once available
  }

  protected setVenue(id: string, patch: Partial<Venue>): void {
    this.mutate((c) => ({
      ...c,
      venues: c.venues.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    }));
  }

  protected setAgendaTime(id: string, value: string): void {
    this.mutate((c) => ({
      ...c,
      agenda: {
        ...c.agenda,
        items: c.agenda.items.map((a) =>
          a.id === id ? { ...a, time: this.mergeHourIntoIso(a.time, value) } : a,
        ),
      },
    }));
  }

  /** Bare-hour text-field value for the agenda `time` ISO datetime. */
  protected timeInputValue(iso: string | undefined): string {
    return extractAgendaTime(iso);
  }

  /**
   * Splice a typed "HH:MM" back into the item's ISO datetime, preserving its
   * existing date portion (falling back to the wedding date, then epoch). This
   * keeps the stored value a valid ISO datetime for the API while the UI only
   * ever exposes the hour. An unparseable entry is kept verbatim so a partial
   * edit isn't silently discarded.
   */
  private mergeHourIntoIso(existing: string, typed: string): string {
    const hhmm = /^(\d{1,2}):(\d{2})$/.exec(typed.trim());
    if (!hhmm) return typed.trim();
    const hh = hhmm[1].padStart(2, '0');
    const mm = hhmm[2];
    const datePart =
      this.isoDatePart(existing) ?? this.isoDatePart(this.cfg().date) ?? '1970-01-01';
    return `${datePart}T${hh}:${mm}:00.000Z`;
  }

  private isoDatePart(iso: string | undefined): string | null {
    if (!iso) return null;
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
    return match ? match[1] : null;
  }

  protected setAgendaVenue(id: string, venueId: string): void {
    this.mutate((c) => ({
      ...c,
      agenda: {
        ...c.agenda,
        items: c.agenda.items.map((a) => (a.id === id ? { ...a, venueId } : a)),
      },
    }));
  }

  protected setAgendaStatus(id: string, status: AgendaItem['status']): void {
    this.mutate((c) => ({
      ...c,
      agenda: {
        ...c.agenda,
        items: c.agenda.items.map((a) => (a.id === id ? { ...a, status } : a)),
      },
    }));
  }

  /** Overall schedule status (`provisional` | `final`) — the agenda root, not
   *  a single item; drives the "Schedule status" toggle. */
  protected setScheduleStatus(status: ConfigState['agenda']['status']): void {
    this.mutate((c) => ({ ...c, agenda: { ...c.agenda, status } }));
  }

  protected setAgendaText(
    id: string,
    field: 'title' | 'desc',
    lang: LangCode,
    value: string,
  ): void {
    this.mutate((c) => ({
      ...c,
      agenda: {
        ...c.agenda,
        items: c.agenda.items.map((a) =>
          a.id === id ? { ...a, [field]: { ...a[field], [lang]: value } } : a,
        ),
      },
    }));
  }

  /** "Key moment" toggle — what the guest home screen surfaces (`invitee.html`
   *  filters on `highlight`); `screens/schedule` shows every item regardless. */
  protected setAgendaHighlight(id: string, highlight: boolean): void {
    this.mutate((c) => ({
      ...c,
      agenda: {
        ...c.agenda,
        items: c.agenda.items.map((a) => (a.id === id ? { ...a, highlight } : a)),
      },
    }));
  }

  protected addAgenda(): void {
    const firstVenueId = this.cfg().venues[0]?.id ?? null;
    const newItem: AgendaItem = {
      id: ulid(),
      status: 'planned',
      // Seeded with a real datetime, not `''`: `time` is a required
      // `z.iso.datetime()` on the API (`AgendaItemSchema`), so an item the
      // admin adds and never types an hour into would otherwise fail
      // validation and take the whole config save down with it.
      time: this.mergeHourIntoIso('', DEFAULT_AGENDA_TIME),
      venueId: firstVenueId,
      highlight: false,
      title: emptyLangText(),
      desc: emptyLangText(),
    };
    this.mutate((c) => ({
      ...c,
      agenda: { ...c.agenda, items: [...c.agenda.items, newItem] },
    }));
  }

  protected removeAgenda(id: string): void {
    this.mutate((c) => ({
      ...c,
      agenda: { ...c.agenda, items: c.agenda.items.filter((a) => a.id !== id) },
    }));
  }

  protected setHotel(id: string, patch: Partial<Hotel>): void {
    this.mutate((c) => ({
      ...c,
      hotels: c.hotels.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    }));
  }

  protected addHotel(): void {
    this.mutate((c) => ({
      ...c,
      hotels: [
        ...c.hotels,
        { id: ulid(), name: '', priceTier: '€€', distanceKm: 0, bookingUrl: '', photoKey: null },
      ],
    }));
  }

  protected removeHotel(id: string): void {
    this.mutate((c) => ({ ...c, hotels: c.hotels.filter((h) => h.id !== id) }));
  }

  protected setTagLabel(
    collection: TagCollection,
    id: string,
    lang: LangCode,
    value: string,
  ): void {
    this.mutate((c) => ({
      ...c,
      [collection]: c[collection].map((tag: DietTag) =>
        tag.id === id ? { ...tag, label: { ...tag.label, [lang]: value } } : tag,
      ),
    }));
  }

  // Adding an option happens inline (T297): the trailing "+ Add option" input
  // commits its typed text into all three languages as a starting point —
  // each is then edited inline, per-language, on its own row.
  protected addTag(collection: TagCollection, text = ''): void {
    this.mutate((c) => ({
      ...c,
      [collection]: [...c[collection], { id: uid(), label: { es: text, en: text, fr: text } }],
    }));
  }

  protected removeTag(collection: TagCollection, id: string): void {
    this.mutate((c) => ({
      ...c,
      [collection]: c[collection].filter((tag: DietTag) => tag.id !== id),
    }));
  }

  protected setDraftTag(collection: TagCollection, value: string): void {
    this.draftTag.update((draft) => ({ ...draft, [collection]: value }));
  }

  protected commitDraftTag(collection: TagCollection): void {
    const text = this.draftTag()[collection].trim();
    this.draftTag.update((draft) => ({ ...draft, [collection]: '' }));
    if (!text) return;
    this.addTag(collection, text);
  }

  protected setTheme(themeId: ThemeId): void {
    this.mutate((c) => ({ ...c, themeId: themeId as ConfigState['themeId'] }));
  }

  // ── Good to know mutators (hub ADR-0046 §2/§3, T376) ──────────────────────

  /** Template-facing casts (see the `as*` helpers above): the generated
   *  union's `type` is a plain `string`, so `@switch (block.type)` narrows
   *  nothing and each branch reaches its fields through one of these. */
  protected dressCode(block: GoodToKnowBlock): CreateWeddingConfigDtoGoodToKnowInnerOneOf {
    return asDressCode(block);
  }
  protected gift(block: GoodToKnowBlock): CreateWeddingConfigDtoGoodToKnowInnerOneOf1 {
    return asGift(block);
  }
  protected faqOf(block: GoodToKnowBlock): CreateWeddingConfigDtoGoodToKnowInnerOneOf2 {
    return asFaq(block);
  }
  protected contactsOf(block: GoodToKnowBlock): CreateWeddingConfigDtoGoodToKnowInnerOneOf3 {
    return asContacts(block);
  }
  protected dayLineOf(block: GoodToKnowBlock): CreateWeddingConfigDtoGoodToKnowInnerOneOf4 {
    return asDayLine(block);
  }
  protected noteOf(block: GoodToKnowBlock): CreateWeddingConfigDtoGoodToKnowInnerOneOf5 {
    return asNote(block);
  }

  /** A localized value off any block, by field name — the read half of
   *  `setBlockLocale`, so the template's language rows stay one generic
   *  chunk instead of a per-field copy. */
  protected blockLocaleValue(block: GoodToKnowBlock, field: string, lang: LangCode): string {
    const record = block as unknown as Record<string, LangDescriptionType | undefined>;
    return record[field]?.[lang] ?? '';
  }

  private mutateGoodToKnow(
    updater: (blocks: readonly GoodToKnowBlock[]) => GoodToKnowBlock[],
  ): void {
    this.mutate((c) => ({ ...c, goodToKnow: updater(c.goodToKnow ?? []) }));
  }

  private updateBlock(id: string, updater: (block: GoodToKnowBlock) => GoodToKnowBlock): void {
    this.mutateGoodToKnow((blocks) =>
      blocks.map((block) => (block.id === id ? updater(block) : block)),
    );
  }

  /**
   * One typed value pre-fills all three locales (hub ADR-0031's ergonomics,
   * T376): an edit in the primary language mirrors into every locale that
   * still tracked the primary's previous value (or was empty) and leaves a
   * locale the couple customized alone — the stateless equivalent of the
   * milestones form's `customizedLocales` set, applied to draft state that
   * lives on the config document itself. An edit in a non-primary language
   * only ever writes that language (and thereby stops its mirroring).
   */
  private mergeLocalized(
    current: LangDescriptionType | undefined,
    lang: LangCode,
    value: string,
  ): LangDescriptionType {
    const previous = current ?? emptyLangText();
    if (lang !== this.goodToKnowLang()) return { ...previous, [lang]: value };
    const before = previous[lang];
    const next: LangDescriptionType = { ...previous, [lang]: value };
    for (const other of EDIT_LANGS) {
      if (other !== lang && (previous[other] === before || previous[other].trim() === '')) {
        next[other] = value;
      }
    }
    return next;
  }

  /** Write one locale of a localized field on a block. The record cast stays
   *  within the block's own shape — same workaround as the `as*` helpers. */
  protected setBlockLocale(id: string, field: string, lang: LangCode, value: string): void {
    this.updateBlock(id, (block) => {
      const record = block as unknown as Record<string, LangDescriptionType | undefined>;
      return {
        ...block,
        [field]: this.mergeLocalized(record[field], lang, value),
      } as GoodToKnowBlock;
    });
  }

  /** Identifier fields are single plain strings, byte-identical in every
   *  locale (ADR-0046 §5 / hard rule 19a) — never localized, never
   *  reformatted. An emptied input stores `undefined`: a field the couple
   *  left empty is not a row (§2). */
  protected setBlockIdentifier(id: string, field: string, value: string): void {
    this.updateBlock(id, (block) => {
      return { ...block, [field]: value === '' ? undefined : value } as GoodToKnowBlock;
    });
  }

  protected addGoodToKnowBlock(type: string): void {
    if (!this.addableBlockTypes().includes(type)) return;
    const base = { id: uid(), type, title: emptyLangText() };
    let block: GoodToKnowBlock;
    switch (type) {
      case 'dress-code':
        block = { ...base, headline: emptyLangText(), body: emptyLangText() };
        break;
      case 'gift':
        block = base as GoodToKnowBlock;
        break;
      case 'faq':
        // Seeded at the 3-entry floor (§2): the couple fills them rather than
        // discovering the minimum at save time.
        block = {
          ...base,
          entries: Array.from({ length: FAQ_MIN_ENTRIES }, () => this.emptyFaqEntry()),
        };
        break;
      case 'contacts':
        block = { ...base, entries: [this.emptyContactEntry()] };
        break;
      case 'day-line':
        block = {
          ...base,
          rsvpOpen: emptyLangText(),
          rsvpClosed: emptyLangText(),
          afterWedding: emptyLangText(),
        };
        break;
      default:
        block = { ...base, body: emptyLangText() };
    }
    this.mutateGoodToKnow((blocks) => [...blocks, block]);
  }

  protected removeGoodToKnowBlock(id: string): void {
    this.mutateGoodToKnow((blocks) => blocks.filter((block) => block.id !== id));
  }

  /** Reorder by one step — the saved order is what guests read (§3). */
  protected moveGoodToKnowBlock(id: string, delta: -1 | 1): void {
    this.mutateGoodToKnow((blocks) => {
      const index = blocks.findIndex((block) => block.id === id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= blocks.length) return [...blocks];
      const next = [...blocks];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  private emptyFaqEntry(): FaqEntry {
    return { id: uid(), question: emptyLangText(), answer: emptyLangText() };
  }

  private emptyContactEntry(): ContactEntry {
    return { id: uid(), firstName: '', purpose: emptyLangText() };
  }

  protected addFaqEntry(blockId: string): void {
    this.updateBlock(blockId, (block) => {
      const faq = asFaq(block);
      if (faq.entries.length >= FAQ_MAX_ENTRIES) return block;
      return { ...faq, entries: [...faq.entries, this.emptyFaqEntry()] };
    });
  }

  protected removeFaqEntry(blockId: string, entryId: string): void {
    this.updateBlock(blockId, (block) => {
      const faq = asFaq(block);
      return { ...faq, entries: faq.entries.filter((entry) => entry.id !== entryId) };
    });
  }

  protected setFaqEntryText(
    blockId: string,
    entryId: string,
    field: 'question' | 'answer',
    lang: LangCode,
    value: string,
  ): void {
    this.updateBlock(blockId, (block) => {
      const faq = asFaq(block);
      return {
        ...faq,
        entries: faq.entries.map((entry) =>
          entry.id === entryId
            ? { ...entry, [field]: this.mergeLocalized(entry[field], lang, value) }
            : entry,
        ),
      };
    });
  }

  protected addContactEntry(blockId: string): void {
    this.updateBlock(blockId, (block) => {
      const contacts = asContacts(block);
      if (contacts.entries.length >= CONTACTS_MAX_ENTRIES) return block;
      return { ...contacts, entries: [...contacts.entries, this.emptyContactEntry()] };
    });
  }

  protected removeContactEntry(blockId: string, entryId: string): void {
    this.updateBlock(blockId, (block) => {
      const contacts = asContacts(block);
      return { ...contacts, entries: contacts.entries.filter((entry) => entry.id !== entryId) };
    });
  }

  /** A contact's name and number are identifiers (§5, Amendment 2 §B):
   *  plain strings, the same in every locale. Optional ones store
   *  `undefined` when emptied so the renderer's "no number, no call button"
   *  rule sees a genuinely absent field. */
  protected setContactField(
    blockId: string,
    entryId: string,
    field: 'firstName' | 'lastName' | 'phoneNumber',
    value: string,
  ): void {
    this.updateBlock(blockId, (block) => {
      const contacts = asContacts(block);
      return {
        ...contacts,
        entries: contacts.entries.map((entry) =>
          entry.id === entryId
            ? { ...entry, [field]: field !== 'firstName' && value === '' ? undefined : value }
            : entry,
        ),
      };
    });
  }

  protected setContactPurpose(
    blockId: string,
    entryId: string,
    lang: LangCode,
    value: string,
  ): void {
    this.updateBlock(blockId, (block) => {
      const contacts = asContacts(block);
      return {
        ...contacts,
        entries: contacts.entries.map((entry) =>
          entry.id === entryId
            ? { ...entry, purpose: this.mergeLocalized(entry.purpose, lang, value) }
            : entry,
        ),
      };
    });
  }

  /**
   * The save payload: the draft with every never-written optional localized
   * field dropped (three blank strings are not "a value in all three
   * locales") and blank identifiers normalized to absent. Required fields are
   * untouched — a half-built block never gets this far (`saveBlocked`).
   */
  private sanitizedConfig(): ConfigState {
    const goodToKnow = this.cfg().goodToKnow;
    if (!goodToKnow) return this.cfg();
    const dropBlank = (value: LangDescriptionType | undefined): LangDescriptionType | undefined =>
      allBlank(value) ? undefined : value;
    const sanitized = goodToKnow.map((block) => {
      switch (block.type) {
        case 'dress-code': {
          const dressCode = asDressCode(block);
          return { ...dressCode, note: dropBlank(dressCode.note) };
        }
        case 'gift': {
          const gift = asGift(block);
          return {
            ...gift,
            intro: dropBlank(gift.intro),
            reference: dropBlank(gift.reference),
            bizumNote: dropBlank(gift.bizumNote),
            accountHolder: gift.accountHolder?.trim() === '' ? undefined : gift.accountHolder,
            iban: gift.iban?.trim() === '' ? undefined : gift.iban,
            bic: gift.bic?.trim() === '' ? undefined : gift.bic,
            bizumPhone: gift.bizumPhone?.trim() === '' ? undefined : gift.bizumPhone,
          };
        }
        default:
          return block;
      }
    });
    return { ...this.cfg(), goodToKnow: sanitized };
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected inputNumber(event: Event): number {
    return Number((event.target as HTMLInputElement).value);
  }

  protected selectValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected dateInputValue(dateString: string | undefined): string {
    if (!dateString) return '';
    return dateString.split('T')[0];
  }
}
