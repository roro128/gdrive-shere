import { describe, expect, it } from 'vitest';
import {
  completeUpload,
  failUpload,
  retryUpload,
  updateUploadProgress
} from './upload-state-model';

describe('upload state model', () => {
  const item = {
    id: 'upload-1',
    progress: 40,
    status: 'uploading' as const,
    sessionId: 'session-1'
  };
  const other = { id: 'upload-2', progress: 10, status: 'uploading' as const };

  it('updates only the requested item and preserves the source list', () => {
    const items = [item, other];
    const next = updateUploadProgress(items, 'upload-1', 75, 'session-2');

    expect(next).toEqual([{ ...item, progress: 75, sessionId: 'session-2' }, other]);
    expect(items).toEqual([item, other]);
    expect(next[1]).toBe(other);
  });

  it('models completion, cancellation, failure, and retry transitions', () => {
    expect(completeUpload([item], 'upload-1')[0]).toEqual({
      ...item,
      progress: 100,
      status: 'complete',
      error: undefined
    });
    expect(failUpload([item], 'upload-1', true, 'aborted')[0].status).toBe('cancelled');
    expect(failUpload([item], 'upload-1', false, 'network')[0]).toMatchObject({
      status: 'error',
      error: 'network'
    });
    expect(
      retryUpload([{ ...item, progress: 100, status: 'error', error: 'network' }], 'upload-1')[0]
    ).toEqual({
      id: 'upload-1',
      progress: 0,
      status: 'uploading',
      error: undefined,
      sessionId: undefined
    });
  });

  it('leaves the list unchanged when the id is unknown', () => {
    const items = [item];
    expect(completeUpload(items, 'missing')).toEqual(items);
  });
});
