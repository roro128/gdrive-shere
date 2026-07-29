import { describe, expect, it } from 'vitest';
import { initialUploadPanelState, uploadPanelReducer } from './upload-panel-model';

describe('uploadPanelReducer', () => {
  it('enqueues, progresses, completes, and retries without mutating state', () => {
    const initial = initialUploadPanelState<
      { id: string; progress: number; status: 'uploading' | 'complete' | 'error' | 'cancelled' },
      string
    >();
    const upload = { id: 'upload-1', progress: 0, status: 'uploading' as const };
    const queued = uploadPanelReducer(initial, { type: 'enqueue', upload });
    const progressed = uploadPanelReducer(queued, {
      type: 'progress',
      uploadId: 'upload-1',
      progress: 45,
      sessionId: 'session-1'
    });
    const completed = uploadPanelReducer(progressed, { type: 'complete', uploadId: 'upload-1' });
    const retried = uploadPanelReducer(completed, { type: 'retry', uploadId: 'upload-1' });
    const removed = uploadPanelReducer(retried, { type: 'remove', uploadId: 'upload-1' });

    expect(initial.uploads).toEqual([]);
    expect(queued.showTray).toBe(true);
    expect(progressed.uploads[0]).toMatchObject({ progress: 45, sessionId: 'session-1' });
    expect(completed.uploads[0]).toMatchObject({ progress: 100, status: 'complete' });
    expect(retried.uploads[0]).toMatchObject({ progress: 0, status: 'uploading' });
    expect(removed.uploads).toEqual([]);
  });

  it('appends conflicts and replaces them immutably', () => {
    const initial = initialUploadPanelState<
      { id: string; progress: number; status: 'uploading' | 'complete' | 'error' | 'cancelled' },
      string
    >();
    const one = uploadPanelReducer(initial, { type: 'append-conflicts', conflicts: ['one'] });
    const two = uploadPanelReducer(one, { type: 'append-conflicts', conflicts: ['two'] });
    const cleared = uploadPanelReducer(two, { type: 'set-conflicts', conflicts: [] });

    expect(one.conflicts).toEqual(['one']);
    expect(two.conflicts).toEqual(['one', 'two']);
    expect(cleared.conflicts).toEqual([]);
    expect(two.conflicts).not.toBe(cleared.conflicts);
  });
});
