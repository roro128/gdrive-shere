export type UploadChunk = {
  start: number;
  end: number;
  contentRange?: string;
};

export type UploadChunkRequest = UploadChunk & {
  headers: Readonly<Record<string, string>>;
};

export type UploadSessionPayload = {
  name: string;
  mimeType: string;
  size: number;
  parentId: string | null;
  conflictAction?: 'replace' | 'overwrite';
  existingFileId?: string;
};

export function buildUploadSessionPayload(input: {
  name: string;
  type: string;
  size: number;
  parentId: string | null;
  conflictAction?: 'replace' | 'overwrite';
  existingFileId?: string;
}): UploadSessionPayload {
  return {
    name: input.name,
    mimeType: input.type || 'application/octet-stream',
    size: input.size,
    parentId: input.parentId,
    conflictAction: input.conflictAction,
    existingFileId: input.existingFileId
  };
}

export function getUploadChunk(fileSize: number, offset: number, chunkSize: number): UploadChunk {
  const end = fileSize === 0 ? 0 : Math.min(offset + chunkSize, fileSize);
  return {
    start: offset,
    end,
    ...(fileSize > 0 ? { contentRange: `bytes ${offset}-${end - 1}/${fileSize}` } : {})
  };
}

export function buildUploadChunkRequest(
  fileSize: number,
  offset: number,
  chunkSize: number,
  chunkSizeBytes: number
): UploadChunkRequest {
  const chunk = getUploadChunk(fileSize, offset, chunkSize);
  return {
    ...chunk,
    headers: {
      'content-length': String(chunkSizeBytes),
      ...(chunk.contentRange ? { 'content-range': chunk.contentRange } : {})
    }
  };
}

export function uploadProgress(fileSize: number, end: number): number {
  return fileSize > 0 ? Math.round((end / fileSize) * 100) : 100;
}

export function shouldRetryUploadResponse(
  status: number,
  attempt: number,
  maxAttempts = 3
): boolean {
  return status >= 500 && attempt < maxAttempts - 1;
}

export function uploadRetryDelay(attempt: number): number {
  return Math.min(10_000, 250 * 2 ** Math.max(0, attempt));
}
