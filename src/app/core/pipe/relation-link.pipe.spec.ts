import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { GuestListResponseDtoItemsInnerRelation } from '../api';

import { RelationLinkPipe, relationLinkKey, relationLinkLabel } from './relation-link.pipe';

const family = (link: string): GuestListResponseDtoItemsInnerRelation =>
  ({ side: 'bride', kind: 'family', link }) as GuestListResponseDtoItemsInnerRelation;

const other = (kind: string, link: string): GuestListResponseDtoItemsInnerRelation =>
  ({ side: 'groom', kind, link }) as GuestListResponseDtoItemsInnerRelation;

describe('relationLinkKey / relationLinkLabel', () => {
  const translate = (key: string) => `«${key}»`;

  it('keys a family link into the shared relation namespace', () => {
    expect(relationLinkKey(family('sister-in-law'))).toBe('relation.link.sister-in-law');
    expect(relationLinkLabel(family('sister-in-law'), translate)).toBe(
      '«relation.link.sister-in-law»',
    );
  });

  it('leaves every non-family link as free text — never a lookup key', () => {
    expect(relationLinkKey(other('colleagues', 'Team lead'))).toBeNull();
    expect(relationLinkLabel(other('colleagues', 'Team lead'), translate)).toBe('Team lead');
    // Free text that happens to look like a key is still printed verbatim.
    expect(relationLinkLabel(other('other', 'rsvp.title'), translate)).toBe('rsvp.title');
  });

  it('returns nothing for an absent or empty link', () => {
    expect(relationLinkLabel(undefined, translate)).toBe('');
    expect(relationLinkLabel(family(''), translate)).toBe('');
  });
});

@Component({
  selector: 'app-relation-link-host',
  imports: [RelationLinkPipe],
  template: `{{ relation | relationLink }}`,
})
class Host {
  relation: GuestListResponseDtoItemsInnerRelation | null = null;
}

describe('RelationLinkPipe', () => {
  let fixture: ComponentFixture<Host>;

  async function create(relation: GuestListResponseDtoItemsInnerRelation | null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideTranslateService({ lang: 'en', fallbackLang: 'en' })],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation(
      'en',
      { relation: { link: { 'sister-in-law': 'Sister-in-law' } } },
      true,
    );
    translate.setTranslation('fr', { relation: { link: { 'sister-in-law': 'Belle-sœur' } } }, true);

    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.relation = relation;
    fixture.detectChanges();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent?.trim();

  it('translates a family link through the shared namespace', async () => {
    await create(family('sister-in-law'));
    expect(text()).toBe('Sister-in-law');
  });

  it('re-renders on a language switch', async () => {
    await create(family('sister-in-law'));

    TestBed.inject(TranslateService).use('fr');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toBe('Belle-sœur');
  });

  it('prints a non-family link verbatim', async () => {
    await create(other('friends', 'Uni flatmate'));
    expect(text()).toBe('Uni flatmate');
  });

  it('renders nothing without a relation', async () => {
    await create(null);
    expect(text()).toBe('');
  });
});
