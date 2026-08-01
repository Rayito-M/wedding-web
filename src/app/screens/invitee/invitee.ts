import { Component, computed, inject, type Signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { map } from 'rxjs';
import { EntityCollectionService, EntityServices } from '@ngrx/data';
import { TranslatePipe } from '@ngx-translate/core';

import {
  EntityNamesEnum,
  LoginService,
  RsvpDto,
  UserProfileDto,
  WeddingConfigResponseDto,
  TranslateLanguageService,
  CreateWeddingConfigDtoAgendaItemsInner,
  PluralTranslatePipe,
  AgendaTimePipe,
} from '@app/core';

import { DecorFish } from '../../shared/decor/fish';
import { ProgressBar } from '../../shared/progress-bar/progress-bar';
import { RsvpStatusTick } from '../../shared/rsvp-status-tick/rsvp-status-tick';
import { StatusPill } from '../../shared/status-pill/status-pill';
import { TimelineItem } from '../../shared/timeline-item/timeline-item';

@Component({
  selector: 'app-invitee',
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
  templateUrl: './invitee.html',
  styleUrl: './invitee.scss',
})
export class Invitee {
  private readonly login = inject(LoginService);
  private readonly translate = inject(TranslateLanguageService);

  private readonly userProfileCollection: EntityCollectionService<UserProfileDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE);

  readonly currentUser = computed(() => {
    const user = this.login.currentUserClaims();
    if (user) {
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
          (r) => r.id === currentUser?.sub || r.adults.partner2?.id === currentUser?.sub,
        );
        if (currentUser && !found) {
          this.rsvpCollection.getByKey(currentUser.sub); // Only fetches if cache is empty}
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

  constructor() {
    // Trigger the fetch of the RSVP for the current user (if any).
    this.weddingConfigCollection.getByKey(''); // Singleton resource, always fetches the same document
  }

  readonly currentLang = computed(() => this.translate.currentLang());

  protected readonly isAgendaFinal = computed(
    () => this.weddingConfig()?.agenda?.status === 'final',
  );

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

  getEventTranslation(event: CreateWeddingConfigDtoAgendaItemsInner): {
    id: string;
    time: string;
    title: string;
    desc: string;
  } {
    const currentLang = this.translate.currentLang();
    return {
      id: event.id,
      time: event.time,
      title: event.title[currentLang],
      desc: event.desc[currentLang],
    };
  }
}
