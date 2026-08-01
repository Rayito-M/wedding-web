import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  Signal,
  OnInit,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EntityCollectionService, EntityServices } from '@ngrx/data';

import {
  CreateWeddingConfigDtoAgendaItemsInner,
  CreateWeddingConfigDtoAgendaItemsInnerTitle,
  CreateWeddingConfigDtoDietaryPreferencesInner,
  CreateWeddingConfigDtoHotelsInner,
  CreateWeddingConfigDtoVenuesInner,
  HeaderService,
  WeddingConfigResponseDto,
  EntityNamesEnum,
  extractAgendaTime,
} from '@app/core';
import { LangCode, ThemeId } from '@app/model';
import { Btn } from '@app/shared/button/button';
import { DecorFish } from '@app/shared/decor/fish';
import { TextInput } from '@app/shared/input/input';
import { TextareaInput } from '@app/shared/textarea/textarea';
import { Pill } from '@app/shared/pill/pill';

// Reuse the generated OpenAPI models directly (Hard Rule: "never duplicate type
// definitions") — this is the exact shape a future `PATCH /v1/config` would send
// (T211-T214, not built yet). This screen is UI-only, local component state.
type ConfigState = WeddingConfigResponseDto;
type Venue = CreateWeddingConfigDtoVenuesInner;
type MultiLangText = CreateWeddingConfigDtoAgendaItemsInnerTitle;
type AgendaItem = CreateWeddingConfigDtoAgendaItemsInner;
type Hotel = CreateWeddingConfigDtoHotelsInner;
type DietTag = CreateWeddingConfigDtoDietaryPreferencesInner;
type TagCollection = 'dietaryPreferences' | 'allergies';
type SectionId = 'basics' | 'couple' | 'venues' | 'agenda' | 'hotels' | 'dietary' | 'appearance';

interface SectionDef {
  readonly id: SectionId;
  readonly number: string;
  readonly labelKey: string;
}

const SECTIONS: readonly SectionDef[] = [
  { id: 'basics', number: '01', labelKey: 'configManager.section.basics' },
  { id: 'couple', number: '02', labelKey: 'configManager.section.couple' },
  { id: 'venues', number: '03', labelKey: 'configManager.section.venues' },
  { id: 'agenda', number: '04', labelKey: 'configManager.section.agenda' },
  { id: 'hotels', number: '05', labelKey: 'configManager.section.hotels' },
  { id: 'dietary', number: '06', labelKey: 'configManager.section.dietary' },
  { id: 'appearance', number: '07', labelKey: 'configManager.section.appearance' },
];

// "The couple" section — the two accounts (bride/groom) that own the wedding.
// There is no `couple` field anywhere on the generated API client (verified
// against `WeddingConfigResponseDto` / `CreateWeddingConfigDto*`), so — like
// the rest of this screen — this is UI-only, local component state, seeded
// from a fixture (same precedent as `screens/profile/profile.ts`'s `ME_SEED`),
// not wired to any API. Mirrors `SEED.couple` (`ScreenConfigManager.jsx`
// lines 11-14) and its `setPerson`/`addPerson`/`rmPerson` helpers.
type CoupleRole = 'bride' | 'groom';
type CoupleAccess = 'owner' | 'editor' | 'viewer';
type CoupleAccountStatus = 'active' | 'invited';

interface CoupleAccount {
  readonly id: string;
  readonly role: CoupleRole;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  access: CoupleAccess;
  status: CoupleAccountStatus;
  lastSeen: string;
}

const COUPLE_ROLES: readonly CoupleRole[] = ['bride', 'groom'];
const COUPLE_ACCESS_LEVELS: readonly CoupleAccess[] = ['owner', 'editor', 'viewer'];

// Fixture data mirroring the reference SEED.couple `c1`/`c2` entries — literal
// content (names, contact details, "last seen" copy), not UI chrome, so it
// isn't run through i18n (same precedent as `ME_SEED`'s `relation.label`).
function buildCoupleSeed(): CoupleAccount[] {
  return [
    {
      id: 'c1',
      role: 'bride',
      firstName: 'Sara',
      lastName: 'Ortega',
      email: 'sara@ortega.es',
      phone: '+34 611 20 44 08',
      access: 'owner',
      status: 'active',
      lastSeen: 'Today, 09:12',
    },
    {
      id: 'c2',
      role: 'groom',
      firstName: 'Christophe',
      lastName: 'Lemoine',
      email: 'christophe.lemoine@mail.fr',
      phone: '+33 6 42 11 87 30',
      access: 'owner',
      status: 'active',
      lastSeen: 'Yesterday, 21:40',
    },
  ];
}

