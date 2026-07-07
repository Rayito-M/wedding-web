import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RsvpReply, RsvpService } from '../../core/rsvp.service';
import { Btn } from '../../shared/button/button';
import { DecorFishPair } from '../../shared/decor/fish-pair';
import { Monogram } from '../../shared/monogram/monogram';

export const DIET_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Gluten-free',
  'Nut allergy',
  'No alcohol',
] as const;

@Component({
  selector: 'app-rsvp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Monogram, Btn, DecorFishPair],
  templateUrl: './rsvp.html',
  styleUrl: './rsvp.scss',
})
export class Rsvp {
  private readonly rsvpService = inject(RsvpService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly dietOptions = DIET_OPTIONS;
  protected readonly step = signal(0);

  protected readonly form = this.fb.group({
    name: [this.rsvpService.reply()?.name ?? 'Laura Mendoza'],
    attending: this.fb.control<'yes' | 'no' | null>(
      this.rsvpService.reply()?.attending ?? null,
      Validators.required,
    ),
    plusOne: [this.rsvpService.reply()?.plusOne ?? false],
    diet: [this.rsvpService.reply()?.diet ?? ([] as string[])],
    note: [this.rsvpService.reply()?.note ?? ''],
  });

  protected setAttending(value: 'yes' | 'no'): void {
    this.form.controls.attending.setValue(value);
  }

  protected togglePlusOne(): void {
    this.form.controls.plusOne.setValue(!this.form.controls.plusOne.value);
  }

  protected toggleDiet(option: string): void {
    const diet = this.form.controls.diet.value;
    this.form.controls.diet.setValue(
      diet.includes(option) ? diet.filter((d) => d !== option) : [...diet, option],
    );
  }

  protected continue(): void {
    if (this.step() === 0) {
      // Cannot advance without an "Attending?" selection.
      if (this.form.controls.attending.invalid) return;
      this.step.set(1);
    } else {
      this.rsvpService.submit(this.form.getRawValue() as RsvpReply);
      this.step.set(2);
    }
  }

  protected back(): void {
    this.step.update((s) => s - 1);
  }

  protected edit(): void {
    this.step.set(0);
  }

  protected statusLine(): string {
    const { attending, plusOne, diet } = this.form.getRawValue();
    const base = attending === 'yes' ? `Attending${plusOne ? ' · +1' : ''}` : 'Not attending';
    return diet.length ? `${base} · ${diet.join(', ')}` : base;
  }
}
