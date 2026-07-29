import { describe, expect, it } from 'vitest';
import { buildInvitationRecord } from './auth-record-model';

describe('invitation runtime model', () => {
  it('builds a deterministic invitation record with a bounded TTL', () => {
    expect(
      buildInvitationRecord(
        { tokenHash: 'hash', role: 'member', ttlMs: 24 * 60 * 60 * 1000 },
        { now: () => '2026-07-29T00:00:00.000Z', newId: () => 'invitation-1' }
      )
    ).toEqual({
      id: 'invitation-1',
      tokenHash: 'hash',
      role: 'member',
      expiresAt: '2026-07-30T00:00:00.000Z',
      createdAt: '2026-07-29T00:00:00.000Z'
    });
  });
});
