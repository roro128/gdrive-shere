import { describe, expect, it, vi } from 'vitest';
import {
  fetchCurrentUser,
  loginLegacyPassword,
  logout,
  registerInvite,
  requestPasswordReset,
  resetPassword
} from './auth-client';

describe('auth client', () => {
  it('normalizes current user responses and handles logout', async () => {
    await expect(
      fetchCurrentUser<{ id: string }>(async (input) => {
        expect(input).toBe('/api/me');
        return new Response(
          JSON.stringify({
            user: { id: 'user-1' },
            googleConnected: 1,
            googleConnectionStatus: 'reauthorization-required'
          }),
          {
            status: 200
          }
        );
      })
    ).resolves.toEqual({
      user: { id: 'user-1' },
      googleConnected: false,
      googleConnectionStatus: 'reauthorization-required'
    });
    await expect(
      fetchCurrentUser(async () => new Response(null, { status: 401 }))
    ).resolves.toBeNull();
    await expect(
      logout(async (input, init) => {
        expect(input).toBe('/api/auth/logout');
        expect(init?.method).toBe('POST');
        return new Response(null, { status: 204 });
      })
    ).resolves.toBeUndefined();
  });

  it('posts each auth mutation and exposes server errors', async () => {
    const calls: string[] = [];
    const request = async (input: string) => {
      calls.push(input);
      return new Response(null, { status: 200 });
    };
    await requestPasswordReset(request, 'member');
    await registerInvite(request, { loginId: 'member' });
    await resetPassword(request, { token: 'token', password: 'password' });
    expect(calls).toEqual([
      '/api/auth/password/reset-request',
      '/api/auth/better/register',
      '/api/auth/password/reset'
    ]);
    await expect(
      requestPasswordReset(
        async () => new Response(JSON.stringify({ message: 'request failed' }), { status: 400 }),
        'member'
      )
    ).rejects.toThrow('request failed');
  });

  it('logs in legacy accounts through the compatibility endpoint', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      loginLegacyPassword(request, '  member  ', 'correct horse battery staple')
    ).resolves.toBeUndefined();

    expect(request).toHaveBeenCalledWith('/api/auth/password/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ loginId: '  member  ', password: 'correct horse battery staple' })
    });
  });

  it('does not hide a failed legacy login', async () => {
    await expect(
      loginLegacyPassword(
        async () =>
          new Response(JSON.stringify({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' }), {
            status: 401
          }),
        'member',
        'wrong password'
      )
    ).rejects.toThrow('아이디 또는 비밀번호가 올바르지 않습니다.');
  });
});
