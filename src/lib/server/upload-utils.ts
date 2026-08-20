export const UPLOAD_CHUNK_SIZE = 8 * 1024 * 1024;

export interface ByteRange {
  start: number;
  end: number;
  total: number;
}

export function parseByteRange(value: string): ByteRange | null {
  const match = /^bytes\s+(\d+)-(\d+)\/(\d+)$/.exec(value.trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || !Number.isSafeInteger(total))
    return null;
  if (start < 0 || end < start || total <= end) return null;
  return { start, end, total };
}

export function completedBytesFromRange(value: string | null): number | null {
  if (!value) return null;
  const match = /^bytes=0-(\d+)$/.exec(value.trim());
  if (!match) return null;
  const end = Number(match[1]);
  return Number.isSafeInteger(end) && end >= 0 ? end + 1 : null;
}

export type UploadChunkValidation =
  | { valid: true; contentLength: number; range: ByteRange | null }
  | { valid: false; status: 400 | 413; message: string };

export function validateUploadChunk(
  contentLength: string | null,
  contentRange: string | null,
  totalBytes: number
): UploadChunkValidation {
  if (!contentLength || (totalBytes > 0 && !contentRange))
    return { valid: false, status: 400, message: 'Content-Length와 Content-Range가 필요합니다.' };

  const length = Number(contentLength);
  if (!Number.isSafeInteger(length) || length < 0)
    return { valid: false, status: 400, message: 'Content-Length가 올바르지 않습니다.' };
  if (length > UPLOAD_CHUNK_SIZE)
    return { valid: false, status: 413, message: '업로드 청크가 너무 큽니다.' };

  const range = contentRange ? parseByteRange(contentRange) : null;
  if (totalBytes > 0) {
    if (
      !range ||
      range.total !== totalBytes ||
      range.end - range.start + 1 !== length ||
      range.end >= totalBytes
    )
      return {
        valid: false,
        status: 400,
        message: 'Content-Range가 업로드 세션과 일치하지 않습니다.'
      };
  } else if (length !== 0 || contentRange) {
    return {
      valid: false,
      status: 400,
      message: '빈 파일 업로드에는 비어 있는 본문만 사용할 수 있습니다.'
    };
  }

  return { valid: true, contentLength: length, range };
}

export function retryDelay(attempt: number): number {
  return Math.min(10_000, 250 * 2 ** Math.max(0, attempt));
}
