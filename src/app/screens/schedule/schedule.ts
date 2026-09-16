import { ChangeDetectionStrategy, Component, computed, effect, inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { map } from 'rxjs';
import { EntityCollectionService, EntityServices } from '@ngrx/data';
import { TranslatePipe } from '@ngx-translate/core';

import {
  AgendaTimePipe,
  byAgendaTime,
  EntityNamesEnum,
  HeaderService,
  TranslateLanguageService,
  WeddingConfigResponseDto,
  weddingDayLabel,
} from '@app/core';
import { StatusPill } from '@app/shared/status-pill/status-pill';
import { TimelineItem } from '@app/shared/timeline-item/timeline-item';

interface AgendaCounts {
  planned: number;
  confirmed: number;
  cancelled: number;
}

@Component({
  selector: 'app-schedule',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TimelineItem, TranslatePipe, AgendaTimePipe, StatusPill],
  templateUrl: './schedule.html',
  styleUrl: './schedule.scss',
})
export class Schedule {
  private readonly translate = inject(TranslateLanguageService);

  private readonly weddingConfigCollection: EntityCollectionService<WeddingConfigResponseDto> =
    inject(EntityServices).getEntityCollectionService<WeddingConfigResponseDto>(
      EntityNamesEnum.WEDDING_CONFIG,
    );

  /** Singleton resource: the collection holds at most one document. */
  readonly weddingConfig: Signal<WeddingConfigResponseDto | undefined> = toSignal(
    this.weddingConfigCollection.entities$.pipe(map((configs) => configs[0])),
    { initialValue: undefined },
  );

  /** The date badge, from the configured `date` (T396) — the template used
   *  to hardcode "SAT · 5 JUN 2027" untranslated. Empty until config lands. */
  protected readonly dateBadge = computed(() =>
    weddingDayLabel(this.weddingConfig()?.date ?? '', this.translate.currentLang()),
  );
  protected readonly dateBadgeFull = computed(() =>
    weddingDayLabel(this.weddingConfig()?.date ?? '', this.translate.currentLang(), true),
  );

  constructor() {
    // The header is the wedding date — configuration, not copy (T396). The
    // locale files used to spell it ("SAT · 5 JUN"), which was right only
    // while the configured date happened to be 2027-06-05; it now derives
    // from `date`, per locale, and follows a language switch. Empty until
    // the config lands — the header bar has no room for a placeholder.
    const header = inject(HeaderService);
    effect(() => {
      header.set(
        weddingDayLabel(this.weddingConfig()?.date ?? '', this.translate.currentLang()),
      );
    });
    this.weddingConfigCollection.getByKey(''); // Singleton resource, always fetches the same document
  }

  /** `venueId -> name` for the agenda rows' second subtitle. An unmatched or
   *  null id resolves to `''`, which `app-timeline-item` simply doesn't render. */
  private readonly venueNameById = computed(() => {
    const venues = this.weddingConfig()?.venues ?? [];
    return new Map(venues.map((venue) => [venue.id, venue.name]));
  });

  /** Clock order via `byAgendaTime`, shared with the invitee home preview and
   *  the config manager's agenda tab so the three never disagree. */
  protected readonly items = computed(() => {
    const currentLang = this.translate.currentLang();
    const venueNameById = this.venueNameById();
    return byAgendaTime(this.weddingConfig()?.agenda?.items ?? []).map((item) => {
      // Only a venue that actually resolves gets a name — and only a named
      // venue gets an id, so the row never links to a place the map cannot
      // select. An unmatched or null id renders neither.
      const venue = (item.venueId && venueNameById.get(item.venueId)) || '';
      return {
        id: item.id,
        t: item.time,
        title: item.title[currentLang],
        sub: item.desc[currentLang],
        venue,
        venueId: venue ? (item.venueId ?? '') : '',
        status: item.status,
      };
    });
  });

  protected readonly isFinal = computed(() => this.weddingConfig()?.agenda?.status === 'final');

  protected readonly counts: Signal<AgendaCounts> = computed(() => {
    const agendaItems = this.weddingConfig()?.agenda?.items ?? [];
    return agendaItems.reduce<AgendaCounts>(
      (acc, item) => ({ ...acc, [item.status]: acc[item.status] + 1 }),
      { planned: 0, confirmed: 0, cancelled: 0 },
    );
  });
}
