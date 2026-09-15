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
  CreateWeddingConfigDtoGeneralInfo,
  CreateWeddingConfigDtoGeneralInfoContact,
  CreateWeddingConfigDtoGeneralInfoContactGuestInner,
  CreateWeddingConfigDtoGeneralInfoContactWeddingPlannerInner,
  CreateWeddingConfigDtoGeneralInfoDayLine,
  CreateWeddingConfigDtoGeneralInfoDressCode,
  CreateWeddingConfigDtoGeneralInfoFaqInner,
  CreateWeddingConfigDtoGeneralInfoGift,
  CreateWeddingConfigDtoGeneralInfoNoteInner,
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

// ── Good to know (hub ADR-0047 §1/§2, T384) ─────────────────────────────────
// `generalInfo` is an **object of named sections**, so this is one editor per
// section rather than a block builder. Everything the array needed in order
// to be safe went with the array (ADR-0047 §1): no block ids, no singleton
// enforcement, no uniqueness refinement, no 12-block ceiling, no closed
// `type` enum. A seventh kind of content would be a new optional field here,
// not a new member of anything.
//
// Every alias resolves to a generated model (hard rule 15) — a regenerated
// client that reshapes a section is a compile error in this file, not drift.
type GeneralInfo = CreateWeddingConfigDtoGeneralInfo;
type GiDressCode = CreateWeddingConfigDtoGeneralInfoDressCode;
type GiGift = CreateWeddingConfigDtoGeneralInfoGift;
type GiContact = CreateWeddingConfigDtoGeneralInfoContact;
type GiDayLine = CreateWeddingConfigDtoGeneralInfoDayLine;
type FaqEntry = CreateWeddingConfigDtoGeneralInfoFaqInner;
type NoteEntry = CreateWeddingConfigDtoGeneralInfoNoteInner;
type PlannerContact = CreateWeddingConfigDtoGeneralInfoContactWeddingPlannerInner;
type GuestContact = CreateWeddingConfigDtoGeneralInfoContactGuestInner;

/**
 * The field names each fixed section offers, derived from the generated
 * shapes rather than retyped: `Extract` keeps the list honest, because a
 * field the contract renames drops out of the union and every template
 * binding still passing the old name stops compiling.
 *
 * Splitting `gift` in two is ADR-0046 §5 (kept by ADR-0047 §6) expressed in
 * the type system: `intro`/`reference`/`bizumNote` are prose and localized,
 * while `accountHolder`/`iban`/`bic`/`bizumPhone` are **identifiers** — one
 * input, one stored value, byte-identical in all three locales.
 */
type DressCodeField = keyof GiDressCode;
type DayLineField = keyof GiDayLine;
type GiftProseField = Extract<keyof GiGift, 'intro' | 'reference' | 'bizumNote'>;
type GiftIdField = Extract<keyof GiGift, 'accountHolder' | 'iban' | 'bic' | 'bizumPhone'>;

/**
 * §1's only surviving bounds: `faq` and `note` hold 1-10 entries each. The
 * floor needs no control — an emptied array is dropped from the payload
 * rather than sent as `[]` — so only the ceiling has one, and it withholds
 * the add button instead of letting the API 400.
 */
const FAQ_MAX_ENTRIES = 10;
const NOTE_MAX_ENTRIES = 10;

/** All three locales carry non-blank text — what "complete" means for a
 *  required localized field (ADR-0031: three values, not three *distinct*
 *  values, which is what makes the pre-fill below legitimate). */
const allFilled = (value: LangDescriptionType | undefined): boolean =>
  !!value && ['es', 'en', 'fr'].every((lang) => value[lang as LangCode].trim() !== '');

/** Every locale blank — an optional localized field the couple never wrote,
 *  dropped from the save payload rather than sent as three empty strings. */
const allBlank = (value: LangDescriptionType | undefined): boolean =>
  !value || ['es', 'en', 'fr'].every((lang) => value[lang as LangCode].trim() === '');

/** An identifier the couple never wrote. Absence only: the value itself is
 *  never trimmed or reformatted on its way to the API (hard rule 19a). */
const blankIdentifier = (value: string | undefined): boolean => (value ?? '').trim() === '';

/**
 * The USER digest ADR-0047 §2 stores for a contact: picked off the account,
 * never typed here. `role` comes from the account too — the API narrows it to
 * a literal per list (`weddingPlannerDigestSchema` / `guestDigestSchema`), so
 * the group a person is added to and the role stored for them are one fact
 * read once rather than two that can disagree.
 */
