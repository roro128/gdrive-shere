import { describe, expect, it } from 'vitest';
import {
  buildMockResetLink,
  membersOnly,
  mergeGeneratedResetLink,
  updateMemberStatus,
  updateResetRequestLink
} from './member-management';

describe('member management list', () => {
  it('does not expose administrator accounts in the member controls', () => {
    const users = [
      { id: 'admin', role: 'admin' },
      { id: 'member', role: 'member' },
      { id: 'pending', role: 'member', status: 'pending' }
    ];

    expect(membersOnly(users)).toEqual([
      { id: 'member', role: 'member' },
      { id: 'pending', role: 'member', status: 'pending' }
    ]);
  });

  it('updates only the requested member status without mutating the list', () => {
    const users = [
      { id: 'u-1', status: 'active' },
      { id: 'u-2', status: 'active' }
    ];
    expect(updateMemberStatus(users, 'u-1', 'disabled')).toEqual([
      { id: 'u-1', status: 'disabled' },
      { id: 'u-2', status: 'active' }
    ]);
    expect(updateMemberStatus(users, 'missing', 'disabled')).toEqual(users);
    expect(users[0].status).toBe('active');
  });

  it('updates reset request links and merges generated links immutably', () => {
    const requests = [
      { id: 'r-1', status: 'pending' },
      { id: 'r-2', status: 'pending' }
    ];
    expect(updateResetRequestLink(requests, 'r-1', '/reset/1', 'tomorrow')).toEqual([
      { id: 'r-1', status: 'link_created', link: '/reset/1', expires_at: 'tomorrow' },
      { id: 'r-2', status: 'pending' }
    ]);
    const links = { 'u-1': { link: '/reset/1' } };
    expect(mergeGeneratedResetLink(links, 'u-2', { link: '/reset/2' })).toEqual({
      'u-1': { link: '/reset/1' },
      'u-2': { link: '/reset/2' }
    });
    expect(links).toEqual({ 'u-1': { link: '/reset/1' } });
  });

  it('builds deterministic mock reset links without reading browser time', () => {
    expect(buildMockResetLink('https://gshare.test', 'user-1', 0)).toEqual({
      link: 'https://gshare.test/reset/mock-user-1?mock=1',
      expiresAt: '1970-01-01T01:00:00.000Z'
    });
  });
});
