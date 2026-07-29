import { describe, expect, it } from 'vitest';
import { fetchProfilePasskeys, patchProfile } from './profile-client';

describe('profile client', () => {
  it('reads passkeys and patches a profile through injected requests', async () => {
    const passkeys = [{ id: 'passkey-1' }];
    await expect(
      fetchProfilePasskeys(async (input) => {
        expect(input).toBe('/api/me/passkeys');
        return new Response(JSON.stringify({ passkeys }), { status: 200 });
      })
    ).resolves.toEqual(passkeys);

    await expect(
      patchProfile({
        body: { handle: 'member' },
        request: async (input, init) => {
          expect(input).toBe('/api/me');
          expect(init?.method).toBe('PATCH');
          expect(init?.body).toBe(JSON.stringify({ handle: 'member' }));
          return new Response(JSON.stringify({ user: { handle: 'member' } }), { status: 200 });
        }
      })
    ).resolves.toEqual({ handle: 'member' });
  });

  it('turns failed profile responses into descriptive errors', async () => {
    await expect(
      fetchProfilePasskeys(
        async () => new Response(JSON.stringify({ message: 'profile failed' }), { status: 500 })
      )
    ).rejects.toThrow('profile failed');
    await expect(
      patchProfile({
        body: {},
        request: async () => new Response('plain failure', { status: 400 })
      })
    ).rejects.toThrow('plain failure');
  });
});
