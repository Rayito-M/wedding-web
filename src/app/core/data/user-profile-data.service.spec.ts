import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';

import { UpdateUserProfileDto, UserProfileDto, WeddingUserProfileService } from '../api';

import { UserProfileDataService } from './user-profile-data.service';

interface UpdateParams {
  id: string;
  updateUserProfileDto: UpdateUserProfileDto;
}

describe('UserProfileDataService', () => {
  let updateSpy: ReturnType<typeof vi.fn<(params: UpdateParams) => Observable<UserProfileDto>>>;

  function createService(): UserProfileDataService {
    updateSpy = vi.fn((params: UpdateParams) =>
      of({ ...params.updateUserProfileDto, id: params.id } as unknown as UserProfileDto),
    );

    TestBed.configureTestingModule({
      providers: [
        {
          provide: WeddingUserProfileService,
          useValue: {
            profileControllerUpdateProfileByIdV1: (params: UpdateParams) => updateSpy(params),
          },
        },
      ],
    });

    return TestBed.inject(UserProfileDataService);
  }

  it('update() round-trips a nickname change onto UpdateUserProfileDto.nickname', () => {
    const service = createService();

    service
      .update({
        id: 'u1',
        changes: { role: UserProfileDto.RoleEnum.GUEST, nickname: 'Lau' },
      })
      .subscribe();

    expect(updateSpy).toHaveBeenCalledWith({
      id: 'u1',
      updateUserProfileDto: expect.objectContaining({ nickname: 'Lau' }),
    });
  });

  it('update() sends an empty-string nickname as undefined, never as ""', () => {
    const service = createService();

    service
      .update({
        id: 'u1',
        changes: { role: UserProfileDto.RoleEnum.GUEST, nickname: '' },
      })
      .subscribe();

    const dto = updateSpy.mock.calls[0][0].updateUserProfileDto;
    expect(dto.nickname).toBeUndefined();
    expect(dto).not.toEqual(expect.objectContaining({ nickname: '' }));
  });
});
