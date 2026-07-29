import { describe, expect, it } from 'vitest';
import { interpretWorkspaceFilesResponse, isAbortError } from './workspace-load-model';

describe('workspace load model', () => {
  it('turns unauthorized responses into a session command', () => {
    expect(
      interpretWorkspaceFilesResponse({ status: 401, ok: false, files: [], message: 'expired' })
    ).toEqual({ type: 'unauthorized' });
  });

  it('preserves files and normalizes non-ok messages', () => {
    expect(
      interpretWorkspaceFilesResponse({ status: 500, ok: false, files: [{ id: 'file-1' }] })
    ).toEqual({
      type: 'files',
      files: [{ id: 'file-1' }],
      message: '파일을 불러오지 못했습니다.'
    });
    expect(
      interpretWorkspaceFilesResponse({ status: 200, ok: true, files: [{ id: 'file-1' }] })
    ).toEqual({ type: 'files', files: [{ id: 'file-1' }] });
  });

  it('recognizes abort errors without treating ordinary errors as cancellation', () => {
    expect(isAbortError(new DOMException('aborted', 'AbortError'))).toBe(true);
    expect(isAbortError(new Error('network down'))).toBe(false);
  });
});
