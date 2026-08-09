import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EntityCollectionService, EntityServices } from '@ngrx/data';

import {
  EMPTY_RSVP_DRAFT,
  EntityNamesEnum,
  PersonKey,
  RsvpDraft,
  RsvpDto,
  TranslateLanguageService,
  UserProfileDto,
  WeddingConfigResponseDto,
  fromRsvpDraft,
  toRsvpDraft,
  toggleOptionId,
  withPersonOptions,
} from '@app/core';
import { Modal } from '@app/shared/modal/modal';
import { Btn } from '@app/shared/button/button';
import { ChoiceCard } from '@app/shared/choice-card/choice-card';
import { TextInput } from '@app/shared/input/input';
import { TextareaInput } from '@app/shared/textarea/textarea';
import { DecorFish } from '@app/shared/decor/fish';

type PersonKind = 'you' | 'partner' | 'child';

interface PersonCard {
  readonly key: PersonKey;
  readonly kind: PersonKind;
  readonly firstName: string;
  readonly lastName: string;
  /** `null` for adults — children only. */
  readonly age: string | null;
  readonly dietaryPreferenceIds: readonly string[];
  readonly allergyIds: readonly string[];
}

interface CatalogOption {
  readonly id: string;
  readonly label: string;
}

/**
 * Manage-RSVP overlay — the admin's editor for a guest's reply (DS
 * `ScreenGuestManager.jsx`, the `draft != null` branch of the profile
 * overlay): attendance answer, one card per participant with dietary and
 * allergy pills, and the note left with the reply.
 *
 * Opened from `app-guest-profile-modal`'s summary card or its "Manage RSVP"
 * button; "Back" returns there (the parent swaps the two overlays). Writes go
 * through the same `PATCH /v1/rsvp/{id}` the guest's own `app-rsvp-edit`
 * screen uses, sharing its draft mapping (`core/helper/rsvp-draft`).
 *
 * Deviation from the DS mock: dietary and allergy options are the wedding's
 * configured catalogs (`WeddingConfigResponseDto.dietaryPreferences` /
 * `.allergies`, stored as ids on the RSVP), not the mock's hard-coded English
 * label lists.
 */
@Component({
  selector: 'app-manage-rsvp-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    NgTemplateOutlet,
    TranslatePipe,
    Modal,
    Btn,
    ChoiceCard,
    TextInput,
    TextareaInput,
    DecorFish,
  ],
  templateUrl: './manage-rsvp-modal.html',
  styleUrl: './manage-rsvp-modal.scss',
})
export class ManageRsvpModal {
  readonly isOpen = signal(false);
  /** "Back" — emits the guest's user id so the parent can reopen the profile. */
  readonly back = output<string>();
  readonly closeModal = output<void>();
  /** A successful save — emits the guest's user id so the list row can refresh. */
  readonly rsvpSaved = output<string>();

  protected readonly statuses: RsvpDto.StatusEnum[] = [
    RsvpDto.StatusEnum.ATTENDING,
    RsvpDto.StatusEnum.PENDING,
    RsvpDto.StatusEnum.DECLINED,
  ];

  private readonly lang = inject(TranslateLanguageService);
  private readonly translate = inject(TranslateService);

  private readonly rsvpCollection: EntityCollectionService<RsvpDto> = inject(
    EntityServices,
  ).getEntityCollectionService<RsvpDto>(EntityNamesEnum.RSVP);

