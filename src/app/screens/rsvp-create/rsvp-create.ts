import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { EntityCollectionService, EntityServices } from '@ngrx/data';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  EntityNamesEnum,
  HeaderService,
  partnerHasAccount,
  RsvpDto,
  RsvpDtoAdultsPartner2,
  RsvpDtoChildrenInner,
} from '@app/core';
import { Btn } from '@app/shared/button/button';
import { ChoiceCard } from '@app/shared/choice-card/choice-card';
import { DecorFishPair } from '@app/shared/decor/fish-pair';
import { TextInput } from '@app/shared/input/input';
import { Toggle } from '@app/shared/toggle/toggle';

type PartnerDraft = Omit<RsvpDtoAdultsPartner2, 'options' | 'id'> & {
  readonly firstName: string;
  readonly lastName: string;
  /** Optional, max 30 characters client-side (DS `ScreenRSVPCreate.jsx`),
   *  shown in quotes beside the name — never in place of it. Read-only for a
   *  linked partner (`hasLinkedPartner()`), same as their name. */
  readonly nickname?: string;
};

type ChildDraft = Omit<RsvpDtoChildrenInner, 'age'> & {
  readonly firstName: string;
  /** Kept as free text while editing (mirrors the DS reference); parsed to a
   *  number only when building the API payload. */
  readonly age: string;
  /** Optional, max 30 characters client-side — see `PartnerDraft.nickname`. */
  readonly nickname?: string;
};

interface CreateDraft {
  readonly attending: 'yes' | 'no' | null;
  readonly withPartner: boolean;
  readonly withChildren: boolean;
  readonly partner: PartnerDraft;
  readonly children: readonly ChildDraft[];
}

function attendingFromStatus(status: RsvpDto.StatusEnum): 'yes' | 'no' | null {
  if (status === RsvpDto.StatusEnum.ATTENDING) return 'yes';
  if (status === RsvpDto.StatusEnum.DECLINED) return 'no';
  return null;
}

/** Construction-time placeholder — replaced synchronously by the
 *  constructor's `effect()` before the first render is visible (mirrors
 *  `app-rsvp-edit`'s `EMPTY_DRAFT`). */
const EMPTY_DRAFT: CreateDraft = {
  attending: null,
  withPartner: false,
  withChildren: false,
  // A partner typed into this screen is always a plus-one — this app cannot
  // provision an account (ADR W-0004 §Decision.3, W-0002 §Decision.5).
  partner: { firstName: '', lastName: '', kind: 'plus-one' },
  children: [],
};

/** Seeds the wizard from the RSVP already provisioned by the orchestrator
 *  (`app-rsvp`'s auto-create) — a linked partner account (`adults.partner2`
 *  with an `id`, set server-side from `guest.partnerId`) is pre-filled and
 *  can't be removed here; a previous attending/declined answer (the "change
 *  my answer" path) is pre-selected too. */
function toCreateDraft(rsvp: RsvpDto): CreateDraft {
  const partner2 = rsvp.adults.partner2;
  return {
    attending: attendingFromStatus(rsvp.status),
    withPartner: !!partner2,
    withChildren: (rsvp.children?.length ?? 0) > 0,
    partner: partner2
      ? {
          firstName: partner2.firstName,
          lastName: partner2.lastName,
          nickname: partner2.nickname,
          kind: partner2.kind,
        }
      : { firstName: '', lastName: '', kind: 'plus-one' },
    children: (rsvp.children ?? []).map((c) => ({
      firstName: c.firstName,
      age: String(c.age),
      nickname: c.nickname,
    })),
  };
}

/**
 * First-time RSVP reply (design system `ScreenRSVPCreate.jsx`, commit
 * 9e44df2). Deliberately simplified vs. the reference: no guest-list roster
 * lookup and no "give them their own guest account" sub-flow for the
 * partner — there is no guest-search API wired anywhere in this app yet, and
 * provisioning a new authenticated account is an identity/auth-shape
 * decision that needs a hub-level ADR, not something this screen should
 * invent. A typed-in partner becomes a plain name on `adults.partner2` (no
 * `id`, no phone number); the party can still be edited any time afterwards
 * on `app-rsvp-edit`.
 *
 * By the time this renders, the orchestrator (`app-rsvp`) has already
 * provisioned the guest's `pending` RSVP record — so this screen only ever
 * PATCHes it (never creates), carrying forward its `id`/`version` and
 * server-set `adults.partner1`/linked `adults.partner2`.
 */
@Component({
  selector: 'app-rsvp-create',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Btn, ChoiceCard, TextInput, Toggle, DecorFishPair, TranslatePipe],
  templateUrl: './rsvp-create.html',
  styleUrl: './rsvp-create.scss',
})
export class RsvpCreate {
  private readonly translateService = inject(TranslateService);
  private readonly header = inject(HeaderService);

