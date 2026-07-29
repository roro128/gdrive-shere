import { describe, expect, it } from 'vitest';
import { isAllowedAvatarUpdate, resolveProfileHandle } from './profile-input-model';

describe('profile input model', () => {
  it('resolves omitted, valid, invalid, and empty handles without throwing', () => {
    expect(resolveProfileHandle(undefined, 'current', 'login')).toEqual({
      valid: true,
      handle: 'current'
    });
    expect(resolveProfileHandle(undefined, null, 'login')).toEqual({
      valid: true,
      handle: 'login'
    });
    expect(resolveProfileHandle('  New_User ', 'current', 'login')).toEqual({
      valid: true,
      handle: 'new_user'
    });
    expect(resolveProfileHandle('', 'current', 'login')).toEqual({ valid: false, handle: null });
    expect(resolveProfileHandle('한글', 'current', 'login')).toEqual({
      valid: false,
      handle: null
    });
  });

  it('accepts only the configured avatar data URL formats and size', () => {
    const defaultAvatar = 'https://example.com/default.svg';

    expect(isAllowedAvatarUpdate(undefined, defaultAvatar)).toBe(true);
    expect(isAllowedAvatarUpdate(null, defaultAvatar)).toBe(true);
    expect(isAllowedAvatarUpdate(defaultAvatar, defaultAvatar)).toBe(true);
    expect(isAllowedAvatarUpdate('data:image/png;base64,AAAA', defaultAvatar)).toBe(true);
    expect(isAllowedAvatarUpdate('data:image/svg+xml;base64,AAAA', defaultAvatar)).toBe(false);
    expect(isAllowedAvatarUpdate('https://example.com/avatar.png', defaultAvatar)).toBe(false);
    expect(
      isAllowedAvatarUpdate(`data:image/png;base64,${'A'.repeat(1_500_000)}`, defaultAvatar)
    ).toBe(false);
  });
});
