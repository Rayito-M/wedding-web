import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Multiline note field (DS core/Textarea). Attribute component:
 *  `<textarea app-textarea formControlName="…"></textarea>`. */
@Component({
  selector: 'textarea[app-textarea]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './textarea.html',
  styleUrl: './textarea.scss',
})
export class TextareaInput {}
