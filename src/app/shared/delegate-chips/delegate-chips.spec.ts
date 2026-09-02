import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { DelegateChip, DelegateChips } from './delegate-chips';

describe('DelegateChips (T335/T336 shared display half)', () => {
  let fixture: ComponentFixture<DelegateChips>;

  async function create(
    delegates: DelegateChip[],
    inputs: Record<string, unknown> = {},
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [DelegateChips],
      providers: [provideTranslateService({ lang: 'en', fallbackLang: 'en' })],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation(
      'en',
      {
        delegation: {
          kind: { father: 'Father', mother: 'Mother', brother: 'Brother', sister: 'Sister' },
          field: { remove: 'Remove {{name}}' },
        },
      },
      true,
    );

    fixture = TestBed.createComponent(DelegateChips);
    fixture.componentRef.setInput('delegates', delegates);
    fixture.componentRef.setInput('emptyText', 'Nobody answers for this RSVP yet.');
    for (const [name, val] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, val);
    }
    fixture.detectChanges();
  }

  it('shows the empty text when there are no delegates', async () => {
    await create([]);

    expect(fixture.nativeElement.querySelector('.chip-empty')?.textContent?.trim()).toBe(
      'Nobody answers for this RSVP yet.',
    );
    expect(fixture.nativeElement.querySelector('.delegate-chip')).toBeNull();
  });

  it('renders name + kind, subject-side, for every entry (hard rule 18(c))', async () => {
    await create([
      { id: 'g1', name: 'Laura Mendoza', kind: 'sister' },
      { id: 'g2', name: 'Pablo Mendoza', kind: 'brother' },
    ]);

    const chips = Array.from(
      fixture.nativeElement.querySelectorAll('.delegate-chip'),
    ) as HTMLElement[];
    expect(chips.length).toBe(2);
    expect(chips[0].textContent).toContain('Laura Mendoza · Sister');
    expect(chips[1].textContent).toContain('Pablo Mendoza · Brother');
  });

  it('never renders a remove control unless `removable` is on', async () => {
    await create([{ id: 'g1', name: 'Laura Mendoza', kind: 'sister' }]);

    expect(fixture.nativeElement.querySelector('.chip-remove')).toBeNull();
  });

  it('removable mode renders a × that emits the delegate id', async () => {
    await create([{ id: 'g1', name: 'Laura Mendoza', kind: 'sister' }], { removable: true });
    const emitted: string[] = [];
    fixture.componentInstance.remove.subscribe((id) => emitted.push(id));

    const btn = fixture.nativeElement.querySelector('.chip-remove') as HTMLButtonElement;
    expect(btn.getAttribute('aria-label')).toBe('Remove Laura Mendoza');
    btn.click();

    expect(emitted).toEqual(['g1']);
  });

  it('an unresolved name (T336) degrades to the kind alone — never a blank chip, never a crash', async () => {
    await create([{ id: 'g1', name: '', kind: 'sister' }]);

    const chip = fixture.nativeElement.querySelector('.delegate-chip') as HTMLElement;
    expect(chip.textContent?.trim()).toBe('Sister');
    expect(chip.textContent).not.toContain('·');
  });

  it('an unresolved name still gets a sensible remove aria-label, keyed off the kind', async () => {
    await create([{ id: 'g1', name: '', kind: 'sister' }], { removable: true });

    const btn = fixture.nativeElement.querySelector('.chip-remove') as HTMLButtonElement;
    expect(btn.getAttribute('aria-label')).toBe('Remove Sister');
  });
});
