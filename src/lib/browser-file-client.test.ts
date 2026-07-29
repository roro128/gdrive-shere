import { describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard, readFileAsDataUrl } from './browser-file-client';

describe('browser file client', () => {
  it('reads a file as a data URL through an injected FileReader', async () => {
    const reader = {
      result: 'data:image/png;base64,abc',
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      readAsDataURL: vi.fn(() => reader.onload?.())
    };

    await expect(readFileAsDataUrl(new Blob(['image']), () => reader)).resolves.toBe(
      'data:image/png;base64,abc'
    );
    expect(reader.readAsDataURL).toHaveBeenCalled();
  });

  it('rejects when the browser reader reports an error', async () => {
    const reader = {
      result: null,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      readAsDataURL: vi.fn(() => reader.onerror?.())
    };

    await expect(readFileAsDataUrl(new Blob(['invalid']), () => reader)).rejects.toThrow(
      '파일을 읽지 못했습니다.'
    );
  });

  it('copies text and reports unsupported or rejected clipboard APIs', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(copyTextToClipboard('https://example.test', { writeText })).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://example.test');
    await expect(copyTextToClipboard('text', undefined)).resolves.toBe(false);
    await expect(
      copyTextToClipboard('text', { writeText: vi.fn().mockRejectedValue(new Error('denied')) })
    ).resolves.toBe(false);
  });
});
