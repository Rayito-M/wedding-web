import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import { EntityCollectionService, EntityServices } from '@ngrx/data';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  EntityNamesEnum,
  HeaderService,
  RsvpDto,
  RsvpDtoAdultsPartner1,
  RsvpDtoAdultsPartner1Options,
  RsvpDtoAdultsPartner2,
  RsvpDtoChildrenInner,
  TranslateLanguageService,
  WeddingConfigResponseDto,
  PluralTranslatePipe,
} from '@app/core';
import { Btn } from '@app/shared/button/button';
import { Pill } from '@app/shared/pill/pill';
import { TextInput } from '@app/shared/input/input';
import { TextareaInput } from '@app/shared/textarea/textarea';

type PersonKind = 'you' | 'partner' | 'child';
type PersonKey = 'partner1' | 'partner2' | `child:${number}`;

/** Editable draft shape for one adult (partner1 or partner2). `id` is only
 *  ever known for `partner1` (self) or a `partner2` who already has an
 *  account (server-linked on `create`) — never edited here, only carried
 *  forward so we don't silently drop an existing account link on save. */
interface AdultDraft {
  readonly id?: string;
  firstName: string;
  lastName: string;
  options: RsvpDtoAdultsPartner1Options;
}

/** Age kept as free text while editing (mirrors `rsvp-create`'s child draft)
 *  so an empty field reads as empty, not `0`; parsed to a number on save. */
interface ChildDraft {
  firstName: string;
  age: string;
  options: RsvpDtoAdultsPartner1Options;
}

interface EditDraft {
  readonly status: RsvpDto.StatusEnum;
  readonly version: number;
  partner1: AdultDraft;
  partner2?: AdultDraft;
  children: ChildDraft[];
}

interface PersonCard {
  readonly key: PersonKey;
  readonly kind: PersonKind;
  readonly firstName: string;
  readonly lastName: string;
  /** `null` for adults — children only. */
  readonly age: string | null;
  readonly options: RsvpDtoAdultsPartner1Options;
}

/** Construction-time placeholder — replaced synchronously by the
 *  constructor's `effect()` before the first render is visible (see the
 *  `draft` field for why this can't just read the `rsvp` input directly). */
const EMPTY_DRAFT: EditDraft = {
  status: RsvpDto.StatusEnum.PENDING,
  version: 0,
  partner1: { id: '', firstName: '', lastName: '', options: {} },
  children: [],
};

function toEditDraft(rsvp: RsvpDto): EditDraft {
  return {
    status: rsvp.status,
    version: rsvp.version,
    partner1: {
      id: rsvp.adults.partner1.id,
      firstName: rsvp.adults.partner1.firstName,
      lastName: rsvp.adults.partner1.lastName,
      options: rsvp.adults.partner1.options ?? {},
    },
    partner2: rsvp.adults.partner2
      ? {
          id: rsvp.adults.partner2.id,
          firstName: rsvp.adults.partner2.firstName,
          lastName: rsvp.adults.partner2.lastName,
          options: rsvp.adults.partner2.options ?? {},
        }
      : undefined,
    children: (rsvp.children ?? []).map((c) => ({
      firstName: c.firstName,
      age: String(c.age),
      options: c.options ?? {},
    })),
  };
}

