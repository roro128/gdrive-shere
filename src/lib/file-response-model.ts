export type FileResponseDisposition = 'attachment' | 'inline';

export function buildFileResponseHeaders(
  mimeType: string | null | undefined,
  fileName: string,
  disposition: FileResponseDisposition
): Record<string, string> {
  return {
    'content-type': mimeType || 'application/octet-stream',
    'content-disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    'cache-control': 'private, no-store'
  };
}
