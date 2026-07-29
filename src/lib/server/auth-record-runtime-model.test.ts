import { describe, expect, it } from 'vitest';
import { buildLegacySessionRecord } from './auth-record-model';

describe('auth record runtime model', () => {
  it('builds a deterministic legacy session record', () => {
    expect(
      buildLegacySessionRecord(
        { userId: 'user-1', tokenHash: 'hash', ttlSeconds: 60 },
        { now: () => '2026-07-29T00:00:00.000Z', newId: () => 'session-1' }
      )
    ).toEqual({
      id: 'session-1',
      user_id: 'user-1',
      token_hash: 'hash',
      expires_at: '2026-07-29T00:01:00.000Z',
      created_at: '2026-07-29T00:00:00.000Z'
    });
  });
});