const contactDigest = (account: UserDto): PlannerContact => ({
  id: account.id,
  role: account.role,
  firstName: account.firstName,
  lastName: account.lastName,
  email: account.email,
  phoneNumber: account.phoneNumber,
});

/** Deterministic, locale-independent ordering for the two picker lists — a
 *  sort key, never rendered, and deliberately not `localeCompare`. */
const byAccountName = (a: UserDto, b: UserDto): number => {
  const key = (user: UserDto): string => `${user.lastName} ${user.firstName}`;
  return key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
};

/** One row of the section's "cannot save yet" message list: which section it
 *  is about (the i18n key of that section's own label) and why. */
interface GoodToKnowIssue {
  readonly key: string;
  readonly section: string;
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
    // A half-built Good to know section withholds Save for the whole
    // document (one PATCH carries every section) — say so instead of showing
    // a mutely disabled button from another section.
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

  // ── Good to know (hub ADR-0047 §1/§2, T384) ───────────────────────────────

  private readonly translateLanguage = inject(TranslateLanguageService);

  /** The one language typed by default; the other two sit behind each card's
   *  disclosure (ADR-0031's ergonomics, kept verbatim through the reshape). */
  protected readonly goodToKnowLang = this.translateLanguage.currentLang;

  /** The draft's `generalInfo`. Never `undefined` for reading — an absent
   *  section is simply an absent field, which every reader resolves to `''`;
   *  the attribute itself stays optional on the way out (§1). */
  protected readonly generalInfo = computed<GeneralInfo>(() => this.cfg().generalInfo ?? {});

  protected readonly faqEntries = computed<readonly FaqEntry[]>(() => this.generalInfo().faq ?? []);
  protected readonly noteEntries = computed<readonly NoteEntry[]>(
    () => this.generalInfo().note ?? [],
  );
  protected readonly plannerContacts = computed<readonly PlannerContact[]>(
    () => this.generalInfo().contact?.weddingPlanner ?? [],
  );
  protected readonly guestContacts = computed<readonly GuestContact[]>(
    () => this.generalInfo().contact?.guest ?? [],
  );

  protected readonly faqMaxEntries = FAQ_MAX_ENTRIES;
  protected readonly noteMaxEntries = NOTE_MAX_ENTRIES;

  /** Field lists for the sections whose editors are a plain repetition of
   *  one localized row. Typed off the generated shapes, so a contract rename
   *  breaks the loop rather than silently editing nothing. */
  protected readonly dressCodeFields: readonly DressCodeField[] = ['headline', 'body', 'note'];
  protected readonly dayLineFields: readonly DayLineField[] = [
    'rsvpOpen',
    'rsvpClosed',
    'afterWedding',
  ];
  protected readonly giftBankFields: readonly GiftIdField[] = ['accountHolder', 'iban', 'bic'];

  /**
   * Everyone who holds an account, from the `User` collection this screen
   * already loads for the couple section. **A contact is a person with an
   * account** (ADR-0047 §2): this screen picks from that list and never
   * creates one — a person with no account is added as a guest first, in the
   * guest manager, and appears here on the next read.
   */
  private readonly accounts: Signal<readonly UserDto[]> = toSignal(this.userCollection.entities$, {
    initialValue: [] as UserDto[],
  });

  /** The two pickers' pending selection — draft UI state, committed by the
   *  add button beside each, and cleared so the select falls back to its
   *  placeholder once the person has moved into the list. */
  protected readonly plannerPick = signal('');
  protected readonly guestPick = signal('');

  private addableAccounts(
    role: UserDto.RoleEnum,
    picked: readonly { id: string }[],
  ): readonly UserDto[] {
    const already = new Set(picked.map((entry) => entry.id));
    return this.accounts()
      .filter((account) => account.role === role && !already.has(account.id))
      .slice()
      .sort(byAccountName);
  }

  protected readonly addablePlanners = computed<readonly UserDto[]>(() =>
    this.addableAccounts(UserDto.RoleEnum.WEDDING_PLANNER, this.plannerContacts()),
  );
  protected readonly addableGuests = computed<readonly UserDto[]>(() =>
    this.addableAccounts(UserDto.RoleEnum.GUEST, this.guestContacts()),
  );

