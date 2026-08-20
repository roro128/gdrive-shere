export type FileResponseDisposition = 'attachment' | 'inline';

export function buildFileResponseHeaders(
  mimeType: string | null | undefined,
  fileName: string,
  disposition: FileResponseDisposition
): Record<string, string> {
  const contentType =
    disposition === 'inline' && mimeType?.toLowerCase().startsWith('text/')
      ? 'text/plain; charset=utf-8'
      : mimeType || 'application/octet-stream';
  return {
    'content-type': contentType,
    'content-disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    'x-content-type-options': 'nosniff',
    'cache-control': 'private, no-store'
  };
}
