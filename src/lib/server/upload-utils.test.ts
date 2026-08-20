import { describe, expect, it } from 'vitest';
import {
  completedBytesFromRange,
  parseByteRange,
  retryDelay,
  UPLOAD_CHUNK_SIZE,
  validateUploadChunk
} from './upload-utils';

describe('upload range helpers', () => {
  it('parses a valid Drive range', () => {
    expect(parseByteRange(`bytes 0-${UPLOAD_CHUNK_SIZE - 1}/20000000`)).toEqual({
      start: 0,
      end: UPLOAD_CHUNK_SIZE - 1,
      total: 20_000_000
    });
  });

  it('rejects malformed and overlapping ranges', () => {
    expect(parseByteRange('bytes 1-0/10')).toBeNull();
    expect(parseByteRange('bytes 0-10/*')).toBeNull();
    expect(parseByteRange('bytes 0-10/10')).toBeNull();
  });

  it('reads the next byte from a Google Range header', () => {
    expect(completedBytesFromRange('bytes=0-8388607')).toBe(8388608);
    expect(completedBytesFromRange(null)).toBeNull();
  });

  it('caps exponential retry delays', () => {
    expect(retryDelay(0)).toBe(250);
    expect(retryDelay(10)).toBe(10_000);
  });

  it('rejects chunks that do not match the upload session or exceed the server limit', () => {
    expect(validateUploadChunk('5', 'bytes 0-4/10', 10)).toMatchObject({
      valid: true,
      contentLength: 5
    });
    expect(validateUploadChunk('4', 'bytes 0-4/10', 10)).toMatchObject({
      valid: false,
      status: 400
    });
    expect(
      validateUploadChunk(String(UPLOAD_CHUNK_SIZE + 1), 'bytes 0-8388608/10000000', 10_000_000)
    ).toMatchObject({
      valid: false,
      status: 413
    });
    expect(validateUploadChunk('0', null, 0)).toMatchObject({ valid: true, contentLength: 0 });
  });
});
