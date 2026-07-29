import { describe, expect, it } from 'vitest';
import { completedUploadOutcome, failedUploadOutcome } from './upload-lifecycle-model';

describe('upload lifecycle model', () => {
  it('returns a refresh command after completion', () => {
    expect(completedUploadOutcome()).toEqual({ type: 'completed', refresh: true });
  });

  it('normalizes error and cancellation outcomes without throwing', () => {
    expect(failedUploadOutcome(new Error('네트워크 오류'), false)).toEqual({
      type: 'failed',
      cancelled: false,
      error: '네트워크 오류',
      refresh: false
    });
    expect(failedUploadOutcome('unknown', true)).toEqual({
      type: 'failed',
      cancelled: true,
      error: '업로드 실패',
      refresh: false
    });
  });
});
