import { describe, expect, it, vi } from 'vitest';
import {
  fetchFolderShares,
  listShareInvitations,
  respondToShareInvitation,
  saveFolderShares
} from './share-client';

describe('share client', () => {
  it('builds invitation list and response requests', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await listShareInvitations(request);
    await respondToShareInvitation(request, 'invitation-1', true);

    expect(request.mock.calls).toEqual([
      ['/api/share-invitations'],
      [
        '/api/share-invitations',
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ invitationId: 'invitation-1', accept: true })
        }
      ]
    ]);
  });

  it('builds folder share reads and writes without consuming the response', async () => {
    const response = new Response(JSON.stringify({ shares: [] }), { status: 200 });
    const request = vi.fn().mockResolvedValue(response);
    const users = [{ userId: 'user-1', permission: 'editor' as const }];

    await expect(fetchFolderShares(request, 'folder-1')).resolves.toBe(response);
    await expect(saveFolderShares(request, 'folder-1', users)).resolves.toBe(response);

    expect(request.mock.calls[1]).toEqual([
      '/api/folders/folder-1/shares',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ users })
      }
    ]);
  });

  it('preserves non-ok responses for the caller error policy', async () => {
    const response = new Response(JSON.stringify({ message: '공유 권한이 없습니다.' }), {
      status: 403
    });
    const request = vi.fn().mockResolvedValue(response);

    await expect(saveFolderShares(request, 'folder-1', [])).resolves.toBe(response);
  });
});
