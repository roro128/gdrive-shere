import { describe, expect, it } from 'vitest';
import {
  accountDeletionErrorMessage,
  buildProcessingAccountDeletionJob,
  buildRetryAccountDeletionJob,
  isMissingDriveFileError,
  toDisabledUserUpdate,
  toProcessingAccountDeletionJob,
  toQueuedAccountDeletionJob,
  toRetryAccountDeletionJob
} from './account-deletion-model';

describe('account deletion error model', () => {
  it('treats a missing Drive file as already deleted', () => {
    expect(isMissingDriveFileError(new Error('Google API 404: not found'))).toBe(true);
    expect(isMissingDriveFileError(new Error('Google API 500: unavailable'))).toBe(false);
    expect(isMissingDriveFileError('Google API 404: not found')).toBe(false);
  });

  it('bounds retry messages and provides a stable fallback', () => {
    expect(accountDeletionErrorMessage(new Error('x'.repeat(600)))).toHaveLength(500);
    expect(accountDeletionErrorMessage('unknown')).toBe('cleanup failed');
  });

  it('builds immutable queue and retry state payloads', () => {
    expect(
      toQueuedAccountDeletionJob({ id: 'job-1', userId: 'user-1', createdAt: 'created' })
    ).toEqual({
      id: 'job-1',
      user_id: 'user-1',
      status: 'queued',
      created_at: 'created',
      updated_at: 'created'
    });
    expect(toProcessingAccountDeletionJob('processing')).toEqual({
      status: 'processing',
      updated_at: 'processing',
      last_error: null
    });
    expect(toRetryAccountDeletionJob('retry', 'failed')).toEqual({
      status: 'queued',
      updated_at: 'retry',
      last_error: 'failed'
    });
    expect(toDisabledUserUpdate('disabled')).toEqual({
      status: 'disabled',
      updated_at: 'disabled'
    });
  });

  it('injects clock effects for processing and retry transitions', () => {
    const runtime = { now: () => '2026-07-29T00:00:00.000Z', newId: () => 'job-1' };
    expect(buildProcessingAccountDeletionJob(runtime)).toEqual({
      status: 'processing',
      updated_at: '2026-07-29T00:00:00.000Z',
      last_error: null
    });
    expect(buildRetryAccountDeletionJob('Drive failed', runtime)).toEqual({
      status: 'queued',
      updated_at: '2026-07-29T00:00:00.000Z',
      last_error: 'Drive failed'
    });
  });
});
