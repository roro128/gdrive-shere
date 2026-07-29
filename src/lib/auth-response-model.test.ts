import { describe, expect, it } from 'vitest';
import { toAdminUserResponse, toAuthUserResponse } from './auth-response-model';

describe('auth response model', () => {
  it('maps the administrator user list response without mutating the row', () => {
    const user = {
      id: 'user-1',
      display_name: 'Ada',
      handle: null,
      login_id: 'ada-login',
      role: 'member',
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z'
    };
    expect(toAdminUserResponse(user)).toEqual({
      id: 'user-1',
      displayName: 'Ada',
      handle: 'ada-login',
      role: 'member',
      loginId: 'ada-login',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    });
    expect(user.status).toBe('active');
  });
  it('maps the preferred handle and falls back to login id', () => {
    expect(
      toAuthUserResponse({
        id: 'user-1',
        display_name: 'Ada',
        handle: 'ada',
        login_id: 'ada-login',
        role: 'member'
      })
    ).toEqual({ id: 'user-1', displayName: 'Ada', handle: 'ada', role: 'member' });
    expect(
      toAuthUserResponse({
        id: 'user-2',
        display_name: 'Grace',
        handle: null,
        login_id: 'grace-login',
        role: 'member'
      }).handle
    ).toBe('grace-login');
  });

  it('returns null when neither identifier exists and does not mutate input', () => {
    const user = {
      id: 'user-3',
      display_name: 'Lin',
      handle: null,
      login_id: null,
      role: 'admin' as const
    };
    expect(toAuthUserResponse(user)).toEqual({
      id: 'user-3',
      displayName: 'Lin',
      handle: null,
      role: 'admin'
    });
    expect(user).toEqual({
      id: 'user-3',
      display_name: 'Lin',
      handle: null,
      login_id: null,
      role: 'admin'
    });
  });
});
