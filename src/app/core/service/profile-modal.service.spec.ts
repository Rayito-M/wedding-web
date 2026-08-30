import { TestBed } from '@angular/core/testing';

import { ProfileModalService } from './profile-modal.service';

describe('ProfileModalService', () => {
  function createService(): ProfileModalService {
    TestBed.configureTestingModule({});
    return TestBed.inject(ProfileModalService);
  }

  it('starts closed', () => {
    const service = createService();
    expect(service.isOpen()).toBe(false);
  });

  it('open() sets isOpen to true', () => {
    const service = createService();
    service.open();
    expect(service.isOpen()).toBe(true);
  });

  it('close() sets isOpen back to false', () => {
    const service = createService();
    service.open();
    service.close();
    expect(service.isOpen()).toBe(false);
  });
});