// Order for the per-language edit tabs (Agenda, Dietary) — mirrors the design
// reference's LangTabs order (FR · EN · ES); a UI convenience, not the app-wide
// default-language order (that stays es-first, hub ADR-0009).
const EDIT_LANGS: readonly LangCode[] = ['fr', 'en', 'es'];

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
const uid = (): string => globalThis.crypto.randomUUID();

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
 * Admin-only wedding configuration editor (7 sections: basics, the couple,
 * venues, agenda, stays, dietary, appearance). UI-only, local component
 * state — there is no live `PATCH /v1/config` wiring yet (blocked on
 * T211-T214); Save just clears the `dirty` flag and flashes a confirmation.
 * See the design reference: `ScreenConfigManager.jsx` /
 * `ScreenConfigManagerMobile.jsx`.
 */
@Component({
  selector: 'app-config-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Btn, TextInput, TextareaInput, Pill, DecorFish, TranslatePipe],
  templateUrl: './config-manager.html',
  styleUrl: './config-manager.scss',
})
export class ConfigManager implements OnInit {
  private readonly translateService = inject(TranslateService);
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

  private savedFlashTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly sections = SECTIONS;
  protected readonly editLangs = EDIT_LANGS;
  protected readonly appLanguages = APP_LANGUAGES;
  protected readonly priceTiers = PRICE_TIERS;
  protected readonly themeSwatches = THEME_SWATCHES;

  protected readonly cfg = signal<ConfigState>(this.weddingConfig() ?? buildEmptyConfig());
  protected readonly section = signal<SectionId>('basics');
  protected readonly lang = signal<LangCode>('en');
  protected readonly dirty = signal(false);
  protected readonly savedFlash = signal(false);
  // "The couple" section — local state only, not part of `cfg`/the API client
  // (no `couple` field on `WeddingConfigResponseDto`). See buildCoupleSeed().
  protected readonly couple = signal<CoupleAccount[]>(buildCoupleSeed());
  protected readonly coupleRoles = COUPLE_ROLES;
  protected readonly coupleAccessLevels = COUPLE_ACCESS_LEVELS;
  // Draft text for the inline "+ Add tag" chip input, per tag collection.
  protected readonly draftTag = signal<Record<TagCollection, string>>({
    dietaryPreferences: '',
    allergies: '',
  });

  protected readonly tagModalOpen = signal(false);
  protected readonly tagModalCollection = signal<TagCollection | null>(null);
  protected readonly tagModalLabel = signal<MultiLangText>(emptyLangText());