function fromEditDraft(draft: EditDraft): Partial<RsvpDto> {
  const partner1: RsvpDtoAdultsPartner1 = {
    id: draft.partner1.id as string,
    firstName: draft.partner1.firstName.trim(),
    lastName: draft.partner1.lastName.trim(),
    options: draft.partner1.options,
  };
  const partner2: RsvpDtoAdultsPartner2 | undefined = draft.partner2
    ? // reason: the generated `RsvpDtoAdultsPartner2` type incorrectly requires
      // `id` (an OpenAPI `anyOf`-merge artifact); the API's Zod schema
      // (`RsvpParticipantSchema`, wedding-api rsvp.ts) allows partner2 without
      // an id for a party member with no account — `id` is only included here
      // when one was already known (carried forward, never editable in this UI).
      ({
        ...(draft.partner2.id ? { id: draft.partner2.id } : {}),
        firstName: draft.partner2.firstName.trim(),
        lastName: draft.partner2.lastName.trim(),
        options: draft.partner2.options,
      } as unknown as RsvpDtoAdultsPartner2)
    : undefined;
  const children: RsvpDtoChildrenInner[] = draft.children.map((c) => ({
    firstName: c.firstName.trim(),
    age: Number(c.age) || 0,
    options: c.options,
  }));
  return {
    status: draft.status,
    version: draft.version,
    adults: { partner1, partner2 },
    children,
  };
}

/**
 * The RSVP once it exists (design system `ScreenRSVPEdit.jsx`, commit
 * 9e44df2): expandable per-person cards for the party, a shared note, and
 * "Change my answer" back to `app-rsvp-create`.
 *
 * Simplified vs. the reference, matching `app-rsvp-create`: no "own guest
 * account / phone number" sub-flow for adults (out of scope — no
 * guest-search API, and provisioning accounts needs a hub-level ADR), so
 * there is also no "N guests need a phone number" footer state. The DS's
 * flat `reply.people[]` (kind `you`/`partner`/`guest`/`child`) doesn't exist
 * in the real API — this renders one card each for `adults.partner1`
 * (always), `adults.partner2` (if present) and `children[]`, and repurposes
 * the DS's "+ Add a guest" as "+ Add a partner" (the only other adult slot
 * the real model has; shown only while `partner2` is absent).
 */
@Component({
  selector: 'app-rsvp-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Btn, Pill, TextInput, TextareaInput, TranslatePipe, PluralTranslatePipe],
  templateUrl: './rsvp-edit.html',
  styleUrl: './rsvp-edit.scss',
})
export class RsvpEdit {
  private readonly translate = inject(TranslateLanguageService);
  private readonly translateService = inject(TranslateService);
  private readonly header = inject(HeaderService);

  private readonly rsvpCollection: EntityCollectionService<RsvpDto> = inject(
    EntityServices,
  ).getEntityCollectionService<RsvpDto>(EntityNamesEnum.RSVP);

  private readonly weddingConfigCollection: EntityCollectionService<WeddingConfigResponseDto> =
    inject(EntityServices).getEntityCollectionService<WeddingConfigResponseDto>(
      EntityNamesEnum.WEDDING_CONFIG,
    );

  /** The current guest's RSVP, as read by the orchestrator. */
  readonly rsvp = input.required<RsvpDto>();

  /** "Change my answer" — the orchestrator switches back to `app-rsvp-create`. */
  readonly changeAnswer = output<void>();

  // Placeholder until the constructor's `effect()` below resyncs it from the
  // required `rsvp` input — reading a required input signal at field-init
  // time is flagged by the Angular compiler (NG8118) even though the value
  // is available; the effect runs once immediately after construction, well
  // before the initial render is visible.
  protected readonly draft = signal<EditDraft>(EMPTY_DRAFT);
  protected readonly openKey = signal<PersonKey | null>('partner1');
  protected readonly dirty = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveFailed = signal(false);

  /** Singleton resource: at most one document in the collection (mirrors
   *  `invitee.ts`). `GET /v1/config` (no `@Roles` restriction beyond being
   *  signed in) is guest-readable — confirmed by `invitee.ts` already
   *  reading this same collection successfully for the guest role — so the
   *  dietary-preference catalog is sourced from here, not a placeholder. */
  protected readonly weddingConfig = toSignal(
    this.weddingConfigCollection.entities$.pipe(map((configs) => configs[0])),
    { initialValue: undefined },
  );

  protected readonly dietaryOptions = computed(() => {
    const lang = this.translate.currentLang();
    return (this.weddingConfig()?.dietaryPreferences ?? []).map((d) => ({
      id: d.id,
      label: d.label[lang],
    }));
  });

