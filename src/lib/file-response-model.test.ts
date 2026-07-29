import { describe, expect, it } from 'vitest';
import { buildFileResponseHeaders } from './file-response-model';

describe('file response model', () => {
  it('builds download headers with a safe MIME fallback and encoded filename', () => {
    expect(buildFileResponseHeaders('', '보고서 1.pdf', 'attachment')).toEqual({
      'content-type': 'application/octet-stream',
      'content-disposition': "attachment; filename*=UTF-8''%EB%B3%B4%EA%B3%A0%EC%84%9C%201.pdf",
      'cache-control': 'private, no-store'
    });
  });

  it('builds inline preview headers without mutating input values', () => {
    const fileName = 'image.png';
    expect(buildFileResponseHeaders('image/png', fileName, 'inline')).toEqual({
      'content-type': 'image/png',
      'content-disposition': "inline; filename*=UTF-8''image.png",
      'cache-control': 'private, no-store'
    });
    expect(fileName).toBe('image.png');
  });
});
