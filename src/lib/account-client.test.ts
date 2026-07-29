import { describe, expect, it } from 'vitest';
import { requestAccountDeletion } from './account-client';

describe('account client', () => {
  it('posts the deletion acknowledgement through an injected request', async () => {
    const acknowledged = { files: true, shares: true, passkeys: true };
    await expect(
      requestAccountDeletion({
        confirmation: '계정 삭제',
        acknowledged,
        request: async (input, init) => {
          expect(input).toBe('/api/me/deletion');
          expect(init?.method).toBe('POST');
          expect(init?.body).toBe(JSON.stringify({ confirmation: '계정 삭제', acknowledged }));
          return new Response(null, { status: 202 });
        }
      })
    ).resolves.toBeUndefined();
  });

  it('surfaces server and transport failures', async () => {
    await expect(
      requestAccountDeletion({
        confirmation: 'wrong',
        acknowledged: { files: false, shares: false, passkeys: false },
        request: async () => new Response(JSON.stringify({ message: 'not ready' }), { status: 400 })
      })
    ).rejects.toThrow('not ready');
    await expect(
      requestAccountDeletion({
        confirmation: '계정 삭제',
        acknowledged: { files: true, shares: true, passkeys: true },
        request: async () => {
          throw new Error('offline');
        }
      })
    ).rejects.toThrow('offline');
  });
});
