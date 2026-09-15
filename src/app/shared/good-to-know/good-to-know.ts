import { ChangeDetectionStrategy, Component, DestroyRef, Signal, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { catchError, map, of } from 'rxjs';
import { EntityCollectionService, EntityServices } from '@ngrx/data';
import { TranslatePipe } from '@ngx-translate/core';

import {
  AppJwtClaimsDto,
  CreateWeddingConfigDtoGeneralInfoContactGuestInner,
  CreateWeddingConfigDtoGeneralInfoContactWeddingPlannerInner,
  EntityNamesEnum,
  TranslateLanguageService,
  WeddingConfigResponseDto,
  WeddingConfigurationService,
  WeddingGeneralInformationDto,
  WeddingGeneralInformationDtoContactCoupleBride,
  WeddingGeneralInformationDtoDayLine,
} from '@app/core';
import { ThemeService } from '@app/core/theme.service';
import { Icon } from '@app/shared/icons/icon';
import { DecorFish } from '@app/shared/decor/fish';
import { LangCode, LangDescriptionType, ThemeId } from '@app/model';

/**
 * Home's "Good to know" section, rendering the couple's own `generalInfo`
 * sections (hub **ADR-0047 §1/§2**, T383).
 *
 * **Every word a guest reads inside a section is the couple's** — never from a
 * locale file (hard rule 19). What *is* a locale string here is the chrome
 * around it: the section labels. ADR-0046's block carried an authored `title`;
 * the fixed shape has no per-section title at all — `note.title` is the one
 * exception and ADR-0047 §1 makes it the section label for that one. So
 * "What to wear" and "Gifts" are UI labels now, exactly as `ScreenInfo.jsx`
 * hardcodes them, and nothing a couple wrote has been moved into `es.json`.
 *
 * ## Where the content comes from, and what that costs
 *
 * `GET /v1/config/general-information` (ADR-0047 §4), **not** the wedding
 * configuration Home already reads. That is one more HTTP call than ADR-0046
 * deliberately spent, and the reason it is worth it is `contact.couple`:
 *
 * - On this route `contact` and `contact.couple` are **required** — the
 *   service composes the digest from the CONFIG document at read time and
 *   resolves Amendment 2's choice on the server.
 * - On `GET /v1/config` there is no couple inside `generalInfo.contact` at
 *   all, and root `couple?` is **optional** (T248's expand phase). Riding that
 *   read would mean re-deciding, client-side, what to show when a row written
 *   before the backfill has no couple — a second copy of a decision the API
 *   has already made, in a bundle that (hard rule 17) can be a week older than
 *   the API making it.
 *
 * The wedding configuration is still read here, for exactly two fields:
 * `rsvpDeadline` and `date`, which the `dayLine` variant is chosen against.
 * The route does not carry them and should not — they are not Good-to-know
 * content. That read is the `EntityNamesEnum.WEDDING_CONFIG` singleton
 * `Travel` and `HomeToday` already fetch, so it is a cache hit, not a third
 * request.
 *
 * ## Ordering is structural
 *
 * Each section has its own field and the template renders the design system's
 * fixed order. There is **no stored order, no block array, no per-type
 * dispatch and no id-keyed bookkeeping** — every trace of that is gone rather
 * than left as a dead branch, because a dead branch is how the next reader
 * concludes ordering is still authored.
 *
 * ## Three things are derived here and never stored (ADR-0046 §2, unchanged)
 *
 * - the dress-code **swatch row**, read off the active theme so it can never
 *   disagree with the CONFIG `themeId` (ADR-0047 §6 re-affirms this: build
 *   nothing for naming swatches);
 * - **which `dayLine` variant shows**, computed from today's `Europe/Madrid`
 *   date against `rsvpDeadline` and `date` (ADR-0046 §4) — the API stores
 *   three sentences and picks none, and no stored field says which phase is
 *   current;
 * - **whether a section renders at all**, which is presence of its field.
 *   There are no per-section toggles and none may be added.
 */

/** One dress-code colour chip: the CSS custom property the theme resolves it
 *  from, and the i18n key naming it. Derived from the active theme, never
 *  authored (ADR-0046 §2, re-affirmed by ADR-0047 §6). */
interface Swatch {
  readonly token: string;
  readonly labelKey: string;
}

/** The five chips per theme, in the DS's own order (`ScreenInfo.jsx:7-11`).
 *  Values are token *names* — the resolved colour is whatever `data-theme`
 *  currently makes them, which is the point. */
const PALETTES: Record<ThemeId, readonly Swatch[]> = {
  terracotta: [
    { token: '--accent', labelKey: 'home.goodToKnowSection.palette.terracotta.accent' },
    { token: '--accent-2', labelKey: 'home.goodToKnowSection.palette.terracotta.accent2' },
    { token: '--accent-3', labelKey: 'home.goodToKnowSection.palette.terracotta.accent3' },
    { token: '--chip', labelKey: 'home.goodToKnowSection.palette.terracotta.chip' },
    { token: '--ink', labelKey: 'home.goodToKnowSection.palette.terracotta.ink' },
  ],
  mauve: [
    { token: '--accent', labelKey: 'home.goodToKnowSection.palette.mauve.accent' },
    { token: '--accent-2', labelKey: 'home.goodToKnowSection.palette.mauve.accent2' },
    { token: '--accent-3', labelKey: 'home.goodToKnowSection.palette.mauve.accent3' },
    { token: '--chip', labelKey: 'home.goodToKnowSection.palette.mauve.chip' },
    { token: '--ink', labelKey: 'home.goodToKnowSection.palette.mauve.ink' },
  ],
  verdeagua: [
    { token: '--accent', labelKey: 'home.goodToKnowSection.palette.verdeagua.accent' },
    { token: '--accent-2', labelKey: 'home.goodToKnowSection.palette.verdeagua.accent2' },
    { token: '--accent-3', labelKey: 'home.goodToKnowSection.palette.verdeagua.accent3' },
    { token: '--chip', labelKey: 'home.goodToKnowSection.palette.verdeagua.chip' },
    { token: '--ink', labelKey: 'home.goodToKnowSection.palette.verdeagua.ink' },
  ],
};

/** The dress-code card, already locale-picked. */
interface DressCodeCard {
  readonly headline: string;
  readonly body: string;
  readonly note: string | null;
  readonly swatches: readonly Swatch[];
}

/** One labelled gift row the couple actually filled — an empty field is not a
 *  row (ADR-0046 §2). `copyable` is set only on the two rows the DS gives a
 *  copy button (`ScreenInfo.jsx`): copyability is a design decision, not a
 *  stored one. */
interface GiftRow {
  readonly key: string;
  readonly labelKey: string;
  readonly value: string;
  readonly copyable: boolean;
}

/** The gift card: the authored intro, the filled identifier rows, and Bizum. */
interface GiftCard {
  readonly intro: string | null;
  readonly rows: readonly GiftRow[];
  readonly bizumPhone: string | null;
  readonly bizumNote: string | null;
}

/** One FAQ row, already locale-picked. Keyed by its stored **ULID `id`**, not
 *  by index (ADR-0047 §1: the id exists so a row survives a reorder). */
interface FaqRow {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

/** One free-form note, already locale-picked. Its authored **`title` is the
 *  section label** — never unlabelled prose (ADR-0047 §1) — and, like the FAQ
 *  rows, it is keyed by its stored ULID. */
interface NoteCard {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

/**
 * One contact row.
 *
 * The card opens with the **couple**, composed server-side by the read route
 * (ADR-0047 §4) — the design system's own contacts list is built the same way
 * (`ScreenInfo.jsx:61-64`: bride and groom first, then everyone else). Then
 * the wedding planners, then the guests. A couple or planner row names itself
 * through its **role**; a guest row carries the couple's authored `purpose` —
 * *what to ask them about* — which ADR-0047 §2 calls the point of the section.
 *
 * `phone` and `tel` are **nullable, and absent means no call button — not a
 * disabled one** (T383). Today only a couple member can reach that state: the
 * contract makes `phoneNumber` required on a `weddingPlanner` and a `guest`
 * entry and optional on the composed couple digest. The row is built for the
 * absence regardless, because which of the three grows an optional number is
 * the API's call and this bundle outlives any one version of it (hard rule 17).
 *
 * `email` is new exposure, accepted by **ADR-0047 §3**: a signed-in guest sees
 * a listed person's name, email and number *in this section*. ADR-0035 §7/§8
 * is untouched — none of it reaches a profile screen, and none of it reaches
 * an unauthenticated surface (hard rule 19c).
 *
 * Name, number and email are **identifiers**: reproduced exactly as the API
 * returns them in every locale, with no `Intl` formatting, grouping or
 * re-casing (ADR-0046 §5, kept by ADR-0047 §6). `tel` is the dial href —
 * whitespace-stripped for the URI, which is a *link target*, not a rendered
 * value. No WhatsApp, no email link, no other channel (hub ADR-0014).
 */
interface ContactRow {
  readonly id: string;
  readonly name: string;
  /** The authored purpose line; `null` on a couple or wedding-planner row,
   *  which the contract gives no `purpose` and which names itself by role. */
  readonly purpose: string | null;
  /** The i18n key naming this person's role; `null` for an unrecognised role,
   *  which renders no role line rather than a raw key. */
  readonly roleKey: string | null;
  readonly phone: string | null;
  readonly tel: string | null;
  readonly email: string | null;
}

/**
 * The i18n key naming each role, keyed off the **generated** enum so a
 * regenerated client that adds or renames a role is a compile error here
 * (hard rule 15). An unrecognised value maps to `null` and the row simply
 * renders no role line — the same tolerance `login.service.ts` shows, for
 * ADR-0047 §7's reason: a stale bundle meets `wedding-planner` before it has
 * been deployed a name for it.
 */
const ROLE_LABEL_KEY: Readonly<Record<string, string>> = {
  [AppJwtClaimsDto.RoleEnum.BRIDE]: 'roles.bride',
  [AppJwtClaimsDto.RoleEnum.GROOM]: 'roles.groom',
  [AppJwtClaimsDto.RoleEnum.GUEST]: 'roles.guest',
  [AppJwtClaimsDto.RoleEnum.WEDDING_PLANNER]: 'roles.wedding-planner',
  [AppJwtClaimsDto.RoleEnum.PROVIDER]: 'roles.provider',
};

/** The reference timezone every date in this system is reckoned in
 *  (`SPEC.md` Constants; ADR-0046 §4). */
const REFERENCE_TIMEZONE = 'Europe/Madrid';

/**
 * A calendar date in `Europe/Madrid`, as `YYYY-MM-DD` — the form two of them
 * compare correctly as plain strings. `en-CA` is the locale whose short date
 * format *is* ISO order; the locale is an implementation detail of that
 * format and never the guest's, so this can never drift with the UI language.
 * Returns `null` for an unparseable instant.
 */
function madridCalendarDate(value: Date): string | null {
  if (Number.isNaN(value.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: REFERENCE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

/** Whitespace-stripped copy of an identifier — for the clipboard and for a
 *  `tel:` URI only. What renders is always the value exactly as stored. */
function stripped(value: string): string {
  return value.replace(/\s/g, '');
}

/**
 * Writes an identifier to the clipboard, reporting whether it actually landed
 * there. `false` covers both refusal (a denied permission prompt) and absence
 * (no `navigator.clipboard` at all, e.g. an insecure context) — the caller
 * shows a confirmation only on `true`.
 */
async function writeToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(stripped(value));
    return true;
  } catch {
    // Unavailable or refused. No confirmation, and the value stays selectable
    // by hand — it is plain text in the row.
    return false;
  }
}

/** How long a copy result stays on the button, matching the DS's own
 *  `window.setTimeout(…, 1600)` (`ScreenInfo.jsx:52`). */
const COPY_FEEDBACK_MS = 1600;

/** A person the contacts card can render, whatever section they came from. */
type ContactPerson =
  | WeddingGeneralInformationDtoContactCoupleBride
  | CreateWeddingConfigDtoGeneralInfoContactWeddingPlannerInner
  | CreateWeddingConfigDtoGeneralInfoContactGuestInner;

@Component({
  selector: 'app-good-to-know',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, Icon, DecorFish],
  templateUrl: './good-to-know.html',
  styleUrl: './good-to-know.scss',
})
export class GoodToKnow {
  private readonly lang = inject(TranslateLanguageService);
  private readonly theme = inject(ThemeService);
  private readonly configApi = inject(WeddingConfigurationService);

  private readonly weddingConfigCollection: EntityCollectionService<WeddingConfigResponseDto> =
    inject(EntityServices).getEntityCollectionService<WeddingConfigResponseDto>(
      EntityNamesEnum.WEDDING_CONFIG,
    );

  /**
   * The wedding configuration, read for `rsvpDeadline` and `date` alone — the
   * two fields the `dayLine` variant is chosen against. Singleton resource:
   * the collection holds at most one document, and it is the same read
   * `Travel` and `HomeToday` make.
   */
  private readonly weddingConfig: Signal<WeddingConfigResponseDto | undefined> = toSignal(
    this.weddingConfigCollection.entities$.pipe(map((configs) => configs[0])),
    { initialValue: undefined },
  );

  /**
   * The couple's authored sections, from the authenticated read route
   * (ADR-0047 §4). A failed read resolves to `undefined` and the whole section
   * renders nothing: the HTTP error interceptor has already seen the failure
   * and owns what the guest is told about it (hard rule 17b), so swallowing it
   * here degrades the section rather than breaking Home around it.
   */
  private readonly generalInfo: Signal<WeddingGeneralInformationDto | undefined> = toSignal(
    this.configApi
      .weddingConfigControllerGetGeneralInformationV1()
      .pipe(catchError(() => of(undefined))),
    { initialValue: undefined },
  );

  constructor() {
    this.weddingConfigCollection.getByKey(''); // Singleton resource, always fetches the same document
    inject(DestroyRef).onDestroy(() => this.clearCopyTimer());
  }

  /** Picks the guest's locale out of a stored `{es,en,fr}` triple. */
  private pick(value: LangDescriptionType): string {
    return value[this.lang.currentLang() as LangCode];
  }

  // ── the six sections, each its own field (ADR-0047 §1) ──────────────────

  protected readonly dressCode = computed<DressCodeCard | null>(() => {
    const dress = this.generalInfo()?.dressCode;
    if (!dress) return null;
    return {
      headline: this.pick(dress.headline),
      body: this.pick(dress.body),
      note: dress.note ? this.pick(dress.note) : null,
      swatches: PALETTES[this.theme.theme()] ?? PALETTES.terracotta,
    };
  });

  protected readonly gift = computed<GiftCard | null>(() => {
    const gift = this.generalInfo()?.gift;
    if (!gift) return null;
    // Only the fields the couple filled become rows; an empty one is not a
    // row (ADR-0046 §2). `reference` is prose — an instruction, not an
    // identifier — so it is the one localized value here (§5).
    const rows: GiftRow[] = [];
    if (gift.accountHolder) {
      rows.push({
        key: 'accountHolder',
        labelKey: 'home.goodToKnowSection.gift.accountHolder',
        value: gift.accountHolder,
        copyable: false,
      });
    }
    if (gift.iban) {
      rows.push({
        key: 'iban',
        labelKey: 'home.goodToKnowSection.gift.iban',
        value: gift.iban,
        copyable: true,
      });
    }
    if (gift.bic) {
      rows.push({
        key: 'bic',
        labelKey: 'home.goodToKnowSection.gift.bic',
        value: gift.bic,
        copyable: true,
      });
    }
    if (gift.reference) {
      rows.push({
        key: 'reference',
        labelKey: 'home.goodToKnowSection.gift.reference',
        value: this.pick(gift.reference),
        copyable: false,
      });
    }
    return {
      intro: gift.intro ? this.pick(gift.intro) : null,
      rows,
      bizumPhone: gift.bizumPhone ?? null,
      bizumNote: gift.bizumNote ? this.pick(gift.bizumNote) : null,
    };
  });

  /**
   * The contacts card: the couple, then the wedding planners, then the
   * guests. The couple comes off `contact.couple`, which the route composes
   * server-side and the contract marks required — so the card is never empty
   * once the route has answered, and this component never re-decides what to
   * do when a CONFIG row predates the couple backfill.
   */
  protected readonly contacts = computed<readonly ContactRow[]>(() => {
    const contact = this.generalInfo()?.contact;
    if (!contact) return [];
    return [
      this.contactRow('couple-bride', contact.couple.bride, AppJwtClaimsDto.RoleEnum.BRIDE, null),
      this.contactRow('couple-groom', contact.couple.groom, AppJwtClaimsDto.RoleEnum.GROOM, null),
      // A wedding planner's role states what to ask them; a guest's does not,
      // which is why only the guest entry carries `purpose` (ADR-0047 §2).
      ...(contact.weddingPlanner ?? []).map((person) =>
        this.contactRow(person.id, person, person.role, null),
      ),
      ...(contact.guest ?? []).map((person) =>
        this.contactRow(person.id, person, person.role, this.pick(person.purpose)),
      ),
    ];
  });

  protected readonly faq = computed<readonly FaqRow[]>(() =>
    (this.generalInfo()?.faq ?? []).map((entry) => ({
      id: entry.id,
      question: this.pick(entry.question),
      answer: this.pick(entry.answer),
    })),
  );

  /** The one `dayLine` sentence this calendar day resolves to, or `null` when
   *  the couple wrote no day line. */
  protected readonly dayLine = computed<string | null>(() => {
    const dayLine = this.generalInfo()?.dayLine;
    if (!dayLine) return null;
    return this.pick(this.dayLineVariant(dayLine));
  });

  protected readonly notes = computed<readonly NoteCard[]>(() =>
    (this.generalInfo()?.note ?? []).map((entry) => ({
      id: entry.id,
      title: this.pick(entry.title),
      body: this.pick(entry.body),
    })),
  );

  // ── purely-local UI state ───────────────────────────────────────────────

  /** Which FAQ entry is open — the DS's single-open accordion. Every entry
   *  starts closed (ADR-0046 §3, owner's decision overriding the mock's
   *  `useState(0)`). */
  private readonly openFaqId = signal<string | null>(null);

  protected isFaqOpen(id: string): boolean {
    return this.openFaqId() === id;
  }

  protected toggleFaq(id: string): void {
    this.openFaqId.update((open) => (open === id ? null : id));
  }

  /**
   * The copy button's transient result, or `null`. **A confirmation appears
   * only when the clipboard call actually resolved** (hard rule 19b): the DS
   * mock flips to "Copied ✓" unconditionally (`ScreenInfo.jsx:50-52`), and a
   * guest who believes a wrong IBAN is on their clipboard is worse off than
   * one told it failed.
   */
  protected readonly copyResult = signal<{ key: string; ok: boolean } | null>(null);

  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  protected async copy(key: string, value: string): Promise<void> {
    this.clearCopyTimer();
    this.copyResult.set({ key, ok: await writeToClipboard(value) });
    this.copyTimer = setTimeout(() => this.copyResult.set(null), COPY_FEEDBACK_MS);
  }

  private clearCopyTimer(): void {
    if (this.copyTimer !== null) {
      clearTimeout(this.copyTimer);
      this.copyTimer = null;
    }
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private contactRow(
    id: string,
    person: ContactPerson,
    role: string,
    purpose: string | null,
  ): ContactRow {
    const phone = person.phoneNumber ?? null;
    return {
      id,
      name: [person.firstName, person.lastName].filter(Boolean).join(' '),
      purpose,
      roleKey: ROLE_LABEL_KEY[role] ?? null,
      phone,
      // No number, no call button — absent, not disabled.
      tel: phone ? `tel:${stripped(phone)}` : null,
      email: person.email ?? null,
    };
  }

  /**
   * Which of the three authored sentences today is (ADR-0046 §4, unchanged by
   * ADR-0047), by calendar date in `Europe/Madrid`: on or before
   * `rsvpDeadline` → `rsvpOpen`; after it and on or before the wedding `date`
   * → `rsvpClosed`; after the wedding → `afterWedding`. Computed here every
   * render — no stored field says which phase is current, and none may be
   * requested.
   *
   * A missing or unparseable config date falls back to `rsvpOpen`, the state
   * the document is in for most of its life; the alternative (rendering
   * nothing) would silently drop a section the couple wrote.
   */
  private dayLineVariant(dayLine: WeddingGeneralInformationDtoDayLine): LangDescriptionType {
    const config = this.weddingConfig();
    const today = madridCalendarDate(new Date());
    const deadline = config ? madridCalendarDate(new Date(config.rsvpDeadline)) : null;
    const wedding = config ? madridCalendarDate(new Date(config.date)) : null;
    if (!today || !deadline || !wedding) return dayLine.rsvpOpen;
    if (today <= deadline) return dayLine.rsvpOpen;
    if (today <= wedding) return dayLine.rsvpClosed;
    return dayLine.afterWedding;
  }
}
