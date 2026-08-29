import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  Signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';

import { map } from 'rxjs';
import { EntityCollectionService, EntityServices } from '@ngrx/data';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  CreateWeddingConfigDtoHotelsInner,
  CreateWeddingConfigDtoVenuesInner,
  EntityNamesEnum,
  HeaderService,
  WeddingConfigResponseDto,
} from '@app/core';
import { StayCard } from '@app/shared/stay-card/stay-card';
import { TRAVEL_PLACE_PARAM } from '@app/shared/travel-link';

/** A single selectable, map-able location — either a venue or a hotel,
 *  normalised down to what the embed needs: the URL its iframe points at. */
interface Place {
  readonly id: string;
  readonly name: string;
  readonly url: string;
}

/** One rendered "stays nearby" row — `app-stay-card`'s inputs, derived from
 *  `CreateWeddingConfigDtoHotelsInner` (no editorial tag/price text exists in
 *  the contract, only `priceTier`/`distanceKm`). */
interface HotelRow {
  readonly id: string;
  readonly name: string;
  readonly distanceKm: number;
  readonly tag: string;
  readonly thumbLabel: string;
}

/** Google Maps zoom level: 1 is the whole world, 21 is a single building. Left
 *  alone it frames a street address so tightly that a guest sees no landmark to
 *  orient by; 15 keeps the surrounding streets and the town name in view. */
const MAP_ZOOM = 15;

/** The DS's documented `?q=…&output=embed` pin map — the fallback for a place
 *  the contract carries no map link for; see T296's "out of scope". */
function queryEmbedUrl(query: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=${MAP_ZOOM}&output=embed`;
}

/** Google Maps hands out several link shapes and **only some can be framed** —
 *  a plain `/maps/place/…` link answers `X-Frame-Options: SAMEORIGIN` and would
 *  render an empty box. Returns an embeddable URL, or `null` when the link
 *  carries nothing the embed can use (an opaque `maps.app.goo.gl` share link). */
function toEmbedUrl(mapUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(mapUrl);
  } catch {
    return null;
  }
  // "Share → Embed a map" already gives a frameable `/maps/embed?pb=…`.
  if (url.pathname.startsWith('/maps/embed')) return mapUrl;
  // A `?q=…` link needs only the embed switch.
  const query = url.searchParams.get('q');
  if (query) return queryEmbedUrl(query);
  // A link copied from the address bar carries `@lat,lng,zoom` in its path —
  // the coordinates alone are enough to pin the map.
  const at = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(url.pathname);
  if (at) return queryEmbedUrl(`${at[1]},${at[2]}`);
  return null;
}

/** The couple-authored `mapUrl` is what the map points at, when it is a link
 *  the embed can actually use. Anything else — empty, or a share link with no
 *  usable place in it — falls back to the venue's own address. */
function venueUrl(venue: CreateWeddingConfigDtoVenuesInner): string {
  const embed = venue.mapUrl ? toEmbedUrl(venue.mapUrl) : null;
  return (
    embed ??
    queryEmbedUrl(`${venue.address}, ${venue.postalCode} ${venue.city}, ${venue.country}`)
  );
}

/** Hotels carry no `mapUrl` and no address — hard rule 15 forbids inventing
 *  either, so `name` + the wedding city is the best the contract allows. */
function hotelUrl(hotel: CreateWeddingConfigDtoHotelsInner, city: string): string {
  return queryEmbedUrl(`${hotel.name}, ${city}`);
}

@Component({
  selector: 'app-travel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StayCard, TranslatePipe],
  templateUrl: './travel.html',
  styleUrl: './travel.scss',
})
export class Travel {
  private readonly translateService = inject(TranslateService);
  private readonly sanitizer = inject(DomSanitizer);

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
    inject(HeaderService).set(this.translateService.instant('travel.header'));
    this.weddingConfigCollection.getByKey(''); // Singleton resource, always fetches the same document
  }

  protected readonly venues = computed(() => this.weddingConfig()?.venues ?? []);
  protected readonly hotels = computed(() => this.weddingConfig()?.hotels ?? []);

  protected readonly hotelRows: Signal<HotelRow[]> = computed(() =>
    this.hotels().map((hotel) => ({
      id: hotel.id,
      name: hotel.name,
      distanceKm: hotel.distanceKm,
      tag: hotel.priceTier,
      thumbLabel: hotel.name.slice(0, 4),
    })),
  );

  /** Every selectable place — venues then hotels — reduced to what the map
   *  embed needs. Order matches the two rendered lists (venues above stays). */
  private readonly places: Signal<Place[]> = computed(() => {
    const config = this.weddingConfig();
    if (!config) return [];
    const venuePlaces = config.venues.map((venue) => ({
      id: venue.id,
      name: venue.name,
      url: venueUrl(venue),
    }));
    const hotelPlaces = config.hotels.map((hotel) => ({
      id: hotel.id,
      name: hotel.name,
      url: hotelUrl(hotel, config.city),
    }));
    return [...venuePlaces, ...hotelPlaces];
  });

  /** `?place=<id>` when the caller asked for a specific venue or hotel — an
   *  agenda row linking to the venue it happens at, say. `null` otherwise. */
  private readonly requestedId: Signal<string | null> = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => params.get(TRAVEL_PLACE_PARAM))),
    { initialValue: null },
  );

  /** Seeded from the route, then overwritten by clicks. `linkedSignal` (not
   *  `signal`) so that arriving at a *different* `?place=` — a second agenda
   *  link, or the back button — re-seeds the selection instead of leaving the
   *  previous click in place. */
  private readonly selectedId = linkedSignal<string | null, string | null>({
    source: this.requestedId,
    computation: (requestedId) => requestedId,
  });

  /** Falls back to the first place, so the first row is selected by default,
   *  an unknown `?place=` degrades quietly rather than blanking the map, and
   *  the choice stays correct as config data arrives asynchronously. */
  protected readonly selectedPlace: Signal<Place | null> = computed(() => {
    const places = this.places();
    if (places.length === 0) return null;
    const id = this.selectedId();
    return places.find((place) => place.id === id) ?? places[0];
  });

  /** The selected place's map URL, trusted for the `<iframe>`. */
  protected readonly mapSrc: Signal<SafeResourceUrl | null> = computed(() => {
    const place = this.selectedPlace();
    if (!place) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(place.url);
  });

  protected select(id: string): void {
    this.selectedId.set(id);
  }
}
