export type FileResponseDisposition = 'attachment' | 'inline';

export function buildFileResponseHeaders(
  mimeType: string | null | undefined,
  fileName: string,
  disposition: FileResponseDisposition
): Record<string, string> {
  const hasControlCharacter =
    mimeType !== null &&
    mimeType !== undefined &&
    [...mimeType].some((character) => {
      const code = character.charCodeAt(0);
      return code < 0x20 || code === 0x7f;
    });
  const safeMimeType = mimeType && !hasControlCharacter ? mimeType : null;
  const contentType =
    disposition === 'inline' && safeMimeType?.toLowerCase().startsWith('text/')
      ? 'text/plain; charset=utf-8'
      : safeMimeType || 'application/octet-stream';
  return {
    'content-type': contentType,
    'content-disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    'x-content-type-options': 'nosniff',
    'cache-control': 'private, no-store'
  };
}
