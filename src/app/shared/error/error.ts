import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-error',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error.html',
  styleUrl: './error.scss',
})
export class AppErrorComponent {
  /** Optional custom message; falls back to a generic backend-unavailable copy. */
  readonly message = input<string>();
  /** Emitted when the user clicks the retry button. */
  readonly retry = output<void>();
}
