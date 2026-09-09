import { ChangeDetectionStrategy, Component, DestroyRef, Signal, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';

import { map } from 'rxjs';
import { EntityCollectionService, EntityServices } from '@ngrx/data';
import { TranslatePipe } from '@ngx-translate/core';

import {
  CreateWeddingConfigDtoGoodToKnowInner,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf1,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf2,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf3,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf4,
  CreateWeddingConfigDtoGoodToKnowInnerOneOf5,
  EntityNamesEnum,
  TranslateLanguageService,
  UserProfileDto,
  WeddingConfigResponseDto,
} from '@app/core';
import { ThemeService } from '@app/core/theme.service';
import { Icon } from '@app/shared/icons/icon';
import { DecorFish } from '@app/shared/decor/fish';
import { LangCode, LangDescriptionType, ThemeId } from '@app/model';

/**
 * Home's "Good to know" section (hub ADR-0045 §4's umbrella pill row),
 * rendering the couple's own `goodToKnow` blocks off the wedding
 * configuration (hub **ADR-0046**, T375).
 *
 * **Every word a guest reads inside a block is the couple's** — read from
 * `GET /v1/config`, never from a locale file. T364 shipped this component as
 * an honest empty state precisely because no such content existed anywhere in
 * the product; ADR-0046 created it, and hard rule 19 now forbids putting a
 * dress-code line, an FAQ question or an IBAN back into `es.json`. The four
 * blocks `ScreenInfo.jsx` draws are the designer's guess at what guests ask,
 * not requirements — the empty state below is still what the app renders on
 * the day this ships, and stays until the couple writes something.
 *
 * The read rides Home's existing wedding-configuration fetch (the same
 * `EntityNamesEnum.WEDDING_CONFIG` singleton `Travel` and `HomeToday` read) —
 * no new endpoint, no new service, no state of this component's own beyond
 * the two purely-local UI bits below (which FAQ row is open, which copy
 * button just fired).
 *
 * Three things are derived here and never stored (ADR-0046 §2), because a
 * stored copy of any of them is a defect:
 *
 * - the dress-code **swatch row**, read off the active theme so it can never
 *   disagree with the CONFIG `themeId`;
 * - **which `day-line` variant shows**, computed from today's `Europe/Madrid`
 *   date against the config's `rsvpDeadline` and `date` (§4) — the API stores
 *   three sentences and picks none;
 * - **whether a block renders at all**, which is presence in the array (§3).
 *   There are no per-block toggles and none may be added.
 *
 * Stored order is render order. On wide screens the same sequence is split
 * into two columns (`ScreenInfo.jsx:169-186`) — layout, not a second
 * ordering: the first half of the array fills the left column top-to-bottom,
 * the rest the right, so a reader scans the couple's order either way. The
 * kit's own desktop distribution (dress code + contacts left; gifts, FAQ and
 * the day line right) is hand-picked for its own five fixture blocks and is
 * not a rule that generalizes to content nobody has written yet.
 */

/** The generated union of block shapes. Aliased, not redeclared (hard rule
 *  15): the alias resolves to the generated type, so a regenerated client
 *  that renames or reshapes a member is a compile error here rather than
 *  silent drift. */
type GoodToKnowBlock = CreateWeddingConfigDtoGoodToKnowInner;

/**
 * The block-type discriminants cannot narrow the generated union: the OpenAPI
 * `const` on each member's `type` is flattened to a plain `string` by the
 * generator (every member reads `type: string`), so `block.type === 'gift'`
 * tells TypeScript nothing. These six one-liners are the whole workaround —
 * a cast *within* the union the value already belongs to, in one place, so no
 * call site has to repeat it and no local copy of the block shapes exists.
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

/** One dress-code colour chip: the CSS custom property the theme resolves it
 *  from, and the i18n key naming it. Derived from the active theme, never
 *  authored (ADR-0046 §2). */
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

/** One labelled gift row the couple actually filled — an empty field is not a
 *  row (ADR-0046 §2). `copyKey` is set only on the two rows the DS gives a
 *  copy button (`ScreenInfo.jsx`): copyability is a design decision, not a
 *  stored one. */
interface GiftRow {
  readonly key: string;
  readonly labelKey: string;
  readonly value: string;
  readonly copyable: boolean;
}

/** One FAQ row, already locale-picked. */
interface FaqRow {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

/**
 * One contact row. Only `purpose` is stored on the block — since contract
 * commit `0dc09db` a `contacts` entry is `{ userId, purpose }`, a reference to
 * a user of the system, so the **name and number are resolved from that
 * user's profile** rather than transcribed onto the CONFIG row. They are
 * still identifiers: reproduced exactly as the profile carries them, in every
 * locale (ADR-0046 §5).
 *
 * `phone`/`tel` are nullable because `UserProfileDto.phoneNumber` is optional
 * *and* couple-gated on the API side — for a guest reading `GET /v1/profile`
 * it is simply absent, which unambiguously means "don't show this line" (the
 * same reading `people.ts` already documents). No number, no call button; the
 * name and the purpose line still render.
 *
 * `tel` is the dial href — whitespace-stripped for the URI, which is a *link
 * target*, not a rendered value. No WhatsApp, no email, no other channel (hub
 * ADR-0014).
 */
interface ContactRow {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  readonly phone: string | null;
  readonly tel: string | null;
}

/**
 * One block, projected for rendering: the stored `type` verbatim (the
 * template switches on it) plus the already-locale-picked strings for that
 * one shape. A UI projection, not a copy of an API model — every field is
 * either resolved prose, a derived href or a token name.
 */
interface RenderedBlock {
  readonly id: string;
  /** Straight from the block, unmodified — never a local re-typing of the
   *  closed set (hard rule 15). */
  readonly type: string;
  /** The section label the guest reads: authored, not a UI string. */
  readonly title: string;
  readonly dressCode?: {
    readonly headline: string;
    readonly body: string;
    readonly note: string | null;
    readonly swatches: readonly Swatch[];
  };
  readonly gift?: {
    readonly intro: string | null;
    readonly rows: readonly GiftRow[];
    readonly bizumPhone: string | null;
    readonly bizumNote: string | null;
  };
  readonly faq?: readonly FaqRow[];
  readonly contacts?: readonly ContactRow[];
  /** The one `day-line` sentence this calendar day resolves to. */
  readonly dayLine?: string;
  readonly note?: string;
}

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

@Component({
  selector: 'app-good-to-know',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, NgTemplateOutlet, Icon, DecorFish],
  templateUrl: './good-to-know.html',
  styleUrl: './good-to-know.scss',
})
export class GoodToKnow {
  private readonly lang = inject(TranslateLanguageService);
  private readonly theme = inject(ThemeService);

  private readonly weddingConfigCollection: EntityCollectionService<WeddingConfigResponseDto> =
    inject(EntityServices).getEntityCollectionService<WeddingConfigResponseDto>(
      EntityNamesEnum.WEDDING_CONFIG,
    );

  /** Singleton resource: the collection holds at most one document. The same
   *  read `Travel` and `HomeToday` make — Home's sections are a `@switch`, so
   *  only one of them is ever mounted and each owns its own data (T372). */
  private readonly weddingConfig: Signal<WeddingConfigResponseDto | undefined> = toSignal(
    this.weddingConfigCollection.entities$.pipe(map((configs) => configs[0])),
    { initialValue: undefined },
  );

  /**
   * The people directory (`GET /v1/profile`), read for exactly one reason: a
   * `contacts` entry stores a `userId`, so the name and number a guest reads
   * live on that user's profile, not on the CONFIG row (contract `0dc09db`,
   * which lands after ADR-0046 §2 was written and which the hub still owes an
   * amendment for). The same shared, cached `@ngrx/data` collection `/people`
   * already fills — guarded on `loaded$` exactly as `people.ts` does, so this
   * costs one request per session at most and none at all if the directory is
   * already in the store.
   */
  private readonly userProfileCollection: EntityCollectionService<UserProfileDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE);

  private readonly profilesById = computed(() => {
    const byId = new Map<string, UserProfileDto>();
    for (const profile of this.userProfiles()) byId.set(profile.id, profile);
    return byId;
  });

  private readonly userProfiles: Signal<readonly UserProfileDto[]> = toSignal(
    this.userProfileCollection.entities$,
    { initialValue: [] },
  );

  constructor() {
    this.weddingConfigCollection.getByKey(''); // Singleton resource, always fetches the same document
    this.userProfileCollection.loaded$.subscribe((loaded) => {
      if (!loaded) {
        this.userProfileCollection.getAll(); // Only fetches if cache is empty
      }
    });
    inject(DestroyRef).onDestroy(() => this.clearCopyTimer());
  }

  /** Stored order, untouched: never sorted, grouped or re-arranged by type
   *  (ADR-0046 §3). An absent field is an empty list, which is the empty
   *  state — not a placeholder card. */
  protected readonly blocks = computed<readonly RenderedBlock[]>(() => {
    const config = this.weddingConfig();
    if (!config?.goodToKnow) return [];
    const lang = this.lang.currentLang();
    const swatches = PALETTES[this.theme.theme()] ?? PALETTES.terracotta;
    const people = this.profilesById();
    return config.goodToKnow.map((block) => this.render(block, lang, swatches, config, people));
  });

  /** The first half of the sequence — the left column at `≥900px`, and simply
   *  the first blocks in the single flow below it. */
  protected readonly leftColumn = computed(() =>
    this.blocks().slice(0, Math.ceil(this.blocks().length / 2)),
  );

  /** The rest, in the same stored order. */
  protected readonly rightColumn = computed(() =>
    this.blocks().slice(Math.ceil(this.blocks().length / 2)),
  );

  /** Which FAQ entry is open, across every FAQ block on the screen — the DS's
   *  single-open accordion. Every entry starts closed (ADR-0046 §3, owner's
   *  decision overriding the mock's `useState(0)`). */
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

  private render(
    block: GoodToKnowBlock,
    lang: LangCode,
    swatches: readonly Swatch[],
    config: WeddingConfigResponseDto,
    people: ReadonlyMap<string, UserProfileDto>,
  ): RenderedBlock {
    const pick = (value: LangDescriptionType): string => value[lang];
    const base = { id: block.id, type: block.type, title: pick(block.title) };

    switch (block.type) {
      case 'dress-code': {
        const dressCode = asDressCode(block);
        return {
          ...base,
          dressCode: {
            headline: pick(dressCode.headline),
            body: pick(dressCode.body),
            note: dressCode.note ? pick(dressCode.note) : null,
            swatches,
          },
        };
      }
      case 'gift': {
        const gift = asGift(block);
        // Only the fields the couple filled become rows; an empty one is not
        // a row (ADR-0046 §2). `reference` is prose — an instruction, not an
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
            value: pick(gift.reference),
            copyable: false,
          });
        }
        return {
          ...base,
          gift: {
            intro: gift.intro ? pick(gift.intro) : null,
            rows,
            bizumPhone: gift.bizumPhone ?? null,
            bizumNote: gift.bizumNote ? pick(gift.bizumNote) : null,
          },
        };
      }
      case 'faq':
        return {
          ...base,
          faq: asFaq(block).entries.map((entry) => ({
            id: entry.id,
            question: pick(entry.question),
            answer: pick(entry.answer),
          })),
        };
      case 'contacts': {
        // An entry whose `userId` resolves to nobody renders nothing — a
        // deleted account, or the directory not read yet. Never a row saying
        // "unknown": the couple pointed at a person, and half a person is
        // worse than none. A block whose every entry is unresolvable renders
        // no card at all, the same way an absent block does.
        const rows = asContacts(block).entries.flatMap<ContactRow>((entry) => {
          const person = people.get(entry.userId);
          if (!person) return [];
          const phone = person.phoneNumber ?? null;
          return [
            {
              id: entry.userId,
              name: `${person.firstName} ${person.lastName}`.trim(),
              purpose: pick(entry.purpose),
              phone,
              tel: phone ? `tel:${stripped(phone)}` : null,
            },
          ];
        });
        return { ...base, contacts: rows.length > 0 ? rows : undefined };
      }
      case 'day-line': {
        const dayLine = asDayLine(block);
        return { ...base, dayLine: pick(this.dayLineVariant(dayLine, config)) };
      }
      default:
        // `note` — the couple's free-form block, and the pressure valve that
        // keeps the block-type enum closed (ADR-0046 §1). Plain prose: no
        // Markdown, no HTML, nothing renders it (§2).
        return { ...base, note: pick(asNote(block).body) };
    }
  }

  /**
   * Which of the three authored sentences today is (ADR-0046 §4), by calendar
   * date in `Europe/Madrid`: on or before `rsvpDeadline` → `rsvpOpen`; after
   * it and on or before the wedding `date` → `rsvpClosed`; after the wedding
   * → `afterWedding`. Computed here every render — no stored field says which
   * phase is current, and none may be requested.
   *
   * A config date that will not parse falls back to `rsvpOpen`, the state the
   * document is in for most of its life; the alternative (rendering nothing)
   * would silently drop a block the couple wrote.
   */
  private dayLineVariant(
    block: CreateWeddingConfigDtoGoodToKnowInnerOneOf4,
    config: WeddingConfigResponseDto,
  ): LangDescriptionType {
    const today = madridCalendarDate(new Date());
    const deadline = madridCalendarDate(new Date(config.rsvpDeadline));
    const wedding = madridCalendarDate(new Date(config.date));
    if (!today || !deadline || !wedding) return block.rsvpOpen;
    if (today <= deadline) return block.rsvpOpen;
    if (today <= wedding) return block.rsvpClosed;
    return block.afterWedding;
  }
}
