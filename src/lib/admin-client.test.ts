import { describe, expect, it, vi } from 'vitest';
import {
  createMemberInvitation,
  createMemberResetLink,
  createPasswordResetRequestLink,
  listMembers,
  listPasswordResetRequests,
  updateMemberStatus
} from './admin-client';

describe('admin client', () => {
  it('builds member invitation and collection requests', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await createMemberInvitation(request);
    await listMembers(request);
    await listPasswordResetRequests(request);

    expect(request.mock.calls).toEqual([
      [
        '/api/invitations',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ role: 'member' })
        }
      ],
      ['/api/users'],
      ['/api/password-reset-requests']
    ]);
  });

  it('builds member status and reset-link mutations', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await updateMemberStatus(request, 'user-1', 'disabled');
    await createMemberResetLink(request, 'user-1');
    await createPasswordResetRequestLink(request, 'request-1');

    expect(request.mock.calls).toEqual([
      [
        '/api/users',
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId: 'user-1', status: 'disabled' })
        }
      ],
      ['/api/users/user-1/password-reset-link', { method: 'POST' }],
      ['/api/password-reset-requests/request-1/link', { method: 'POST' }]
    ]);
  });

  it('returns non-ok responses so the UI can preserve its message policy', async () => {
    const response = new Response(JSON.stringify({ message: '관리자 권한이 필요합니다.' }), {
      status: 403
    });
    const request = vi.fn().mockResolvedValue(response);

    await expect(updateMemberStatus(request, 'user-1', 'active')).resolves.toBe(response);
  });
});
