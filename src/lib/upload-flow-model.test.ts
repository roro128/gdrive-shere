import { describe, expect, it } from 'vitest';
import {
  buildUploadSessionPayload,
  buildUploadChunkRequest,
  getUploadChunk,
  shouldRetryUploadResponse,
  uploadProgress,
  uploadRetryDelay
} from './upload-flow-model';

describe('upload flow model', () => {
  it('builds a stable upload session payload with a MIME fallback', () => {
    expect(
      buildUploadSessionPayload({
        name: 'sample.txt',
        type: '',
        size: 10,
        parentId: null,
        conflictAction: 'overwrite',
        existingFileId: 'file-1'
      })
    ).toEqual({
      name: 'sample.txt',
      mimeType: 'application/octet-stream',
      size: 10,
      parentId: null,
      conflictAction: 'overwrite',
      existingFileId: 'file-1'
    });
  });
  it('builds immutable chunk headers from the calculated range', () => {
    expect(buildUploadChunkRequest(10, 4, 8, 6)).toEqual({
      start: 4,
      end: 10,
      contentRange: 'bytes 4-9/10',
      headers: { 'content-length': '6', 'content-range': 'bytes 4-9/10' }
    });
  });

  it('uses bounded exponential retry delays', () => {
    expect(uploadRetryDelay(0)).toBe(250);
    expect(uploadRetryDelay(10)).toBe(10_000);
  });
  it('builds bounded byte ranges and handles empty files', () => {
    expect(getUploadChunk(10, 4, 8)).toEqual({
      start: 4,
      end: 10,
      contentRange: 'bytes 4-9/10'
    });
    expect(getUploadChunk(0, 0, 8)).toEqual({ start: 0, end: 0 });
  });

  it('calculates progress from the immutable chunk boundary', () => {
    expect(uploadProgress(10, 4)).toBe(40);
    expect(uploadProgress(0, 0)).toBe(100);
  });

  it('retries only transient responses before the final attempt', () => {
    expect(shouldRetryUploadResponse(503, 0)).toBe(true);
    expect(shouldRetryUploadResponse(503, 2)).toBe(false);
    expect(shouldRetryUploadResponse(409, 0)).toBe(false);
  });
});
