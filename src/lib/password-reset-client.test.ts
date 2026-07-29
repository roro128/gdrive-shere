import { describe, expect, it } from 'vitest';
import { fetchPasswordResetContext } from './password-reset-client';

describe('password reset client', () => {
  it('builds deterministic mock context without a request', async () => {
    let requested = false;
    await expect(
      fetchPasswordResetContext({
        token: 'mock-member',
        mock: true,
        request: async () => {
          requested = true;
          return new Response(null, { status: 500 });
        }
      })
    ).resolves.toEqual({ valid: true, handle: 'member', loginId: 'member' });
    expect(requested).toBe(false);
  });

  it('encodes the token and returns the remote context shape', async () => {
    await expect(
      fetchPasswordResetContext({
        token: 'token with spaces',
        mock: false,
        request: async (input) => {
          expect(input).toBe('/api/auth/password/reset-context?token=token%20with%20spaces');
          return new Response(JSON.stringify({ valid: false }), { status: 200 });
        }
      })
    ).resolves.toEqual({ valid: false });
  });

  it('leaves transport failures visible to the route effect boundary', async () => {
    await expect(
      fetchPasswordResetContext({
        token: 'token',
        mock: false,
        request: async () => {
          throw new Error('network down');
        }
      })
    ).rejects.toThrow('network down');
  });
});
