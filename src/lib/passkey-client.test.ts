import { describe, expect, it, vi } from 'vitest';
import { createPasskeyRegistrationContext, deletePasskey } from './passkey-client';

describe('passkey client', () => {
  it('builds registration and deletion requests', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await createPasskeyRegistrationContext(request);
    await deletePasskey(request, 'passkey-1');

    expect(request.mock.calls).toEqual([
      ['/api/me/passkeys', { method: 'POST' }],
      ['/api/me/passkeys/passkey-1', { method: 'DELETE' }]
    ]);
  });

  it('returns a non-ok response for the caller error policy', async () => {
    const response = new Response(JSON.stringify({ message: '패스키를 찾을 수 없습니다.' }), {
      status: 404
    });
    const request = vi.fn().mockResolvedValue(response);

    await expect(deletePasskey(request, 'missing')).resolves.toBe(response);
  });
});
