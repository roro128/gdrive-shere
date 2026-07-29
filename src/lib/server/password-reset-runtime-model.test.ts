import { describe, expect, it } from 'vitest';
import {
  buildPasswordResetLinkPlan,
  buildPendingPasswordResetRequest
} from './password-reset-model';

describe('password reset runtime model', () => {
  const runtime = {
    now: () => '2026-07-29T00:00:00.000Z',
    newId: () => 'generated-id'
  };

  it('builds a deterministic pending request from injected runtime values', () => {
    expect(buildPendingPasswordResetRequest('user-1', runtime)).toMatchObject({
      id: 'generated-id',
      user_id: 'user-1',
      status: 'pending',
      created_at: '2026-07-29T00:00:00.000Z'
    });
  });

  it('builds one consistent link plan with created and expiration times', () => {
    expect(
      buildPasswordResetLinkPlan(
        {
          requestId: 'request-1',
          userId: 'user-1',
          tokenHash: 'hash',
          createdBy: 'admin-1',
          ttlMs: 60 * 60 * 1000
        },
        runtime
      )
    ).toEqual({
      createdAt: '2026-07-29T00:00:00.000Z',
      expiresAt: '2026-07-29T01:00:00.000Z',
      record: {
        id: 'generated-id',
        request_id: 'request-1',
        user_id: 'user-1',
        token_hash: 'hash',
        expires_at: '2026-07-29T01:00:00.000Z',
        created_by: 'admin-1',
        created_at: '2026-07-29T00:00:00.000Z'
      }
    });
  });
});