  protected readonly statusKey = computed(() => {
    if (this.savedFlash()) return 'configManager.status.saved';
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

  protected readonly agendaCounts = computed(() =>
    this.cfg().agenda.items.reduce(
      (acc, item) => ({ ...acc, [item.status]: acc[item.status] + 1 }),
      { planned: 0, confirmed: 0, cancelled: 0 },
    ),
  );

  constructor() {
    inject(HeaderService).set(this.translateService.instant('configManager.headerMeta'));
    inject(DestroyRef).onDestroy(() => clearTimeout(this.savedFlashTimer));
    this.weddingConfigCollection.load();

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
  protected selectSection(id: SectionId): void {
    this.section.set(id);
  }

  protected selectLang(code: LangCode): void {
    this.lang.set(code);
  }

  protected save(): void {
    this.dirty.set(false);
    this.savedFlash.set(true);
    clearTimeout(this.savedFlashTimer);
    this.savedFlashTimer = setTimeout(() => this.savedFlash.set(false), 1800);
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

  // ── The couple (bride/groom accounts) — local state, see buildCoupleSeed() ──

  protected findPerson(role: CoupleRole): CoupleAccount | undefined {
    return this.couple().find((p) => p.role === role);
  }

  protected setPerson(id: string, patch: Partial<CoupleAccount>): void {
    this.couple.update((people) => people.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    this.dirty.set(true);
  }

  protected addPerson(role: CoupleRole): void {
    const newPerson: CoupleAccount = {
      id: uid(),
      role,
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      access: 'owner',
      status: 'invited',
      lastSeen: this.translateService.instant('configManager.couple.lastSeen.neverSignedIn'),
    };
    this.couple.update((people) => [...people, newPerson]);
    this.dirty.set(true);
  }

  protected removePerson(id: string): void {
    this.couple.update((people) => people.filter((p) => p.id !== id));
    this.dirty.set(true);
  }

  protected coupleInitials(person: CoupleAccount): string {
    const first = person.firstName.charAt(0) || '?';
    const last = person.lastName.charAt(0) || '';
    return (first + last).toUpperCase();
  }

  protected coupleFullName(person: CoupleAccount): string | null {
    const name = [person.firstName, person.lastName].filter(Boolean).join(' ');
    return name || null;
  }

  /** "Send sign-in link" (active accounts) / "Resend invitation" (invited). */
  protected sendCoupleInvite(person: CoupleAccount): void {
    const key =
      person.status === 'active'
        ? 'configManager.couple.lastSeen.signInLinkSent'
        : 'configManager.couple.lastSeen.inviteSent';
    this.setPerson(person.id, { lastSeen: this.translateService.instant(key) });
  }

  /** "Suspend access" (active → invited) / "Mark as active" (invited → active). */
  protected toggleCoupleStatus(person: CoupleAccount): void {
    if (person.status === 'active') {
      this.setPerson(person.id, {
        status: 'invited',
        lastSeen: this.translateService.instant('configManager.couple.lastSeen.invitationPending'),
      });
    } else {
      this.setPerson(person.id, {
        status: 'active',
        lastSeen: this.translateService.instant('configManager.couple.lastSeen.justNow'),
      });
    }
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

  protected setAgendaText(id: string, field: 'title' | 'desc', value: string): void {
    const lang = this.lang();
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

  protected addAgenda(): void {
    const firstVenueId = this.cfg().venues[0]?.id ?? null;
    const newItem: AgendaItem = {
      id: uid(),
      status: 'planned',
      time: '',
      venueId: firstVenueId,
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
        { id: uid(), name: '', priceTier: '€€', distanceKm: 0, bookingUrl: '', photoKey: null },
      ],
    }));
  }

  protected removeHotel(id: string): void {
    this.mutate((c) => ({ ...c, hotels: c.hotels.filter((h) => h.id !== id) }));
  }

  protected setTagLabel(collection: TagCollection, id: string, value: string): void {
    const lang = this.lang();
    this.mutate((c) => ({
      ...c,
      [collection]: c[collection].map((tag: DietTag) =>
        tag.id === id ? { ...tag, label: { ...tag.label, [lang]: value } } : tag,
      ),
    }));
  }

  // Adding a tag now happens inline (design update): the trailing "+ Add tag"
  // chip commits its typed text straight into the new tag's label, in the
  // language currently being edited — see setDraftTag/commitDraftTag below.
  protected addTag(collection: TagCollection, text = ''): void {
    this.mutate((c) => ({
      ...c,
      [collection]: [
        ...c[collection],
        { id: uid(), label: { ...emptyLangText(), [this.lang()]: text } },
      ],
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

  protected openTagModal(collection: TagCollection): void {
    this.tagModalCollection.set(collection);
    this.tagModalLabel.set(emptyLangText());
    this.tagModalOpen.set(true);
  }

  protected getTagModalTitle(): string {
    const collection = this.tagModalCollection();
    if (collection === 'dietaryPreferences') {
      return 'configManager.dietary.addDietaryPreference';
    }
    return 'configManager.dietary.addAllergy';
  }

  // Close only when the backdrop itself is clicked — clicks inside the dialog
  // land on descendants, so `target === currentTarget` distinguishes the two
  // without a stopPropagation handler on the dialog (which would also swallow
  // the overlay's Escape keybinding). Keyboard close stays on the overlay.
  protected onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeTagModal();
    }
  }

  protected closeTagModal(): void {
    this.tagModalOpen.set(false);
    this.tagModalCollection.set(null);
    this.tagModalLabel.set(emptyLangText());
  }

  protected submitTagModal(): void {
    const collection = this.tagModalCollection();
    const label = this.tagModalLabel();
    if (!collection || !Object.values(label).some((v) => v.trim())) {
      return;
    }
    this.mutate((c) => ({
      ...c,
      [collection]: [...c[collection], { id: uid(), label }],
    }));
    this.closeTagModal();
  }

  protected setTagModalLabel(lang: LangCode, value: string): void {
    this.tagModalLabel.update((label) => ({ ...label, [lang]: value }));
  }

  // Naive content-based width so the pill's inline input grows with its text
  // (matches the design reference's chip-editor sizing formula).
  protected tagInputWidth(text: string): number {
    return Math.max(56, text.length * 7 + 10);
  }

  protected setTheme(themeId: ThemeId): void {
    this.mutate((c) => ({ ...c, themeId: themeId as ConfigState['themeId'] }));
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
