import { describe, expect, it } from 'vitest';
import {
  toPasswordResetContext,
  toPasswordResetLinkRecord,
  toPasswordResetLinkUsedUpdate,
  toPasswordResetRequestHandledUpdate,
  toAuthAccountPasswordUpdate,
  toPendingPasswordResetRequest,
  toUserPasswordUpdate,
  toPasswordResetRequestView,
  type PasswordResetLinkState
} from './password-reset-model';

describe('password reset model', () => {
  it('builds pending request and reset link records immutably', () => {
    expect(
      toPendingPasswordResetRequest({ id: 'request-1', userId: 'user-1', createdAt: 'created' })
    ).toEqual({
      id: 'request-1',
      user_id: 'user-1',
      status: 'pending',
      created_at: 'created',
      handled_at: null,
      handled_by: null
    });
    expect(
      toPasswordResetLinkRecord({
        id: 'link-1',
        requestId: 'request-1',
        userId: 'user-1',
        tokenHash: 'hash',
        expiresAt: 'expires',
        createdBy: 'admin-1',
        createdAt: 'created'
      })
    ).toEqual({
      id: 'link-1',
      request_id: 'request-1',
      user_id: 'user-1',
      token_hash: 'hash',
      expires_at: 'expires',
      created_by: 'admin-1',
      created_at: 'created'
    });
  });

  it('builds reset lifecycle update payloads with explicit statuses', () => {
    expect(toPasswordResetLinkUsedUpdate('used')).toEqual({ used_at: 'used' });
    expect(
      toPasswordResetRequestHandledUpdate({
        status: 'link_created',
        handledAt: 'handled',
        handledBy: 'admin-1'
      })
    ).toEqual({ status: 'link_created', handled_at: 'handled', handled_by: 'admin-1' });
    expect(
      toPasswordResetRequestHandledUpdate({ status: 'completed', handledAt: 'completed' })
    ).toEqual({ status: 'completed', handled_at: 'completed' });
    expect(toUserPasswordUpdate('hash', 'updated')).toEqual({
      password_hash: 'hash',
      updated_at: 'updated'
    });
    const updatedAt = new Date('2026-07-29T00:00:00.000Z');
    expect(toAuthAccountPasswordUpdate('hash', updatedAt)).toEqual({
      password: 'hash',
      updatedAt
    });
  });

  it('maps an administrator request row to an immutable response view', () => {
    const row = {
      request: { id: 'request-1', status: 'pending' },
      login_id: 'member',
      display_name: 'Member',
      expires_at: null
    };
    expect(toPasswordResetRequestView(row)).toEqual({
      id: 'request-1',
      status: 'pending',
      login_id: 'member',
      display_name: 'Member',
      expires_at: null
    });
    expect(row.request).toEqual({ id: 'request-1', status: 'pending' });
  });
  const link: PasswordResetLinkState = {
    used_at: null,
    expires_at: '2026-08-01T00:00:00.000Z',
    user_status: 'active',
    handle: null,
    login_id: 'member'
  };

  it('maps a valid link and falls back from handle to login id', () => {
    expect(toPasswordResetContext(link, '2026-07-31T00:00:00.000Z')).toEqual({
      valid: true,
      handle: 'member',
      loginId: 'member',
      expiresAt: '2026-08-01T00:00:00.000Z'
    });
  });

  it.each([
    { used_at: '2026-07-30T00:00:00.000Z' },
    { user_status: 'disabled' },
    { expires_at: '2026-07-30T00:00:00.000Z' }
  ])('rejects an unusable link state: %o', (update) => {
    expect(toPasswordResetContext({ ...link, ...update }, '2026-07-31T00:00:00.000Z')).toEqual({
      valid: false
    });
  });

  it('rejects a missing database row', () => {
    expect(toPasswordResetContext(null, '2026-07-31T00:00:00.000Z')).toEqual({ valid: false });
  });
});
