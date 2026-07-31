import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { HeaderService } from '../../core';
import { ALBUM_CATEGORIES, AlbumService } from '../../core/album.service';
import { DecorMotorcycleRider } from '../../shared/decor/motorcycle-rider/motorcycle-rider';
import { PhotoPlaceholder } from '../../shared/photo-placeholder/photo-placeholder';

@Component({
  selector: 'app-album',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhotoPlaceholder, DecorMotorcycleRider],
  templateUrl: './album.html',
  styleUrl: './album.scss',
})
export class Album {
  protected readonly album = inject(AlbumService);
  protected readonly categories = ALBUM_CATEGORIES;
  private readonly header = inject(HeaderService);

  constructor() {
    effect(() => this.header.set(`LIVE · ${this.album.totalCount()} PHOTOS`));
  }
}
