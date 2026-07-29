export type MockPreviewFile = {
  name: string;
  mimeType: string;
};

export function buildMockPreviewSource(file: MockPreviewFile): string | null {
  if (file.mimeType.startsWith('text/')) {
    return `data:text/plain;charset=utf-8,${encodeURIComponent(`GShare mock preview\n${file.name}`)}`;
  }
  if (file.mimeType.startsWith('image/')) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#1b1713"/><text x="32" y="185" fill="#e8aa70" font-family="sans-serif" font-size="28">${file.name}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  return null;
}
