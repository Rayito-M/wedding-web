import { Injectable, computed, signal } from '@angular/core';

export interface AlbumPhoto {
  label: string;
  category: string;
  /** Tile height in the mobile grid (mock: varying 90–130). */
  h: number;
}

export const ALBUM_CATEGORIES = [
  'All',
  'Getting ready',
  'Ceremony',
  'Dinner',
  'Dancing',
  'Polaroid',
] as const;

/** Live album photo list with category tags. Photos are placeholders until
 *  real uploads exist (production: user uploads / CMS). */
@Injectable({ providedIn: 'root' })
export class AlbumService {
  readonly totalCount = signal(247);
  readonly filter = signal<string>('All');

  readonly photos = signal<AlbumPhoto[]>([
    { label: 'CEREMONY', category: 'Ceremony', h: 130 },
    { label: 'TABLES', category: 'Dinner', h: 90 },
    { label: 'DANCE', category: 'Dancing', h: 90 },
    { label: 'FIRST KISS', category: 'Ceremony', h: 130 },
    { label: 'TOAST', category: 'Dinner', h: 110 },
    { label: 'SUNSET', category: 'Getting ready', h: 110 },
  ]);

  readonly filtered = computed(() => {
    const f = this.filter();
    const all = this.photos();
    return f === 'All' ? all : all.filter((p) => p.category === f);
  });

  upload(): void {
    // Production: open picker + POST to album backend.
  }
}