  /** Cards whose EN/FR rows are disclosed, keyed by section (`'dressCode'`,
   *  `'gift'`, `'dayLine'`) or by section and entry id (`'faq:<ulid>'`).
   *  Not block bookkeeping: nothing is stored, ordered or sent from here —
   *  it is which disclosure the couple has open, and it dies with the page. */
  private readonly openLocaleCards = signal<ReadonlySet<string>>(new Set());

  protected isLocalesOpen(card: string): boolean {
    return this.openLocaleCards().has(card);
  }

  protected toggleLocales(card: string): void {
    this.openLocaleCards.update((open) => {
      const next = new Set(open);
      if (next.has(card)) next.delete(card);
      else next.add(card);
      return next;
    });
  }

  /** The languages a localized field shows rows for: just the primary until
   *  the card's disclosure is open, then all three. */
  protected visibleLangs(card: string): readonly LangCode[] {
    return this.isLocalesOpen(card) ? EDIT_LANGS : [this.goodToKnowLang()];
  }

  // Readers. Every section is optional and every one of them resolves to the
  // empty string when absent, so the editor renders the same whether the
  // couple has written a section or not — which is the whole of the presence
  // mechanism: a section exists because it has content, and there is no
  // add/remove control for one.

  protected dressCodeText(field: DressCodeField, lang: LangCode): string {
    return this.generalInfo().dressCode?.[field]?.[lang] ?? '';
  }

  protected giftText(field: GiftProseField, lang: LangCode): string {
    return this.generalInfo().gift?.[field]?.[lang] ?? '';
  }

  protected giftIdentifier(field: GiftIdField): string {
    return this.generalInfo().gift?.[field] ?? '';
  }

  protected dayLineText(field: DayLineField, lang: LangCode): string {
    return this.generalInfo().dayLine?.[field]?.[lang] ?? '';
  }

  /**
   * Whether a singleton section has been written at all. An all-blank section
   * is not "a half-built section" — it is a section the couple does not have,
   * so it raises no issue and never reaches the payload. This is what lets
   * the fixed-shape editor drop the array's add/remove controls entirely.
   */
  private dressCodeWritten(dressCode: GiDressCode): boolean {
    return !(allBlank(dressCode.headline) && allBlank(dressCode.body) && allBlank(dressCode.note));
  }

  private dayLineWritten(dayLine: GiDayLine): boolean {
    return !this.dayLineFields.every((field) => allBlank(dayLine[field]));
  }

  private giftWritten(gift: GiGift): boolean {
    const prose = allBlank(gift.intro) && allBlank(gift.reference) && allBlank(gift.bizumNote);
    const identifiers =
      blankIdentifier(gift.accountHolder) &&
      blankIdentifier(gift.iban) &&
      blankIdentifier(gift.bic) &&
      blankIdentifier(gift.bizumPhone);
    return !(prose && identifiers);
  }

  /**
   * Why the draft cannot be saved yet, one row per offending section. What is
   * checked is per-section completeness, not cardinality: with ordering
   * structural and presence derived from content, the only ways to be
   * half-built are a required localized field missing a locale, an optional
   * one filled in some locales and not others, and a guest contact with no
   * `purpose` — the field that makes this section "who to call **about
   * what**" (ADR-0047 §2) rather than a list of names.
   */
  protected readonly goodToKnowIssues = computed<readonly GoodToKnowIssue[]>(() => {
    const info = this.generalInfo();
    const issues: GoodToKnowIssue[] = [];
    const incomplete = (section: string): void => {
      issues.push({ key: 'configManager.goodToKnow.issue.incomplete', section });
    };

    const dressCode = info.dressCode;
    if (dressCode && this.dressCodeWritten(dressCode)) {
      const note = dressCode.note;
      const complete =
        allFilled(dressCode.headline) &&
        allFilled(dressCode.body) &&
        (allBlank(note) || allFilled(note));
      if (!complete) incomplete('configManager.goodToKnow.dressCode.title');
    }

    // Every gift field is optional, so only a *partially* localized prose
    // field is an error — an all-blank one is dropped from the payload.
    const gift = info.gift;
    if (gift) {
      const halfWritten = [gift.intro, gift.reference, gift.bizumNote].some(
        (field) => !allBlank(field) && !allFilled(field),
      );
      if (halfWritten) incomplete('configManager.goodToKnow.gift.title');
    }

    if (this.guestContacts().some((entry) => !allFilled(entry.purpose)))
      issues.push({
        key: 'configManager.goodToKnow.issue.purposeMissing',
        section: 'configManager.goodToKnow.contact.title',
      });

    if (this.faqEntries().some((entry) => !allFilled(entry.question) || !allFilled(entry.answer)))
      incomplete('configManager.goodToKnow.faq.title');

    const dayLine = info.dayLine;
    if (
      dayLine &&
      this.dayLineWritten(dayLine) &&
      !this.dayLineFields.every((field) => allFilled(dayLine[field]))
    )
      incomplete('configManager.goodToKnow.dayLine.title');

    if (this.noteEntries().some((entry) => !allFilled(entry.title) || !allFilled(entry.body)))
      incomplete('configManager.goodToKnow.note.title');

    return issues;
  });

