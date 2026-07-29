import { describe, expect, it } from 'vitest';
import { mergeProfileState, removeProfilePasskey, type ProfileState } from './profile-state';

const user: ProfileState = {
  displayName: '사용자',
  role: 'member',
  handle: 'before',
  loginId: 'before',
  googleConnected: false
};

describe('profile state', () => {
  it('updates the visible handle without discarding session metadata', () => {
    expect(mergeProfileState(user, { handle: 'after' })).toEqual({
      ...user,
      handle: 'after'
    });
  });

  it('preserves an explicit avatar removal from the server response', () => {
    expect(mergeProfileState(user, { avatarUrl: null })).toMatchObject({
      handle: 'before',
      avatarUrl: null
    });
  });

  it('removes one passkey without mutating the source list', () => {
    const passkeys = [{ id: 'key-1' }, { id: 'key-2' }];
    expect(removeProfilePasskey(passkeys, 'key-1')).toEqual([{ id: 'key-2' }]);
    expect(removeProfilePasskey(passkeys, 'missing')).toEqual(passkeys);
    expect(passkeys).toEqual([{ id: 'key-1' }, { id: 'key-2' }]);
  });
});
