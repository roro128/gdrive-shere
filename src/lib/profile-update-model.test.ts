import { describe, expect, it } from 'vitest';
import {
  buildProfileUpdateResponse,
  buildProfileUpdateValues,
  toAuthUserImageUpdate,
  toProfilePatchRequest
} from './profile-update-model';

const current = {
  id: 'user-1',
  avatar_url: 'https://avatar.test/default.svg',
  password_hash: 'old-hash',
  role: 'member',
  status: 'active'
};

describe('profile update model', () => {
  it('preserves omitted avatar and password values', () => {
    const values = buildProfileUpdateValues(current, { handle: 'new-handle' }, undefined, 'now');

    expect(values).toEqual({
      handle: 'new-handle',
      avatar_url: current.avatar_url,
      password_hash: current.password_hash,
      updated_at: 'now'
    });
  });

  it('applies explicit avatar and local password hash without mutating input', () => {
    const input = { handle: 'new-handle', avatarUrl: 'data:image/png;base64,abc' };
    const values = buildProfileUpdateValues(current, input, 'new-hash', 'now');

    expect(values.avatar_url).toBe(input.avatarUrl);
    expect(values.password_hash).toBe('new-hash');
    expect(input).toEqual({ handle: 'new-handle', avatarUrl: 'data:image/png;base64,abc' });
  });

  it('builds the observable profile response from current identity and new values', () => {
    const values = buildProfileUpdateValues(current, { handle: null }, undefined, 'now');
    expect(buildProfileUpdateResponse(current, values)).toEqual({
      id: 'user-1',
      handle: null,
      avatarUrl: current.avatar_url,
      role: 'member',
      status: 'active'
    });
  });

  it('builds the Better Auth image synchronization payload', () => {
    const updatedAt = new Date('2026-07-29T00:00:00.000Z');
    expect(toAuthUserImageUpdate('avatar', updatedAt)).toEqual({ image: 'avatar', updatedAt });
  });

  it('omits password fields when no password change was requested', () => {
    expect(
      toProfilePatchRequest({
        handle: 'member',
        avatarUrl: null,
        currentPassword: 'old',
        newPassword: ''
      })
    ).toEqual({ handle: 'member', avatarUrl: null });
    expect(
      toProfilePatchRequest({
        handle: 'member',
        avatarUrl: 'avatar',
        currentPassword: 'old',
        newPassword: 'new-password'
      })
    ).toEqual({
      handle: 'member',
      avatarUrl: 'avatar',
      currentPassword: 'old',
      newPassword: 'new-password'
    });
  });
});