  protected readonly cards = computed<PersonCard[]>(() => {
    const d = this.draft();
    const list: PersonCard[] = [
      {
        key: 'partner1',
        kind: 'you',
        firstName: d.partner1.firstName,
        lastName: d.partner1.lastName,
        age: null,
        options: d.partner1.options,
      },
    ];
    if (d.partner2) {
      list.push({
        key: 'partner2',
        kind: 'partner',
        firstName: d.partner2.firstName,
        lastName: d.partner2.lastName,
        age: null,
        options: d.partner2.options,
      });
    }
    d.children.forEach((c, i) => {
      list.push({
        key: `child:${i}`,
        kind: 'child',
        firstName: c.firstName,
        lastName: '',
        age: c.age,
        options: c.options,
      });
    });
    return list;
  });

  protected readonly seatsHeld = computed(() => this.cards().length);

  constructor() {
    this.weddingConfigCollection.getByKey(''); // Singleton resource, only fetches if cache is empty

    effect(() => {
      const header = this.translateService.instant('rsvp.header');
      this.header.set(`${header} · ${this.translateService.instant('rsvp.edit.eyebrow')}`);
    });

    // Resync the draft whenever the orchestrator hands us a fresh entity
    // (e.g. after our own successful save round-trips through the cache).
    effect(() => {
      const rsvp = this.rsvp();
      this.draft.set(toEditDraft(rsvp));
      this.dirty.set(false);
      this.saveFailed.set(false);
    });
  }

  protected isOpen(key: PersonKey): boolean {
    return this.openKey() === key;
  }

  protected toggleOpen(key: PersonKey): void {
    this.openKey.update((current) => (current === key ? null : key));
  }

  protected kindLabelKey(kind: PersonKind): string {
    return `rsvp.edit.kind.${kind}`;
  }

  protected fullName(card: PersonCard): string {
    return `${card.firstName} ${card.lastName}`.trim();
  }

  protected initial(card: PersonCard): string {
    return (this.fullName(card) || '?').charAt(0).toUpperCase();
  }

  protected dietLabel(id: string): string {
    return this.dietaryOptions().find((d) => d.id === id)?.label ?? id;
  }

  protected allergiesText(card: PersonCard): string {
    return card.options.customAllergies?.[0] ?? '';
  }

  protected summaryFor(card: PersonCard): string {
    const bits: string[] = [];
    if (card.kind === 'child' && card.age) {
      bits.push(this.translateService.instant('rsvp.edit.person.yearsOld', { age: card.age }));
    }
    const dietLabels = (card.options.dietaryPreferenceIds ?? []).map((id) => this.dietLabel(id));
    if (dietLabels.length) bits.push(dietLabels.join(', '));
    const allergies = this.allergiesText(card).trim();
    if (allergies) {
      bits.push(this.translateService.instant('rsvp.edit.person.allergiesSummary', { list: allergies }));
    }
    return bits.length ? bits.join(' · ') : this.translateService.instant('rsvp.edit.person.noMealDetails');
  }

  protected setPartner1FirstName(value: string): void {
    this.draft.update((d) => ({ ...d, partner1: { ...d.partner1, firstName: value } }));
    this.markDirty();
  }

  protected setPartner1LastName(value: string): void {
    this.draft.update((d) => ({ ...d, partner1: { ...d.partner1, lastName: value } }));
    this.markDirty();
  }

  protected setPartner2FirstName(value: string): void {
    this.draft.update((d) => (d.partner2 ? { ...d, partner2: { ...d.partner2, firstName: value } } : d));
    this.markDirty();
  }

  protected setPartner2LastName(value: string): void {
    this.draft.update((d) => (d.partner2 ? { ...d, partner2: { ...d.partner2, lastName: value } } : d));
    this.markDirty();
  }