  private readonly rsvpCollection: EntityCollectionService<RsvpDto> = inject(
    EntityServices,
  ).getEntityCollectionService<RsvpDto>(EntityNamesEnum.RSVP);

  /** The already-provisioned (`pending`, or a prior `attending`/`declined`
   *  answer on "change my answer") RSVP this screen updates. */
  readonly rsvp = input.required<RsvpDto>();

  /** Fired once the reply has been saved on the server. */
  readonly submitted = output<void>();

  protected readonly step = signal(0);
  protected readonly draft = signal<CreateDraft>(EMPTY_DRAFT);
  protected readonly submitting = signal(false);
  protected readonly submitFailed = signal(false);

  /** True once the PATCH has actually landed on the server. The confirmation
   *  step is a receipt, not a form step: it is only ever reached *after* a
   *  successful save, so "See you in June" can never be shown for a reply
   *  that was not sent. */
  protected readonly sent = signal(false);

  protected readonly needsDetails = computed(() => {
    const d = this.draft();
    return d.attending === 'yes' && (d.withPartner || d.withChildren);
  });

  protected readonly steps = computed(() =>
    this.draft().attending === 'no' ? 2 : this.needsDetails() ? 3 : 2,
  );

  protected readonly partnerReady = computed(() => {
    const d = this.draft();
    if (!d.withPartner) return true;
    return d.partner.firstName.trim() !== '' && d.partner.lastName.trim() !== '';
  });

  protected readonly childrenReady = computed(() => {
    const d = this.draft();
    if (!d.withChildren) return true;
    return (
      d.children.length > 0 && d.children.every((c) => c.firstName.trim() !== '' && c.age !== '')
    );
  });

  protected readonly isPartyStep = computed(() => this.step() === 1 && this.needsDetails());

  /** The step whose primary action sends the reply — the party step when
   *  there is a party to name, otherwise the very first step (a guest coming
   *  alone answers and is done; ADR W-0004 §Decision.6). */
  protected readonly isLastDataStep = computed(() => this.step() === (this.needsDetails() ? 1 : 0));

  protected readonly continueDisabled = computed(() => {
    if (this.submitting()) return true;
    if (this.sent()) return false;
    if (this.step() === 0) return this.draft().attending === null;
    if (this.step() === 1) return !(this.partnerReady() && this.childrenReady());
    return false;
  });

  protected readonly continueLabelKey = computed(() => {
    if (this.sent())
      return this.draft().attending === 'yes'
        ? 'rsvp.create.actions.addMeals'
        : 'rsvp.create.actions.done';
    return this.isLastDataStep() ? 'rsvp.create.actions.send' : 'shared.continue';
  });

  /** A partner account already linked server-side (`guest.partnerId`) isn't
   *  something this screen can unlink — the toggle is locked on in that case. */
  protected readonly hasLinkedPartner = computed(() =>
    partnerHasAccount(this.rsvp().adults.partner2),
  );

  constructor() {
    // Resync the draft whenever the orchestrator hands us a fresh entity
    // (e.g. the auto-provisioned pending record, or a prior answer when
    // re-entering via "change my answer").
    effect(() => {
      const rsvp = this.rsvp();
      // Our own PATCH feeds a fresh entity back through this input; resyncing
      // on it would rewind the guest off their confirmation receipt and back
      // to step 1.
      if (untracked(this.sent)) return;
      this.draft.set(toCreateDraft(rsvp));
      this.step.set(0);
    });

    effect(() => {
      const header = this.translateService.instant('rsvp.header');
      const step = this.translateService.instant('rsvp.create.step', {
        current: this.step() + 1,
        total: this.steps(),
      });
      this.header.set(`${header} · ${step}`);
    });
  }

  protected setAttending(value: 'yes' | 'no'): void {
    this.draft.update((d) => ({
      ...d,
      attending: value,
      // Sadly-no clears the party toggles — there is nothing to detail.
      withPartner: value === 'no' ? false : d.withPartner,
      withChildren: value === 'no' ? false : d.withChildren,
    }));
  }

  protected toggleWithPartner(value: boolean): void {
    this.draft.update((d) => ({ ...d, withPartner: value }));
  }

  protected toggleWithChildren(value: boolean): void {
    this.draft.update((d) => ({
      ...d,
      withChildren: value,
      children: value && d.children.length === 0 ? [{ firstName: '', age: '' }] : d.children,
    }));
  }

  protected setPartnerFirstName(value: string): void {
    // A linked partner's name is owned by their own guest account and is
    // carried forward verbatim on submit — never let the draft diverge from
    // what will actually be sent (ADR W-0002 §Decision.3).
    if (this.hasLinkedPartner()) return;
    this.draft.update((d) => ({ ...d, partner: { ...d.partner, firstName: value } }));
  }

