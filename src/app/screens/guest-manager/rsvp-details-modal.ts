import { Component, signal, inject, OnInit, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { RsvpDto } from '@app/core';

@Component({
  selector: 'app-rsvp-details-modal',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './rsvp-details-modal.html',
  styleUrl: './rsvp-details-modal.scss',
})
export class RsvpDetailsModal implements OnInit {
  readonly rsvp = signal<RsvpDto | null>(null);
  readonly isOpen = signal(false);
  readonly closeModal = output<void>();
  readonly saveComments = output<{ rsvpId: string; comments: string }>();

  private readonly commentsText = signal('');

  ngOnInit(): void {
    // Initialize comments from RSVP when modal opens
    const currentRsvp = this.rsvp();
    if (currentRsvp?.adults.partner1.options?.comments) {
      this.commentsText.set(currentRsvp.adults.partner1.options.comments);
    }
  }

  open(rsvp: RsvpDto): void {
    this.rsvp.set(rsvp);
    this.commentsText.set(rsvp.adults.partner1.options?.comments || '');
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.closeModal.emit();
  }

  onSave(): void {
    const currentRsvp = this.rsvp();
    if (currentRsvp) {
      this.saveComments.emit({
        rsvpId: currentRsvp.id,
        comments: this.commentsText(),
      });
    }
    this.close();
  }

  getCommentsText(): string {
    return this.commentsText();
  }

  updateComments(text: string): void {
    this.commentsText.set(text);
  }
}
