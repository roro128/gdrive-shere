import { describe, expect, it } from 'vitest';
import { buildQueuedAccountDeletionJob } from './account-deletion-model';

describe('account deletion runtime model', () => {
  it('builds a deterministic queued job from injected runtime values', () => {
    expect(
      buildQueuedAccountDeletionJob('user-1', {
        now: () => '2026-07-29T00:00:00.000Z',
        newId: () => 'job-1'
      })
    ).toEqual({
      id: 'job-1',
      user_id: 'user-1',
      status: 'queued',
      created_at: '2026-07-29T00:00:00.000Z',
      updated_at: '2026-07-29T00:00:00.000Z'
    });
  });
});