  protected setChildFirstName(index: number, value: string): void {
    this.draft.update((d) => ({
      ...d,
      children: d.children.map((c, i) => (i === index ? { ...c, firstName: value } : c)),
    }));
    this.markDirty();
  }

  protected setChildAge(index: number, value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 2);
    this.draft.update((d) => ({
      ...d,
      children: d.children.map((c, i) => (i === index ? { ...c, age: digits } : c)),
    }));
    this.markDirty();
  }

  protected toggleDiet(key: PersonKey, dietId: string): void {
    this.updateOptions(key, (opts) => {
      const current = opts.dietaryPreferenceIds ?? [];
      return {
        ...opts,
        dietaryPreferenceIds: current.includes(dietId)
          ? current.filter((id) => id !== dietId)
          : [...current, dietId],
      };
    });
  }

  protected setAllergies(key: PersonKey, value: string): void {
    this.updateOptions(key, (opts) => ({
      ...opts,
      customAllergies: value.trim() ? [value.trim()] : [],
    }));
  }

  protected setNote(value: string): void {
    this.updateOptions('partner1', (opts) => ({ ...opts, comments: value || null }));
  }

  protected readonly noteText = computed(() => this.draft().partner1.options.comments ?? '');

  protected canAddPartner(): boolean {
    return !this.draft().partner2;
  }

  protected addPartner(): void {
    if (!this.canAddPartner()) return;
    this.draft.update((d) => ({ ...d, partner2: { firstName: '', lastName: '', options: {} } }));
    this.openKey.set('partner2');
    this.markDirty();
  }

  protected addChild(): void {
    this.draft.update((d) => ({ ...d, children: [...d.children, { firstName: '', age: '', options: {} }] }));
    this.openKey.set(`child:${this.draft().children.length - 1}`);
    this.markDirty();
  }

  protected removePerson(key: PersonKey): void {
    if (key === 'partner2') {
      this.draft.update((d) => ({ ...d, partner2: undefined }));
    } else if (key.startsWith('child:')) {
      const index = Number(key.slice('child:'.length));
      this.draft.update((d) => ({ ...d, children: d.children.filter((_, i) => i !== index) }));
    } else {
      return;
    }
    if (this.openKey() === key) this.openKey.set(null);
    this.markDirty();
  }

  protected async save(): Promise<void> {
    if (this.saving() || !this.dirty()) return;
    this.saving.set(true);
    this.saveFailed.set(false);
    const changes = fromEditDraft(this.draft());
    try {
      // `EntityCollectionService.update()` takes a flat `Partial<T>` (must
      // include `id`) — it's the underlying `EntityCollectionDataService`
      // (`RsvpDataService.update()`) that wraps it as `{ id, changes }`
      // before calling the API.
      const updated = await firstValueFrom(
        this.rsvpCollection.update({ id: this.rsvp().id, ...changes }),
      );
      this.draft.set(toEditDraft(updated));
      this.dirty.set(false);
    } catch {
      this.saveFailed.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  protected onChangeAnswer(): void {
    this.changeAnswer.emit();
  }

  private updateOptions(
    key: PersonKey,
    mutate: (opts: RsvpDtoAdultsPartner1Options) => RsvpDtoAdultsPartner1Options,
  ): void {
    this.draft.update((d) => {
      if (key === 'partner1') {
        return { ...d, partner1: { ...d.partner1, options: mutate(d.partner1.options) } };
      }
      if (key === 'partner2' && d.partner2) {
        return { ...d, partner2: { ...d.partner2, options: mutate(d.partner2.options) } };
      }
      if (key.startsWith('child:')) {
        const index = Number(key.slice('child:'.length));
        return {
          ...d,
          children: d.children.map((c, i) => (i === index ? { ...c, options: mutate(c.options) } : c)),
        };
      }
      return d;
    });
    this.markDirty();
  }

  private markDirty(): void {
    this.dirty.set(true);
    this.saveFailed.set(false);
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected childIndex(key: PersonKey): number {
    return Number(key.slice('child:'.length));
  }
}