  protected setPartnerLastName(value: string): void {
    if (this.hasLinkedPartner()) return;
    this.draft.update((d) => ({ ...d, partner: { ...d.partner, lastName: value } }));
  }

  /** Mirrors `setPartnerFirstName`'s shape, plus the DS's 30-character clamp
   *  (`ScreenRSVPCreate.jsx`'s `v.slice(0, 30)`), matching the wire's
   *  `maxLength: 30`. */
  protected setPartnerNickname(value: string): void {
    if (this.hasLinkedPartner()) return;
    const nickname = value.slice(0, 30);
    this.draft.update((d) => ({ ...d, partner: { ...d.partner, nickname } }));
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

  /** Mirrors `setChildFirstName`'s shape, plus the same 30-character clamp as
   *  `setPartnerNickname`. */
  protected setChildNickname(index: number, value: string): void {
    const nickname = value.slice(0, 30);
    this.draft.update((d) => ({
      ...d,
      children: d.children.map((c, i) => (i === index ? { ...c, nickname } : c)),
    }));
  }

  protected addChild(): void {
    this.draft.update((d) => ({ ...d, children: [...d.children, { firstName: '', age: '' }] }));
  }

  protected removeChild(index: number): void {
    this.draft.update((d) => ({ ...d, children: d.children.filter((_, i) => i !== index) }));
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected back(): void {
    this.step.set(0);
  }

  protected async continue(): Promise<void> {
    // On the confirmation receipt the reply is already saved; the button only
    // hands the guest on to the standing record editor (meals & allergies).
    if (this.sent()) {
      this.submitted.emit();
      return;
    }
    if (this.step() === 0) {
      if (this.draft().attending === null) return;
      if (this.needsDetails()) {
        this.step.set(1);
        return;
      }
      await this.submit();
      return;
    }
    if (!(this.partnerReady() && this.childrenReady())) return;
    await this.submit();
  }

  private async submit(): Promise<void> {
    if (this.submitting()) return;

    this.submitting.set(true);
    this.submitFailed.set(false);

    const rsvp = this.rsvp();
    const d = this.draft();
    const status: RsvpDto.StatusEnum =
      d.attending === 'yes' ? RsvpDto.StatusEnum.ATTENDING : RsvpDto.StatusEnum.DECLINED;

    const typedPartner: RsvpDtoAdultsPartner2 | undefined =
      d.attending === 'yes' &&
      d.withPartner &&
      !this.hasLinkedPartner() &&
      d.partner.firstName.trim() &&
      d.partner.lastName.trim()
        ? // A partner typed into this screen has no account of their own — no
          // `id` — so this is `…OneOf1`, and is always `'plus-one'` (this app
          // cannot provision an account; ADR W-0004 §Decision.3, W-0002 §Decision.5).
          {
            firstName: d.partner.firstName.trim(),
            lastName: d.partner.lastName.trim(),
            nickname: d.partner.nickname?.trim() || undefined,
            kind: 'plus-one',
          }
        : undefined;

    // Declining is a change of *answer*, not a deletion of the party (ADR
    // W-0004 §Decision.6): the stored partner/children are carried forward
    // verbatim so switching back to attending finds everyone again. Explicit
    // removal — un-ticking "With my partner"/"With children" while attending
    // — is a separate condition and must not be widened into this one.
    let partner2: RsvpDtoAdultsPartner2 | undefined;
    let children: RsvpDtoChildrenInner[] | undefined;

    if (d.attending === 'no') {
      partner2 = rsvp.adults.partner2;
      children = rsvp.children;
    } else {
      // A partner account already linked server-side (`hasLinkedPartner`)
      // isn't editable here — carried forward verbatim rather than replaced.
      partner2 = d.withPartner ? (typedPartner ?? rsvp.adults.partner2) : undefined;
      children = d.withChildren
        ? d.children.map((c) => ({
            firstName: c.firstName.trim(),
            age: Number(c.age),
            nickname: c.nickname?.trim() || undefined,
          }))
        : undefined;
    }

    try {
      // The orchestrator has already provisioned this RSVP (`pending`, or a
      // prior answer) — this is always a PATCH against its `id`/`version`,
      // never a create. `adults.partner1` is always the server-canonical
      // value from `rsvp`, never client-guessed.
      await firstValueFrom(
        this.rsvpCollection.update({
          id: rsvp.id,
          version: rsvp.version,
          status,
          adults: { partner1: rsvp.adults.partner1, partner2 },
          children,
        }),
      );
      this.sent.set(true);
      this.step.set(this.steps() - 1);
    } catch {
      this.submitFailed.set(true);
    } finally {
      this.submitting.set(false);
    }
  }
}
