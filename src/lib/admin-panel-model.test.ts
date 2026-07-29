import { describe, expect, it } from 'vitest';
import { adminPanelReducer, initialAdminPanelState } from './admin-panel-model';

type User = { id: string; status: string };
type Request = { id: string; link?: string };
type Link = { link: string };

describe('admin panel reducer', () => {
  it('copies collections and keeps generated links immutable', () => {
    const users = [{ id: 'user-1', status: 'active' }];
    const requests = [{ id: 'request-1' }];
    const opened = adminPanelReducer(initialAdminPanelState<User, Request, Link>(), {
      type: 'open'
    });
    const next = adminPanelReducer(
      adminPanelReducer(adminPanelReducer(opened, { type: 'set-users', users }), {
        type: 'set-reset-requests',
        requests
      }),
      { type: 'set-generated-link', memberId: 'user-1', link: { link: '/reset' } }
    );

    expect(next.users).toEqual(users);
    expect(next.resetRequests).toEqual(requests);
    expect(next.generatedResetLinks).toEqual({ 'user-1': { link: '/reset' } });
    expect(next.users).not.toBe(users);
  });

  it('updates only the requested member and reset request', () => {
    const state = {
      ...initialAdminPanelState<User, Request, Link>(),
      users: [
        { id: 'user-1', status: 'active' },
        { id: 'user-2', status: 'active' }
      ],
      resetRequests: [{ id: 'request-1' }, { id: 'request-2' }]
    };
    const next = adminPanelReducer(
      adminPanelReducer(state, {
        type: 'update-member-status',
        memberId: 'user-2',
        status: 'disabled'
      }),
      {
        type: 'update-reset-request',
        requestId: 'request-1',
        update: (request) => ({ ...request, link: '/reset' })
      }
    );

    expect(next.users).toEqual([
      { id: 'user-1', status: 'active' },
      { id: 'user-2', status: 'disabled' }
    ]);
    expect(next.resetRequests).toEqual([{ id: 'request-1', link: '/reset' }, { id: 'request-2' }]);
    expect(state.users[1].status).toBe('active');
  });
});
