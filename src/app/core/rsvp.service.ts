import { Injectable, signal } from '@angular/core';

export interface RsvpReply {
  name: string;
  attending: 'yes' | 'no';
  plusOne: boolean;
  diet: string[];
  note: string;
}

const STORAGE_KEY = 'sc-rsvp';

/**
 * Guest reply state. `submit` stands in for the production POST — it
 * persists locally so the reply survives reloads and stays editable.
 */
@Injectable({ providedIn: 'root' })
export class RsvpService {
  readonly reply = signal<RsvpReply | null>(this.restore());

  submit(reply: RsvpReply): void {
    this.reply.set(reply);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reply));
    } catch {
      // storage unavailable — reply is kept in memory only
    }
  }

  private restore(): RsvpReply | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as RsvpReply) : null;
    } catch {
      return null;
    }
  }
}