  private readonly userProfileCollection: EntityCollectionService<UserProfileDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE);

  private readonly weddingConfigCollection: EntityCollectionService<WeddingConfigResponseDto> =
    inject(EntityServices).getEntityCollectionService<WeddingConfigResponseDto>(
      EntityNamesEnum.WEDDING_CONFIG,
    );

  /** Set by `open(userId)` — the RSVP's `id` equals its primary guest's user id. */
  private readonly userId = signal<string | null>(null);

  protected readonly draft = signal<RsvpDraft>(EMPTY_RSVP_DRAFT);
  protected readonly saving = signal(false);
  protected readonly saveFailed = signal(false);

  private readonly rsvps = toSignal(this.rsvpCollection.entities$, {
    initialValue: [] as RsvpDto[],
  });

  /** Read-only lookup into the profiles `guest-manager.ts` already bulk-loads. */
  private readonly userProfiles = toSignal(this.userProfileCollection.entities$, {
    initialValue: [] as UserProfileDto[],
  });

  protected readonly rsvp = computed<RsvpDto | null>(() => {
    const userId = this.userId();
    if (!userId) return null;
    return this.rsvps().find((r) => r.id === userId) ?? null;
  });

  /** Singleton resource: at most one document in the collection — the source
   *  of the dietary/allergy catalogs (same read as `app-rsvp-edit`). */
  private readonly weddingConfig = toSignal(
    this.weddingConfigCollection.entities$.pipe(map((configs) => configs[0])),
    { initialValue: undefined },
  );

  protected readonly dietaryOptions = computed<CatalogOption[]>(() =>
    this.toCatalog(this.weddingConfig()?.dietaryPreferences),
  );

  protected readonly allergyOptions = computed<CatalogOption[]>(() =>
    this.toCatalog(this.weddingConfig()?.allergies),
  );

  protected readonly cards = computed<PersonCard[]>(() => {
    const d = this.draft();
    const cards: PersonCard[] = [
      {
        key: 'partner1',
        kind: 'you',
        firstName: d.partner1.firstName,
        lastName: d.partner1.lastName,
        age: null,
        dietaryPreferenceIds: d.partner1.options.dietaryPreferenceIds ?? [],
        allergyIds: d.partner1.options.allergyIds ?? [],
      },
    ];
    if (d.partner2) {
      cards.push({
        key: 'partner2',
        kind: 'partner',
        firstName: d.partner2.firstName,
        lastName: d.partner2.lastName,
        age: null,
        dietaryPreferenceIds: d.partner2.options.dietaryPreferenceIds ?? [],
        allergyIds: d.partner2.options.allergyIds ?? [],
      });
    }
    d.children.forEach((child, index) => {
      cards.push({
        key: `child:${index}`,
        kind: 'child',
        firstName: child.firstName,
        lastName: '',
        age: child.age,
        dietaryPreferenceIds: child.options.dietaryPreferenceIds ?? [],
        allergyIds: child.options.allergyIds ?? [],
      });
    });
    return cards;
  });

  protected readonly partnerCard = computed(() =>
    this.cards().find((card) => card.kind === 'partner'),
  );
  protected readonly childCards = computed(() =>
    this.cards().filter((card) => card.kind === 'child'),
  );
  protected readonly mainCard = computed(() => this.cards()[0]);
  protected readonly participantsCount = computed(() => this.cards().length);

  protected readonly noteText = computed(() => this.draft().partner1.options.comments ?? '');

  protected readonly guestFullName = computed(() => {
    const userId = this.userId();
    const profile = userId ? this.userProfiles().find((p) => p.id === userId) : undefined;
    if (profile) return `${profile.firstName} ${profile.lastName}`.trim();
    const d = this.draft();
    return `${d.partner1.firstName} ${d.partner1.lastName}`.trim();
  });

  protected readonly modalTitle = computed(
    () => this.guestFullName() || this.translate.instant('guest_manager.modal.guestPlaceholder'),
  );

  constructor() {
    this.weddingConfigCollection.getByKey(''); // Singleton resource, only fetches if cache is empty

    // `open()` sets `userId` before the fetch resolves, so the draft can't be
    // seeded synchronously there — resync it whenever the RSVP lands (and
    // again after a save round-trips through the cache).
    effect(() => {
      const rsvp = this.rsvp();
      this.draft.set(rsvp ? toRsvpDraft(rsvp) : EMPTY_RSVP_DRAFT);
      this.saveFailed.set(false);
    });
  }

  /**
   * Open the editor for this guest. Only reachable from a profile whose RSVP
   * already loaded, so the record is in the cache; refetch it anyway so the
   * `version` this editor sends back is the freshest one (the write is
   * optimistic-locked on it).
   */
  open(userId: string): void {
    this.userId.set(userId);
    this.rsvpCollection.getByKey(userId);
    this.saveFailed.set(false);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.closeModal.emit();
  }

  /** "Back" — hand the guest back to `app-guest-profile-modal`. */
  protected goBack(): void {
    const userId = this.userId();
    this.isOpen.set(false);
    if (userId) this.back.emit(userId);
  }

  protected setStatus(status: RsvpDto.StatusEnum): void {
    this.draft.update((d) => ({ ...d, status }));
  }

  protected isStatus(status: RsvpDto.StatusEnum): boolean {
    return this.draft().status === status;
  }

  protected setAdultFirstName(key: PersonKey, value: string): void {
    if (key === 'partner1') {
      this.draft.update((d) => ({ ...d, partner1: { ...d.partner1, firstName: value } }));
    } else if (key === 'partner2') {
      this.draft.update((d) => (d.partner2 ? { ...d, partner2: { ...d.partner2, firstName: value } } : d));
    }
  }

  protected setAdultLastName(key: PersonKey, value: string): void {
    if (key === 'partner1') {
      this.draft.update((d) => ({ ...d, partner1: { ...d.partner1, lastName: value } }));
    } else if (key === 'partner2') {
      this.draft.update((d) => (d.partner2 ? { ...d, partner2: { ...d.partner2, lastName: value } } : d));
    }
  }

  protected setChildFirstName(index: number, value: string): void {
    this.draft.update((d) => ({
      ...d,
      children: d.children.map((c, i) => (i === index ? { ...c, firstName: value } : c)),
    }));
  }

  protected setChildAge(index: number, value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 2);
    this.draft.update((d) => ({
      ...d,
      children: d.children.map((c, i) => (i === index ? { ...c, age: digits } : c)),
    }));
  }

  protected toggleDiet(key: PersonKey, dietId: string): void {
    this.draft.update((d) =>
      withPersonOptions(d, key, (opts) => toggleOptionId(opts, 'dietaryPreferenceIds', dietId)),
    );
  }

  protected toggleAllergy(key: PersonKey, allergyId: string): void {
    this.draft.update((d) =>
      withPersonOptions(d, key, (opts) => toggleOptionId(opts, 'allergyIds', allergyId)),
    );
  }

  protected setNote(value: string): void {
    this.draft.update((d) =>
      withPersonOptions(d, 'partner1', (opts) => ({ ...opts, comments: value || null })),
    );
  }

  protected addPartner(): void {
    this.draft.update((d) =>
      d.partner2 ? d : { ...d, partner2: { firstName: '', lastName: '', options: {} } },
    );
  }

  protected removePartner(): void {
    this.draft.update((d) => ({ ...d, partner2: undefined }));
  }

  protected addChild(): void {
    this.draft.update((d) => ({
      ...d,
      children: [...d.children, { firstName: '', age: '', options: {} }],
    }));
  }

  protected removeChild(index: number): void {
    this.draft.update((d) => ({ ...d, children: d.children.filter((_, i) => i !== index) }));
  }

  protected childIndex(key: PersonKey): number {
    return Number(key.slice('child:'.length));
  }

  protected async save(): Promise<void> {
    const userId = this.userId();
    if (!userId || !this.rsvp() || this.saving()) return;
    this.saving.set(true);
    this.saveFailed.set(false);
    try {
      // `EntityCollectionService.update()` takes a flat `Partial<T>` (must
      // include `id`) — `RsvpDataService.update()` wraps it as `{ id, changes }`
      // before calling the API.
      await firstValueFrom(this.rsvpCollection.update({ id: userId, ...fromRsvpDraft(this.draft()) }));
      this.rsvpSaved.emit(userId);
      this.close();
    } catch {
      this.saveFailed.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  private toCatalog(
    entries: WeddingConfigResponseDto['dietaryPreferences'] | undefined,
  ): CatalogOption[] {
    const lang = this.lang.currentLang();
    return (entries ?? []).map((entry) => ({ id: entry.id, label: entry.label[lang] }));
  }
}
