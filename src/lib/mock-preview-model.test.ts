import { describe, expect, it } from 'vitest';
import { buildMockPreviewSource } from './mock-preview-model';

describe('mock preview model', () => {
  it('builds an encoded text preview', () => {
    const source = buildMockPreviewSource({ name: '메모.txt', mimeType: 'text/plain' });
    expect(source).toBe(
      'data:text/plain;charset=utf-8,GShare%20mock%20preview%0A%EB%A9%94%EB%AA%A8.txt'
    );
  });

  it('builds an encoded SVG image preview', () => {
    const source = buildMockPreviewSource({ name: 'image.png', mimeType: 'image/png' });
    expect(source?.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(source?.split(',')[1] ?? '')).toContain('image.png');
  });

  it('does not provide a mock source for unsupported media', () => {
    expect(buildMockPreviewSource({ name: 'clip.mp4', mimeType: 'video/mp4' })).toBeNull();
  });
});
