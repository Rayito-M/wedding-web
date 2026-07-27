import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { HeaderService } from '../../core';
import { RsvpReply, RsvpService } from '../../core/rsvp.service';
import { Btn } from '../../shared/button/button';
import { ChoiceCard } from '../../shared/choice-card/choice-card';
import { DecorFishPair } from '../../shared/decor/fish-pair';
import { TextInput } from '../../shared/input/input';
import { TextareaInput } from '../../shared/textarea/textarea';
import { Toggle } from '../../shared/toggle/toggle';

export const DIET_OPTIONS = [
  'vegetarian',
  'vegan',
  'pescatarian',
  'glutenFree',
  'nutAllergy',
  'noAlcohol',
] as const;

@Component({
  selector: 'app-rsvp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    Btn,
    ChoiceCard,
    TextInput,
    TextareaInput,
    Toggle,
    DecorFishPair,
    TranslatePipe,
  ],
  templateUrl: './rsvp.html',
  styleUrl: './rsvp.scss',
})
export class Rsvp {
  private readonly rsvpService = inject(RsvpService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly translateService = inject(TranslateService);
  private readonly header = inject(HeaderService);

  protected readonly dietOptions = DIET_OPTIONS;
  protected readonly step = signal(0);

  constructor() {
    effect(() => {
      const header = this.translateService.instant('rsvp.header');
      const step = this.translateService.instant('rsvp.step', { current: this.step() + 1 });
      this.header.set(`${header} · ${step}`);
    });
  }

  protected readonly confirmationTitle = computed(() => {
    const isAttending = this.form.controls.attending.value === 'yes';
    return this.translateService.instant(
      isAttending ? 'rsvp.step3.yesTitle' : 'rsvp.step3.noTitle',
    );
  });

  protected readonly confirmationMessage = computed(() => {
    const isAttending = this.form.controls.attending.value === 'yes';
    return this.translateService.instant(
      isAttending ? 'rsvp.step3.yesMessage' : 'rsvp.step3.noMessage',
    );
  });

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
