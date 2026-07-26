import { describe, expect, it } from 'vitest';
import { toProfileUser } from './user-profile';

describe('profile user response contract', () => {
  it('keeps the fixed login ID separate from the editable public handle', () => {
    const response = {
      user: toProfileUser({
        id: 'user-1',
        display_name: '테스트 사용자',
        handle: 'public-name',
        login_id: 'login-name',
        avatar_url: null,
        role: 'member',
        status: 'active'
      })
    };

    expect(response.user.handle).toBe('public-name');
    expect(response.user.loginId).toBe('login-name');
  });
});
