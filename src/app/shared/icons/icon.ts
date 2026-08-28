import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Line-art icon names currently supported (DS `Icon` component subset used
 *  in this repo). Extend `PATHS` alongside this union when a new name is
 *  needed elsewhere. */
export type IconName =
  | 'mail'
  | 'phone'
  | 'pin'
  | 'calendar'
  | 'clock'
  | 'camera'
  | 'upload'
  | 'share'
  | 'search'
  | 'edit'
  | 'trash'
  | 'mobile'
  | 'seat'
  | 'lock'
  | 'info'
  | 'warning'
  | 'chevron'
  | 'bell'
  | 'check';

const PATHS: Record<IconName, string> = {
  mail: 'M4.5 5.5h15A1.5 1.5 0 0 1 21 7v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17V7a1.5 1.5 0 0 1 1.5-1.5zM3.5 7.5 12 13.5 20.5 7.5',
  phone:
    'M8.3 4.5H5.7A1.7 1.7 0 0 0 4 6.2C4 13.9 10.1 20 17.8 20a1.7 1.7 0 0 0 1.7-1.7v-2a1 1 0 0 0-.8-1l-3-.6a1 1 0 0 0-1 .4l-1 1.3a12.6 12.6 0 0 1-5.5-5.5l1.3-1a1 1 0 0 0 .4-1l-.6-3a1 1 0 0 0-1-1.4z',
  pin: 'M12 20.5s6.5-5.9 6.5-10.5a6.5 6.5 0 0 0-13 0C5.5 14.6 12 20.5 12 20.5zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  calendar:
    'M5 5.5h14A1.5 1.5 0 0 1 20.5 7v12A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5zM3.5 10h17M8 3.5v3M16 3.5v3',
  clock: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 7.5V12l3.5 2.2',
  camera:
    'M4.5 8h3l1.7-2.5h5.6L16.5 8h3A1.5 1.5 0 0 1 21 9.5v9A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5v-9A1.5 1.5 0 0 1 4.5 8zM12 17.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  upload: 'M12 16V4.5M7.5 9 12 4.5 16.5 9M4.5 19.5h15',
  share:
    'M18 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6',
  search: 'M11 17.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.8 15.8l4.2 4.2',
  edit: 'M5 19h3.9L19.6 8.3a1.9 1.9 0 0 0-2.7-2.7L6.2 16.3 5 19zM15.9 6.6l2.7 2.7',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.8 7l.9 12.5h8.6L17.2 7M10.5 10.5v6M13.5 10.5v6',
  mobile:
    'M8 3.5h8A1.5 1.5 0 0 1 17.5 5v14A1.5 1.5 0 0 1 16 20.5H8A1.5 1.5 0 0 1 6.5 19V5A1.5 1.5 0 0 1 8 3.5zM10.5 17.8h3',
  seat: 'M7 11V6.5A2 2 0 0 1 9 4.5h6a2 2 0 0 1 2 2V11M5.5 11h13v5.5h-13zM7.5 16.5V20M16.5 16.5V20',
  lock: 'M5 10.5h14a1 1 0 0 1 1 1V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-7.5a1 1 0 0 1 1-1zM8 10.5V8a4 4 0 0 1 8 0v2.5',
  info: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 11v5.5',
  warning: 'M12 4.2l8.6 15.3H3.4L12 4.2zM12 10v4.4',
  chevron: 'M9.5 5 16.5 12 9.5 19',
  bell: 'M12 4a5.5 5.5 0 0 0-5.5 5.5c0 3.5-.9 4.9-1.7 5.7-.5.5-.2 1.3.5 1.3h13.4c.7 0 1-.8.5-1.3-.8-.8-1.7-2.2-1.7-5.7A5.5 5.5 0 0 0 12 4zM9.8 19a2.2 2.2 0 0 0 4.4 0',
  check: 'M5 12.8 9.5 17.3 19 7.8',
};

/** Generic line-art icon (DS `Icon`, 24px grid, 1.5px stroke, round caps,
 *  `currentColor`). Decorative by default — always pair with a text label;
 *  the SVG is hidden from the a11y tree. */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);

  protected readonly path = computed(() => PATHS[this.name()]);
}
