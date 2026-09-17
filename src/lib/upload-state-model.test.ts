import { describe, expect, it } from 'vitest';
import {
  clearCompletedUploads,
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

  it('filters out completed uploads and preserves active, error, or cancelled uploads', () => {
    const items = [
      { id: '1', progress: 100, status: 'complete' as const },
      { id: '2', progress: 50, status: 'uploading' as const },
      { id: '3', progress: 0, status: 'error' as const },
      { id: '4', progress: 20, status: 'cancelled' as const }
    ];
    expect(clearCompletedUploads(items).map((x) => x.id)).toEqual(['2', '3', '4']);
  });
});
