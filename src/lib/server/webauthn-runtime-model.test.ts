import { describe, expect, it } from 'vitest';
import { buildWebAuthnChallengeRecord } from './webauthn-model';

describe('webauthn runtime model', () => {
  it('builds a deterministic expiring challenge record', () => {
    expect(
      buildWebAuthnChallengeRecord(
        {
          userId: 'user-1',
          challenge: 'challenge',
          kind: 'authentication',
          ttlMs: 5 * 60 * 1000
        },
        {
          now: () => '2026-07-29T00:00:00.000Z',
          newId: () => 'challenge-1'
        }
      )
    ).toEqual({
      id: 'challenge-1',
      user_id: 'user-1',
      challenge: 'challenge',
      kind: 'authentication',
      expires_at: '2026-07-29T00:05:00.000Z',
      created_at: '2026-07-29T00:00:00.000Z'
    });
  });
});
