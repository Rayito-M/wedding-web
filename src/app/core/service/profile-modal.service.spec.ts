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

  it('open() with no argument leaves targetUserId() null (self)', () => {
    const service = createService();
    service.open();
    expect(service.targetUserId()).toBeNull();
  });

  it("open('u2') sets targetUserId() to 'u2'", () => {
    const service = createService();
    service.open('u2');
    expect(service.targetUserId()).toBe('u2');
  });

  it('close() sets isOpen back to false', () => {
    const service = createService();
    service.open();
    service.close();
    expect(service.isOpen()).toBe(false);
  });

  it('close() resets targetUserId() back to null', () => {
    const service = createService();
    service.open('u2');
    service.close();
    expect(service.targetUserId()).toBeNull();
  });
});
