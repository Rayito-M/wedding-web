import { Component, ChangeDetectionStrategy, computed, inject, type Signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { map } from 'rxjs';
import { EntityCollectionService, EntityServices } from '@ngrx/data';
import { TranslatePipe } from '@ngx-translate/core';

import {
  byAgendaTime,
  EntityNamesEnum,
  isFirstLoad,
  LoginService,
  RsvpDto,
  UserProfileDto,
  WeddingConfigResponseDto,
  TranslateLanguageService,
  PluralTranslatePipe,
  AgendaTimePipe,
} from '@app/core';

import { DecorFish } from '../decor/fish';
import { ProgressBar } from '../progress-bar/progress-bar';
import { RsvpStatusTick } from '../rsvp-status-tick/rsvp-status-tick';
import { StatusPill } from '../status-pill/status-pill';
import { TimelineItem } from '../timeline-item/timeline-item';

/** `adults.partner2`'s account id, when it has one — the union's second
 *  member (`…OneOf1`) carries no `id` at all, so it is only readable behind
 *  an `in` check (ADR W-0004 §Decision.1, §Consequences). */
function partner2Id(rsvp: RsvpDto): string | undefined {
  const partner2 = rsvp.adults.partner2;
  return partner2 && 'id' in partner2 ? partner2.id : undefined;
}

/**
 * Home's shared "Today" content (DS `ScreenHome.jsx`'s `content` branch, hub
 * ADR-0045 §2/§4, T372) — greeting, countdown, day highlights, live-album
 * preview, with the guest's RSVP recap dropped for the couple
 * (`role === 'couple' ? null : rsvpConfirmed`, kit line ~201). One component,
 * both roles' Home pill row default section: `invitee.ts` (guest, `/me`) and
 * `dashboard.ts` (couple, `/dashboard`) both mount this for their `'today'`
 * section instead of each re-declaring the countdown/highlights markup —
 * exactly the same "shared full-data-owning section component" shape
 * `Travel`/`GoodToKnow` already use for the "Getting there"/"Good to know"
 * pills (`invitee.html`/`dashboard.html`'s own `@switch (section())`).
 *
 * Gates the RSVP-recap card on {@link LoginService.isCouple} — never on route
 * location — matching CLAUDE.md hard rule 16's reasoning for `lastSeen`: an
 * explicit "is this viewer the couple" signal, not an inference from which
 * screen mounted this component. The live-album preview stays commented out
 * here exactly as it already was in `invitee.html` before this extraction —
 * `/album` is not an enabled destination (hub ADR-0045 §2's "+ Album only if
 * ever re-scoped"), so neither role renders it; this is a carried-over scope
 * cut, not a new one.
 */
@Component({
  selector: 'app-home-today',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DecorFish,
    ProgressBar,
    DatePipe,
    TranslatePipe,
    RsvpStatusTick,
    PluralTranslatePipe,
    AgendaTimePipe,
    StatusPill,
    TimelineItem,
  ],
  templateUrl: './home-today.html',
  styleUrl: './home-today.scss',
})
export class HomeToday {
  private readonly login = inject(LoginService);
  private readonly translate = inject(TranslateLanguageService);

  /** The couple never sees the guest RSVP recap card (kit `ScreenHome.jsx`
   *  `content`'s `role === 'couple' ? null : rsvpConfirmed`) — gated on the
   *  signed-in user's own role, never on which route mounted this component. */
  protected readonly isCouple = this.login.isCouple;

