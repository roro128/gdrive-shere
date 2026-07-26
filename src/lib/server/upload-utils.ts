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

export function retryDelay(attempt: number): number {
  return Math.min(10_000, 250 * 2 ** Math.max(0, attempt));
}
