import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ALBUM_CATEGORIES, AlbumService } from '../../core/album.service';
import { Monogram } from '../../shared/monogram/monogram';
import { PhotoPlaceholder } from '../../shared/photo-placeholder/photo-placeholder';

@Component({
  selector: 'app-album',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Monogram, PhotoPlaceholder],
  templateUrl: './album.html',
  styleUrl: './album.scss',
})
export class Album {
  protected readonly album = inject(AlbumService);
  protected readonly categories = ALBUM_CATEGORIES;
}