  private readonly userProfileCollection: EntityCollectionService<UserProfileDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE);

  readonly currentUser = computed(() => {
    const user = this.login.currentUserClaims();
    // The couple has no guest RSVP record of its own — only fetch/read one
    // for a guest viewer, matching the card this data feeds being hidden
    // entirely for the couple (`isCouple` above).
    if (user && !this.isCouple()) {
      this.rsvpCollection.keys$.subscribe((keys) => {
        if (!keys || keys.length === 0 || !(keys as string[]).includes(user.sub)) {
          this.rsvpCollection.getByKey(user.sub); // Only fetches if cache is empty
        }
      });
    }
    return user;
  });

  protected readonly profile: Signal<UserProfileDto | undefined> = toSignal(
    this.userProfileCollection.entities$.pipe(
      map((profiles) => {
        const currentUser = this.login.currentUserClaims();
        return currentUser?.sub ? profiles.find((p) => p.id === currentUser.sub) : undefined;
      }),
    ),
    { initialValue: undefined },
  );

  private readonly rsvpCollection: EntityCollectionService<RsvpDto> = inject(
    EntityServices,
  ).getEntityCollectionService<RsvpDto>(EntityNamesEnum.RSVP);

  protected readonly rsvpStatus = computed(() => this.rsvp()?.status);

  protected readonly rsvp: Signal<RsvpDto | undefined> = toSignal(
    this.rsvpCollection.entities$.pipe(
      map((rsvps) => {
        const currentUser = this.login.currentUserClaims();
        const found = rsvps.find(
          (r) => r.id === currentUser?.sub || partner2Id(r) === currentUser?.sub,
        );
        // Same "couple has no guest RSVP record" gate as `currentUser` above.
        if (currentUser && !found && !this.isCouple()) {
          this.rsvpCollection.getByKey(currentUser.sub); // Only fetches if cache is empty
        }
        return found;
      }),
    ),
    {
      initialValue: undefined,
    },
  );

  private readonly weddingConfigCollection: EntityCollectionService<WeddingConfigResponseDto> =
    inject(EntityServices).getEntityCollectionService<WeddingConfigResponseDto>(
      EntityNamesEnum.WEDDING_CONFIG,
    );

  /** Singleton resource: the collection holds at most one document. */
  readonly weddingConfig: Signal<WeddingConfigResponseDto | undefined> = toSignal(
    this.weddingConfigCollection.entities$.pipe(map((configs) => configs[0])),
    { initialValue: undefined },
  );

  /**
   * The wedding document this whole section is written against — date,
   * countdown, venue, agenda — has not arrived yet. Everything below the
   * chrome would otherwise render as "0 days" over a nameless venue, so the
   * template draws the same layout with those values skeletoned until the
   * read lands.
   */
  protected readonly loading = isFirstLoad(this.weddingConfigCollection);

  /** Placeholder agenda rows for the loading state — see the note in the
   *  template on why the count is a guess. */
  protected readonly pendingAgendaRows = [0, 1, 2];

  constructor() {
    // Trigger the fetch of the RSVP for the current user (if any).
    this.weddingConfigCollection.getByKey(''); // Singleton resource, always fetches the same document
  }

  readonly currentLang = computed(() => this.translate.currentLang());

  protected readonly isAgendaFinal = computed(
    () => this.weddingConfig()?.agenda?.status === 'final',
  );

  /** `venueId -> name` for the home preview's agenda rows' second subtitle.
   *  An unmatched or null id resolves to `''`, which `app-timeline-item`
   *  simply doesn't render. */
  private readonly venueNameById = computed(() => {
    const venues = this.weddingConfig()?.venues ?? [];
    return new Map(venues.map((venue) => [venue.id, venue.name]));
  });

  daysToGo = computed(() => {
    const configuration = this.weddingConfig();
    if (!configuration?.date) {
      return 0;
    }
    const today = new Date();
    const weddingDate = new Date(configuration.date); // Month is 0-based, so 5 = June
    const diffTime = weddingDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  });

  /** Countdown heading's day-count key (T368 fix, DS `AppShell.jsx`'s bare
   *  "See you in 44 days"): each locale's whole phrase is a translated key,
   *  never English text stitched onto a translated prefix. Same
   *  singular/plural ternary as `dashboard.ts`'s own `daysTranslationKey`. */
  protected daysHeadingKey(): string {
    return this.daysToGo() === 1
      ? 'invitee.countdown.days_singular'
      : 'invitee.countdown.days_plural';
  }

  /** Countdown caption key (T368 fix): each locale's whole sentence (count
   *  substituted via `{{count}}`) is the translated string, so word order is
   *  a per-locale choice instead of fixed by the template. */
  protected daysCaptionKey(): string {
    return this.daysToGo() === 1
      ? 'invitee.countdown.daysToGo_singular'
      : 'invitee.countdown.daysToGo_plural';
  }

  adultsCount = computed(() => (this.rsvp()?.adults.partner2 ? 2 : 1));
  childrenCount = computed(() => this.rsvp()?.children?.length ?? 0);
  partner2FirstName = computed(() => {
    if (!this.rsvp()?.adults.partner2) return '';
    if (this.rsvp()?.adults.partner1.id === this.rsvp()?.id)
      return this.rsvp()?.adults.partner2?.firstName;
    return this.rsvp()?.adults.partner1.firstName;
  });
  childrenFirstNames = computed(() => {
    if (!this.rsvp()?.children) return [];
    return (
      this.rsvp()
        ?.children?.map((c) => c.firstName)
        .join(' - ') ?? ''
    );
  });

  /**
   * Home preview's "key moments" — filtered to `highlight` *before* mapping,
   * mirroring `schedule.ts`'s `items` pattern (T297: filtering after
   * computing `$last` made the trailing connector line track the wrong row).
   * Rows are put in clock order by `byAgendaTime`, shared with the schedule
   * screen and the config manager's agenda tab.
   */
  protected readonly highlightedAgendaItems = computed(() => {
    const currentLang = this.translate.currentLang();
    const venueNameById = this.venueNameById();
    return byAgendaTime(
      (this.weddingConfig()?.agenda?.items ?? []).filter((item) => item.highlight),
    ).map((item) => {
      // Only a venue that actually resolves gets a name — and only a named
      // venue gets an id, so the row never links to a place the map cannot
      // select. An unmatched or null id renders neither.
      const venue = (item.venueId && venueNameById.get(item.venueId)) || '';
      return {
        id: item.id,
        time: item.time,
        title: item.title[currentLang],
        desc: item.desc[currentLang],
        venue,
        venueId: venue ? (item.venueId ?? '') : '',
        status: item.status,
      };
    });
  });
}
