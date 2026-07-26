import { describe, expect, it } from 'vitest';
import {
  completedBytesFromRange,
  parseByteRange,
  retryDelay,
  UPLOAD_CHUNK_SIZE
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
});
