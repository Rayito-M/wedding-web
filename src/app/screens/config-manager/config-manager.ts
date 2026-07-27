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
  CreateWeddingConfigDtoAgendaInnerTitle,
  CreateWeddingConfigDtoDietaryPreferencesInner,
  CreateWeddingConfigDtoHotelsInner,
  CreateWeddingConfigDtoVenuesInner,
  HeaderService,
  WeddingConfigResponseDto,
  EntityNamesEnum,
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
type MultiLangText = CreateWeddingConfigDtoAgendaInnerTitle;
type Hotel = CreateWeddingConfigDtoHotelsInner;
type DietTag = CreateWeddingConfigDtoDietaryPreferencesInner;
type TagCollection = 'dietaryPreferences' | 'allergies';
type SectionId = 'basics' | 'venues' | 'agenda' | 'hotels' | 'dietary' | 'appearance';

interface SectionDef {
  readonly id: SectionId;
  readonly number: string;
  readonly labelKey: string;
}

const SECTIONS: readonly SectionDef[] = [
  { id: 'basics', number: '01', labelKey: 'configManager.section.basics' },
  { id: 'venues', number: '02', labelKey: 'configManager.section.venues' },
  { id: 'agenda', number: '03', labelKey: 'configManager.section.agenda' },
  { id: 'hotels', number: '04', labelKey: 'configManager.section.hotels' },
  { id: 'dietary', number: '05', labelKey: 'configManager.section.dietary' },
  { id: 'appearance', number: '06', labelKey: 'configManager.section.appearance' },
];

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
    agenda: [],
    hotels: [],
    dietaryPreferences: [],
    allergies: [],
    menus: [],
  };
}

/**
 * Admin-only wedding configuration editor (6 sections: basics, venues, agenda,
 * stays, dietary, appearance). UI-only, local component state — there is no
 * live `PATCH /v1/config` wiring yet (blocked on T211-T214); Save just clears
 * the `dirty` flag and flashes a confirmation. See the design reference:
 * `ScreenConfigManager.jsx` / `ScreenConfigManagerMobile.jsx`.
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

  protected setVenue(id: string, patch: Partial<Venue>): void {
    this.mutate((c) => ({
      ...c,
      venues: c.venues.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    }));
  }

  protected setAgendaTime(id: string, value: string): void {
    this.mutate((c) => ({
      ...c,
      agenda: c.agenda.map((a) => (a.id === id ? { ...a, time: value } : a)),
    }));
  }

  protected setAgendaVenue(id: string, venueId: string): void {
    this.mutate((c) => ({
      ...c,
      agenda: c.agenda.map((a) => (a.id === id ? { ...a, venueId } : a)),
    }));
  }

  protected setAgendaText(id: string, field: 'title' | 'desc', value: string): void {
    const lang = this.lang();
    this.mutate((c) => ({
      ...c,
      agenda: c.agenda.map((a) =>
        a.id === id ? { ...a, [field]: { ...a[field], [lang]: value } } : a,
      ),
    }));
  }

  protected addAgenda(): void {
    const firstVenueId = this.cfg().venues[0]?.id ?? null;
    this.mutate((c) => ({
      ...c,
      agenda: [
        ...c.agenda,
        {
          id: uid(),
          time: '',
          venueId: firstVenueId,
          title: emptyLangText(),
          desc: emptyLangText(),
        },
      ],
    }));
  }

  protected removeAgenda(id: string): void {
    this.mutate((c) => ({ ...c, agenda: c.agenda.filter((a) => a.id !== id) }));
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