  /** Save is withheld while any section is half-built — the whole document
   *  goes up in one PATCH, so an invalid section would take every other
   *  section's edits down with it. */
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
    // Defensive twin of the disabled buttons: a half-built Good to know
    // section must not reach the API.
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

  /** Every Basics field *except* the two names, which need `couple` written
   *  alongside the deprecated pair — `setCoupleFirstName` below, and no other
   *  path (T392). */
  protected setBasics(
    patch: Partial<
      Pick<ConfigState, 'tagline' | 'date' | 'rsvpDeadline' | 'country' | 'city'>
    >,
  ): void {
    this.mutate((c) => ({ ...c, ...patch }));
  }

  /**
   * Basics' bride/groom name fields (T392). `GET /v1/config` derives the two
   * displayed names from `couple.<role>.firstName` whenever the row has a
   * `couple`, falling back to the deprecated pair when it does not
   * (`wedding-api` T252) — so writing `brideName`/`groomName` alone changes
   * nothing any surface reads. Write **both**, until ADR-0037's contract phase
   * drops the pair.
   *
   * The whole `couple` object goes up, not the one changed field:
   * `updateWeddingConfig` merges shallowly (`{ ...config, ...update }`), so a
   * partial `couple` *replaces* the stored one and drops `id`, `lastName`,
   * `email` and `phoneNumber`.
   *
   * With no stored `couple` the deprecated field travels alone: `coupleSchema`
   * requires `id`, `lastName` and `phoneNumber`, so a valid `couple` cannot be
   * built from a first name and inventing one would 400 the whole PATCH.
   * Production has a `couple`; a fresh or seeded environment may not.
   *
   * What this is **not**: a refresh of `couple` from the bride's and groom's
   * USER documents. That staleness — why editing a name under "The couple"
   * still changes nothing — is deferred by hub ADR-0047 Amendment 4, as one
   * pattern with the contacts digests rather than a patch to one field.
   */
  protected setCoupleFirstName(role: CoupleRole, firstName: string): void {
    this.mutate((c) => {
      const deprecated = role === 'bride' ? { brideName: firstName } : { groomName: firstName };
      const couple = c.couple;
      if (!couple) return { ...c, ...deprecated };
      return {
        ...c,
        ...deprecated,
        couple: { ...couple, [role]: { ...couple[role], firstName } },
      };
    });
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

  // ── Good to know mutators (hub ADR-0047 §1/§2, T384) ──────────────────────

  private mutateGeneralInfo(updater: (info: GeneralInfo) => GeneralInfo): void {
    this.mutate((c) => ({ ...c, generalInfo: updater(c.generalInfo ?? {}) }));
  }

  /**
   * One typed value pre-fills all three locales (ADR-0031's ergonomics,
   * unchanged by ADR-0047): an edit in the primary language mirrors into
   * every locale that still tracked the primary's previous value (or was
   * empty) and leaves a locale the couple customized alone. An edit in a
   * non-primary language only ever writes that language, and thereby stops
   * its mirroring. Stateless — the "has this locale been customized" answer
   * is read back out of the values themselves, so it survives a reload the
   * way a component-local `Set` would not.
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

  protected setDressCodeText(field: DressCodeField, lang: LangCode, value: string): void {
    this.mutateGeneralInfo((info) => {
      const current: GiDressCode = info.dressCode ?? {
        headline: emptyLangText(),
        body: emptyLangText(),
      };
      return {
        ...info,
        dressCode: { ...current, [field]: this.mergeLocalized(current[field], lang, value) },
      };
    });
  }

  protected setGiftText(field: GiftProseField, lang: LangCode, value: string): void {
    this.mutateGeneralInfo((info) => {
      const current: GiGift = info.gift ?? {};
      return {
        ...info,
        gift: { ...current, [field]: this.mergeLocalized(current[field], lang, value) },
      };
    });
  }

  /** Identifiers are single plain strings, byte-identical in every locale
   *  (ADR-0046 §5 / hard rule 19a) — never localized, never reformatted, and
   *  stored exactly as typed, spacing and casing included. An emptied input
   *  stores `undefined`: a field the couple left empty is not a row. */
  protected setGiftIdentifier(field: GiftIdField, value: string): void {
    this.mutateGeneralInfo((info) => ({
      ...info,
      gift: { ...(info.gift ?? {}), [field]: value === '' ? undefined : value },
    }));
  }

  protected setDayLineText(field: DayLineField, lang: LangCode, value: string): void {
    this.mutateGeneralInfo((info) => {
      const current: GiDayLine = info.dayLine ?? {
        rsvpOpen: emptyLangText(),
        rsvpClosed: emptyLangText(),
        afterWedding: emptyLangText(),
      };
      return {
        ...info,
        dayLine: { ...current, [field]: this.mergeLocalized(current[field], lang, value) },
      };
    });
  }

  // ── FAQ and notes: the only two arrays left, and the only two ids ─────────
  // They are arrays because their entries are added and removed one at a
  // time; the ULID is minted here because `PATCH /v1/config` replaces the
  // whole array, so the id is the only thing that tracks a row across a
  // re-render (ADR-0047 §1). Nothing else in this section has one.

  protected addFaqEntry(): void {
    this.mutateGeneralInfo((info) => {
      const entries = info.faq ?? [];
      if (entries.length >= FAQ_MAX_ENTRIES) return info;
      return {
        ...info,
        faq: [...entries, { id: uid(), question: emptyLangText(), answer: emptyLangText() }],
      };
    });
  }

  protected removeFaqEntry(id: string): void {
    this.mutateGeneralInfo((info) => ({
      ...info,
      faq: (info.faq ?? []).filter((entry) => entry.id !== id),
    }));
  }

  protected setFaqText(
    id: string,
    field: 'question' | 'answer',
    lang: LangCode,
    value: string,
  ): void {
    this.mutateGeneralInfo((info) => ({
      ...info,
      faq: (info.faq ?? []).map((entry) =>
        entry.id === id
          ? { ...entry, [field]: this.mergeLocalized(entry[field], lang, value) }
          : entry,
      ),
    }));
  }

  protected addNoteEntry(): void {
    this.mutateGeneralInfo((info) => {
      const entries = info.note ?? [];
      if (entries.length >= NOTE_MAX_ENTRIES) return info;
      return {
        ...info,
        note: [...entries, { id: uid(), title: emptyLangText(), body: emptyLangText() }],
      };
    });
  }

  protected removeNoteEntry(id: string): void {
    this.mutateGeneralInfo((info) => ({
      ...info,
      note: (info.note ?? []).filter((entry) => entry.id !== id),
    }));
  }

  protected setNoteText(id: string, field: 'title' | 'body', lang: LangCode, value: string): void {
    this.mutateGeneralInfo((info) => ({
      ...info,
      note: (info.note ?? []).map((entry) =>
        entry.id === id
          ? { ...entry, [field]: this.mergeLocalized(entry[field], lang, value) }
          : entry,
      ),
    }));
  }

  // ── Contact: a picker, not a form (hub ADR-0047 §2) ───────────────────────
  // The couple chooses people who already hold accounts and types only the
  // `purpose` line, on guest entries. Names, emails and numbers come from the
  // account and there is no input for them here; a person with no account is
  // added as a guest first, and this screen never creates one.

  private mutateContact(updater: (contact: GiContact) => GiContact): void {
    this.mutateGeneralInfo((info) => ({ ...info, contact: updater(info.contact ?? {}) }));
  }

  protected addPlannerContact(): void {
    const account = this.addablePlanners().find((person) => person.id === this.plannerPick());
    if (!account) return;
    this.mutateContact((contact) => ({
      ...contact,
      weddingPlanner: [...(contact.weddingPlanner ?? []), contactDigest(account)],
    }));
    this.plannerPick.set('');
  }

  protected removePlannerContact(id: string): void {
    this.mutateContact((contact) => ({
      ...contact,
      weddingPlanner: (contact.weddingPlanner ?? []).filter((entry) => entry.id !== id),
    }));
  }

  /** A guest entry is the digest **plus `purpose`** — required by the
   *  contract and by the point of the section, so a freshly picked guest
   *  starts with an empty one and the save stays withheld until it is
   *  written in all three locales (ADR-0047 §2). */
  protected addGuestContact(): void {
    const account = this.addableGuests().find((person) => person.id === this.guestPick());
    if (!account) return;
    this.mutateContact((contact) => ({
      ...contact,
      guest: [...(contact.guest ?? []), { ...contactDigest(account), purpose: emptyLangText() }],
    }));
    this.guestPick.set('');
  }

  protected removeGuestContact(id: string): void {
    this.mutateContact((contact) => ({
      ...contact,
      guest: (contact.guest ?? []).filter((entry) => entry.id !== id),
    }));
  }

  protected setGuestPurpose(id: string, lang: LangCode, value: string): void {
    this.mutateContact((contact) => ({
      ...contact,
      guest: (contact.guest ?? []).map((entry) =>
        entry.id === id
          ? { ...entry, purpose: this.mergeLocalized(entry.purpose, lang, value) }
          : entry,
      ),
    }));
  }

  /**
   * The stored contact entry, re-read from the account it names. ADR-0047 §2
   * chose the digest over inline details so that a profile edit updates the
   * contact card — but `GET /v1/config/general-information` serves the stored
   * entry (T249 composes only the `couple` digest at read time), so the
   * freshest copy this editor can send is the one it re-reads at save. An
   * entry whose account is not in the list — deactivated, or simply not
   * loaded yet — travels back verbatim rather than blanked.
   */
  private refreshedPlanner(entry: PlannerContact): PlannerContact {
    const account = this.accounts().find((person) => person.id === entry.id);
    return account ? contactDigest(account) : entry;
  }

  /** The guest twin of `refreshedPlanner` — `purpose` is the couple's, not
   *  the account's, so it survives the refresh untouched. */
  private refreshedGuest(entry: GuestContact): GuestContact {
    const account = this.accounts().find((person) => person.id === entry.id);
    return account ? { ...contactDigest(account), purpose: entry.purpose } : entry;
  }

  /**
   * The save payload's `generalInfo`: each section included only if the
   * couple actually wrote it, with every never-written optional field
   * dropped rather than sent blank (three empty strings are not "a value in
   * all three locales", and an empty identifier fails the API's own length
   * bounds). A half-written section never gets this far — `saveBlocked`
   * withholds Save — so nothing here repairs content, it only decides
   * presence.
   */
  private sanitizedGeneralInfo(): GeneralInfo | undefined {
    const info = this.generalInfo();
    const sanitized: GeneralInfo = {};
    const dropBlank = (value: LangDescriptionType | undefined): LangDescriptionType | undefined =>
      allBlank(value) ? undefined : value;
    const dropEmpty = (value: string | undefined): string | undefined =>
      blankIdentifier(value) ? undefined : value;

    const dressCode = info.dressCode;
    if (dressCode && this.dressCodeWritten(dressCode)) {
      sanitized.dressCode = { ...dressCode, note: dropBlank(dressCode.note) };
    }

    const gift = info.gift;
    if (gift && this.giftWritten(gift)) {
      sanitized.gift = {
        intro: dropBlank(gift.intro),
        accountHolder: dropEmpty(gift.accountHolder),
        iban: dropEmpty(gift.iban),
        bic: dropEmpty(gift.bic),
        reference: dropBlank(gift.reference),
        bizumPhone: dropEmpty(gift.bizumPhone),
        bizumNote: dropBlank(gift.bizumNote),
      };
    }

    const weddingPlanner = this.plannerContacts().map((entry) => this.refreshedPlanner(entry));
    const guest = this.guestContacts().map((entry) => this.refreshedGuest(entry));
    if (weddingPlanner.length > 0 || guest.length > 0) {
      sanitized.contact = {
        weddingPlanner: weddingPlanner.length > 0 ? weddingPlanner : undefined,
        guest: guest.length > 0 ? guest : undefined,
      };
    }

    const faq = this.faqEntries();
    if (faq.length > 0) sanitized.faq = [...faq];

    const dayLine = info.dayLine;
    if (dayLine && this.dayLineWritten(dayLine)) sanitized.dayLine = dayLine;

    const note = this.noteEntries();
    if (note.length > 0) sanitized.note = [...note];

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  private sanitizedConfig(): ConfigState {
    return { ...this.cfg(), generalInfo: this.sanitizedGeneralInfo() };
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
