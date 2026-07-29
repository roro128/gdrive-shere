import { describe, expect, it } from 'vitest';
import {
  fetchCurrentUser,
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
        return new Response(JSON.stringify({ user: { id: 'user-1' }, googleConnected: 1 }), {
          status: 200
        });
      })
    ).resolves.toEqual({ user: { id: 'user-1' }, googleConnected: false });
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
});
